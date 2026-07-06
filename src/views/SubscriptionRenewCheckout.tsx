import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { authFetch } from '../lib/authenticatedFetch';
import { ROUTES } from '../lib/routes';
import { supabase } from '../lib/supabase';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { RegistrationCheckoutPanel } from '../components/RegistrationCheckoutPanel';
import { DEFAULT_PLAN_PRICES_REAIS } from '../constants/plans';
import { formatPriceBRL } from '../lib/plansDisplay';

const RENEW_BENEFITS = [
  'Gestão completa do terreiro',
  'Financeiro e relatórios avançados',
  'Prontuário espiritual e atendimentos',
  'Loja do Axé e almoxarifado',
  'WhatsApp automatizado',
  'Acesso ilimitado à plataforma',
] as const;

type RenewContext = {
  tenantId: string;
  nomeTerreiro: string;
  nomeZelador: string;
  email: string;
  active: boolean;
};

function readTenantFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('tenant')?.trim() || '';
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function SubscriptionRenewCheckout() {
  const { premium: catalogPrice, plans } = usePlansCatalog();
  const [tenantId, setTenantId] = useState('');
  const [ctx, setCtx] = useState<RenewContext | null>(null);
  const [amountLabel, setAmountLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUserId = sessionData.session?.user?.id?.trim() || '';
        if (!sessionUserId) {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.replace(`${ROUTES.login}?redirect=${returnTo}`);
          return;
        }

        let resolvedTenant = readTenantFromUrl() || sessionUserId;
        if (cancelled) return;

        if (readTenantFromUrl() !== resolvedTenant) {
          const url = new URL(window.location.href);
          url.searchParams.set('tenant', resolvedTenant);
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }

        setTenantId(resolvedTenant);

        const [cfgRes, ctxRes] = await Promise.all([
          authFetch('/api/v1/checkout/efi/config', { cache: 'no-store', headers: await authHeaders() }),
          authFetch(`/api/v1/checkout/efi/context?tenantId=${encodeURIComponent(resolvedTenant)}`, {
            cache: 'no-store',
            headers: await authHeaders(),
          }),
        ]);

        const cfg = await cfgRes.json().catch(() => ({}));
        if (!cfgRes.ok) throw new Error(cfg.error || 'Pagamento indisponível no momento.');

        if (ctxRes.ok) {
          const body = await ctxRes.json();
          if (cancelled) return;
          setCtx({
            tenantId: resolvedTenant,
            nomeTerreiro: String(body.nomeTerreiro || '').trim(),
            nomeZelador: String(body.nomeZelador || '').trim(),
            email: String(body.email || sessionData.session?.user?.email || '').trim(),
            active: !!body.active,
          });
        } else {
          setCtx({
            tenantId: resolvedTenant,
            nomeTerreiro: '',
            nomeZelador: '',
            email: sessionData.session?.user?.email || '',
            active: false,
          });
        }

        setAmountLabel(
          String(cfg.amountLabel || '').trim() ||
            `R$ ${formatPriceBRL(plans.premium?.price ?? DEFAULT_PLAN_PRICES_REAIS.premium)}/mês`,
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar renovação.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plans.premium?.price]);

  const planName = plans.premium?.name || 'Plano Premium';
  const displayPrice = amountLabel || `${catalogPrice.label}${catalogPrice.period}`;

  return (
    <div className="min-h-screen bg-[#080A0D] text-[#F1F5F9]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,188,0,0.06)_0%,_transparent_55%)]" />

      <header className="relative z-10 border-b border-[#1E242B] bg-[#0B0D11]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#13171D] px-3 py-2 text-xs font-bold text-[#94A3B8] transition-colors hover:border-primary/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao painel
          </a>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">AxéCloud</p>
            <h1 className="font-display text-sm font-bold sm:text-base">Renovação de assinatura</h1>
          </div>
          <div className="hidden w-[120px] sm:block" aria-hidden />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-center">
            <p className="text-sm font-bold text-red-300">{error}</p>
            <a
              href="/dashboard"
              className="mt-4 inline-flex rounded-xl bg-[#13171D] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E2530]"
            >
              Voltar ao painel
            </a>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8"
          >
            <aside className="space-y-4 lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-[#1E242B] pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#F1F5F9]">Resumo do plano</h2>
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      Renove o acesso Premium do terreiro com pagamento seguro via EFI Bank.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Premium
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-[#1E242B] bg-gradient-to-b from-[#1E2530] to-[#12161A] p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[#FDE047] to-primary" />
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
                        <Crown className="h-7 w-7 text-primary" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                          Plano selecionado
                        </p>
                        <p className="font-display text-base font-black text-white">{planName}</p>
                        <p className="mt-0.5 text-xs font-bold text-primary">{displayPrice}</p>
                      </div>
                    </div>
                  </div>

                  {(ctx?.nomeTerreiro || ctx?.nomeZelador) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ctx?.nomeTerreiro ? (
                        <div className="rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                            Terreiro
                          </span>
                          <p className="mt-0.5 truncate text-xs font-bold text-white">{ctx.nomeTerreiro}</p>
                        </div>
                      ) : null}
                      {ctx?.nomeZelador ? (
                        <div className="rounded-xl border border-[#1E242B] bg-[#12161A]/60 p-3">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                            Zelador(a)
                          </span>
                          <p className="mt-0.5 truncate text-xs font-bold text-white">{ctx.nomeZelador}</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <ul className="space-y-1.5">
                    {RENEW_BENEFITS.map((benefit) => (
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
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-[#1E242B]/70 bg-[#13171D] p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                    Pagamento protegido
                  </span>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Transações processadas pela EFI Bank (PIX e cartão). Confirmação automática e liberação imediata do
                    painel após o pagamento.
                  </p>
                </div>
              </div>
            </aside>

            <section className="lg:col-span-7">
              <div className="rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3 border-b border-[#1E242B] pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-[#F1F5F9]">Forma de pagamento</h2>
                    <p className="text-[11px] text-[#94A3B8]">Escolha PIX ou cartão para renovar sua mensalidade.</p>
                  </div>
                </div>

                {tenantId ? (
                  <RegistrationCheckoutPanel
                    tenantId={tenantId}
                    variant="app"
                    purpose="renewal"
                    defaultHolderName={ctx?.nomeZelador || ctx?.nomeTerreiro || ''}
                    showFooter={false}
                  />
                ) : null}
              </div>

              <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/70" aria-hidden />
                EFI Bank · Liberação automática
              </p>
            </section>
          </motion.div>
        )}
      </main>
    </div>
  );
}
