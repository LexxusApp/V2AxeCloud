/**
 * Cliente da Evolution API (WhatsApp) — substitui o proxy para Baileys em /connect e status.
 * URLs e chave padrão podem ser sobrescritas por EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY.
 */
import QRCode from "qrcode";

/** URL pública da Evolution API (sobrescreva com EVOLUTION_API_BASE_URL no deploy). */
export const BASE_URL = "https://evolution-api-production-fb8d.up.railway.app";

/** Chave global da Evolution API (sobrescreva com EVOLUTION_API_KEY no deploy). */
export const API_KEY = "AxeCloud_2026";

function evolutionBaseUrl(): string {
  return String(process.env.EVOLUTION_API_BASE_URL || BASE_URL)
    .trim()
    .replace(/\/$/, "");
}

function evolutionApiKey(): string {
  return String(process.env.EVOLUTION_API_KEY || API_KEY).trim();
}

/** Nome estável da instância na Evolution (1 por tenant Supabase). */
export function evolutionInstanceName(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("tenantId inválido");
  return `axe-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

async function evolutionRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const root = evolutionBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers: Record<string, string> = {
    apikey: evolutionApiKey(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${root}${p}`, { ...init, headers });
}

function stripDataUrlPrefix(dataUrlOrBase64: string): string {
  const s = String(dataUrlOrBase64).trim();
  const m = /^data:image\/\w+;base64,(.+)$/i.exec(s);
  return m ? m[1] : s;
}

async function waLinkToPngDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { margin: 2, width: 280 });
}

function pickQrImageFromUnknown(data: unknown): string | null {
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
  return null;
}

/** Obtém imagem do QR (data URL) a partir do JSON de /instance/connect ou create. */
async function resolveQrImageFromPayload(data: unknown): Promise<string> {
  const direct = pickQrImageFromUnknown(data);
  if (direct) return direct;
  if (data && typeof data === "object" && typeof (data as { code?: string }).code === "string") {
    return waLinkToPngDataUrl((data as { code: string }).code);
  }
  throw new Error("Resposta da Evolution API sem QR code utilizável.");
}

/**
 * Cria (ou reutiliza) a instância na Evolution e devolve o QR em Base64 (PNG, sem prefixo data:)
 * e também como data URL para uso direto no <img src>.
 */
export async function createAxeInstance(tenantId: string): Promise<{
  qrCodeBase64: string;
  qrImageDataUrl: string;
}> {
  const instanceName = evolutionInstanceName(tenantId);
  let res = await evolutionRequest("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

  let data: unknown = await res.json().catch(() => ({}));

  if (res.status === 403 || res.status === 409) {
    res = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
    data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && "response" in data
          ? JSON.stringify((data as { response?: unknown }).response)
          : await textIfNeeded(res, data);
      throw new Error(msg || `Evolution connect falhou (${res.status})`);
    }
  } else if (!res.ok) {
    const msg =
      data && typeof data === "object" && "response" in data
        ? JSON.stringify((data as { response?: unknown }).response)
        : String((data as { error?: string })?.error || `Evolution create (${res.status})`);
    throw new Error(msg);
  } else {
    const fromCreate = pickQrImageFromUnknown(data);
    if (!fromCreate) {
      const conn = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: "GET",
      });
      data = await conn.json().catch(() => ({}));
      if (!conn.ok) {
        const msg =
          data && typeof data === "object" && "response" in data
            ? JSON.stringify((data as { response?: unknown }).response)
            : `Evolution connect após create (${conn.status})`;
        throw new Error(msg);
      }
    }
  }

  const qrImageDataUrl = await resolveQrImageFromPayload(data);
  const qrCodeBase64 = stripDataUrlPrefix(qrImageDataUrl);
  return { qrCodeBase64, qrImageDataUrl };
}

async function textIfNeeded(res: Response, data: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data) return String((data as { error?: string }).error || "");
  return res.statusText;
}

type UiStatus = "CONNECTED" | "QRCODE" | "LOADING" | "DISCONNECTED";

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

/**
 * Estado para a UI AxéCloud / compatível com getStatusAndQr do cliente Node.
 */
export async function getAxeEvolutionStatusAndQr(tenantId: string): Promise<{
  status: UiStatus;
  qrcode: string | null;
}> {
  const instanceName = evolutionInstanceName(tenantId);
  let res: Response;
  try {
    res = await evolutionRequest(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      { method: "GET" },
    );
  } catch {
    return { status: "LOADING", qrcode: null };
  }
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    return { status: "DISCONNECTED", qrcode: null };
  }

  const inst = firstInstanceRecord(raw);
  if (!inst) {
    return { status: "DISCONNECTED", qrcode: null };
  }

  const st = String(inst.status || "").toLowerCase();
  if (st === "open") {
    return { status: "CONNECTED", qrcode: null };
  }

  try {
    const conn = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET",
    });
    const connData = await conn.json().catch(() => ({}));
    if (conn.ok) {
      const qrImageDataUrl = await resolveQrImageFromPayload(connData);
      return { status: "QRCODE", qrcode: qrImageDataUrl };
    }
  } catch {
    /* segue */
  }

  return { status: "LOADING", qrcode: null };
}
