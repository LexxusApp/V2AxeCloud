import { sendEvolutionTextByInstance } from "../../src/services/evolution.service.js";

type QueueJob = {
  instanceName: string;
  phone: string;
  text: string;
  resolve: (value: { messageId?: string }) => void;
  reject: (error: Error) => void;
  retries: number;
  enqueuedAt: number;
};

export type EvolutionQueueStats = {
  pending: number;
  processing: boolean;
  sentLastHour: number;
  sentToday: number;
  consecutiveFailures: number;
  circuitOpenUntil: number | null;
};

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const MIN_DELAY_MS = envInt("WA_SEND_MIN_DELAY_MS", 3500);
const MAX_DELAY_MS = Math.max(MIN_DELAY_MS, envInt("WA_SEND_MAX_DELAY_MS", 8000));
const PHONE_COOLDOWN_MS = envInt("WA_SEND_PHONE_COOLDOWN_MS", 45000);
const HOURLY_MAX = envInt("WA_SEND_HOURLY_MAX", 70);
const DAILY_MAX = envInt("WA_SEND_DAILY_MAX", 450);
const MAX_RETRIES = envInt("WA_SEND_MAX_RETRIES", 2);
const CIRCUIT_FAIL_THRESHOLD = envInt("WA_SEND_CIRCUIT_FAIL_THRESHOLD", 4);
const CIRCUIT_PAUSE_MS = envInt("WA_SEND_CIRCUIT_PAUSE_MS", 90_000);

const queue: QueueJob[] = [];
let processing = false;
let lastSendFinishedAt = 0;
const phoneLastSentAt = new Map<string, number>();

let hourlyCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;
let dailyCount = 0;
let dailyResetAt = startOfNextUtcDay();

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function startOfNextUtcDay(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelayMs(): number {
  if (MAX_DELAY_MS <= MIN_DELAY_MS) return MIN_DELAY_MS;
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

function normalizePhone(phone: string): string {
  return String(phone).replace(/\D/g, "");
}

function quotaError(code: string, message: string): Error & { code: string; statusCode: number } {
  const err = new Error(message) as Error & { code: string; statusCode: number };
  err.code = code;
  err.statusCode = 429;
  return err;
}

function refreshQuotaWindows(): void {
  const now = Date.now();
  if (now >= hourlyResetAt) {
    hourlyCount = 0;
    hourlyResetAt = now + 60 * 60 * 1000;
  }
  if (now >= dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = startOfNextUtcDay();
  }
}

function assertGlobalQuota(): void {
  refreshQuotaWindows();
  if (hourlyCount >= HOURLY_MAX) {
    throw quotaError(
      "WA_QUOTA_HOURLY",
      "Limite horário de envios WhatsApp atingido. Tente novamente em alguns minutos."
    );
  }
  if (dailyCount >= DAILY_MAX) {
    throw quotaError(
      "WA_QUOTA_DAILY",
      "Limite diário de envios WhatsApp atingido. Tente novamente amanhã."
    );
  }
}

function isRetryableError(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("429") ||
    message.includes("rate") ||
    message.includes("temporar")
  );
}

async function waitForCircuit(): Promise<void> {
  const now = Date.now();
  if (circuitOpenUntil > now) {
    await sleep(circuitOpenUntil - now);
  }
}

async function waitForSendSpacing(): Promise<void> {
  const delay = jitterDelayMs();
  const elapsed = Date.now() - lastSendFinishedAt;
  if (elapsed < delay) {
    await sleep(delay - elapsed);
  }
}

async function waitForPhoneCooldown(phone: string): Promise<void> {
  if (PHONE_COOLDOWN_MS <= 0) return;
  const last = phoneLastSentAt.get(phone) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < PHONE_COOLDOWN_MS) {
    await sleep(PHONE_COOLDOWN_MS - elapsed);
  }
}

async function executeJob(job: QueueJob): Promise<{ messageId?: string }> {
  await waitForCircuit();
  assertGlobalQuota();
  await waitForSendSpacing();
  await waitForPhoneCooldown(job.phone);

  try {
    const out = await sendEvolutionTextByInstance(job.instanceName, job.phone, job.text);
    hourlyCount += 1;
    dailyCount += 1;
    consecutiveFailures = 0;
    phoneLastSentAt.set(job.phone, Date.now());
    lastSendFinishedAt = Date.now();
    return out;
  } catch (err) {
    consecutiveFailures += 1;
    lastSendFinishedAt = Date.now();
    if (consecutiveFailures >= CIRCUIT_FAIL_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_PAUSE_MS;
      consecutiveFailures = 0;
      console.warn(
        `[WHATSAPP_QUEUE] circuit breaker aberto por ${Math.round(CIRCUIT_PAUSE_MS / 1000)}s após falhas consecutivas`
      );
    }
    throw err;
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;

      try {
        const out = await executeJob(job);
        job.resolve(out);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (job.retries < MAX_RETRIES && isRetryableError(error)) {
          job.retries += 1;
          const backoff = Math.min(30_000, 2000 * 2 ** job.retries);
          console.warn(
            `[WHATSAPP_QUEUE] retry ${job.retries}/${MAX_RETRIES} para ${job.phone.slice(0, 4)}… em ${backoff}ms`
          );
          await sleep(backoff);
          queue.unshift(job);
          continue;
        }
        job.reject(error);
      }
    }
  } finally {
    processing = false;
    if (queue.length > 0) {
      void processQueue();
    }
  }
}

/** Enfileira envio serializado com espaçamento, cooldown por número e cotas globais. */
export function sendEvolutionTextQueued(
  instanceName: string,
  phoneDigits: string,
  text: string
): Promise<{ messageId?: string }> {
  const phone = normalizePhone(phoneDigits);
  const body = String(text || "").trim();
  if (!phone) return Promise.reject(new Error("Número inválido para envio WhatsApp."));
  if (!body) return Promise.reject(new Error("Mensagem vazia."));

  return new Promise((resolve, reject) => {
    queue.push({
      instanceName,
      phone,
      text: body,
      resolve,
      reject,
      retries: 0,
      enqueuedAt: Date.now(),
    });
    void processQueue();
  });
}

export function getEvolutionQueueStats(): EvolutionQueueStats {
  refreshQuotaWindows();
  return {
    pending: queue.length + (processing ? 1 : 0),
    processing,
    sentLastHour: hourlyCount,
    sentToday: dailyCount,
    consecutiveFailures,
    circuitOpenUntil: circuitOpenUntil > Date.now() ? circuitOpenUntil : null,
  };
}
