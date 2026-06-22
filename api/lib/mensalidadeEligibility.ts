import {
  addMonths,
  endOfMonth,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";

export function clampDayInMonth(year: number, monthIndex0: number, dayWanted: number): Date {
  const last = endOfMonth(new Date(year, monthIndex0, 1)).getDate();
  const d = Math.min(Math.max(1, dayWanted), last);
  return new Date(year, monthIndex0, d);
}

/** Primeiro vencimento (dia fixo) no mês da inclusão que não seja antes da data de inclusão. */
export function firstDueOnOrAfterInclusion(inclusao: Date, diaVenc: number): Date {
  const d = Math.min(Math.max(1, Math.floor(diaVenc) || 10), 31);
  let y = inclusao.getFullYear();
  let m = inclusao.getMonth();
  let candidate = clampDayInMonth(y, m, d);
  if (isBefore(candidate, startOfDay(inclusao))) {
    const nm = addMonths(new Date(y, m, 1), 1);
    candidate = clampDayInMonth(nm.getFullYear(), nm.getMonth(), d);
  }
  return candidate;
}

function parseChildDateField(raw: unknown): Date | null {
  if (!raw) return null;
  const parsed = parseISO(String(raw).trim().slice(0, 10));
  return isValid(parsed) ? startOfDay(parsed) : null;
}

/**
 * Data a partir da qual o filho passa a ser cobrado:
 * o mais recente entre data_entrada (terreiro) e created_at (cadastro no sistema).
 * Evita mensalidade retroativa ao migrar filhos com entrada histórica.
 */
export function childInclusionDateForMensalidade(child: {
  data_entrada?: string | null;
  created_at?: string | null;
}): Date | null {
  const candidates = [
    parseChildDateField(child.data_entrada),
    parseChildDateField(child.created_at),
  ].filter((d): d is Date => d != null);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
}

/** Filho deve ter mensalidade pendente com vencimento `dueStr`? */
export function childEligibleForDueMonth(
  child: { data_entrada?: string | null; created_at?: string | null },
  dueStr: string,
  diaVencimento = 10
): boolean {
  const inclusion = childInclusionDateForMensalidade(child);
  if (!inclusion) return false;
  const due = startOfDay(parseISO(dueStr));
  const firstDue = startOfDay(firstDueOnOrAfterInclusion(inclusion, diaVencimento));
  return due.getTime() >= firstDue.getTime();
}
