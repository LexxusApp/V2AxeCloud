/** Linha de `financeiro` que representa mensalidade já quitada (não cobrança pendente). */
export function isPaidMensalidadeFinanceRow(t: Record<string, unknown>): boolean {
  if (String(t.tipo || "").toLowerCase() !== "entrada") return false;
  if (String(t.categoria || "") !== "Mensalidade") return false;
  const st = String(t.status || "").toLowerCase();
  if (st === "pendente") return false;
  if (st === "pago") return true;
  const desc = String(t.descricao || "");
  if (/\(vencimento/i.test(desc)) return false;
  if (/\(competência|\(competencia/i.test(desc)) return true;
  if (!st) return !/\(vencimento/i.test(desc);
  return false;
}
