import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  CalendarClock,
  Check,
  CircleCheckBig,
  Clock3,
  Infinity,
  LockKeyhole,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import { RegistrationCheckoutPanel } from '../components/RegistrationCheckoutPanel';
import { canonicalPlanSlug, isLifetimePlan, PLAN_NAMES, DEFAULT_PLAN_PRICES_REAIS } from '../constants/plans';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { useSubscriptionBillingCycle } from '../hooks/useSubscriptionBillingCycle';
import { formatPriceBRL } from '../lib/plansDisplay';
import { getSubscriptionDueState } from '../lib/subscriptionDue';
import { cn } from '../lib/utils';

type BillingCycle = 'monthly' | 'annual';

type MinhaAssinaturaProps = {
  session: any;
  tenantData: any;
  onRefresh: () => void | Promise<void>;
};

function formatDate(value?: string | null) {
  if (!value) return 'Data não definida';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Data não definida';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

export default function MinhaAssinatura({ session, tenantData, onRefresh }: MinhaAssinaturaProps) {
  const tenantId = String(tenantData?.tenant_id || session?.user?.id || '').trim();
  const currentCycle = useSubscriptionBillingCycle(tenantId, tenantData?.billing_cycle);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(currentCycle);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const paymentRef = useRef<HTMLDivElement>(null);
  const { plans, loading: plansLoading } = usePlansCatalog();

  const planKey = canonicalPlanSlug(String(tenantData?.plan || 'premium'));
  const lifetime = isLifetimePlan(String(tenantData?.plan || ''));
  const due = getSubscriptionDueState({
    expiresAt: tenantData?.expires_at,
    plan: tenantData?.plan,
    status: tenantData?.status,
    isTrial: tenantData?.is_trial === true,
  });
  const planName = lifetime
    ? planKey === 'vita'
      ? 'Vita'
      : planKey === 'cortesia'
        ? 'Cortesia'
        : PLAN_NAMES[planKey] || 'Vitalício'
    : PLAN_NAMES[planKey] || 'Premium';
  const monthly = plans.premium?.price ?? DEFAULT_PLAN_PRICES_REAIS.premium;
  const annual = plans.premium?.annual_price ?? monthly * 10;
  const selectedPrice = selectedCycle === 'annual' ? annual : monthly;
  const annualSaving = Math.max(0, monthly * 12 - annual);
  const progress = useMemo(() => {
    if (due.daysRemaining == null) return 100;
    const total = currentCycle === 'annual' ? 365 : 30;
    return Math.max(0, Math.min(100, (due.daysRemaining / total) * 100));
  }, [currentCycle, due.daysRemaining]);

  const openPayment = (cycle: BillingCycle = selectedCycle) => {
    setSelectedCycle(cycle);
    setPaymentOpen(true);
    window.setTimeout(() => paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const statusClasses = {
    safe: 'border-emerald-300/40 bg-emerald-100 text-emerald-900',
    attention: 'border-amber-300/60 bg-amber-100 text-amber-950',
    urgent: 'border-rose-300/60 bg-rose-100 text-rose-950',
    permanent: 'border-violet-300/50 bg-violet-100 text-violet-950',
  }[due.tone];

  return (
    <AppPageShell fullWidth>
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[2rem] border border-[#CFC4AE] bg-[#EEE7D8] text-[#1B211C] shadow-[0_34px_90px_-60px_rgba(44,33,15,.75)]">
        <header className="relative overflow-hidden border-b border-[#D6CBB7] px-5 py-7 sm:px-8 sm:py-9 lg:px-11">
          <div className="pointer-events-none absolute -right-24 -top-40 h-[32rem] w-[32rem] rounded-full border border-[#AE7C16]/15 shadow-[0_0_0_70px_rgba(174,124,22,.035),0_0_0_140px_rgba(31,79,59,.025)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#8B6413]">
                <span className="h-2 w-2 rounded-full bg-[#D9A619] shadow-[0_0_0_5px_rgba(217,166,25,.12)]" />
                Continuidade do AxéCloud
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-3xl font-black tracking-[-0.045em] text-[#151914] sm:text-5xl">
                Sua mensalidade, sem caminho escondido.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-[#676154] sm:text-base">
                Acompanhe o vencimento, escolha o melhor ciclo e conclua o pagamento sem sair desta página.
              </p>
            </div>
            <span className={cn('w-fit rounded-full border px-4 py-2 text-xs font-black', statusClasses)}>
              {due.label}
            </span>
          </div>
        </header>

        <section className="grid border-b border-[#D6CBB7] lg:grid-cols-[1.08fr_.92fr]">
          <div className="relative flex items-center overflow-hidden bg-[#10271E] p-5 text-[#F4EFDF] sm:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(231,184,56,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(231,184,56,.10)_1px,transparent_1px)] [background-size:54px_54px]" />
            <div className="relative grid w-full gap-6 sm:grid-cols-[152px_1fr] sm:items-center">
              <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full bg-[#0A1913]" style={{ background: `conic-gradient(#E1AD22 ${progress}%, rgba(255,255,255,.08) 0)` }}>
                <div className="grid h-[7.9rem] w-[7.9rem] place-items-center rounded-full border border-white/10 bg-[#10271E] text-center">
                  {lifetime ? (
                    <><Infinity className="h-9 w-9 text-[#E7B838]" /><strong className="-mt-7 text-sm">Permanente</strong></>
                  ) : due.daysRemaining == null ? (
                    <><CircleCheckBig className="h-9 w-9 text-[#E7B838]" /><strong className="-mt-7 text-sm">Em dia</strong></>
                  ) : (
                    <div><strong className="block text-4xl font-black tracking-[-0.07em] text-white">{Math.max(0, due.daysRemaining ?? 0)}</strong><span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] text-[#A8B6AB]">dias restantes</span></div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D9A619]">Ciclo atual</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white">{planName}</h2>
                <p className="mt-2 text-sm font-semibold text-[#B6C0B7]">
                  {lifetime ? 'Seu acesso não possui data de expiração.' : `${currentCycle === 'annual' ? 'Anuidade' : 'Mensalidade'} válida até ${formatDate(tenantData?.expires_at)}.`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#F8F3E8] p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B6413]">Linha do tempo</p>
            <div className="mt-3 space-y-0">
              {[
                { icon: CircleCheckBig, title: 'Acesso disponível', note: 'Todos os módulos continuam liberados.', done: true },
                { icon: CalendarClock, title: lifetime ? 'Sem vencimento' : formatDate(tenantData?.expires_at), note: lifetime ? 'Nenhuma renovação é necessária.' : 'Data de encerramento do ciclo atual.', done: lifetime },
                { icon: RefreshCw, title: lifetime ? 'Continuidade permanente' : 'Próximo ciclo', note: lifetime ? 'Benefício registrado para esta casa.' : 'A confirmação do pagamento atualiza o acesso automaticamente.', done: false },
              ].map((item, index) => <div className="grid grid-cols-[34px_1fr] gap-3" key={item.title}><div className="relative flex justify-center"><span className={cn('relative z-10 grid h-7 w-7 place-items-center rounded-full border', item.done ? 'border-[#1F6147] bg-[#1F6147] text-white' : 'border-[#CFC4AE] bg-[#F8F3E8] text-[#9A7600]')}><item.icon className="h-3.5 w-3.5" /></span>{index < 2 ? <i className="absolute bottom-0 top-7 w-px bg-[#D8CDB9]" /> : null}</div><div className="pb-3"><strong className="block text-[13px] font-black text-[#1B211C]">{item.title}</strong><small className="mt-0.5 block text-[11px] font-semibold leading-snug text-[#777063]">{item.note}</small></div></div>)}
            </div>
          </div>
        </section>

        {!lifetime ? (
          <section className="grid gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-11 lg:py-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B6413]">Escolha o próximo ciclo</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-[#171A16]">Continue no seu ritmo.</h2>
              <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-[#70695D]">Não existe troca de plano ou perda de recursos. Você escolhe apenas por quanto tempo deseja renovar.</p>
              <div className="mt-6 grid gap-3">
                {([
                  ['monthly', 'Mensal', monthly, 'Flexibilidade mês a mês'],
                  ['annual', 'Anual', annual, `Economia de R$ ${formatPriceBRL(annualSaving)} no ano`],
                ] as const).map(([cycle, title, price, note]) => <button type="button" onClick={() => setSelectedCycle(cycle)} className={cn('grid min-h-[76px] grid-cols-[22px_1fr_auto] items-center gap-3 rounded-2xl border px-4 text-left transition', selectedCycle === cycle ? 'border-[#A97910] bg-[#FFF9EA] shadow-[0_12px_32px_-24px_rgba(112,77,5,.7)]' : 'border-[#D8CEBC] bg-[#F5EFE3] hover:border-[#BFAE8C]')} key={cycle}><span className={cn('grid h-5 w-5 place-items-center rounded-full border', selectedCycle === cycle ? 'border-[#A97910] bg-[#DDAA20]' : 'border-[#BDB3A2]')} >{selectedCycle === cycle ? <Check className="h-3 w-3 text-[#171309]" /> : null}</span><span><strong className="block text-sm font-black">{title}</strong><small className="mt-1 block text-[10px] font-semibold text-[#7A7266]">{note}</small></span><span className="text-right"><strong className="block text-base font-black">R$ {formatPriceBRL(price)}</strong><small className="text-[9px] font-bold text-[#7A7266]">/{cycle === 'annual' ? 'ano' : 'mês'}</small></span></button>)}
              </div>
              <button type="button" disabled={plansLoading} onClick={() => openPayment(selectedCycle)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1C4E3B] px-5 text-sm font-black text-white transition hover:bg-[#153C2E] disabled:opacity-60">Continuar para pagamento <ArrowDown className="h-4 w-4" /></button>
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-[#D7CBB5] bg-[#E7DDC9] p-5 sm:col-span-2"><ReceiptText className="h-6 w-6 text-[#8B6413]" /><strong className="mt-5 block text-lg font-black">Tudo acontece aqui.</strong><p className="mt-2 text-xs font-semibold leading-relaxed text-[#6F685B]">Você escolhe o período, gera o Pix ou paga com cartão e acompanha a confirmação sem abrir outra página.</p></article>
              <article className="rounded-2xl border border-[#D7CBB5] bg-[#F7F1E5] p-5"><LockKeyhole className="h-5 w-5 text-[#1F6147]" /><strong className="mt-4 block text-sm font-black">Pagamento protegido</strong><p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#777063]">Processamento seguro pela Efí.</p></article>
              <article className="rounded-2xl border border-[#D7CBB5] bg-[#F7F1E5] p-5"><ShieldCheck className="h-5 w-5 text-[#1F6147]" /><strong className="mt-4 block text-sm font-black">Liberação automática</strong><p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#777063]">A confirmação atualiza a assinatura.</p></article>
            </div>
          </section>
        ) : (
          <section className="px-5 py-9 sm:px-8 lg:px-11"><div className="flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-6 sm:flex-row sm:items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-violet-900 text-white"><Sparkles className="h-5 w-5" /></span><div><strong className="text-lg font-black text-violet-950">Nenhuma cobrança necessária.</strong><p className="mt-1 text-sm font-semibold text-violet-900/65">Esta casa possui acesso {planKey === 'vita' ? 'Vita' : 'permanente'} ao AxéCloud.</p></div></div></section>
        )}

        {paymentOpen && !lifetime && tenantId ? (
          <section ref={paymentRef} className="scroll-mt-6 border-t border-[#D6CBB7] bg-[#FBF7EF] px-4 py-8 sm:px-8 lg:px-11 lg:py-11">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8B6413]">Pagamento no AxéCloud</p><h2 className="mt-2 text-2xl font-black tracking-tight">Finalize sem sair da página.</h2></div><button type="button" onClick={() => setPaymentOpen(false)} className="w-fit rounded-lg border border-[#CFC4AE] px-4 py-2 text-xs font-black text-[#5E584D] hover:bg-[#EEE7D8]">Fechar pagamento</button></div>
            <div className="overflow-hidden rounded-[1.5rem] border border-[#D5CBB9] bg-white shadow-[0_24px_60px_-46px_rgba(53,39,16,.8)]">
              <RegistrationCheckoutPanel key={selectedCycle} tenantId={tenantId} variant="light" purpose="renewal" billingCycle={selectedCycle} showFooter={false} redirectToDashboard={false} onSuccess={() => void onRefresh()} defaultHolderName={String(tenantData?.nome || tenantData?.nome_terreiro || '')} className="border-0 bg-white" />
            </div>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D6CBB7] bg-[#E4DAC7] px-5 py-4 text-[10px] font-bold text-[#71695C] sm:px-8 lg:px-11"><span className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Situação atualizada automaticamente</span><span>AxéCloud · cobrança segura e transparente</span></footer>
      </div>
    </AppPageShell>
  );
}
