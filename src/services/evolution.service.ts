/**
 * Chamadas centralizadas à Evolution API (Baileys).
 * Instância única compartilhada: axecloud_console_admin — todos os terreiros enviam por ela.
 */
import { normalizeBrWhatsAppMsisdn } from "../lib/whatsappPhone";

export type MetaTemplateTextParam = { type: "text"; text: string };
export type MetaTemplateImageParam = { type: "image"; image: { link: string } };
export type MetaTemplateParameter = MetaTemplateTextParam | MetaTemplateImageParam;

export type MetaTemplateComponent = {
  type: "body" | "header" | "button";
  sub_type?: string;
  index?: string;
  parameters?: MetaTemplateParameter[];
};

export const WHATSAPP_INITIALIZING_MESSAGE_PT =
  "O serviço de mensageria está inicializando ou temporariamente indisponível. Aguarde um instante e tente novamente.";

/** Nome canónico da instância compartilhada AxéCloud (Baileys). */
export const CONSOLE_ADMIN_INSTANCE_NAME = "axecloud_console_admin";

function resolvedBaseUrl(): string {
  const raw = String(process.env.EVOLUTION_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function resolvedApiKey(): string {
  return String(process.env.EVOLUTION_API_KEY || "").trim();
}

const EVOLUTION_API_TIMEOUT_MS = 29000;
const EVOLUTION_PAIRING_TIMEOUT_MS = 55_000;
const EVOLUTION_STATUS_TIMEOUT_MS = 15000;
const EVOLUTION_COLD_START_RETRY_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEvolutionRequestTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string; message?: string };
  const message = String(err.message || "").toLowerCase();
  return (
    err.name === "AbortError" ||
    err.name === "TimeoutError" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ECONNABORTED" ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

function isEvolutionColdStartStatus(status: number): boolean {
  return status === 502 || status === 504;
}

function isInstanceAlreadyExists(status: number, data: unknown): boolean {
  if (status === 403 || status === 409) return true;
  if (status !== 400) return false;
  const text = summarizeBody(data).toLowerCase();
  return (
    text.includes("already") ||
    text.includes("em uso") ||
    text.includes("in use") ||
    text.includes("exists") ||
    text.includes("duplicate")
  );
}

function looksLikePairingCode(value: string): boolean {
  const compact = value.replace(/\s|-/g, "").toUpperCase();
  return compact.length >= 6 && compact.length <= 12 && /^[A-Z0-9]+$/.test(compact);
}

function pickQrBase64(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  for (const key of ["base64", "qrcode"]) {
    const v = d[key];
    if (typeof v === "string" && v.length > 40) {
      return v.startsWith("data:image") ? v : `data:image/png;base64,${v}`;
    }
  }
  if (d.qrcode && typeof d.qrcode === "object") {
    const b = (d.qrcode as Record<string, unknown>).base64;
    if (typeof b === "string" && b.length > 40) {
      return b.startsWith("data:image") ? b : `data:image/png;base64,${b}`;
    }
  }
  return null;
}

function pickPairingCode(data: unknown): string | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const code = pickPairingCode(item);
      if (code) return code;
    }
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const candidates = [
    d.pairingCode,
    d.pairing_code,
    d.qrcode && typeof d.qrcode === "object"
      ? (d.qrcode as Record<string, unknown>).pairingCode
      : null,
    d.qrcode && typeof d.qrcode === "object"
      ? (d.qrcode as Record<string, unknown>).pairing_code
      : null,
    d.instance && typeof d.instance === "object"
      ? (d.instance as Record<string, unknown>).pairingCode
      : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && looksLikePairingCode(c)) return c;
  }
  return null;
}

/** instanceName sanitizado (UUID ou nome fixo). */
export function evolutionInstanceName(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("tenantId inválido");
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function logEvolution(tag: string, status: number, detail: string) {
  console.log(`[Evolution API] ${tag} | HTTP ${status} | ${detail}`);
}

function summarizeBody(data: unknown): string {
  try {
    const s = JSON.stringify(data);
    return s.length > 800 ? `${s.slice(0, 800)}…` : s;
  } catch {
    return String(data);
  }
}

function evolutionErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string" && d.error) return d.error;
    if (d.response && typeof d.response === "object") {
      const r = d.response as Record<string, unknown>;
      const m = r.message;
      if (Array.isArray(m) && m.length) return String(m[0]);
      if (typeof m === "string") return m;
    }
  }
  return fallback;
}

async function evolutionRequest(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = EVOLUTION_API_TIMEOUT_MS
): Promise<Response> {
  const root = resolvedBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers: Record<string, string> = {
    apikey: resolvedApiKey(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${root}${p}`, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

type UiStatus = "CONNECTED" | "QRCODE" | "LOADING" | "DISCONNECTED";

function isConnectedStateValue(value: string): boolean {
  const v = String(value || "").toLowerCase().trim();
  return v === "open" || v === "connected" || v === "online";
}

function pickConnectionStateValue(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const instance = p.instance && typeof p.instance === "object" ? (p.instance as Record<string, unknown>) : null;
  const candidates = [p.state, p.status, p.connectionStatus, instance?.state, instance?.status, instance?.connectionStatus];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return "";
}

function pickPhoneFromConnectionPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const instance = p.instance && typeof p.instance === "object" ? (p.instance as Record<string, unknown>) : null;
  const candidates = [p.ownerJid, p.number, p.phone, instance?.ownerJid, instance?.number, instance?.phone];
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const digits = c.split("@")[0].replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return null;
}

type ConnectionStateSnapshot = {
  httpOk: boolean;
  connected: boolean | null;
  state: string;
  number: string | null;
};

async function fetchInstanceConnectionState(instanceName: string): Promise<ConnectionStateSnapshot> {
  const clean = evolutionInstanceName(instanceName);
  const path = `/instance/connectionState/${encodeURIComponent(clean)}`;
  let res: Response;
  try {
    res = await evolutionRequest(path, { method: "GET" }, EVOLUTION_STATUS_TIMEOUT_MS);
  } catch (e) {
    console.error("[Evolution API] connectionState rede/timeout:", e);
    return { httpOk: false, connected: null, state: "", number: null };
  }

  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`GET ${path}`, res.status, summarizeBody(data));

  if (res.status === 401 || res.status === 404 || !res.ok) {
    return {
      httpOk: res.ok,
      connected: res.status === 404 ? false : null,
      state: "",
      number: null,
    };
  }

  let connected: boolean | null = null;
  if (data && typeof data === "object" && "connected" in (data as object)) {
    const flag = (data as { connected?: unknown }).connected;
    if (typeof flag === "boolean") connected = flag;
  }

  const state = pickConnectionStateValue(data);
  if (connected === null && state) {
    connected = isConnectedStateValue(state);
  }

  return {
    httpOk: true,
    connected,
    state,
    number: pickPhoneFromConnectionPayload(data),
  };
}

/** Mantém a Evolution acordada (cron). */
export async function pingEvolutionApi(): Promise<void> {
  const root = resolvedBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EVOLUTION_STATUS_TIMEOUT_MS);
  try {
    await fetch(root, {
      method: "GET",
      headers: { apikey: resolvedApiKey() },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getConsoleInstanceStatus(instanceName: string): Promise<{
  status: UiStatus;
  number: string | null;
}> {
  const snap = await fetchInstanceConnectionState(instanceName);
  if (snap.connected === true) {
    return { status: "CONNECTED", number: snap.number };
  }
  return { status: "DISCONNECTED", number: null };
}

/** Meta Cloud API direta (token + phone number id) — não depende do estado Baileys da Evolution. */
export function isMetaCloudEnvConfigured(): boolean {
  const token = String(
    process.env.WA_META_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || ""
  ).trim();
  const phoneId = String(
    process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || ""
  ).trim();
  return Boolean(token && phoneId);
}

/** Status da instância oficial — usado por todos os terreiros. */
export async function getOfficialWhatsAppStatus(): Promise<{ status: UiStatus; number: string | null }> {
  if (isMetaCloudEnvConfigured()) {
    const phoneId = String(
      process.env.WA_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || ""
    ).trim();
    return { status: "CONNECTED", number: phoneId || null };
  }
  return getConsoleInstanceStatus(CONSOLE_ADMIN_INSTANCE_NAME);
}

export async function ensureOfficialWhatsAppReady(): Promise<void> {
  if (isMetaCloudEnvConfigured()) return;
  const st = await getOfficialWhatsAppStatus();
  if (st.status !== "CONNECTED") {
    const err = new Error(WHATSAPP_INITIALIZING_MESSAGE_PT) as Error & { code?: string };
    err.code = "WHATSAPP_INITIALIZING";
    throw err;
  }
}

export async function sendEvolutionTextByInstance(
  instanceName: string,
  phoneDigits: string,
  text: string
): Promise<{ messageId?: string }> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const number = String(phoneDigits).replace(/\D/g, "");
  if (!number) throw new Error("Número inválido para envio WhatsApp.");
  const path = `/message/sendText/${encodeURIComponent(cleanInstance)}`;
  const res = await evolutionRequest(path, {
    method: "POST",
    body: JSON.stringify({ number, text, linkPreview: false }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`POST ${path}`, res.status, summarizeBody(data));
  if (res.status === 401) throw new Error("Evolution API retornou 401 ao enviar mensagem.");
  if (res.status === 404) throw new Error("Instância WhatsApp não encontrada na Evolution.");
  if (!res.ok) throw new Error(evolutionErrorMessage(data, `Falha ao enviar (${res.status})`));
  const key = data && typeof data === "object" && "key" in data ? (data as { key?: { id?: string } }).key : undefined;
  return { messageId: typeof key?.id === "string" ? key.id : undefined };
}

/** Envia template Meta Cloud API via Evolution (`POST /message/sendTemplate/{instance}`). */
export async function sendEvolutionTemplateByInstance(
  instanceName: string,
  phoneDigits: string,
  templateName: string,
  language: string,
  components: MetaTemplateComponent[]
): Promise<{ messageId?: string }> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const number = String(phoneDigits).replace(/\D/g, "");
  if (!number) throw new Error("Número inválido para envio WhatsApp.");

  const path = `/message/sendTemplate/${encodeURIComponent(cleanInstance)}`;
  console.log(
    `[Evolution API] sendTemplate | instance=${cleanInstance} | template=${templateName} | number=${number.slice(0, 4)}…`
  );

  const res = await evolutionRequest(path, {
    method: "POST",
    body: JSON.stringify({
      number,
      name: templateName,
      language,
      components,
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`POST ${path}`, res.status, summarizeBody(data));

  if (res.status === 401) throw new Error("Evolution API retornou 401 ao enviar template.");
  if (res.status === 404) throw new Error("Instância WhatsApp oficial não encontrada na Evolution.");
  if (!res.ok) throw new Error(evolutionErrorMessage(data, `Falha ao enviar template (${res.status})`));

  const key =
    data && typeof data === "object" && "key" in data
      ? (data as { key?: { id?: string } }).key
      : data && typeof data === "object" && "messages" in data
        ? undefined
        : undefined;
  const messageId =
    typeof key?.id === "string"
      ? key.id
      : data && typeof data === "object" && Array.isArray((data as { messages?: unknown[] }).messages)
        ? String(((data as { messages: Array<{ id?: string }> }).messages[0]?.id) || "")
        : undefined;

  return { messageId: messageId || undefined };
}

/**
 * Envia texto pela instância oficial (legado — boas-vindas admin, etc.).
 * `tenantId` é ignorado; mantido apenas por compatibilidade de assinatura.
 */
export async function sendEvolutionTextMessage(
  _tenantId: string,
  phoneDigits: string,
  text: string
): Promise<{ messageId?: string }> {
  await ensureOfficialWhatsAppReady();
  return sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, phoneDigits, text);
}

export async function logoutEvolutionInstanceByName(instanceName: string): Promise<void> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const path = `/instance/logout/${encodeURIComponent(cleanInstance)}`;
  const res = await evolutionRequest(path, { method: "DELETE" });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`DELETE ${path}`, res.status, summarizeBody(data));
  if (res.status === 401) throw new Error("Evolution API retornou 401 ao desconectar.");
  if (res.status === 404) return;
  if (!res.ok) throw new Error(evolutionErrorMessage(data, `Falha ao desconectar (${res.status})`));
}

export async function deleteEvolutionInstanceByName(instanceName: string): Promise<void> {
  const cleanInstance = evolutionInstanceName(instanceName);
  try {
    await logoutEvolutionInstanceByName(cleanInstance);
  } catch {
    /* ok */
  }
  const path = `/instance/delete/${encodeURIComponent(cleanInstance)}`;
  const res = await evolutionRequest(path, { method: "DELETE" });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`DELETE ${path}`, res.status, summarizeBody(data));
  if (res.status === 401) throw new Error("Evolution API retornou 401 ao remover instância.");
  if (res.status === 404) return;
  if (!res.ok) throw new Error(evolutionErrorMessage(data, `Falha ao remover instância (${res.status})`));
}

/** Normaliza MSISDN BR — exportado para scripts/admin. */
export function normalizeMsisdn(phone: string): string {
  return normalizeBrWhatsAppMsisdn(phone);
}

/**
 * Conecta instância via código de pareamento (Baileys).
 * Recria a instância limpa e devolve pairingCode para digitar no WhatsApp.
 */
export async function createInstanceWithPairingCode(
  instanceName: string,
  phone: string
): Promise<{ pairingCode: string; instanceName: string; qrcode: string | null }> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const number = normalizeMsisdn(phone);

  try {
    await deleteEvolutionInstanceByName(cleanInstance);
    await delay(3500);
  } catch {
    /* instância pode não existir */
  }

  const createPath = "/instance/create";
  const createBody = {
    instanceName: cleanInstance,
    integration: "WHATSAPP-BAILEYS" as const,
    qrcode: false,
    pairing: true,
    number,
  };
  console.log(
    `[Evolution API] pairing | POST ${createPath} | instance=${cleanInstance} | number=${number} (len=${number.length})`
  );

  let res: Response | null = null;
  let data: unknown = {};

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await evolutionRequest(
        createPath,
        { method: "POST", body: JSON.stringify(createBody) },
        EVOLUTION_PAIRING_TIMEOUT_MS
      );
      data = await res.json().catch(() => ({}));
      logEvolution(`POST ${createPath}`, res.status, summarizeBody(data));

      if (attempt === 0 && isEvolutionColdStartStatus(res.status)) {
        console.warn("Evolution API em Cold Start, tentando novamente em 2 segundos...");
        await delay(EVOLUTION_COLD_START_RETRY_DELAY_MS);
        continue;
      }

      break;
    } catch (error) {
      if (attempt === 0 && isEvolutionRequestTimeout(error)) {
        console.warn("Evolution API em Cold Start, tentando novamente em 2 segundos...");
        await delay(EVOLUTION_COLD_START_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }

  if (!res) {
    throw new Error("Evolution API não respondeu ao criar instância.");
  }

  if (res.status === 401) {
    throw new Error("Evolution API retornou 401 (apikey inválida).");
  }

  if (!res.ok && !isInstanceAlreadyExists(res.status, data)) {
    throw new Error(evolutionErrorMessage(data, `Evolution create falhou (${res.status})`));
  }

  const connectPath = `/instance/connect/${encodeURIComponent(cleanInstance)}?number=${encodeURIComponent(number)}`;

  async function fetchOnePairingCode(): Promise<{ pairingCode: string | null; qrcode: string | null }> {
    const r2 = await evolutionRequest(connectPath, { method: "GET" }, EVOLUTION_PAIRING_TIMEOUT_MS);
    const d2: unknown = await r2.json().catch(() => ({}));
    logEvolution(`GET ${connectPath}`, r2.status, summarizeBody(d2));
    if (r2.status === 401) throw new Error("Evolution API retornou 401 em /instance/connect.");
    if (!r2.ok) {
      throw new Error(evolutionErrorMessage(d2, `Falha ao gerar pairing (${r2.status})`));
    }
    return { pairingCode: pickPairingCode(d2), qrcode: pickQrBase64(d2) };
  }

  const PAIRING_WARMUP_MS = 10_000;
  console.log(`[Evolution API] pairing | aguardando ${PAIRING_WARMUP_MS}ms antes do /connect único`);
  await delay(PAIRING_WARMUP_MS);

  let connected = await fetchOnePairingCode();
  let fromCreate = connected.pairingCode;
  let qr = connected.qrcode;

  if (!fromCreate && !qr) {
    console.log("[Evolution API] pairing | sem código; aguardando 5s e última tentativa /connect");
    await delay(5000);
    connected = await fetchOnePairingCode();
    fromCreate = connected.pairingCode;
    qr = connected.qrcode;
  }

  if (!fromCreate) {
    throw new Error(
      "Evolution não gerou código de pareamento. Aguarde 1 minuto e tente de novo (não clique várias vezes)."
    );
  }

  console.log(`[Evolution API] pairing | código final (${fromCreate}) — use no WhatsApp em até 60s`);
  return { pairingCode: fromCreate, instanceName: cleanInstance, qrcode: qr };
}
