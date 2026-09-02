export type GiraScheduleItem = {
  diaSemana: number;
  horario: string;
  titulo: string | null;
  observacao: string | null;
};

export const GIRA_WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeGiraSchedule(value: unknown, limit = 14): GiraScheduleItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: GiraScheduleItem[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const diaSemana = Number(item.diaSemana);
    const horario = String(item.horario || '').trim();
    if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6 || !TIME_PATTERN.test(horario)) continue;

    const titulo = String(item.titulo || '').trim().slice(0, 80) || null;
    const observacao = String(item.observacao || '').trim().slice(0, 160) || null;
    const key = `${diaSemana}:${horario}:${titulo || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ diaSemana, horario, titulo, observacao });
    if (normalized.length >= limit) break;
  }

  return normalized.sort((a, b) => a.diaSemana - b.diaSemana || a.horario.localeCompare(b.horario));
}

export function formatGiraTime(value: string): string {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(minute) === 0 ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

export function getNextGiraScheduleItem(
  schedule: GiraScheduleItem[],
  now = new Date(),
): { item: GiraScheduleItem; daysUntil: number } | null {
  const normalized = normalizeGiraSchedule(schedule);
  if (normalized.length === 0) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));
  const currentMinutes = Number(value('hour')) * 60 + Number(value('minute'));

  return normalized
    .map((item) => {
      const [hour, minute] = item.horario.split(':').map(Number);
      let daysUntil = (item.diaSemana - weekdayIndex + 7) % 7;
      if (daysUntil === 0 && hour * 60 + minute <= currentMinutes) daysUntil = 7;
      return { item, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.item.horario.localeCompare(b.item.horario))[0] || null;
}
