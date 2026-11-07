export type CreditSnapshot = { limitCents: number; blocked: boolean; outstandingCents: number };
export function creditProblem(credit: CreditSnapshot | undefined, cents: number): string | null { if (!credit) return null; if (credit.blocked) return 'A caderneta deste membro está bloqueada. Revise as condições ou registre à vista.'; if (credit.outstandingCents + cents > credit.limitCents) return 'O valor ultrapassa o limite compartilhado da Cantina e da Loja. Revise a comanda ou o limite do membro.'; return null; }
export const shopCategories = ['Velas', 'Guias', 'Roupas', 'Ervas', 'Outros'] as const;
export type ShopCategory = typeof shopCategories[number];
export type ShopPhoto = { source: string | File; kind: 'generated' | 'local' } | null;
export type ShopProduct = { id: string; name: string; description: string; category: ShopCategory; cents: number; stock: number; minimum: number; photo: ShopPhoto; archived: boolean };
export type ShopMethod = 'cash' | 'pix' | 'book' | 'reserve';
export type ShopLine = { productId: string; name: string; cents: number; quantity: number };
export type ShopOrder = { id: string; code: string; checkoutId: string; memberId: string | null; memberName: string; lines: ShopLine[]; method: ShopMethod; status: 'reserved' | 'pending' | 'paid' | 'cancelled'; delivered: boolean; created: string; received?: string };
export type LocalShop = { products: ShopProduct[]; cart: Record<string, number>; cartId: string; orders: ShopOrder[] };
export type ShopResult = { ok: true; state: LocalShop; order?: ShopOrder } | { ok: false; message: string };
const MAX_STOCK = 99999;
export const shopTotal = (lines: ShopLine[]) => lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);
export const shopMoney = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function shopPrice(raw: string): number | null { const input = raw.trim(); if (!/^\d{1,5}(?:,\d{1,2})?$/.test(input)) return null; const [whole, fraction = ''] = input.split(','); const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0')); return Number.isSafeInteger(result) && result <= 1000000 ? result : null; }
export function shopQuantity(raw: string): number | null { if (!/^\d{1,5}$/.test(raw.trim())) return null; const value = Number(raw.trim()); return value <= MAX_STOCK ? value : null; }
export const shopDate = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(stamp));
export function shopDay(stamp: string) { const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date(stamp)); return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-'); }
export function shopCartLines(state: LocalShop): ShopLine[] { return Object.entries(state.cart).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => { const product = state.products.find(item => item.id === id); return { productId: id, name: product?.name || 'Produto indisponível', cents: product?.cents || 0, quantity }; }); }
export const shopSignature = (state: LocalShop) => JSON.stringify(shopCartLines(state).sort((a, b) => a.productId.localeCompare(b.productId)).map(line => ({ ...line, stock: state.products.find(product => product.id === line.productId)?.stock, archived: state.products.find(product => product.id === line.productId)?.archived })));
export function checkShopCart(state: LocalShop): string | null {
  if (!Object.keys(state.cart).length) return 'Adicione um produto à sacola.';
  for (const [id, quantity] of Object.entries(state.cart)) {
    const product = state.products.find(item => item.id === id);
    if (!product || product.archived) return 'Um produto saiu do catálogo. Revise a sacola.';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > product.stock) return `Quantidade indisponível para ${product.name}. Revise a sacola.`;
    if (!Number.isSafeInteger(product.cents) || product.cents < 0 || product.cents > 1000000) return 'O preço de um produto precisa ser revisado.';
  }
  return null;
}
export function checkoutShop(state: LocalShop, input: { checkoutId: string; signature: string; method: ShopMethod; memberId: string | null; memberName: string; memberIds: string[]; now: string; nextCartId: string; credit?: CreditSnapshot }): ShopResult {
  const existing = state.orders.find(order => order.checkoutId === input.checkoutId);
  if (existing) return { ok: true, state, order: existing };
  if (input.checkoutId !== state.cartId || input.signature !== shopSignature(state)) return { ok: false, message: 'A sacola mudou. Volte à revisão antes de confirmar.' };
  const error = checkShopCart(state); if (error) return { ok: false, message: error };
  if (!['cash', 'pix', 'book', 'reserve'].includes(input.method)) return { ok: false, message: 'Escolha uma forma de registrar o pedido.' };
  if (input.memberId && !input.memberIds.includes(input.memberId) || (input.method === 'book' || input.method === 'reserve') && !input.memberId) return { ok: false, message: 'Escolha um membro da casa para a caderneta ou reserva.' };
  const creditError = input.method === 'book' ? creditProblem(input.credit, shopTotal(shopCartLines(state))) : null; if (creditError) return { ok: false, message: creditError };
  const lines = shopCartLines(state).map(line => ({ ...line }));
  const order: ShopOrder = { id: `shop-${input.checkoutId}`, code: `L-${String(state.orders.length + 1).padStart(4, '0')}`, checkoutId: input.checkoutId, memberId: input.memberId, memberName: input.memberName || 'Venda avulsa', lines, method: input.method, status: input.method === 'reserve' ? 'reserved' : input.method === 'cash' ? 'paid' : 'pending', delivered: false, created: input.now, ...(input.method === 'cash' ? { received: input.now } : {}) };
  return { ok: true, order, state: { ...state, cart: {}, cartId: input.nextCartId, products: state.products.map(product => ({ ...product, stock: product.stock - (state.cart[product.id] || 0) })), orders: [...state.orders, order] } };
}
export type ShopAction = 'receive' | 'cancel' | 'deliver' | 'reopen' | 'to-pix' | 'to-book' | 'to-cash';
export function actShopOrder(state: LocalShop, id: string, action: ShopAction, now: string, memberIds: string[], credit?: CreditSnapshot): ShopResult {
  const order = state.orders.find(item => item.id === id); if (!order) return { ok: false, message: 'Pedido não encontrado. Atualize a loja e tente novamente.' };
  let next: ShopOrder = { ...order }; let products = state.products;
  if (action === 'receive') {
    if (order.status === 'paid') return { ok: true, state, order };
    if (order.status !== 'pending') return { ok: false, message: 'Este pedido não aguarda recebimento.' };
    next = { ...order, status: 'paid', received: now };
  } else if (action === 'cancel') {
    if (order.status === 'cancelled') return { ok: true, state, order };
    if (!['reserved', 'pending'].includes(order.status) || order.delivered) return { ok: false, message: 'Cancele somente uma reserva ou pedido pendente ainda não entregue.' };
    for (const line of order.lines) { const product = products.find(item => item.id === line.productId); if (!product || product.stock + line.quantity > MAX_STOCK) return { ok: false, message: 'Confira o estoque do produto antes de cancelar.' }; }
    products = products.map(product => ({ ...product, stock: product.stock + (order.lines.find(line => line.productId === product.id)?.quantity || 0) })); next = { ...order, status: 'cancelled', received: undefined };
  } else if (action === 'deliver') {
    if (order.status !== 'paid') return { ok: false, message: 'Confirme o recebimento antes de marcar a entrega.' };
    if (order.delivered) return { ok: true, state, order }; next = { ...order, delivered: true };
  } else if (action === 'reopen') {
    if (order.status !== 'paid') return { ok: false, message: 'Só uma baixa confirmada pode ser reaberta.' };
    next = { ...order, status: 'pending', received: undefined };
  } else if (['to-pix', 'to-book', 'to-cash'].includes(action)) {
    if (order.status !== 'reserved') return { ok: false, message: 'Este pedido não é uma reserva aberta.' };
    if (action === 'to-book' && (!order.memberId || !memberIds.includes(order.memberId))) return { ok: false, message: 'O membro da reserva não está disponível para a caderneta.' };
    const creditError = action === 'to-book' ? creditProblem(credit, shopTotal(order.lines)) : null; if (creditError) return { ok: false, message: creditError };
    next = { ...order, method: action === 'to-pix' ? 'pix' : action === 'to-book' ? 'book' : 'cash', status: action === 'to-cash' ? 'paid' : 'pending', ...(action === 'to-cash' ? { received: now } : {}) };
  } else return { ok: false, message: 'Ação de pedido não reconhecida.' };
  return { ok: true, order: next, state: { ...state, products, orders: state.orders.map(item => item.id === id ? next : item) } };
}
export function shopReceipts(state: LocalShop) { return state.orders.filter(order => order.status === 'paid' && !!order.received && shopTotal(order.lines) > 0).map(order => ({ id: `shop-receipt-${order.id}`, description: `Loja · pedido ${order.code}`, category: 'Loja', kind: 'income' as const, cents: shopTotal(order.lines), date: shopDay(order.received!), createdAt: Date.parse(order.received!), memberId: order.memberId || undefined, memberName: order.memberName, source: 'store' as const })); }
export const shopPending = (state: LocalShop) => state.orders.filter(order => order.status === 'pending').reduce((sum, order) => sum + shopTotal(order.lines), 0);
export const shopOrderLabel = (order: ShopOrder) => order.status === 'cancelled' ? 'Cancelado' : order.status === 'reserved' ? 'Reservado · sem débito' : order.status === 'pending' ? order.delivered ? 'Entregue · cobrança reaberta' : 'Aguardando pagamento' : order.delivered ? 'Entregue' : 'Pago · a entregar';
