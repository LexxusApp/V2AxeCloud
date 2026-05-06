/**
 * Cliente HTTP para o serviço WhatsApp (Baileys) em processo contínuo — ex.: Railway.
 * Usa process.env.AXE_WHATSAPP_NODE_BASE_URL no app que chama (Vercel ou server.ts local).
 */

export const WHATSAPP_INITIALIZING_MESSAGE_PT =
  "O serviço de mensageria está inicializando ou temporariamente indisponível. Aguarde um instante e tente novamente.";

export type AxeWhatsappNodeClientConfig = {
  baseUrl: string;
  proxySecret?: string;
  timeoutMs?: number;
};

export function createAxeWhatsappNodeClient(cfg: AxeWhatsappNodeClientConfig) {
  const base = cfg.baseUrl.trim().replace(/\/$/, "");
  const timeoutMs = cfg.timeoutMs ?? 15_000;
  const secret = (cfg.proxySecret || "").trim();

  async function fetchNode(
    tenantId: string,
    pathname: string,
    init: { method?: string; body?: object } = {},
  ): Promise<Response> {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
      "x-tenant-id": tenantId,
      "x-supabase-tenant-id": tenantId,
    };
    if (secret) headers["x-axe-whatsapp-proxy-secret"] = secret;
    const method = init.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      headers["content-type"] = "application/json";
    }
    const bodyPayload =
      method !== "GET" && method !== "HEAD"
        ? {
            ...(typeof init.body === "object" && init.body ? init.body : {}),
            tenant_id: tenantId,
          }
        : undefined;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers,
        body: bodyPayload !== undefined ? JSON.stringify(bodyPayload) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }

  function throwInitializing(): never {
    const err = new Error(WHATSAPP_INITIALIZING_MESSAGE_PT);
    (err as { code?: string }).code = "WHATSAPP_INITIALIZING";
    throw err;
  }

  async function parseJsonResponse(r: Response): Promise<any> {
    const text = await r.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { raw: text };
    }
  }

  /**
   * GET status + QR no Node; mapeia para o formato esperado pelo app (DISCONNECTED | LOADING | QRCODE | CONNECTED).
   */
  async function getStatusAndQr(tenantId: string): Promise<{
    status: "DISCONNECTED" | "LOADING" | "QRCODE" | "CONNECTED";
    qrcode: string | null;
  }> {
    let stRes: Response;
    try {
      stRes = await fetchNode(tenantId, `/whatsapp/status`);
    } catch {
      throwInitializing();
    }
    const stData = await parseJsonResponse(stRes);
    if (!stRes.ok) {
      if (stRes.status >= 500) throwInitializing();
      const err = new Error(String(stData?.error || `Falha status (${stRes.status})`));
      (err as { code?: string }).code = stData?.code || "WHATSAPP_NODE_ERROR";
      throw err;
    }
    const railway = String(stData?.status || "").toLowerCase();
    let status: "DISCONNECTED" | "LOADING" | "QRCODE" | "CONNECTED" = "DISCONNECTED";
    if (railway === "open" || railway === "connected") status = "CONNECTED";
    else if (railway === "qr" || railway === "qrcode") status = "QRCODE";
    else if (railway === "connecting" || railway === "loading") status = "LOADING";

    let qrcode: string | null = null;
    if (status === "QRCODE") {
      try {
        const qrRes = await fetchNode(tenantId, `/whatsapp/qr`);
        const qrData = await parseJsonResponse(qrRes);
        if (qrRes.ok && typeof qrData?.qr_image_data_url === "string") {
          qrcode = qrData.qr_image_data_url;
        }
      } catch {
        /* QR ainda não pronto */
      }
    }
    return { status, qrcode };
  }

  /**
   * Chama o Node e lança Error com .code WHATSAPP_INITIALIZING em falha de rede/timeout/5xx.
   */
  async function jsonOrThrow(tenantId: string, pathname: string, init: { method?: string; body?: object } = {}) {
    let r: Response;
    try {
      r = await fetchNode(tenantId, pathname, init);
    } catch {
      throwInitializing();
    }
    const data = await parseJsonResponse(r);
    if (!r.ok) {
      if (r.status >= 500) throwInitializing();
      const err = new Error(String(data?.error || `WhatsApp (${r.status})`));
      (err as { code?: string }).code = data?.code || "WHATSAPP_NODE_ERROR";
      throw err;
    }
    return data;
  }

  return { fetchNode, getStatusAndQr, jsonOrThrow };
}
