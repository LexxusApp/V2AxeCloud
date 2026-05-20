/** Assinatura com acesso liberado (status active e dentro da validade). */
export function isSubscriptionAccessActive(
  sub: { status?: string | null; expires_at?: string | null } | null | undefined
): boolean {
  if (!sub || String(sub.status || "").toLowerCase() !== "active") return false;
  if (!sub.expires_at) return true;
  return new Date(String(sub.expires_at)) > new Date();
}
