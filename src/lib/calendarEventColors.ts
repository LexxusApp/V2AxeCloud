/** Cores e legenda dos tipos de evento no calendário do zelador. */

export const CALENDAR_EVENT_LEGEND = [
  { tipo: 'Gira', label: 'Gira', dotClass: 'bg-white' },
  { tipo: 'Festa', label: 'Festa', dotClass: 'bg-emerald-500' },
  { tipo: 'Manutenção', label: 'Caridade', dotClass: 'bg-sky-500' },
  { tipo: 'Reunião', label: 'Reunião', dotClass: 'bg-primary' },
] as const;

export function getCalendarEventDotClass(tipo?: string | null): string {
  switch (String(tipo || '').trim()) {
    case 'Festa':
      return 'bg-emerald-500';
    case 'Manutenção':
      return 'bg-sky-500';
    case 'Gira':
      return 'bg-white';
    case 'Reunião':
      return 'bg-primary';
    default:
      return 'bg-primary/70';
  }
}
