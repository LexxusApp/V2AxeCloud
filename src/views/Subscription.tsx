import React, { useState } from 'react';
import { Check, Crown, Zap, ShieldCheck, ArrowRight, Loader2, CalendarDays, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { PLAN_NAMES, isLifetimePlan, canonicalPlanSlug, DEFAULT_PLAN_PRICES_REAIS } from '../constants/plans';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { formatPriceBRL } from '../lib/plansDisplay';
import { renewSubscriptionPath } from '../lib/routes';
import { supabase } from '../lib/supabase';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoCard, AppDemoPanelHeader } from '../components/ui/appDemoUi';
import { useSubscriptionBillingCycle } from '../hooks/useSubscriptionBillingCycle';

interface PlanCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  icon: any;
  isPopular?: boolean;
  color: string;
  onSelect: () => void;
  loading?: boolean;
  isCurrentPlan?: boolean;
  /** Card mais estreito e tipografia reduzida (ex.: único plano na tela) */
  compact?: boolean;
  priceNote?: string;
  periodLabel?: string;
  badgeLabel?: string;
  buttonLabel?: string;
}

function PlanCard({ name, price, description, features, icon: Icon, isPopular, color, onSelect, loading, isCurrentPlan, compact, priceNote, periodLabel = '/mês', badgeLabel = 'Mais escolhido', buttonLabel = 'Assinar agora' }: PlanCardProps) {
  return (
    <motion.div 
      whileHover={{ y: compact ? -3 : -6 }}
      className={cn(
        "relative flex flex-col rounded-2xl border bg-[#151A21] text-[#F8FAFC] transition-all duration-500",
        compact ? "p-4 md:p-5" : "p-6",
        isPopular ? "border-[#FBBC00] shadow-xl shadow-[#FBBC00]/10 z-10" : "border-white/5 hover:border-white/20",
        isCurrentPlan && "border-primary shadow-lg shadow-primary/20"
      )}
    >
      {isPopular && !isCurrentPlan && (
        <div className={cn(
          "absolute left-1/2 -translate-x-1/2 bg-[#FBBC00] text-background font-black rounded-full tracking-widest uppercase",
          compact ? "-top-3 text-[9px] px-3 py-0.5" : "-top-4 text-[10px] px-4 py-1"
        )}>
          {badgeLabel}
        </div>
      )}
      {isCurrentPlan && (
        <div className={cn(
          "absolute left-1/2 -translate-x-1/2 bg-primary text-background font-black rounded-full tracking-widest uppercase flex items-center gap-1",
          compact ? "-top-3 text-[9px] px-3 py-0.5" : "-top-4 text-[10px] px-4 py-1"
        )}>
          <Check className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
          Seu Plano Atual
        </div>
      )}

      <div className={cn(compact ? "mb-4" : "mb-6")}>
        <div className={cn("rounded-xl flex items-center justify-center shadow-lg mb-3", compact ? "w-10 h-10 mb-3" : "w-12 h-12 mb-4", color)}>
          <Icon className={compact ? "w-5 h-5 text-white" : "w-6 h-6 text-white"} />
        </div>
        <h3 className={cn("font-black text-white mb-1.5", compact ? "text-lg" : "text-xl mb-2")}>{name}</h3>
        <p className={cn("text-gray-400 leading-relaxed", compact ? "text-[11px]" : "text-xs")}>{description}</p>
      </div>

      <div className={cn(compact ? "mb-4" : "mb-6")}>
        <div className="flex items-baseline gap-1">
          <span className={cn("font-black text-white", compact ? "text-2xl" : "text-3xl")}>R$ {price}</span>
          <span className={cn("text-gray-500 font-bold", compact ? "text-xs" : "text-sm")}>{periodLabel}</span>
        </div>
        {priceNote && (
          <p className={cn("text-primary/90 font-bold mt-1", compact ? "text-[10px]" : "text-xs")}>{priceNote}</p>
        )}
      </div>

      <div className={cn("flex-1", compact ? "mb-5 space-y-2" : "mb-7 space-y-3")}>
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className={cn("mt-0.5 bg-emerald-500/10 rounded-full", compact ? "p-0.5" : "p-0.5")}>
              <Check className={compact ? "w-2.5 h-2.5 text-emerald-500" : "w-3 h-3 text-emerald-500"} />
            </div>
            <span className={cn("text-gray-300 font-medium", compact ? "text-[11px] leading-snug" : "text-xs")}>{feature}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onSelect}
        disabled={loading || isCurrentPlan}
        className={cn(
          "w-full rounded-xl font-black flex items-center justify-center gap-2 transition-all group",
          compact ? "py-2.5 text-xs" : "py-3 text-sm gap-2.5",
          isCurrentPlan
            ? "bg-white/10 text-white cursor-not-allowed border border-white/10"
            : isPopular 
              ? "bg-[#FBBC00] text-background hover:bg-[#FBBC00]/90 shadow-lg shadow-[#FBBC00]/20" 
              : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
        )}
      >
        {loading ? (
          <Loader2 className={compact ? "w-4 h-4 animate-spin" : "w-5 h-5 animate-spin"} />
        ) : isCurrentPlan ? (
          <>
            <Check className={compact ? "w-4 h-4" : "w-5 h-5"} />
            PLANO ATIVO
          </>
        ) : (
          <>
            {buttonLabel}
            <ArrowRight className={compact ? "w-4 h-4 transition-transform group-hover:translate-x-1" : "w-5 h-5 transition-transform group-hover:translate-x-1"} />
          </>
        )}
      </button>
    </motion.div>
  );
}

interface SubscriptionProps {
  session: any;
  tenantData: any;
  onPlanUpdated: () => void;
  hideHeader?: boolean;
  onlyCurrentPlan?: boolean;
  onlyAvailablePlans?: boolean;
  setActiveTab: (tab: string) => void;
}

export default function Subscription({ session, tenantData, onPlanUpdated, hideHeader, onlyCurrentPlan, onlyAvailablePlans, setActiveTab }: SubscriptionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { plans: plansConfig, loading: fetchingPlans } = usePlansCatalog();
  const currentBillingCycle = useSubscriptionBillingCycle(
    String(tenantData?.tenant_id || ''),
    tenantData?.billing_cycle,
  );

  const handleSelectPlan = async (
    planId: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ) => {
    setLoading(billingCycle);
    let tenantId = String(tenantData?.tenant_id || '').trim();
    if (!tenantId) {
      const { data } = await supabase.auth.getSession();
      tenantId = data.session?.user?.id || '';
    }
    window.location.href = renewSubscriptionPath(tenantId, billingCycle);
  };

  const formatPrice = (price?: number, fallbackReais?: number) => {
    const fb =
      fallbackReais != null
        ? formatPriceBRL(fallbackReais)
        : formatPriceBRL(DEFAULT_PLAN_PRICES_REAIS.premium);
    if (price === undefined || price === null) return fb;
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return fb;
    return formatPriceBRL(n);
  };

  if (fetchingPlans) {
    if (onlyCurrentPlan) {
      return (
        <AppDemoCard className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </AppDemoCard>
      );
    }
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const planKey = canonicalPlanSlug(tenantData?.plan);
  const currentPlanName = PLAN_NAMES[planKey] || plansConfig[tenantData?.plan]?.name || tenantData?.plan || 'Nenhum';
  const expiresAt = tenantData?.expires_at ? new Date(tenantData.expires_at).toLocaleDateString('pt-BR') : 'Sem validade definida';
  const isLifetime = isLifetimePlan(tenantData?.plan);
  const displayPlanName = isLifetime ? 'Mensalidade Vitalícia' : `Plano ${currentPlanName}`;

  if (onlyCurrentPlan) {
    return (
      <AppDemoCard className="flex flex-col items-center justify-between gap-6 border-primary/20 bg-primary/5 md:flex-row">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-2xl font-black text-white">{displayPlanName}</h3>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-black tracking-widest uppercase">Ativo</span>
            </div>
            <p className="text-gray-400 font-medium">
              {isLifetime ? 'Seu plano é vitalício e não possui data de expiração.' : `Sua assinatura expira em: ${expiresAt}`}
            </p>
          </div>
        </div>
        {!isLifetime && (
          <button 
            onClick={() => handleSelectPlan(tenantData?.plan || 'premium', currentBillingCycle)}
            disabled={loading === currentBillingCycle}
            className="bg-primary text-background px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {loading === currentBillingCycle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            RENOVAR ASSINATURA
          </button>
        )}
      </AppDemoCard>
    );
  }

  const monthlyPrice = plansConfig.premium?.price ?? DEFAULT_PLAN_PRICES_REAIS.premium;
  const annualPrice = plansConfig.premium?.annual_price ?? monthlyPrice * 10;
  const annualEquivalent = annualPrice / 12;
  const annualSavings = Math.max(0, monthlyPrice * 12 - annualPrice);
  const sharedFeatures = [
    'Gestão completa do terreiro',
    'Financeiro e relatórios avançados',
    'Prontuário espiritual',
    'Loja do Axé e almoxarifado',
    'WhatsApp automatizado',
    'Acesso ilimitado',
  ];

  const plansGrid = (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[#252C35] bg-[#0E1217] p-4 shadow-[0_28px_80px_-48px_rgba(0,0,0,0.95)] sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" />
            Escolha como economizar
          </div>
          <h3 className="font-display text-xl font-black text-white sm:text-2xl">Premium no seu ritmo</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#94A3B8]">
            Os mesmos recursos completos nos dois períodos. Prefira flexibilidade mensal ou garanta um ano com dois meses de economia.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-left sm:text-right">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Economia no anual</p>
          <p className="text-sm font-black text-white">R$ {formatPrice(annualSavings)} por ano</p>
        </div>
      </div>

      <div className="relative grid gap-5 md:grid-cols-2 md:items-stretch">
        <PlanCard
          name="Premium Mensal"
          price={formatPrice(monthlyPrice)}
          description="Liberdade para renovar mês a mês, sem abrir mão de nenhum recurso."
          icon={Crown}
          color="bg-[#334155] shadow-black/30"
          features={sharedFeatures}
          onSelect={() => handleSelectPlan('premium', 'monthly')}
          loading={loading === 'monthly'}
          isCurrentPlan={planKey === 'premium' && currentBillingCycle === 'monthly' && tenantData?.status === 'active'}
          compact
          periodLabel="/mês"
          buttonLabel="Escolher mensal"
        />
        <PlanCard
          name="Premium Anual"
          price={formatPrice(annualPrice)}
          description="Um único pagamento para manter o terreiro organizado durante 12 meses."
          icon={CalendarDays}
          color="bg-gradient-to-br from-[#FBBC00] to-[#D89200] shadow-[#FBBC00]/25"
          features={sharedFeatures}
          onSelect={() => handleSelectPlan('premium', 'annual')}
          loading={loading === 'annual'}
          isCurrentPlan={planKey === 'premium' && currentBillingCycle === 'annual' && tenantData?.status === 'active'}
          isPopular
          compact
          periodLabel="/ano"
          badgeLabel="Melhor custo-benefício"
          buttonLabel="Quero economizar"
          priceNote={`Equivale a R$ ${formatPrice(annualEquivalent)}/mês · 2 meses grátis`}
        />
      </div>
      <p className="relative mt-5 text-center text-[10px] font-medium text-[#64748B]">
        Pagamento seguro via PIX · Ativação automática após a confirmação
      </p>
    </div>
  );

  if (onlyAvailablePlans) {
    if (isLifetime) return null;
    return (
      <div className="w-full">
        {plansGrid}
      </div>
    );
  }

  const inner = (
    <div className={cn(hideHeader ? '' : '')}>
      {!hideHeader ? (
        <AppDemoPanelHeader
          title="Assinatura do terreiro"
          description="Selecione o plano que melhor atende às necessidades do seu terreiro."
        />
      ) : null}

      {hideHeader && (
        <div className="mb-12">
          <AppDemoCard className="flex flex-col items-center justify-between gap-6 border-primary/20 bg-primary/5 md:flex-row">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Crown className="w-8 h-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-2xl font-black text-white">{displayPlanName}</h3>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-black tracking-widest uppercase">Ativo</span>
                </div>
                <p className="text-gray-400 font-medium">
                  {isLifetime ? 'Seu plano é vitalício e não possui data de expiração.' : `Sua assinatura expira em: ${expiresAt}`}
                </p>
              </div>
            </div>
            {!isLifetime && (
              <button 
                onClick={() => handleSelectPlan(tenantData?.plan || 'premium', currentBillingCycle)}
                disabled={loading === currentBillingCycle}
                className="bg-primary text-background px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {loading === currentBillingCycle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                RENOVAR ASSINATURA
              </button>
            )}
          </AppDemoCard>
        </div>
      )}

      {plansGrid}

      <AppDemoCard className="mt-20 flex flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-white mb-1">Segurança e Transparência</h4>
            <p className="text-gray-400 text-sm">Seus dados são protegidos com criptografia de ponta a ponta. Cancele quando quiser.</p>
          </div>
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Pagamento via PIX · EFI Bank</p>
      </AppDemoCard>
    </div>
  );

  return hideHeader ? inner : <AppPageShell>{inner}</AppPageShell>;
}
