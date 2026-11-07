import { creditProblem } from './shopLogic';
export type MenuProduct = { id: string; name: string; cents: number; icon: 'coffee' | 'snack' | 'water' | 'cake' | 'ritual' | 'herb'; category?: 'bebidas' | 'comidas' | 'liturgia'; badge?: string; transient?: boolean };
export type ConsumptionLine = { id: string; name: string; cents: number; quantity: number };
export type Consumption = { id: string; code?: string; memberId: string; memberName?: string; origin?: 'counter' | 'book'; lines: ConsumptionLine[]; settled: boolean; createdAt: number; settledAt?: number; receiptId?: string };
export type CantinaReceipt = { id: string; code: string; saleIds: string[]; memberId: string; memberName: string; cents: number; receivedAt: number; origin: 'counter' | 'book' };
export type CantinaState = { preferences?: Record<string, { limitCents: number; blocked: boolean }>; products: MenuProduct[]; cart: Record<string, number>; memberId: string; sales: Consumption[]; receipts: CantinaReceipt[] };
export const initialCantina: CantinaState = {
  products: [{ id: 'coffee', name: 'Café de terreiro', cents: 350, icon: 'coffee' }, { id: 'snack', name: 'Salgado assado', cents: 750, icon: 'snack' }, { id: 'water', name: 'Água mineral', cents: 350, icon: 'water' }, { id: 'cake', name: 'Bolo caseiro', cents: 450, icon: 'cake' }],
  cart: {}, memberId: '', sales: [], receipts: [],
};
export const consumptionTotal = (sale: Pick<Consumption, 'lines'>) => sale.lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);

export function recordCantinaConsumption(state: CantinaState, input: { id: string; at: number; method: 'cash' | 'credit'; memberName: string; externalDebtCents?: number }): CantinaState {
 if (state.sales.some(s => s.id === input.id)) return state;
 if (!input.id || !Number.isFinite(input.at)) throw new Error('Não foi possível identificar esta comanda. Feche e tente novamente.');
 const lines = state.products.filter(p => state.cart[p.id] > 0).map(p => ({ id: p.id, name: p.name, cents: p.cents, quantity: state.cart[p.id] }));
 if (!lines.length || lines.some(l => !Number.isSafeInteger(l.cents) || l.cents <= 0 || !Number.isInteger(l.quantity) || l.quantity <= 0 || l.quantity > 99)) throw new Error('Confira os itens e as quantidades da comanda.');
 if (input.method === 'credit' && (!state.memberId || !input.memberName)) throw new Error('Selecione um membro para anotar o consumo.');
 if (input.method === 'credit') { const preference = state.preferences?.[state.memberId] || { limitCents: 10000, blocked: false }; const debt = state.sales.filter(sale => sale.memberId === state.memberId && !sale.settled).reduce((sum, sale) => sum + consumptionTotal(sale), 0); const error = creditProblem({ ...preference, outstandingCents: debt + (input.externalDebtCents || 0) }, consumptionTotal({ lines })); if (error) throw new Error(error); }
 const paid = input.method === 'cash', receipts = state.receipts || [], name = input.memberName || 'Venda avulsa';
 const sale: Consumption = { id: input.id, code: `C-${String(state.sales.length + 1).padStart(4, '0')}`, memberId: state.memberId, memberName: name, origin: paid ? 'counter' : 'book', lines, settled: paid, createdAt: input.at, ...(paid ? { settledAt: input.at, receiptId: `receipt-${input.id}` } : {}) };
 const receipt: CantinaReceipt = { id: `receipt-${input.id}`, code: `R-${String(receipts.length + 1).padStart(4, '0')}`, saleIds: [sale.id], memberId: sale.memberId, memberName: name, cents: consumptionTotal(sale), receivedAt: input.at, origin: 'counter' };
 return { ...state, products: state.products.filter(product => !product.transient), cart: {}, sales: [...state.sales, sale], receipts: paid ? [...receipts, receipt] : receipts };
}

export function settleCantinaBook(state: CantinaState, input: { id: string; at: number; memberId: string; memberName: string }): CantinaState {
 const receipts = state.receipts || [];
 if (receipts.some(r => r.id === input.id)) return state;
 if (!input.id || !Number.isFinite(input.at)) throw new Error('Não foi possível identificar este recebimento. Feche e tente novamente.');
 const pending = state.sales.filter(s => s.memberId === input.memberId && !s.settled);
 if (!pending.length) return state;
 const ids = new Set(pending.map(s => s.id));
 const receipt: CantinaReceipt = { id: input.id, code: `R-${String(receipts.length + 1).padStart(4, '0')}`, saleIds: [...ids], memberId: input.memberId, memberName: input.memberName || pending[0].memberName || 'Membro', cents: pending.reduce((sum, sale) => sum + consumptionTotal(sale), 0), receivedAt: input.at, origin: 'book' };
 return { ...state, sales: state.sales.map(s => ids.has(s.id) ? { ...s, settled: true, settledAt: input.at, receiptId: receipt.id } : s), receipts: [...receipts, receipt] };
}

export function cantinaDay(at: number) { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(at); }
export function cantinaDate(at?: number) { return at !== undefined && Number.isFinite(at) ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }).format(at) : 'Horário não registrado'; }
