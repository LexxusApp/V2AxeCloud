const BR_TZ = "America/Sao_Paulo";

/** Extrai a data civil YYYY-MM-DD da expiração no fuso de São Paulo. */
export function parseSubscriptionExpiryYmd(raw?: string | null): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const date = new Date(str);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Retorna a data civil atual YYYY-MM-DD em São Paulo. */
export function getSaoPauloDateYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * A assinatura é considerada vencida para bloqueio apenas a partir do dia seguinte
 * ao vencimento (um dia depois da data de vencimento em horário de Brasília).
 * No dia do vencimento, o terreiro tem o dia todo liberado para usar o sistema e pagar.
 */
export function isSubscriptionExpired(
  sub: { expires_at?: string | null } | null | undefined,
  now = new Date()
): boolean {
  const expiryYmd = parseSubscriptionExpiryYmd(sub?.expires_at);
  if (!expiryYmd) return false;
  const todayYmd = getSaoPauloDateYmd(now);

  // Bloqueia somente se hoje for estritamente posterior ao dia do vencimento (D+1 em diante)
  return todayYmd > expiryYmd;
}

/**
 * Assinatura com acesso liberado (status active e não passou do dia do vencimento).
 * Durante todo o dia do vencimento o acesso continua 100% liberado.
 */
export function isSubscriptionAccessActive(
  sub: { status?: string | null; expires_at?: string | null } | null | undefined,
  now = new Date()
): boolean {
  if (!sub || String(sub.status || "").toLowerCase() !== "active") return false;
  if (!sub.expires_at) return true;
  return !isSubscriptionExpired(sub, now);
}