import { useState } from 'react';
import { Check, Infinity, Loader2, ShieldCheck, Zap } from 'lucide-react';
import {
  PLAN_NAMES,
  canonicalPlanSlug,
  isLifetimePlan,
  DEFAULT_PLAN_PRICES_REAIS,
} from '../../constants/plans';
import { usePlansCatalog } from '../../hooks/usePlansCatalog';
import { formatPriceBRL } from '../../lib/plansDisplay';
import { useSubscriptionBillingCycle } from '../../hooks/useSubscriptionBillingCycle';

type SettingsSubscriptionPanelProps = {
  tenantData: Record<string, unknown> | null | undefined;
  onRenew?: (billingCycle: 'monthly' | 'annual') => void;
};

const PLAN_BENEFITS = [
  'Gestão completa do terreiro',
  'Financeiro e relatórios avançados',
  'Prontuário espiritual e atendimentos',
  'Loja do Axé e almoxarifado',
  'WhatsApp automatizado',
  'Acesso ilimitado à plataforma',
] as const;

function statusBadge(status: string | undefined, isLifetime: boolean, isTrial: boolean) {
  if (isTrial && !isLifetime) {
    return (
      <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-950/50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
        Período de teste
      </span>
    );
  }
  const active = status === 'active' || isLifetime;
  if (active) {
    return (
      <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
        Ativo
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-950/50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
        Pendente
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-zinc-600 bg-zinc-800/80 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
      Inativo
    </span>
  );
}

export function SettingsSubscriptionPanel({ tenantData, onRenew }: SettingsSubscriptionPanelProps) {
  const [renewError, setRenewError] = useState<string | null>(null);
  const { plans: plansConfig, loading: fetchingPlans } = usePlansCatalog();

  const planKey = canonicalPlanSlug(String(tenantData?.plan || ''));
  const isLifetime = isLifetimePlan(String(tenantData?.plan || ''));
  const currentPlanName = PLAN_NAMES[planKey] || plansConfig[String(tenantData?.plan || '')]?.name || String(tenantData?.plan || 'Premium');
  const expiresAt = tenantData?.expires_at
    ? new Date(String(tenantData.expires_at)).toLocaleDateString('pt-BR')
    : null;
  const displayPlanName = isLifetime
    ? planKey === 'vita'
      ? 'Mensalidade Vitalícia'
      : planKey === 'cortesia'
        ? 'Plano Cortesia'
        : `Plano ${currentPlanName}`
        : `Plano ${currentPlanName}`;
  const status = String(tenantData?.status || 'active');
  const isTrial = tenantData?.is_trial === true && !isLifetime;
  const billingCycle = useSubscriptionBillingCycle(
    String(tenantData?.tenant_id || ''),
    tenantData?.billing_cycle,
  );
  const monthlyPriceValue = plansConfig.premium?.price ?? DEFAULT_PLAN_PRICES_REAIS.premium;
  const annualPriceValue = plansConfig.premium?.annual_price ?? monthlyPriceValue * 10;
  const currentPrice = formatPriceBRL(
    billingCycle === 'annual' ? annualPriceValue : monthlyPriceValue,
  );

  function handleRenew() {
    setRenewError(null);
    onRenew?.(billingCycle);
  }

  if (fetchingPlans) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-[#1E242B] bg-[#13171D] p-8">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="settings-dark-surface animate-fadeIn space-y-6 rounded-[1.75rem] border border-[#252C35] bg-[#11151A] p-5 shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] sm:p-6">
      <div className="flex flex-col gap-2 border-b border-[#1E242B] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="font-display text-sm font-bold text-[#F1F5F9]">Plano e Assinatura</h6>
          <p className="mt-0.5 text-[11px] font-light text-gray-400">
            Situação da mensalidade e benefícios liberados para o terreiro.
          </p>
        </div>
        {statusBadge(status, isLifetime, isTrial)}
      </div>

      <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Plano contratado
              </span>
              <p className="text-xs font-bold text-[#F1F5F9]">{displayPlanName}</p>
            </div>
            <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Validade
              </span>
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#F1F5F9]">
                {isLifetime ? (
                  <>
                    <Infinity className="h-3.5 w-3.5 text-primary" aria-hidden />
                    Vitalício — sem expiração
                  </>
                ) : expiresAt ? (
                  isTrial ? `Teste grátis até ${expiresAt}` : `Até ${expiresAt}`
                ) : (
                  'Sem data definida'
                )}
              </p>
            </div>
            {!isLifetime && (
              <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3 sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Valor {billingCycle === 'annual' ? 'anual' : 'mensal'}
                </span>
                <p className="text-xs font-bold text-[#F1F5F9]">
                  R$ {currentPrice}
                  <span className="ml-1 font-normal text-gray-500">
                    / {billingCycle === 'annual' ? 'ano' : 'mês'}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Recursos incluídos
            </span>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {PLAN_BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-2 rounded-lg border border-[#1E242B]/70 bg-zinc-950/30 px-2.5 py-2"
                >
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                  <span className="text-[11px] font-medium leading-snug text-gray-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {!isLifetime && (
            <div className="space-y-3 border-t border-[#1E242B] pt-4">
              {isTrial ? (
                <p className="rounded-xl border border-sky-500/25 bg-sky-950/30 px-3 py-2 text-[11px] font-medium leading-snug text-sky-200">
                  Você está no teste grátis de 30 dias — nenhum pagamento foi realizado ainda.
                  Assine agora para garantir o acesso {billingCycle === 'annual' ? 'por 1 ano' : 'contínuo'} após{' '}
                  {expiresAt || 'o fim do teste'}.
                </p>
              ) : null}
              {renewError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-300">
                  {renewError}
                </p>
              ) : null}
              <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleRenew()}
                className="flex min-h-11 w-fit min-w-[13rem] items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-black text-[#080A0D] shadow-md shadow-primary/20 transition-all hover:bg-[#fde047]"
              >
                <Zap className="h-4 w-4 shrink-0" />
                {isTrial
                  ? billingCycle === 'annual'
                    ? 'Assinar plano anual agora'
                    : 'Assinar agora'
                  : 'Renovar assinatura'}
              </button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-[#1E242B]/70 bg-zinc-950/40 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
            <div>
              <span className="block text-[8px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                Pagamento seguro
              </span>
              <p className="mt-0.5 text-[10px] font-light leading-relaxed text-gray-500">
                Transações via PIX com EFI Bank. Dados criptografados e confirmação automática.
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
