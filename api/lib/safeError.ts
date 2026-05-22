/** Mensagem genérica para respostas HTTP — evita vazar schema/SQL interno. */
export function safeErrorMessage(err: unknown, fallback = "Erro interno do servidor."): string {
  if (!err || typeof err !== "object") return fallback;
  const msg = String((err as { message?: string }).message || "").trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (
    lower.includes("does not exist") ||
    lower.includes("pgrst") ||
    lower.includes("postgres") ||
    lower.includes("relation ") ||
    lower.includes("column ") ||
    lower.includes("violates") ||
    lower.includes("duplicate key")
  ) {
    return fallback;
  }
  return msg.slice(0, 200);
}
