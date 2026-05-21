/**
 * Chamadas centralizadas à Evolution API (WhatsApp).
 * Configure EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY no ambiente em produção.
 */
import QRCode from "qrcode";

export const WHATSAPP_INITIALIZING_MESSAGE_PT =
  "O serviço de mensageria está inicializando ou temporariamente indisponível. Aguarde um instante e tente novamente.";

/** URL pública da Evolution no Railway (placeholder; substitua xxx ou use env). */
export const BASE_URL = "https://evolution-api-production-fb8d.up.railway.app";

export const API_KEY = "AxeCloud_2026";

const EVOLUTION_API_TIMEOUT_MS = 29000;
/** Timeout menor em checagens de status (polling) para não segurar workers. */
const EVOLUTION_STATUS_TIMEOUT_MS = 15000;
const EVOLUTION_COLD_START_RETRY_DELAY_MS = 2000;

function resolvedBaseUrl(): string {
  const raw = String(process.env.EVOLUTION_API_BASE_URL || BASE_URL).trim().replace(/\/$/, "");
  if (!raw) return BASE_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Alguns ambientes salvam apenas o host (sem protocolo); normalizamos para URL válida.
  return `https://${raw}`;
}

function resolvedApiKey(): string {
  return String(process.env.EVOLUTION_API_KEY || API_KEY).trim();
}

/** instanceName na Evolution = tenantId normalizado (sem caracteres problemáticos). */
export function evolutionInstanceName(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("tenantId inválido");
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function logEvolution(tag: string, status: number, detail: string) {
  console.log(`[Evolution API] ${tag} | HTTP ${status} | ${detail}`);
}

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

async function evolutionRequest(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = EVOLUTION_API_TIMEOUT_MS,
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
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  try {
    return await fetch(`${root}${p}`, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

function summarizeBody(data: unknown): string {
  try {
    const s = JSON.stringify(data);
    return s.length > 800 ? `${s.slice(0, 800)}…` : s;
  } catch {
    return String(data);
  }
}

function stripDataUrlPrefix(dataUrlOrBase64: string): string {
  const s = String(dataUrlOrBase64).trim();
  const m = /^data:image\/\w+;base64,(.+)$/i.exec(s);
  return m ? m[1] : s;
}

async function waLinkToPngDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { margin: 2, width: 280 });
}

function pickQrOrLinkFromPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const nested = d.qrcode;
  if (nested && typeof nested === "object") {
    const b = (nested as Record<string, unknown>).base64;
    if (typeof b === "string" && b.length > 0) return b.startsWith("data:") ? b : `data:image/png;base64,${b}`;
  }
  for (const k of ["base64", "qrcode", "qr"]) {
    const v = d[k];
    if (typeof v === "string" && v.length > 20) {
      return v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
    }
  }
  if (typeof d.pairingCode === "string" && d.pairingCode.length > 0) {
    return d.pairingCode;
  }
  if (typeof d.code === "string" && d.code.length > 0) {
    return d.code;
  }
  return null;
}

/** Converte payload Evolution em string exibível: data URL (imagem) ou link/código bruto. */
async function resolveDisplayString(data: unknown): Promise<string> {
  const picked = pickQrOrLinkFromPayload(data);
  if (!picked) {
    throw new Error("Resposta da Evolution sem QR/Base64/link utilizável.");
  }
  if (picked.startsWith("http://") || picked.startsWith("https://")) {
    return picked;
  }
  if (picked.startsWith("data:image")) {
    return picked;
  }
  if (picked.startsWith("data:")) {
    return picked;
  }
  if (/^[A-Z0-9]{8}$/i.test(picked)) {
    return picked;
  }
  return waLinkToPngDataUrl(picked);
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

/**
 * Cria instância (POST /instance/create) ou, se já existir, obtém só o QR (GET /instance/connect).
 * Retorna string: PNG em Base64 (data URL), Base64 cru, ou link/código conforme a API.
 */
export async function createAxeInstance(tenantId: string): Promise<string> {
  const instanceName = evolutionInstanceName(tenantId);
  const createUrl = "/instance/create";
  const body = {
    instanceName,
    integration: "WHATSAPP-BAILEYS" as const,
    qrcode: true,
  };

  console.log(`[Evolution API] createAxeInstance | tenantId=${tenantId} | instanceName=${instanceName} | POST ${createUrl}`);

  let res = await evolutionRequest(createUrl, {
    method: "POST",
    body: JSON.stringify(body),
  });

  let data: unknown = await res.json().catch(() => ({}));
  logEvolution("POST /instance/create", res.status, summarizeBody(data));

  if (res.status === 401) {
    console.error("[Evolution API] Erro 401: apikey inválida ou ausente na Evolution.");
    throw new Error("Evolution API retornou 401 (não autorizado). Verifique API_KEY e o header apikey.");
  }

  if (res.ok) {
    const fromCreate = pickQrOrLinkFromPayload(data);
    if (fromCreate) {
      const out = await resolveDisplayString(data);
      console.log("[Evolution API] Instância criada com sucesso; QR/link obtido do corpo da resposta.");
      return out;
    }
    console.log("[Evolution API] Create OK mas sem QR no corpo; chamando GET /instance/connect…");
    return fetchConnectQr(instanceName);
  }

  if (res.status === 404) {
    console.error("[Evolution API] Erro 404 no create: rota ou recurso não encontrado na Evolution.");
    throw new Error("Evolution API retornou 404 no /instance/create.");
  }

  if (isInstanceAlreadyExists(res.status, data)) {
    console.log("[Evolution API] Instância já existe; ignorando create e buscando QR via GET /instance/connect.");
    return fetchConnectQr(instanceName);
  }

  const msg =
    data && typeof data === "object" && "response" in data
      ? summarizeBody((data as { response: unknown }).response)
      : String((data as { error?: string })?.error || `Evolution create falhou (${res.status})`);
  console.error(`[Evolution API] Falha no create: ${msg}`);
  throw new Error(msg);
}

async function fetchConnectQr(instanceName: string): Promise<string> {
  const path = `/instance/connect/${encodeURIComponent(instanceName)}`;
  const res = await evolutionRequest(path, { method: "GET" });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`GET ${path}`, res.status, summarizeBody(data));

  if (res.status === 401) {
    console.error("[Evolution API] Erro 401 no connect: apikey inválida.");
    throw new Error("Evolution API retornou 401 em /instance/connect.");
  }

  if (res.status === 404) {
    console.error(`[Evolution API] Erro 404 no connect: instância "${instanceName}" não encontrada.`);
    throw new Error(`Evolution API retornou 404: instância "${instanceName}" não existe.`);
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "response" in data
        ? summarizeBody((data as { response: unknown }).response)
        : String((data as { error?: string })?.error || res.statusText);
    console.error(`[Evolution API] Connect falhou: ${msg}`);
    throw new Error(msg || `Evolution connect (${res.status})`);
  }

  const out = await resolveDisplayString(data);
  console.log("[Evolution API] GET /instance/connect concluído com sucesso (QR/link disponível).");
  return out;
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

  const candidates = [
    p.state,
    p.status,
    p.connectionStatus,
    instance?.state,
    instance?.status,
    instance?.connectionStatus,
  ];
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

/** GET /instance/connectionState/{instanceName} — única fonte para polling de status. */
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

  if (res.status === 401) {
    console.error("[Evolution API] Erro 401 em connectionState.");
    return { httpOk: false, connected: null, state: "", number: null };
  }
  if (res.status === 404) {
    console.error("[Evolution API] Erro 404 em connectionState.");
    return { httpOk: false, connected: false, state: "", number: null };
  }
  if (!res.ok) {
    return { httpOk: false, connected: null, state: "", number: null };
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

async function isConnectedByConnectionState(instanceName: string): Promise<boolean | null> {
  const snap = await fetchInstanceConnectionState(instanceName);
  if (!snap.httpOk) return null;
  if (snap.connected === true) return true;
  if (snap.connected === false) return false;
  return null;
}

/** Mantém a Evolution acordada (cron). Usa env + header apikey. */
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

export async function getAxeEvolutionStatusAndQr(tenantId: string): Promise<{
  status: UiStatus;
  qrcode: string | null;
}> {
  const instanceName = evolutionInstanceName(tenantId);
  // Polling leve: uma instância via connectionState (evita fetchInstances que lista todas).
  const connected = await isConnectedByConnectionState(instanceName);
  if (connected === true) {
    console.log(`[Evolution API] Instância ${instanceName} conectada (connectionState).`);
    return { status: "CONNECTED", qrcode: null };
  }

  // QR/pairing só no fluxo /api/whatsapp/start — polling não chama /instance/connect nem fetchInstances.
  return { status: "DISCONNECTED", qrcode: null };
}

/** Base64 do PNG sem prefixo `data:` (útil para armazenar). */
export function toQrCodeBase64(displayString: string): string {
  const s = String(displayString).trim();
  if (s.startsWith("data:image") && s.includes("base64,")) {
    return stripDataUrlPrefix(s);
  }
  return s;
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

/**
 * Envia texto via Evolution (`POST /message/sendText/{instance}`).
 * `phoneDigits`: apenas dígitos, com DDI (ex.: 5511999999999).
 */
export async function sendEvolutionTextMessage(
  tenantId: string,
  phoneDigits: string,
  text: string,
): Promise<{ messageId?: string }> {
  const instanceName = evolutionInstanceName(tenantId);
  const number = String(phoneDigits).replace(/\D/g, "");
  if (!number) throw new Error("Número inválido para envio WhatsApp.");

  const path = `/message/sendText/${encodeURIComponent(instanceName)}`;
  console.log(`[Evolution API] sendText | instance=${instanceName} | number=${number.slice(0, 4)}…`);

  const res = await evolutionRequest(path, {
    method: "POST",
    body: JSON.stringify({
      number,
      text,
      linkPreview: false,
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`POST ${path}`, res.status, summarizeBody(data));

  if (res.status === 401) {
    console.error("[Evolution API] sendText 401: verifique API_KEY.");
    throw new Error("Evolution API retornou 401 ao enviar mensagem.");
  }
  if (res.status === 404) {
    console.error(`[Evolution API] sendText 404: instância "${instanceName}" não encontrada.`);
    throw new Error("Instância WhatsApp não encontrada na Evolution. Conecte o WhatsApp nas configurações.");
  }

  if (!res.ok) {
    const msg = evolutionErrorMessage(data, `Falha ao enviar mensagem (${res.status})`);
    console.error(`[Evolution API] sendText erro: ${msg}`);
    throw new Error(msg);
  }

  const key =
    data && typeof data === "object" && "key" in data
      ? (data as { key?: { id?: string } }).key
      : undefined;
  const messageId = typeof key?.id === "string" ? key.id : undefined;
  console.log("[Evolution API] sendText concluído com sucesso.", messageId ? `id=${messageId}` : "");
  return { messageId };
}

/** Nome canónico da instância usada pelo Console Admin global (separada dos terreiros). */
export const CONSOLE_ADMIN_INSTANCE_NAME = "axecloud_console_admin";

/**
 * Normaliza para MSISDN aceito pela Evolution/Baileys (DDI + DDD + linha, só dígitos).
 * Regras:
 *  - 10 ou 11 dígitos (DDD + linha brasileira) → prefixa "55".
 *  - 12 ou 13 dígitos começando com "55" → mantém.
 *  - 12+ dígitos com outro DDI (ex.: "351", "1", "44") → mantém.
 *  - <10 dígitos → erro.
 */
function normalizeMsisdn(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) throw new Error("Número de telefone inválido");
  if (digits.length < 10) {
    throw new Error("Número incompleto: digite DDD + linha (10 ou 11 dígitos).");
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  return digits;
}

function pickPairingCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const direct = d.pairingCode ?? d.pairing_code ?? d.code;
  if (typeof direct === "string" && direct.length >= 6) return direct;
  if (d.qrcode && typeof d.qrcode === "object") {
    const inner = (d.qrcode as Record<string, unknown>).pairingCode;
    if (typeof inner === "string" && inner.length >= 6) return inner;
  }
  if (d.instance && typeof d.instance === "object") {
    const inner = (d.instance as Record<string, unknown>).pairingCode;
    if (typeof inner === "string" && inner.length >= 6) return inner;
  }
  return null;
}

/**
 * Conecta uma instância via PAIRING CODE (sem QR).
 * 1) Tenta criar a instância passando o número (Evolution devolve `pairingCode` no body).
 * 2) Se já existir, pede `/instance/connect/{instance}?number=…` que também devolve pairing code.
 * Retorna o código no formato exibido pelo WhatsApp (ex.: "ABCD-1234").
 */
export async function createInstanceWithPairingCode(
  instanceName: string,
  phone: string
): Promise<{ pairingCode: string; instanceName: string }> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const number = normalizeMsisdn(phone);

  const createPath = "/instance/create";
  const createBody = {
    instanceName: cleanInstance,
    integration: "WHATSAPP-BAILEYS" as const,
    qrcode: false,
    number,
  };
  console.log(
    `[Evolution API] pairing | POST ${createPath} | instance=${cleanInstance} | number=${number} (len=${number.length})`
  );

  let res: Response | null = null;
  let data: unknown = {};

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await evolutionRequest(createPath, {
        method: "POST",
        body: JSON.stringify(createBody),
      });
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

  if (res.ok) {
    const code = pickPairingCode(data);
    if (code) return { pairingCode: code, instanceName: cleanInstance };
  }

  // Já existe — pedir connect com o número.
  if (isInstanceAlreadyExists(res.status, data) || res.ok) {
    const path = `/instance/connect/${encodeURIComponent(cleanInstance)}?number=${encodeURIComponent(number)}`;
    const r2 = await evolutionRequest(path, { method: "GET" });
    const d2: unknown = await r2.json().catch(() => ({}));
    logEvolution(`GET ${path}`, r2.status, summarizeBody(d2));
    if (r2.status === 401) throw new Error("Evolution API retornou 401 em /instance/connect.");
    if (!r2.ok) {
      const msg = evolutionErrorMessage(d2, `Falha ao gerar pairing (${r2.status})`);
      throw new Error(msg);
    }
    const code = pickPairingCode(d2);
    if (code) return { pairingCode: code, instanceName: cleanInstance };
    throw new Error("Evolution API não devolveu pairingCode. Verifique a versão da API.");
  }

  const msg = evolutionErrorMessage(data, `Evolution create falhou (${res.status})`);
  throw new Error(msg);
}

/** Status simples da instância do console (sem QR) — via connectionState. */
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

/** Envia mensagem usando a instância dada (sem mapear por user.id como em sendEvolutionTextMessage). */
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

/** Logout para uma instância arbitrária (não usa tenantId). */
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

/** Encerra sessão na Evolution (`DELETE /instance/logout/{instance}`). */
export async function logoutEvolutionInstance(tenantId: string): Promise<void> {
  const instanceName = evolutionInstanceName(tenantId);
  const path = `/instance/logout/${encodeURIComponent(instanceName)}`;
  const res = await evolutionRequest(path, { method: "DELETE" });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`DELETE ${path}`, res.status, summarizeBody(data));

  if (res.status === 401) {
    console.error("[Evolution API] logout 401.");
    throw new Error("Evolution API retornou 401 ao desconectar.");
  }
  if (res.status === 404) {
    console.log(`[Evolution API] logout 404 — instância "${instanceName}" já inexistente; considerando desconectado.`);
    return;
  }
  if (!res.ok) {
    const msg = evolutionErrorMessage(data, `Falha ao desconectar (${res.status})`);
    console.error(`[Evolution API] logout: ${msg}`);
    throw new Error(msg);
  }
  console.log(`[Evolution API] Instância "${instanceName}" desconectada com sucesso.`);
}
