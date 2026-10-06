export type GiraReminderConfig = {
  intervalDays?: number | null;
  count?: number | null;
  mode?: "antes" | "recorrente" | "quantidade" | null;
  windowKind?: "relativa" | "absoluta" | null;
  windowStartDays?: number | null;
  windowEndDays?: number | null;
  windowStartDate?: string | null;
  windowEndDate?: string | null;
};

type GiraReminderInput = {
  todayYmd: string;
  eventYmd: string;
  daysUntil: number;
  config: GiraReminderConfig;
};

function validYmd(value: unknown): string | null {
  const text = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function inConfiguredWindow(input: GiraReminderInput): boolean {
  const { config, daysUntil, todayYmd } = input;
  if (config.windowKind === "absoluta") {
    const start = validYmd(config.windowStartDate);
    const end = validYmd(config.windowEndDate);
    if (start && todayYmd < start) return false;
    if (end && todayYmd > end) return false;
    return true;
  }

  const rawStart = Number(config.windowStartDays);
  const rawEnd = Number(config.windowEndDays);
  const hasStart = Number.isFinite(rawStart) && rawStart >= 0;
  const hasEnd = Number.isFinite(rawEnd) && rawEnd >= 0;
  if (!hasStart && !hasEnd) return true;
  const upper = hasStart ? Math.max(rawStart, hasEnd ? rawEnd : 0) : rawEnd;
  const lower = hasEnd ? Math.min(rawEnd, hasStart ? rawStart : rawEnd) : 0;
  return daysUntil >= lower && daysUntil <= upper;
}

function isQuantityDay(daysUntil: number, config: GiraReminderConfig): boolean {
  const count = Math.max(1, Math.floor(Number(config.count) || 0));
  const start = Math.max(0, Math.floor(Number(config.windowStartDays) || 0));
  const end = Math.max(0, Math.floor(Number(config.windowEndDays) || 0));
  const upper = Math.max(start, end);
  const lower = Math.min(start, end);
  if (upper === lower || count === 1) return daysUntil === lower;
  const selected = new Set<number>();
  for (let index = 0; index < count; index++) {
    selected.add(Math.round(upper - ((upper - lower) * index) / (count - 1)));
  }
  return selected.has(daysUntil);
}

/** Decide o envio diário sem depender do fuso do container. */
export function shouldSendGiraReminderToday(input: GiraReminderInput): boolean {
  const today = validYmd(input.todayYmd);
  const event = validYmd(input.eventYmd);
  const daysUntil = Math.floor(Number(input.daysUntil));
  if (!today || !event || !Number.isFinite(daysUntil) || daysUntil < 0 || today > event) return false;
  if (!inConfiguredWindow({ ...input, todayYmd: today, eventYmd: event, daysUntil })) return false;

  const mode = input.config.mode || "recorrente";
  const interval = Math.max(1, Math.floor(Number(input.config.intervalDays) || 0));
  if (mode === "antes") return daysUntil === interval;
  if (mode === "quantidade") return isQuantityDay(daysUntil, input.config);
  return daysUntil === 0 || daysUntil % interval === 0;
}
