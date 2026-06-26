import { useState } from 'react';
import { Check, Crown, Infinity, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  PLAN_NAMES,
  canonicalPlanSlug,
  isLifetimePlan,
  DEFAULT_PLAN_PRICES_REAIS,
} from '../../constants/plans';
import { usePlansCatalog } from '../../hooks/usePlansCatalog';
import { formatPriceBRL } from '../../lib/plansDisplay';
import { ROUTES } from '../../lib/routes';

type SettingsSubscriptionPanelProps = {
  tenantData: Record<string, unknown> | null | undefined;
};

const PLAN_BENEFITS = [
  'Gestão completa do terreiro',
  'Financeiro e relatórios avançados',
  'Prontuário espiritual e atendimentos',
  'Loja do Axé e almoxarifado',
  'WhatsApp automatizado',
  'Acesso ilimitado à plataforma',
] as const;

function planAccent(planKey: string, isLifetime: boolean) {
  if (isLifetime && planKey === 'vita') {
    return {
      bar: 'from-primary via-amber-400 to-primary',
      iconBg: 'bg-primary/15 border-primary/30',
      icon: 'text-primary',
      badge: 'border-primary/25 bg-primary/10 text-primary',
    };
  }
  if (isLifetime && planKey === 'cortesia') {
    return {
      bar: 'from-violet-500 via-fuchsia-400 to-violet-600',
      iconBg: 'bg-violet-500/15 border-violet-500/30',
      icon: 'text-violet-400',
      badge: 'border-violet-500/25 bg-violet-950/40 text-violet-300',
    };
  }
  return {
    bar: 'from-primary via-[#FDE047] to-primary',
    iconBg: 'bg-primary/15 border-primary/30',
    icon: 'text-primary',
    badge: 'border-primary/25 bg-primary/10 text-primary',
  };
}

function statusBadge(status: string | undefined, isLifetime: boolean) {
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

export function SettingsSubscriptionPanel({ tenantData }: SettingsSubscriptionPanelProps) {
  const [renewLoading, setRenewLoading] = useState(false);
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
  const accent = planAccent(planKey, isLifetime);
  const status = String(tenantData?.status || 'active');
  const monthlyPrice = formatPriceBRL(
    plansConfig.premium?.price ?? DEFAULT_PLAN_PRICES_REAIS.premium,
  );

  function handleRenew() {
    setRenewLoading(true);
    window.location.href = ROUTES.checkout;
  }

  if (fetchingPlans) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-[#1E242B] bg-[#13171D] p-8">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6 rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-[#1E242B] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h6 className="font-display text-sm font-bold text-[#F1F5F9]">Plano e Assinatura</h6>
          <p className="mt-0.5 text-[11px] font-light text-gray-400">
            Situação da mensalidade e benefícios liberados para o terreiro.
          </p>
        </div>
        {statusBadge(status, isLifetime)}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
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
                  `Até ${expiresAt}`
                ) : (
                  'Sem data definida'
                )}
              </p>
            </div>
            {!isLifetime && (
              <div className="space-y-1 rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3 sm:col-span-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Valor mensal
                </span>
                <p className="text-xs font-bold text-[#F1F5F9]">
                  R$ {monthlyPrice}
                  <span className="ml-1 font-normal text-gray-500">/ mês</span>
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
            <button
              type="button"
              onClick={handleRenew}
              disabled={renewLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-[#080A0D] shadow-md shadow-primary/15 transition-all hover:bg-[#fde047] disabled:opacity-50 sm:w-auto sm:px-6"
            >
              {renewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Renovar assinatura
            </button>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            Cartão do plano
          </span>

          <div className="group relative overflow-hidden rounded-2xl border border-[#1E242B] bg-gradient-to-b from-[#1E2530] to-[#12161A] p-5 text-center shadow-lg">
            <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accent.bar)} />

            <div className="relative space-y-4 pt-2">
              <div className="relative mx-auto h-16 w-16">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-md filter" />
                <div
                  className={cn(
                    'relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner',
                    accent.iconBg,
                  )}
                >
                  <Crown className={cn('h-7 w-7', accent.icon)} aria-hidden />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 z-20 h-4 w-4 rounded-full border-2 border-[#1E252E] bg-emerald-500" />
              </div>

              <div>
                <h6 className="font-display text-base font-black text-[#F1F5F9]">{displayPlanName}</h6>
                <span
                  className={cn(
                    'mt-2 inline-block rounded border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wide',
                    accent.badge,
                  )}
                >
                  {isLifetime ? 'Acesso vitalício' : 'Assinatura mensal'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 border-t border-[#1E242B]/80 pt-3 text-[9px] leading-normal text-[#94A3B8]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Todos os módulos liberados no painel
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[#1E242B]/70 bg-zinc-950/40 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
            <div>
              <span className="block text-[8px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                Pagamento seguro
              </span>
              <p className="mt-0.5 text-[10px] font-light leading-relaxed text-gray-500">
                Transações via PIX e cartão com EFI Bank. Dados criptografados e cancelamento a qualquer momento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
