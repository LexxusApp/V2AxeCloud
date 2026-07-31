import { DEFAULT_PLAN_PRICES_REAIS } from '../constants/plans';

export type PlanCatalogEntryClient = {
  name?: string;
  price?: number;
  description?: string;
  price_cents?: number;
  annual_price?: number;
  annual_price_cents?: number;
};

export type PlansCatalogClient = Record<string, PlanCatalogEntryClient>;

export function formatPriceBRL(price?: number, fallback = '0,00'): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n.toFixed(2).replace('.', ',');
}

export function formatPriceLabel(price?: number, fallbackReais?: number): string {
  const fb = fallbackReais ?? DEFAULT_PLAN_PRICES_REAIS.premium;
  const n = Number(price);
  const value = Number.isFinite(n) && n > 0 ? n : fb;
  return `R$ ${formatPriceBRL(value)}`;
}

export type PremiumDisplayPrice = {
  amount: number;
  label: string;
  period: string;
  annualAmount: number;
  annualLabel: string;
  annualEquivalentMonthly: number;
  annualSavings: number;
  annualDiscountPercent: number;
  description: string;
  name: string;
};

export function premiumDisplayFromCatalog(
  plans: PlansCatalogClient,
  fallbacks?: Partial<PremiumDisplayPrice>
): PremiumDisplayPrice {
  const p = plans.premium;
  const amount =
    Number(p?.price) > 0 ? Number(p.price) : (fallbacks?.amount ?? DEFAULT_PLAN_PRICES_REAIS.premium);
  const annualAmount =
    Number(p?.annual_price) > 0 ? Number(p.annual_price) : amount * 10;
  const fullYear = amount * 12;
  return {
    amount,
    label: formatPriceLabel(p?.price, amount),
    period: fallbacks?.period ?? '/mês',
    annualAmount,
    annualLabel: formatPriceLabel(annualAmount),
    annualEquivalentMonthly: annualAmount / 12,
    annualSavings: Math.max(0, fullYear - annualAmount),
    annualDiscountPercent: fullYear > 0 ? Math.round((1 - annualAmount / fullYear) * 100) : 0,
    description:
      (typeof p?.description === 'string' && p.description.trim()) ||
      fallbacks?.description ||
      'Plano Premium completo para o seu terreiro. Pix na hora — acesso liberado automaticamente.',
    name: (typeof p?.name === 'string' && p.name.trim()) || fallbacks?.name || 'Plano Premium',
  };
}

export async function fetchPlansCatalog(): Promise<PlansCatalogClient> {
  const res = await fetch(`/api/plans?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Não foi possível carregar os planos.');
  const data = (await res.json()) as { plans?: PlansCatalogClient };
  return data.plans || {};
}
