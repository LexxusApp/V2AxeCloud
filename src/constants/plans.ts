export type PlanType = 'premium' | 'cortesia' | 'vita';

const PREMIUM_LIKE_FEATURES = [
  'dashboard', 'children', 'calendar', 'gestao_eventos', 'mural', 'chat', 'gallery', 'inventory', 'library', 'notes',
  'financial', 'financial_reports', 'financial_whatsapp', 'whatsapp_invites', 'store', 'settings',
  'caixinha', 'saude_axe', 'atendimentos',
] as const;

/** Normaliza slug gravado no banco (ex.: "Plano Vita", "plano_vita", "Orô") para chave usada em PLAN_FEATURES / PLAN_LIMITS. */
export function canonicalPlanSlug(plan: string | undefined): string {
  if (!plan) return 'premium';
  // Normaliza acentos/diacríticos: "Orô" → "oro", "Axé" → "axe", etc.
  const stripped = plan.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const p = stripped.toLowerCase().trim().replace(/\s+/g, ' ');
  const compact = p.replace(/[\s_-]/g, '');

  if (p === 'vita' || p === 'plano vita' || compact === 'planovita') return 'vita';
  if (p === 'premium' || compact === 'premium') return 'premium';
  if (p === 'oro' || compact === 'oro' || compact === 'planoor') return 'premium';
  if (p === 'cortesia' || compact === 'cortesia') return 'cortesia';
  if (p === 'axe' || p === 'free' || compact === 'axe' || compact === 'free') return 'premium';
  return p;
}

/** Cortesia e Plano Vita: acesso completo e sem exigência de renovação por data. */
export function isLifetimePlan(plan: string | undefined): boolean {
  const c = canonicalPlanSlug(plan);
  return c === 'cortesia' || c === 'vita';
}

/** Premium + planos vitalícios com todas as funções. */
export function hasPremiumTierFeatures(plan: string | undefined): boolean {
  const c = canonicalPlanSlug(plan);
  return c === 'premium' || c === 'cortesia' || c === 'vita';
}

/** Assinatura com data distante (evita bloqueio por expiração). */
export function usesDistantSubscriptionExpiry(plan: string | undefined): boolean {
  if (!plan) return false;
  const raw = plan.toLowerCase().trim();
  if (raw === 'premium') return true;
  return isLifetimePlan(plan);
}

export const PLAN_LIMITS: Record<string, number> = {
  premium: 999999,
  cortesia: 999999,
  vita: 999999,
};

export const PLAN_FEATURES: Record<string, string[]> = {
  premium: [...PREMIUM_LIKE_FEATURES],
  cortesia: [...PREMIUM_LIKE_FEATURES],
  vita: [...PREMIUM_LIKE_FEATURES],
};

export const PLAN_NAMES: Record<string, string> = {
  premium: 'Premium',
  cortesia: 'Cortesia',
  vita: 'Plano Vita',
};

import { PLAN_PRICE_STANDARD_REAIS } from '../../lib/planPricing';

/** Preços padrão (reais) quando /api/plans não responde — espelha api/lib/plansCatalog.ts */
export const DEFAULT_PLAN_PRICES_REAIS: Record<string, number> = {
  premium: PLAN_PRICE_STANDARD_REAIS,
  vita: 49.9,
};

export type Feature = 'dashboard' | 'children' | 'calendar' | 'gestao_eventos' | 'whatsapp_invites' | 'mural' | 'chat' | 'gallery' | 'inventory' | 'library' | 'notes' | 'financial' | 'store' | 'settings' | 'subscription' | 'caixinha' | 'saude_axe' | 'atendimentos';

export const hasPlanAccess = (plan: string | undefined, feature: string, isAdminGlobal: boolean = false): boolean => {
  if (isAdminGlobal) return true;
  if (!plan) return PLAN_FEATURES.premium.includes(feature);

  const key = canonicalPlanSlug(plan);
  const features = PLAN_FEATURES[key] || PLAN_FEATURES.premium;

  return features.includes(feature);
};
