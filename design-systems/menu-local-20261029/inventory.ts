export const inventoryCategories = ['Camarinha', 'Rituais', 'Cozinha de Santo', 'Vestuário', 'Limpeza'] as const;
export type InventoryCategory = typeof inventoryCategories[number];
export const inventoryUnits = ['un.', 'kg', 'L', 'm', 'maços', 'garrafas'] as const;
export type InventoryUnit = typeof inventoryUnits[number];
export type StockItem = { id: string; name: string; category: InventoryCategory; unit: InventoryUnit; quantity: number; minimum: number; location: string; notes: string };
// Quantities use integer thousandths of each item's unit. Different units are never summed.
export type StockMovement = { id: string; itemId: string; name: string; unit: InventoryUnit; kind: 'initial' | 'in' | 'out' | 'adjust'; before: number; after: number; note: string; created: string };
export type LocalInventory = { items: StockItem[]; movements: StockMovement[] };
export const fractionalUnit = (unit: InventoryUnit) => ['kg', 'L', 'm'].includes(unit);
export const stockNumber = (value: number) => (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const stockStatus = (item: StockItem) => item.quantity === 0 ? 'out' : item.quantity < item.minimum ? 'low' : 'ok';
export const stockNeed = (item: StockItem) => Math.max(0, item.minimum - item.quantity);
export const stockStamp = (stamp: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(stamp));
export const stockInput = (value: number) => String(value / 1000).replace('.', ',');
export function parseStockAmount(raw: string, unit: InventoryUnit): number | null {
  const input = raw.trim();
  if (!/^\d{1,7}(?:[.,]\d{1,3})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.replace(',', '.').split('.');
  const value = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (!Number.isSafeInteger(value) || value > 1_000_000_000 || (!fractionalUnit(unit) && value % 1000 !== 0)) return null;
  return value;
}
export function applyStockMovement(item: StockItem, kind: 'in' | 'out' | 'adjust', amount: number): number | null {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000 || (!fractionalUnit(item.unit) && amount % 1000 !== 0)) return null;
  if (kind !== 'adjust' && amount === 0) return null;
  const next = kind === 'adjust' ? amount : kind === 'in' ? item.quantity + amount : item.quantity - amount;
  return next >= 0 && next <= 1_000_000_000 && next !== item.quantity ? next : null;
}
const seedItems: StockItem[] = [
  { id: 'vela', name: 'Vela de 7 dias branca', category: 'Rituais', unit: 'un.', quantity: 4000, minimum: 10000, location: 'Armário A · prateleira 1', notes: '' },
  { id: 'arruda', name: 'Arruda fresca', category: 'Rituais', unit: 'maços', quantity: 2000, minimum: 4000, location: 'Área de preparo', notes: 'Conferir a conservação antes do uso.' },
  { id: 'agua', name: 'Água mineral 500 ml', category: 'Cozinha de Santo', unit: 'garrafas', quantity: 0, minimum: 12000, location: 'Despensa', notes: '' },
  { id: 'arroz', name: 'Arroz branco', category: 'Cozinha de Santo', unit: 'kg', quantity: 8000, minimum: 5000, location: 'Despensa', notes: '' },
  { id: 'pano', name: 'Tecido branco', category: 'Camarinha', unit: 'm', quantity: 3000, minimum: 2000, location: 'Armário B', notes: '' },
  { id: 'sabao', name: 'Sabão neutro', category: 'Limpeza', unit: 'un.', quantity: 6000, minimum: 3000, location: 'Armário de limpeza', notes: '' },
  { id: 'toalha', name: 'Toalha branca', category: 'Vestuário', unit: 'un.', quantity: 5000, minimum: 4000, location: 'Armário B', notes: '' },
  { id: 'cafe', name: 'Café em pó', category: 'Cozinha de Santo', unit: 'kg', quantity: 1500, minimum: 1000, location: 'Despensa', notes: '' },
];
export const demoInventory: LocalInventory = {
  items: seedItems,
  movements: seedItems.map((item, index) => ({ id: `initial-${item.id}`, itemId: item.id, name: item.name, unit: item.unit, kind: 'initial', before: 0, after: item.quantity, note: 'Saldo inicial de demonstração.', created: `2026-10-29T08:${String(index).padStart(2, '0')}:00-03:00` })),
};
