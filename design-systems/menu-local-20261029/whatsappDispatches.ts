export type DispatchStatus = 'queued' | 'sending' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
export type DispatchKind = 'gira' | 'monthly' | 'cantina' | 'obligation' | 'notice';
export type DispatchEvent = { status: DispatchStatus; at: string };
export type WhatsAppDispatch = { id: string; externalId?:string; memberId?:string; currentStatus?:DispatchStatus; recipient: string; maskedPhone: string; kind: DispatchKind; title: string; template: string; message: string; createdAt: string; events: DispatchEvent[]; statusTimestampUnknown?:boolean; failure?: { reason: string; guidance: string } };
export type DispatchGroup = 'all' | 'success' | 'failed' | 'pending';
export type DispatchFilter = { query: string; kind: 'all' | DispatchKind; period: '7' | '30' | 'all'; group: DispatchGroup };
export const dispatchKinds: Record<DispatchKind, string> = { gira: 'Gira', monthly: 'Mensalidade', cantina: 'Cantina', obligation: 'Obrigação', notice: 'Comunicado' };
export const dispatchStatuses: Record<DispatchStatus, string> = { queued: 'Na fila', sending:'Enviando', accepted:'Aceito pelo WhatsApp', sent: 'Enviado', delivered: 'Entregue', read: 'Lido', failed: 'Falhou', unknown:'Situação não informada' };
export const dispatchGroup = (status: DispatchStatus): Exclude<DispatchGroup, 'all'> => status === 'failed' ? 'failed' : status === 'read' || status === 'delivered' ? 'success' : 'pending';
export function dispatchEvents(record: WhatsAppDispatch) { return record.events.filter(e => Number.isFinite(Date.parse(e.at))).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); }
export function dispatchStatus(record: WhatsAppDispatch): DispatchStatus { return record.currentStatus ?? dispatchEvents(record).at(-1)?.status ?? 'queued'; }
export function dispatchDate(value: string) { return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Data não disponível'; }
const dayKey = (value: string) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export function filterDispatches(records: readonly WhatsAppDispatch[], filters: DispatchFilter, asOf: string) {
 const end = Date.parse(asOf); if (!Number.isFinite(end)) return [];
 const endDay = dayKey(asOf), cutoff = new Date(`${endDay}T12:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - (Number(filters.period) - 1));
 const startDay = filters.period === 'all' ? '' : cutoff.toISOString().slice(0, 10), query = normalized(filters.query);
 return records.filter(record => { const time = Date.parse(record.createdAt); if (!Number.isFinite(time) || time > end) return false; const day = dayKey(record.createdAt); return (!startDay || day >= startDay) && (filters.kind === 'all' || record.kind === filters.kind) && (filters.group === 'all' || dispatchGroup(dispatchStatus(record)) === filters.group) && normalized(`${record.recipient} ${record.maskedPhone} ${record.title} ${record.template} ${record.id} ${dispatchKinds[record.kind]}`).includes(query); }).slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

