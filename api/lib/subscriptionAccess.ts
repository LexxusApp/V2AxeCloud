/** A assinatura venceu quando possui uma data válida igual ou anterior ao momento atual. */
export function isSubscriptionExpired(
  sub: { expires_at?: string | null } | null | undefined,
  now = new Date()
): boolean {
  const expiresAt = String(sub?.expires_at || "").trim();
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

/** Assinatura com acesso liberado (status active e dentro da validade). */
export function isSubscriptionAccessActive(
  sub: { status?: string | null; expires_at?: string | null } | null | undefined
): boolean {
  if (!sub || String(sub.status || "").toLowerCase() !== "active") return false;
  if (!sub.expires_at) return true;
  const timestamp = new Date(String(sub.expires_at)).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}