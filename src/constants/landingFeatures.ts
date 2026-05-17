import { DEFAULT_PLAN_PRICES_REAIS } from './plans';

const premiumReais = DEFAULT_PLAN_PRICES_REAIS.premium;
const premiumLabel = `R$ ${premiumReais.toFixed(2).replace('.', ',')}`;

/** Preço do onboarding Premium (checkout EFI) — fallback UI; valor real vem de /api/v1/checkout/efi/config. */
export const LANDING_PRICE = {
  amount: premiumReais,
  label: premiumLabel,
  period: '/mês',
  description: 'Plano Premium completo para o seu terreiro. Pix na hora — acesso liberado automaticamente.',
};
