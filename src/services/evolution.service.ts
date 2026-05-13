/**
 * Chamadas centralizadas à Evolution API (WhatsApp).
 * Configure EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY no ambiente em produção.
 */
import QRCode from "qrcode";

export const WHATSAPP_INITIALIZING_MESSAGE_PT =
  "O serviço de mensageria está inicializando ou temporariamente indisponível. Aguarde um instante e tente novamente.";

/** URL pública da Evolution no Railway (placeholder; substitua xxx ou use env). */
export const BASE_URL = "https://evolution-api-production-xxx.up.railway.app";

export const API_KEY = "AxeCloud_2026";

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

async function evolutionRequest(path: string, init: RequestInit = {}): Promise<Response> {
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
  return fetch(`${root}${p}`, { ...init, headers });
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

function firstInstanceRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const row = raw[0] as unknown;
    if (row && typeof row === "object" && "instance" in (row as object)) {
      const inner = (row as { instance: unknown }).instance;
      return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : null;
    }
    if (row && typeof row === "object") return row as Record<string, unknown>;
    return null;
  }
  if (typeof raw === "object" && "instance" in (raw as object)) {
    const inner = (raw as { instance: unknown }).instance;
    return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : null;
  }
  return null;
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

async function isConnectedByConnectionState(instanceName: string): Promise<boolean | null> {
  const path = `/instance/connectionState/${encodeURIComponent(instanceName)}`;
  try {
    const res = await evolutionRequest(path, { method: "GET" });
    const data: unknown = await res.json().catch(() => ({}));
    logEvolution(`GET ${path}`, res.status, summarizeBody(data));
    if (!res.ok) return null;

    if (data && typeof data === "object" && "connected" in (data as object)) {
      const connected = (data as { connected?: unknown }).connected;
      if (typeof connected === "boolean") return connected;
    }

    const state = pickConnectionStateValue(data);
    if (!state) return null;
    return isConnectedStateValue(state);
  } catch (e) {
    console.error("[Evolution API] connectionState falhou:", e);
    return null;
  }
}

export async function getAxeEvolutionStatusAndQr(tenantId: string): Promise<{
  status: UiStatus;
  qrcode: string | null;
}> {
  const instanceName = evolutionInstanceName(tenantId);
  const path = `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`;
  let res: Response;
  try {
    res = await evolutionRequest(path, { method: "GET" });
  } catch (e) {
    console.error("[Evolution API] fetchInstances rede/timeout:", e);
    return { status: "DISCONNECTED", qrcode: null };
  }

  const raw = await res.json().catch(() => null);
  logEvolution(`GET ${path}`, res.status, summarizeBody(raw));

  if (res.status === 401) {
    console.error("[Evolution API] Erro 401 em fetchInstances.");
    return { status: "DISCONNECTED", qrcode: null };
  }
  if (res.status === 404) {
    console.error("[Evolution API] Erro 404 em fetchInstances.");
    return { status: "DISCONNECTED", qrcode: null };
  }
  if (!res.ok) {
    return { status: "DISCONNECTED", qrcode: null };
  }

  const inst = firstInstanceRecord(raw);
  if (!inst) {
    console.log(`[Evolution API] Nenhuma instância encontrada para instanceName=${instanceName}`);
    return { status: "DISCONNECTED", qrcode: null };
  }

  const st = String(inst.status || inst.state || inst.connectionStatus || "").toLowerCase();
  if (isConnectedStateValue(st)) {
    console.log(`[Evolution API] Instância ${instanceName} conectada (open).`);
    return { status: "CONNECTED", qrcode: null };
  }

  const connectedFromState = await isConnectedByConnectionState(instanceName);
  if (connectedFromState === true) {
    console.log(`[Evolution API] Instância ${instanceName} conectada (connectionState).`);
    return { status: "CONNECTED", qrcode: null };
  }

  // Evita auto-conexão involuntária: polling de status não deve chamar /instance/connect.
  // A geração de QR fica exclusiva no clique do botão "Conectar agora" (fluxo /api/whatsapp/start).
  const qrFromInstance = pickQrOrLinkFromPayload(inst);
  if (qrFromInstance) {
    try {
      const qr = await resolveDisplayString(inst);
      return { status: "QRCODE", qrcode: qr };
    } catch (e) {
      console.error("[Evolution API] Não foi possível normalizar QR do fetchInstances:", e);
    }
  }

  // Instância existe, mas sem sessão aberta e sem QR disponível no snapshot.
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

  const res = await evolutionRequest(createPath, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  const data: unknown = await res.json().catch(() => ({}));
  logEvolution(`POST ${createPath}`, res.status, summarizeBody(data));

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

/** Status simples da instância do console (sem QR). */
export async function getConsoleInstanceStatus(instanceName: string): Promise<{
  status: UiStatus;
  number: string | null;
}> {
  const cleanInstance = evolutionInstanceName(instanceName);
  const path = `/instance/fetchInstances?instanceName=${encodeURIComponent(cleanInstance)}`;
  let res: Response;
  try {
    res = await evolutionRequest(path, { method: "GET" });
  } catch (e) {
    console.error("[Evolution API] console fetchInstances rede/timeout:", e);
    return { status: "DISCONNECTED", number: null };
  }
  const raw = await res.json().catch(() => null);
  logEvolution(`GET ${path}`, res.status, summarizeBody(raw));
  if (!res.ok) return { status: "DISCONNECTED", number: null };

  const inst = firstInstanceRecord(raw);
  if (!inst) return { status: "DISCONNECTED", number: null };
  const st = String(inst.status || inst.state || inst.connectionStatus || "").toLowerCase();
  const number =
    (typeof inst.ownerJid === "string" && (inst.ownerJid as string).split("@")[0]) ||
    (typeof inst.number === "string" ? (inst.number as string) : null);
  if (isConnectedStateValue(st)) return { status: "CONNECTED", number };
  const fromState = await isConnectedByConnectionState(cleanInstance);
  if (fromState === true) return { status: "CONNECTED", number };
  return { status: "DISCONNECTED", number };
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
