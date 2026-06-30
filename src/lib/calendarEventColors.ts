/** Cores e legenda dos tipos de evento no calendário do zelador. */

export const CALENDAR_EVENT_LEGEND = [
  { tipo: 'Gira', label: 'Gira', swatchClass: 'bg-rose-500' },
  { tipo: 'Festa', label: 'Festa', swatchClass: 'bg-emerald-500' },
  { tipo: 'Manutenção', label: 'Caridade', swatchClass: 'bg-sky-500' },
  { tipo: 'Reunião', label: 'Reunião', swatchClass: 'bg-violet-500' },
] as const;

export function getCalendarEventCellClass(tipo?: string | null): string {
  switch (String(tipo || '').trim()) {
    case 'Festa':
      return 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]';
    case 'Manutenção':
      return 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.35)]';
    case 'Gira':
      return 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)]';
    case 'Reunião':
      return 'bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]';
    default:
      return 'bg-rose-500/80 text-white shadow-[0_0_12px_rgba(244,63,94,0.25)]';
  }
}

export function getCalendarEventSwatchClass(tipo?: string | null): string {
  switch (String(tipo || '').trim()) {
    case 'Festa':
      return 'bg-emerald-500';
    case 'Manutenção':
      return 'bg-sky-500';
    case 'Gira':
      return 'bg-rose-500';
    case 'Reunião':
      return 'bg-violet-500';
    default:
      return 'bg-rose-500/80';
  }
}
