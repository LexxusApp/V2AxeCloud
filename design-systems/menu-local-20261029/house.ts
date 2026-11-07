// Records belong only to the standalone preview. No transport or storage layer.
import { DEMO_TODAY, type DemoGira } from './giras';
import type { DemoMember } from './MembersPage';
export type HouseObligation = { id: string; memberId: string; title: string; date: string; time: string; description: string; done: boolean; attachment?: File | null; attachmentPath?:string|null; created?:string; reminder?: boolean };
export const demoObligations: HouseObligation[] = [
  { id: 'house-1', memberId: 'demo-1', title: 'Acompanhamento individual', date: '2026-10-31', time: '17:00', description: 'Exemplo de compromisso. Os cuidados e fundamentos são definidos pela zeladoria.', done: false },
  { id: 'house-2', memberId: 'demo-2', title: 'Revisão com a zeladoria', date: '2026-10-27', time: '19:00', description: 'Agendamento fictício para demonstrar o acompanhamento de prazos.', done: false },
  { id: 'house-3', memberId: 'demo-3', title: 'Encontro de orientação', date: '2026-10-24', time: '16:00', description: 'Registro concluído de demonstração.', done: true },
];
export const obligationStatus = (item: HouseObligation) => item.done ? 'done' : item.date < DEMO_TODAY ? 'late' : 'upcoming';
export const houseDate = (date: string, time?: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'America/Sao_Paulo' }).format(new Date(`${date}T${time || '12:00'}:00-03:00`));
export type AttendanceMark = 'present' | 'absent' | 'excused';
export type AttendanceCall = { marks: Record<string, AttendanceMark>; closed: boolean };
export type HouseAttendance = Record<string, AttendanceCall>;
export const demoAttendance: HouseAttendance = { 'encontro-anterior': { closed: true, marks: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`demo-${i + 1}`, i < 7 ? 'present' : 'absent'])) as Record<string, AttendanceMark> } };
export const eligibleMembers = (members: DemoMember[], gira: DemoGira) => members.filter(m => m.joined <= gira.date);
export type HouseNotice = { id: string; title: string; body: string; audience: 'all' | 'selected'; memberIds: string[]; giraId: string; status: 'draft' | 'published'; updated: string; publishedAt: string; category?: 'Geral' | 'Urgente' | 'Festas' | 'Doutrina'; expires?: string; notifyWhatsApp?: boolean; notifyKey?: string; revision?: number; delivery?: 'none' | 'sending' | 'confirmed' | 'uncertain' | 'failed'; deliveryCounts?: {total:number;confirmed:number;failed:number;uncertain:number} };
export const demoNotices: HouseNotice[] = [
  { id: 'notice-1', title: 'Nosso próximo encontro está chegando.', body: 'A Gira de Caboclo está na agenda para 31 de outubro, às 20h. Consulte a organização do encontro e confirme sua participação. As orientações da casa são definidas pela zeladoria.', audience: 'all', memberIds: [], giraId: 'caboclo', status: 'published', updated: '2026-10-28T10:00:00-03:00', publishedAt: '2026-10-28T10:00:00-03:00' },
  { id: 'notice-2', title: 'Um espaço para manter a corrente informada.', body: 'Este é um comunicado de demonstração. Aqui você poderá reunir informações sobre encontros, organização e novidades da casa.', audience: 'all', memberIds: [], giraId: '', status: 'published', updated: '2026-10-25T15:30:00-03:00', publishedAt: '2026-10-25T15:30:00-03:00' },
  { id: 'notice-3', title: 'Preparar os avisos de novembro', body: 'Rascunho de exemplo para organizar os próximos avisos antes de publicá-los na prévia.', audience: 'all', memberIds: [], giraId: '', status: 'draft', updated: '2026-10-29T09:00:00-03:00', publishedAt: '' },
];
