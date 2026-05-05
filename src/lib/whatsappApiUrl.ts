/**
 * Base pública do serviço WhatsApp (Railway), injetada no bundle via Vite (`AXE_WHATSAPP_NODE_BASE_URL`).
 * Com base vazia, mantém caminhos relativos `/whatsapp/...` (Railway sem domínio próprio no dev, se o proxy espelhar).
 */
export function getAxeWhatsappNodeBaseUrl(): string {
  const v = import.meta.env.AXE_WHATSAPP_NODE_BASE_URL;
  return typeof v === "string" ? v.trim().replace(/\/$/, "") : "";
}

/** Monta a URL absoluta do Railway ou relativa ao origin atual. */
export function whatsappApiUrl(path: string): string {
  const base = getAxeWhatsappNodeBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

/** Authorization + tenant (GET e POST sem corpo JSON). */
export function whatsappRailwayAuthHeaders(accessToken: string, tenantUserId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "x-tenant-id": tenantUserId,
    "x-supabase-tenant-id": tenantUserId,
  };
}

/** Inclui `Content-Type: application/json` para POST com body. */
export function whatsappRailwayHeaders(accessToken: string, tenantUserId: string): Record<string, string> {
  return {
    ...whatsappRailwayAuthHeaders(accessToken, tenantUserId),
    "Content-Type": "application/json",
  };
}

/** Corpo JSON com `tenant_id` do usuário logado (Supabase); mescla campos extras (ex.: `phone`). */
export function whatsappRailwayJsonBody(tenantUserId: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({
    ...(extra && typeof extra === "object" ? extra : {}),
    tenant_id: tenantUserId,
  });
}
