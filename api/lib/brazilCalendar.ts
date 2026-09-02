const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

/** Data civil brasileira (YYYY-MM-DD), sem depender do fuso horário da VPS. */
export function brazilDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function brazilMonthStart(now = new Date()): string {
  return `${brazilDate(now).slice(0, 7)}-01`;
}
