import { cantinaDay, consumptionTotal, type CantinaState, type Consumption } from './cantina';
export type CantinaHistoryView = 'orders' | 'receipts';
export type CantinaHistoryFilter = { query: string; period: 'all' | 'today' | '7' | '30'; status: 'all' | 'open' | 'paid'; origin: 'all' | 'counter' | 'book' };
export type CantinaHistoryRow = { id: string; code: string; memberName: string; at: number; cents: number; paid: boolean; origin: 'counter' | 'book'; sales: Consumption[]; receivedAt?: number; receiptCode?: string };
export function cantinaHistoryRows(state: CantinaState, view: CantinaHistoryView, members: readonly { id: string; name: string }[]): CantinaHistoryRow[] {
 const receipts = state.receipts || [], name = (sale: Consumption) => sale.memberName || members.find(m => m.id === sale.memberId)?.name || (sale.memberId ? 'Membro não disponível' : 'Venda avulsa');
 const rows: CantinaHistoryRow[] = view === 'orders' ? state.sales.map((sale, i) => ({ id: sale.id, code: sale.code || `C-${String(i + 1).padStart(4, '0')}`, memberName: name(sale), at: sale.createdAt, cents: consumptionTotal(sale), paid: sale.settled, origin: sale.origin || (sale.memberId ? 'book' : 'counter'), sales: [sale], receivedAt: sale.settledAt, receiptCode: receipts.find(r => r.id === sale.receiptId)?.code })) : receipts.map(receipt => ({ id: receipt.id, code: receipt.code, memberName: receipt.memberName, at: receipt.receivedAt, cents: receipt.cents, paid: true, origin: receipt.origin, sales: receipt.saleIds.map(id => state.sales.find(s => s.id === id)).filter((s): s is Consumption => !!s), receivedAt: receipt.receivedAt }));
 return rows.filter(row => Number.isFinite(row.at)).sort((a, b) => b.at - a.at || b.code.localeCompare(a.code));
}
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
export function filterCantinaHistory(rows: readonly CantinaHistoryRow[], filters: CantinaHistoryFilter, now: number) {
 const today = cantinaDay(now), cutoff = new Date(`${today}T12:00:00Z`);
 if (filters.period === '7' || filters.period === '30') cutoff.setUTCDate(cutoff.getUTCDate() - Number(filters.period) + 1);
 const first = filters.period === 'all' ? '' : cutoff.toISOString().slice(0, 10), query = normalized(filters.query);
 return rows.filter(row => { const day = cantinaDay(row.at); return (!first || day >= first && day <= today) && (filters.origin === 'all' || row.origin === filters.origin) && (filters.status === 'all' || row.paid === (filters.status === 'paid')) && normalized(`${row.code} ${row.memberName} ${row.receiptCode || ''} ${row.sales.map(s => `${s.code || ''} ${s.lines.map(l => l.name).join(' ')}`).join(' ')}`).includes(query); });
}
