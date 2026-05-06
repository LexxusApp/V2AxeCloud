/**
 * URLs do WhatsApp no AxéCloud: sempre via backend (`/api/whatsapp/*`), que chama a Evolution API.
 * Opcional: `VITE_API_ORIGIN` (ex.: https://api.seudominio.com) se o front estiver em outro host.
 */

function apiOrigin(): string {
  const v = import.meta.env.VITE_API_ORIGIN;
  return typeof v === "string" ? v.trim().replace(/\/$/, "") : "";
}

/** Converte caminhos legados (/connect, /whatsapp/...) em rotas `/api/whatsapp/...`. */
export function whatsappApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = apiOrigin();

  if (p === "/connect") {
    return origin ? `${origin}/api/whatsapp/start` : "/api/whatsapp/start";
  }
  if (p.startsWith("/whatsapp/")) {
    const rel = `/api${p}`;
    return origin ? `${origin}${rel}` : rel;
  }
  if (p === "/whatsapp/status") {
    return origin ? `${origin}/api/whatsapp/status` : "/api/whatsapp/status";
  }

  return origin ? `${origin}${p}` : p;
}

/** Authorization + tenant (Supabase user id) para o backend validar escopo. */
export function whatsappRailwayAuthHeaders(accessToken: string, tenantUserId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "x-tenant-id": tenantUserId,
    "x-supabase-tenant-id": tenantUserId,
  };
}

export function whatsappRailwayHeaders(accessToken: string, tenantUserId: string): Record<string, string> {
  return {
    ...whatsappRailwayAuthHeaders(accessToken, tenantUserId),
    "Content-Type": "application/json",
  };
}

export function whatsappRailwayJsonBody(tenantUserId: string, extra?: Record<string, unknown>): string {
  return JSON.stringify({
    ...(extra && typeof extra === "object" ? extra : {}),
    tenant_id: tenantUserId,
  });
}
