/** Obrigações de filho de santo — exibidas só na aba Obrigações, não no calendário de giras. */
export const OBRIGACAO_EVENT_TIPO = 'Obrigação';

export function isObrigacaoEvent(event: { tipo?: string | null }): boolean {
  return String(event.tipo || '').trim() === OBRIGACAO_EVENT_TIPO;
}

export function excludeObrigacaoEvents<T extends { tipo?: string | null }>(events: T[]): T[] {
  return events.filter((event) => !isObrigacaoEvent(event));
}
