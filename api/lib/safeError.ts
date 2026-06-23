/** Mensagem genérica para respostas HTTP — evita vazar schema/SQL interno. */
export function safeErrorMessage(err: unknown, fallback = "Erro interno do servidor."): string {
  if (!err || typeof err !== "object") return fallback;
  const msg = String((err as { message?: string }).message || "").trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  const internalPatterns = [
    "does not exist",
    "pgrst",
    "postgres",
    "relation ",
    "column ",
    "violates",
    "duplicate key",
    "syntax error",
    "permission denied",
    "invalid input syntax",
    "null value",
    "foreign key",
    "42p",
    "235",
    "22p",
  ];
  if (internalPatterns.some((p) => lower.includes(p))) {
    return fallback;
  }
  if (process.env.NODE_ENV === "production") {
    if (/\b(select|insert|update|delete|from|where|join)\b/i.test(msg)) return fallback;
    if (msg.length > 160) return fallback;
  }
  return msg.slice(0, 200);
}
