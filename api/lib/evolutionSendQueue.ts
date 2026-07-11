import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEvolutionTextByInstance } from "../../src/services/evolution.service.js";
import {
  assertWithinSendWindow,
  isWithinAllowedSendWindow,
  msUntilNextSendWindow,
  resolveSendDelayMs,
  resolveSendPriority,
  resolveSendCategory,
  type WhatsAppSendMeta,
} from "./whatsappAntiSpam.js";
import {
  assertPersistentGlobalQuota,
  waitForPersistentPhoneCooldown,
} from "./whatsappPersistentLimits.js";

export type WhatsAppQueueOptions = Partial<WhatsAppSendMeta> & {
  /** Cliente Supabase para cotas persistentes (recomendado em produção). */
  sb?: SupabaseClient;
  /** Pula verificação de janela horária (só OTP/crítico). */
  skipSendWindow?: boolean;
};

type QueueJob = {
  instanceName: string;
  phone: string;
  text: string;
  meta: WhatsAppSendMeta;
  sb?: SupabaseClient;
  skipSendWindow: boolean;
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
  sendWindowOpen: boolean;
};

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

const PHONE_COOLDOWN_MS = envInt("WA_SEND_PHONE_COOLDOWN_MS", 120_000);
const HOURLY_MAX = envInt("WA_SEND_HOURLY_MAX", 40);
const DAILY_MAX = envInt("WA_SEND_DAILY_MAX", 250);
const MAX_RETRIES = envInt("WA_SEND_MAX_RETRIES", 2);
const CIRCUIT_FAIL_THRESHOLD = envInt("WA_SEND_CIRCUIT_FAIL_THRESHOLD", 4);
const CIRCUIT_PAUSE_MS = envInt("WA_SEND_CIRCUIT_PAUSE_MS", 120_000);
const MAX_QUEUE_WAIT_MS = envInt("WA_SEND_MAX_QUEUE_WAIT_MS", 30 * 60_000);

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

function assertInMemoryGlobalQuota(): void {
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
    message.includes("temporar") ||
    message.includes("ban") ||
    message.includes("restrict")
  );
}

async function waitForCircuit(): Promise<void> {
  const now = Date.now();
  if (circuitOpenUntil > now) {
    await sleep(circuitOpenUntil - now);
  }
}

async function waitForSendSpacing(meta: WhatsAppSendMeta, phone: string): Promise<void> {
  const delay = resolveSendDelayMs(meta, `${phone}:${meta.batchIndex ?? 0}`);
  const elapsed = Date.now() - lastSendFinishedAt;
  if (elapsed < delay) {
    await sleep(delay - elapsed);
  }
}

async function waitForPhoneCooldown(phone: string, sb?: SupabaseClient): Promise<void> {
  if (sb) {
    await waitForPersistentPhoneCooldown(sb, phone);
    return;
  }
  if (PHONE_COOLDOWN_MS <= 0) return;
  const last = phoneLastSentAt.get(phone) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < PHONE_COOLDOWN_MS) {
    await sleep(PHONE_COOLDOWN_MS - elapsed);
  }
}

async function waitForSendWindow(skip: boolean, category: WhatsAppSendMeta["category"]): Promise<void> {
  if (skip || category === "critical") return;
  if (isWithinAllowedSendWindow()) return;
  const waitMs = msUntilNextSendWindow();
  if (waitMs <= 0) return;
  if (waitMs > MAX_QUEUE_WAIT_MS) {
    assertWithinSendWindow();
  }
  console.warn(`[WHATSAPP_QUEUE] aguardando janela de envio (${Math.round(waitMs / 60000)} min)`);
  await sleep(waitMs);
}

async function executeJob(job: QueueJob): Promise<{ messageId?: string }> {
  const waitMs = Date.now() - job.enqueuedAt;
  if (waitMs > MAX_QUEUE_WAIT_MS) {
    throw quotaError("WA_QUEUE_TIMEOUT", "Mensagem expirou na fila (muita demanda). Tente novamente.");
  }

  await waitForCircuit();
  await waitForSendWindow(job.skipSendWindow, job.meta.category);

  if (job.sb) {
    await assertPersistentGlobalQuota(job.sb);
  } else {
    assertInMemoryGlobalQuota();
  }

  await waitForSendSpacing(job.meta, job.phone);
  await waitForPhoneCooldown(job.phone, job.sb);

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

function sortQueueByPriority(): void {
  queue.sort((a, b) => {
    const pa = resolveSendPriority(a.meta.category);
    const pb = resolveSendPriority(b.meta.category);
    if (pa !== pb) return pa - pb;
    return a.enqueuedAt - b.enqueuedAt;
  });
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      sortQueueByPriority();
      const job = queue.shift();
      if (!job) break;

      try {
        const out = await executeJob(job);
        job.resolve(out);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (job.retries < MAX_RETRIES && isRetryableError(error)) {
          job.retries += 1;
          const backoff = Math.min(60_000, 3000 * 2 ** job.retries);
          console.warn(
            `[WHATSAPP_QUEUE] retry ${job.retries}/${MAX_RETRIES} (${job.meta.category}) → ${job.phone.slice(0, 4)}… em ${backoff}ms`
          );
          await sleep(backoff);
          queue.push(job);
          sortQueueByPriority();
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

function resolveJobMeta(options?: WhatsAppQueueOptions): WhatsAppSendMeta {
  const tipo = options?.tipo || "notification";
  return {
    category: options?.category || resolveSendCategory(tipo),
    tipo,
    tenantId: options?.tenantId,
    filhoId: options?.filhoId,
    batchIndex: options?.batchIndex,
    batchTotal: options?.batchTotal,
  };
}

/** Enfileira envio com prioridade, espaçamento humano, cooldown e cotas globais. */
export function sendEvolutionTextQueued(
  instanceName: string,
  phoneDigits: string,
  text: string,
  options?: WhatsAppQueueOptions
): Promise<{ messageId?: string }> {
  const phone = normalizePhone(phoneDigits);
  const body = String(text || "").trim();
  if (!phone) return Promise.reject(new Error("Número inválido para envio WhatsApp."));
  if (!body) return Promise.reject(new Error("Mensagem vazia."));

  const meta = resolveJobMeta(options);
  if (meta.category !== "critical" && !options?.skipSendWindow && !isWithinAllowedSendWindow()) {
    const waitMin = Math.ceil(msUntilNextSendWindow() / 60_000);
    console.warn(`[WHATSAPP_QUEUE] fora da janela (${meta.tipo}) — enfileirado, envio em ~${waitMin} min`);
  }

  return new Promise((resolve, reject) => {
    queue.push({
      instanceName,
      phone,
      text: body,
      meta,
      sb: options?.sb,
      skipSendWindow: Boolean(options?.skipSendWindow),
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
    sendWindowOpen: isWithinAllowedSendWindow(),
  };
}
