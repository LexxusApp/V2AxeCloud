import { authFetch } from '../lib/authenticatedFetch';
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { appInputClass, appLabelClass } from '../lib/appUiTokens';
import { supabase } from '../lib/supabase';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { createEfiPaymentToken, detectCardBrand, loadEfiPaymentScript } from '../lib/efiCardToken';
import {
  EFI_CARD_PIX_FALLBACK_MESSAGE,
  isEfiCardProcessingFailure,
  resolveCardPaymentUserMessage,
} from '../../lib/efiCardCheckoutError';

const GOLD = '#f2b90f';

type PayMethod = 'pix' | 'card';

type EfiConfig = {
  sandbox: boolean;
  payeeCode: string | null;
  amountCents: number;
  amountLabel: string;
  pixAvailable: boolean;
  pixSetup?: {
    hasClientCredentials: boolean;
    hasPixKey: boolean;
    certEnvKeysPresent: string[];
    certResolved: boolean;
    certSource: string | null;
    issues: string[];
  };
  cardAvailable: boolean;
  cardTokenizationReady?: boolean;
  cardSetup?: { issues: string[] };
};

type CheckoutContext = {
  tenantId: string;
  email: string;
  nomeTerreiro: string;
  nomeZelador: string;
  active: boolean;
};

const lightTheme = {
  radius: 'rounded-lg',
  fieldShell: cn(
    'w-full h-[46px] rounded-lg border border-zinc-300 bg-white px-3 sm:h-[42px]',
    'text-[14px] font-medium text-zinc-900 placeholder:text-zinc-500',
    'outline-none transition-[border-color,box-shadow] duration-200',
    'focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
  ),
  fieldShellCompact: cn(
    'w-full h-9 rounded-md border border-zinc-300 bg-white px-2.5',
    'text-[13px] font-medium text-zinc-900 placeholder:text-zinc-500',
    'outline-none transition-[border-color,box-shadow] duration-200',
    'focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20'
  ),
  labelClass: 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-800',
  labelClassCompact: 'mb-0.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-800',
  panel: 'rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6',
  panelCompact: 'rounded-lg border border-zinc-200 bg-zinc-50/80 p-3.5 sm:p-4',
  tabContainer: 'mb-4 flex rounded-lg border border-zinc-200 bg-zinc-100 p-1',
  tabContainerCompact: 'mb-2 flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5',
  tabBtn: 'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-black uppercase tracking-wider transition-all sm:text-xs',
  tabBtnCompact: 'flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-[10px] font-black uppercase tracking-wide transition-all',
  formGap: 'space-y-3',
  formGapCompact: 'space-y-2',
  introText: 'text-sm leading-relaxed',
  introTextCompact: 'text-[12px] leading-snug',
  ctaH: 'h-[44px]',
  ctaHCompact: 'h-[38px]',
  ctaText: 'text-[13px]',
  ctaTextCompact: 'text-[12px]',
};

const themes = {
  light: {
    ...lightTheme,
    tabActive: 'bg-amber-500 text-black shadow-sm',
    tabInactive: 'text-zinc-500 hover:text-zinc-800',
    textMuted: 'text-zinc-600',
    textSubtle: 'text-zinc-500',
    errorBox: 'border-red-200 bg-red-50 text-red-800',
    successPanel: 'rounded-xl border border-amber-200 bg-amber-50/90 p-8 text-center text-zinc-900',
    warnBox: 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950',
    footerText: 'text-zinc-500',
    footerIcon: 'text-amber-700',
    disabledField: 'text-zinc-500',
  },
  dark: {
    radius: 'rounded-[14px]',
    fieldShell: cn(
      'w-full h-[42px] pl-3 pr-3 text-[14px] text-white placeholder:text-[#8f939c]',
      'bg-[#0a0b0d]/95 border border-white/[0.22] rounded-[14px]',
      'outline-none transition-[border-color] duration-200 focus:border-[#f2b90f]/70'
    ),
    labelClass: 'block text-[10px] font-bold text-[#c4c7d0] uppercase tracking-[0.16em] mb-1',
    panel: 'rounded-[14px] border border-white/[0.16] bg-[#060708]/76 p-6 backdrop-blur-xl',
    tabContainer: 'mb-4 flex rounded-[14px] border border-white/15 bg-[#060708]/76 p-1',
    tabActive: 'bg-[#f2b90f] text-black',
    tabInactive: 'text-[#9a9da6] hover:text-white',
    textMuted: 'text-[#b8bbc4]',
    textSubtle: 'text-[#9a9da6]',
    errorBox: 'border-red-500/30 bg-red-950/40 text-red-200',
    successPanel:
      'rounded-[14px] border border-[#f2b90f]/30 bg-[#060708]/90 p-8 text-center text-white',
    warnBox: 'rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-[13px] text-amber-100',
    footerText: 'text-[#c8cad2]',
    footerIcon: 'text-[#f2b90f]',
    disabledField: 'text-[#9a9da6]',
  },
  app: {
    radius: 'rounded-xl',
    fieldShell: appInputClass,
    labelClass: appLabelClass,
    panel: 'rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 sm:p-6',
    tabContainer: 'mb-4 flex rounded-xl border border-[#1E242B] bg-[#12161A] p-1',
    tabActive: 'bg-primary text-[#080A0D] shadow-sm',
    tabInactive: 'text-[#94A3B8] hover:text-white',
    textMuted: 'text-[#94A3B8]',
    textSubtle: 'text-gray-500',
    errorBox: 'border-red-500/30 bg-red-950/40 text-red-200',
    successPanel:
      'rounded-2xl border border-primary/30 bg-[#13171D] p-8 text-center text-[#F1F5F9]',
    warnBox: 'rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-[13px] text-amber-100',
    footerText: 'text-[#94A3B8]',
    footerIcon: 'text-primary',
    disabledField: 'text-gray-500',
  },
} as const;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type RegistrationCheckoutPanelProps = {
  tenantId: string;
  variant?: keyof typeof themes;
  /** onboarding = cadastro; renewal = zelador renovando assinatura */
  purpose?: 'onboarding' | 'renewal';
  /** Layout mais baixo para caber no painel do /register sem cortar o topo. */
  compact?: boolean;
  defaultHolderName?: string;
  defaultPhone?: string;
  className?: string;
  showFooter?: boolean;
};

export function RegistrationCheckoutPanel({
  tenantId,
  variant = 'light',
  purpose = 'onboarding',
  compact = false,
  defaultHolderName = '',
  defaultPhone = '',
  className,
  showFooter = true,
}: RegistrationCheckoutPanelProps) {
  const { premium: catalogPrice } = usePlansCatalog();
  const base = themes[variant];
  const isCompactLight = compact && variant === 'light';
  const t = {
    ...base,
    fieldShell: isCompactLight ? lightTheme.fieldShellCompact : base.fieldShell,
    labelClass: isCompactLight ? lightTheme.labelClassCompact : base.labelClass,
    panel: isCompactLight ? lightTheme.panelCompact : base.panel,
    tabContainer: isCompactLight ? lightTheme.tabContainerCompact : base.tabContainer,
  };
  const tabBtnClass = isCompactLight
    ? lightTheme.tabBtnCompact
    : variant === 'light'
      ? lightTheme.tabBtn
      : 'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-all sm:text-xs';
  const formGap = isCompactLight ? lightTheme.formGapCompact : lightTheme.formGap;
  const introClass = cn(
    isCompactLight ? lightTheme.introTextCompact : lightTheme.introText,
    t.textMuted
  );
  const payCtaClass = cn(
    t.radius,
    isCompactLight ? lightTheme.ctaHCompact : lightTheme.ctaH,
    isCompactLight ? lightTheme.ctaTextCompact : lightTheme.ctaText,
    'flex w-full items-center justify-center gap-2 font-bold uppercase tracking-[0.06em] disabled:opacity-50',
    variant === 'app'
      ? 'bg-primary text-[#080A0D] hover:bg-[#fde047]'
      : 'text-black'
  );

  const isRenewal = purpose === 'renewal';
  const pixIntro = isRenewal
    ? 'Gere o QR Code Pix para renovar sua mensalidade. A confirmação libera o painel automaticamente.'
    : 'Gere o QR Code na hora. O Pix confirma em segundos e liberamos seu acesso automaticamente.';
  const cardIntro = isRenewal
    ? 'Pague com cartão de crédito para renovar o acesso do terreiro. Cobrança recorrente via EFI Bank.'
    : 'Assinatura mensal com cartão de crédito. Cobrança recorrente via EFI Bank.';

  const [method, setMethod] = useState<PayMethod>('pix');
  const [config, setConfig] = useState<EfiConfig | null>(null);
  const [ctx, setCtx] = useState<CheckoutContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);

  const [pixLoading, setPixLoading] = useState(false);
  const [pixTxid, setPixTxid] = useState<string | null>(null);
  const [pixCopy, setPixCopy] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [cardLoading, setCardLoading] = useState(false);
  const [cardPaymentError, setCardPaymentError] = useState<string | null>(null);
  const [holderName, setHolderName] = useState(defaultHolderName);
  const [holderCpf, setHolderCpf] = useState('');
  const [holderPhone, setHolderPhone] = useState(defaultPhone);
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');

  const loadInitial = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, ctxRes] = await Promise.all([
        authFetch('/api/v1/checkout/efi/config', { cache: 'no-store' }),
        authFetch(`/api/v1/checkout/efi/context?tenantId=${encodeURIComponent(tenantId)}`, {
          cache: 'no-store',
          headers: await authHeaders(),
        }),
      ]);

      const cfg = await cfgRes.json().catch(() => ({}));
      if (!cfgRes.ok) throw new Error(cfg.error || 'Checkout indisponível');

      setConfig(cfg as EfiConfig);
      if (cfg.pixAvailable) setMethod('pix');
      else if (cfg.cardAvailable) setMethod('card');

      if (ctxRes.ok) {
        const context = (await ctxRes.json()) as CheckoutContext;
        setCtx(context);
        setHolderName((prev) => prev || context.nomeZelador || context.nomeTerreiro || '');
        if (context.active) setAlreadyActive(true);
      } else {
        setHolderName((prev) => prev || defaultHolderName);
        setHolderPhone((prev) => prev || defaultPhone);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar checkout.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, defaultHolderName, defaultPhone]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (config?.cardAvailable) {
      void loadEfiPaymentScript().catch(() => {
        /* SDK carrega ao pagar */
      });
    }
  }, [config?.cardAvailable]);

  useEffect(() => {
    if (method === 'card') {
      setPixQr(null);
      setPixTxid(null);
      setPixCopy(null);
      setCopied(false);
    } else {
      setCardPaymentError(null);
    }
  }, [method]);

  const pollActivation = useCallback(async () => {
    if (!tenantId) return false;
    const res = await authFetch(`/api/v1/onboarding/status?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.active;
  }, [tenantId]);

  useEffect(() => {
    if (!pixTxid || paymentConfirmed) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/v1/checkout/efi/pix/${encodeURIComponent(pixTxid)}/status?tenantId=${encodeURIComponent(tenantId)}`,
          { headers: await authHeaders() }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.paid) {
          setPaymentConfirmed(true);
          window.clearInterval(interval);
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        }
      } catch {
        /* ignore */
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [pixTxid, paymentConfirmed, tenantId]);

  const handleGeneratePix = async () => {
    setPixLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/checkout/efi/pix', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          tenantId,
          payerName: holderName,
          cpf: holderCpf,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o PIX.');

      if (data.alreadyActive) {
        setAlreadyActive(true);
        setError(data.message || 'Sua assinatura já está ativa.');
        return;
      }

      if (!data.txid || !data.copyPaste) {
        throw new Error('Resposta incompleta ao gerar o PIX. Tente novamente.');
      }

      setPixTxid(data.txid);
      setPixCopy(data.copyPaste);
      setPixQr(data.qrCodeDataUrl || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PIX.');
    } finally {
      setPixLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixCopy) return;
    await navigator.clipboard.writeText(pixCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config?.payeeCode || config.cardTokenizationReady === false) {
      setError(
        config?.cardSetup?.issues?.[0] ||
          'Configure EFI_PAYEE_CODE na Vercel (Efí → API → Introdução → Identificador de conta).'
      );
      return;
    }

    setCardLoading(true);
    setError(null);
    setCardPaymentError(null);

    try {
      const brand = await detectCardBrand(cardNumber);
      const { payment_token } = await createEfiPaymentToken({
        payeeCode: config.payeeCode,
        sandbox: config.sandbox,
        brand,
        number: cardNumber,
        cvv: cardCvv,
        expirationMonth: cardExpMonth,
        expirationYear: cardExpYear,
        holderName,
        holderDocument: holderCpf,
      });

      const res = await authFetch('/api/v1/checkout/efi/card', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          tenantId,
          payment_token,
          customer: {
            name: holderName,
            cpf: holderCpf,
            email: ctx?.email,
            phone: holderPhone,
          },
          billing_address: {
            street,
            number: streetNumber,
            neighborhood,
            zipcode,
            city,
            state: stateUf,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          data.suggestPix === true ||
          isEfiCardProcessingFailure(null, {
            httpStatus: res.status,
            suggestPix: data.suggestPix,
            message: typeof data.error === 'string' ? data.error : undefined,
          })
        ) {
          setCardPaymentError(data.error || EFI_CARD_PIX_FALLBACK_MESSAGE);
          return;
        }
        throw new Error(data.error || 'Pagamento recusado.');
      }

      if (data.alreadyActive) {
        setAlreadyActive(true);
        setError(data.message || 'Sua assinatura já está ativa.');
        return;
      }

      if (data.active) {
        setPaymentConfirmed(true);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
        return;
      }

      const active = await pollActivation();
      if (active) {
        setPaymentConfirmed(true);
        window.location.href = '/dashboard';
      } else {
        setError(
          'Assinatura criada. Aguardando confirmação do cartão — o painel libera automaticamente em instantes.'
        );
      }
    } catch (err: unknown) {
      setCardPaymentError(resolveCardPaymentUserMessage(err));
    } finally {
      setCardLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'flex items-center justify-center',
          compact ? 'min-h-[120px] py-4' : 'min-h-[220px] py-8',
          className
        )}
      >
        <Loader2
          className={cn(
            'h-8 w-8 animate-spin',
            variant === 'light' ? 'text-amber-600' : variant === 'app' ? 'text-primary' : 'text-[#f2b90f]'
          )}
        />
      </motion.div>
    );
  }

  return (
    <div className={className}>
      {paymentConfirmed ? (
        <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} className={t.successPanel}>
          <Check
            className={cn(
              'mx-auto mb-4 h-10 w-10',
              variant === 'light' ? 'text-amber-600' : variant === 'app' ? 'text-primary' : 'text-[#f2b90f]'
            )}
          />
          <h2 className="text-xl font-black">Pagamento confirmado!</h2>
          <p className={cn('mt-2 text-sm', t.textMuted)}>
            {isRenewal ? 'Assinatura renovada. Redirecionando para o painel…' : 'Redirecionando para o painel…'}
          </p>
          <Loader2
            className={cn(
              'mx-auto mt-6 h-6 w-6 animate-spin',
              variant === 'light' ? 'text-amber-600' : variant === 'app' ? 'text-primary' : 'text-[#f2b90f]'
            )}
          />
        </motion.div>
      ) : alreadyActive ? (
        <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} className={t.successPanel}>
          <Check
            className={cn(
              'mx-auto mb-4 h-10 w-10',
              variant === 'light' ? 'text-amber-600' : variant === 'app' ? 'text-primary' : 'text-[#f2b90f]'
            )}
          />
          <h2 className="text-xl font-black">Assinatura já ativa</h2>
          <p className={cn('mt-2 text-sm', t.textMuted)}>
            {isRenewal
              ? 'Sua mensalidade já está em dia. Não é necessário pagar novamente.'
              : 'Este terreiro já possui acesso liberado. Não é necessário pagar novamente.'}
          </p>
          <motion.a
            href="/dashboard"
            style={
              variant === 'app'
                ? undefined
                : { background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)` }
            }
            className={cn(
              payCtaClass,
              'mt-6 inline-flex px-8',
              variant === 'app' && 'bg-primary text-[#080A0D] hover:bg-[#fde047]'
            )}
          >
            Ir para o painel
          </motion.a>
        </motion.div>
      ) : (
        <>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]',
                isCompactLight ? 'mb-2' : 'mb-4 py-2.5',
                t.errorBox
              )}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {config?.pixAvailable && config?.cardAvailable && (
            <motion.div className={t.tabContainer} layout role="tablist" aria-label="Forma de pagamento">
              {config?.pixAvailable && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'pix'}
                  onClick={() => setMethod('pix')}
                  className={cn(tabBtnClass, method === 'pix' ? t.tabActive : t.tabInactive)}
                >
                  <QrCode className={cn('shrink-0', isCompactLight ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  <span className="text-left leading-tight">
                    <span className="block opacity-80">QR Code</span>
                    <span>PIX</span>
                  </span>
                </button>
              )}
              {config?.cardAvailable && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'card'}
                  onClick={() => setMethod('card')}
                  className={cn(tabBtnClass, method === 'card' ? t.tabActive : t.tabInactive)}
                >
                  <CreditCard className={cn('shrink-0', isCompactLight ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  <span className="text-left leading-tight">
                    <span className="block opacity-80">Cartão</span>
                    <span>Crédito</span>
                  </span>
                </button>
              )}
            </motion.div>
          )}

          <motion.div
            key={method}
            initial={{ opacity: 0, x: method === 'pix' ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            className={t.panel}
          >
            {method === 'pix' ? (
              <motion.div className="space-y-4" layout>
                {!config?.pixAvailable ? (
                  <div className={cn('space-y-2 text-sm', t.textMuted)}>
                    <p>PIX não disponível neste deploy.</p>
                    {config?.pixSetup?.issues?.length ? (
                      <ul className={cn('list-inside list-disc space-y-1', t.textSubtle)}>
                        {config.pixSetup.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : !pixQr ? (
                  <>
                    <p className={introClass}>{pixIntro}</p>
                    <motion.div>
                      <label className={t.labelClass}>Nome do pagador</label>
                      <input
                        className={t.fieldShell}
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="Como no comprovante"
                      />
                    </motion.div>
                    <motion.div>
                      <label className={t.labelClass}>CPF (opcional)</label>
                      <input
                        className={t.fieldShell}
                        value={holderCpf}
                        onChange={(e) => setHolderCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="00000000000"
                        inputMode="numeric"
                      />
                    </motion.div>
                    <motion.button
                      type="button"
                      disabled={pixLoading}
                      onClick={() => void handleGeneratePix()}
                      whileTap={{ scale: 0.99 }}
                      style={
                        variant === 'app'
                          ? undefined
                          : { background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)` }
                      }
                      className={payCtaClass}
                    >
                      {pixLoading ? (
                        <Loader2 className={cn('animate-spin', isCompactLight ? 'h-4 w-4' : 'h-5 w-5')} />
                      ) : (
                        <>
                          <QrCode className="h-4 w-4" />
                          Gerar QR Code PIX
                        </>
                      )}
                    </motion.button>
                  </>
                ) : (
                  <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className={cn('mb-4 text-sm', t.textMuted)}>
                      Escaneie o QR Code ou copie o código Pix. Validade: 1 hora.
                    </p>
                    {pixQr && (
                      <motion.img
                        src={pixQr}
                        alt="QR Code PIX"
                        className="mx-auto mb-4 rounded-xl border border-zinc-200 bg-white p-2"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCopyPix()}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold',
                        variant === 'light'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : variant === 'app'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-[#f2b90f]/40 bg-black/40 text-[#f2b90f]'
                      )}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copiado!' : 'Copiar Pix copia e cola'}
                    </button>
                    <Loader2
                      className={cn(
                        'mx-auto mt-6 h-6 w-6 animate-spin',
                        variant === 'light' ? 'text-amber-600' : variant === 'app' ? 'text-primary' : 'text-[#f2b90f]/80'
                      )}
                    />
                    <p className={cn('mt-3 text-[11px]', t.textSubtle)}>Aguardando confirmação do pagamento…</p>
                  </motion.div>
                )}
              </motion.div>
            ) : !config?.cardAvailable ? (
              <p className={cn('text-sm', t.textMuted)}>
                Pagamento com cartão indisponível. Configure EFI_CLIENT_ID e EFI_CLIENT_SECRET na Vercel.
              </p>
            ) : (
              <form onSubmit={(e) => void handleCardPay(e)} className={formGap}>
                <p className={introClass}>
                  {isRenewal ? cardIntro : 'Assinatura mensal'} ({config.amountLabel || catalogPrice.label}
                  {catalogPrice.period}). Cartão tokenizado pela Efí — não passa pelo nosso servidor.
                </p>

                {config.cardTokenizationReady === false && config.cardSetup?.issues?.length ? (
                  <motion.div className={t.warnBox}>
                    {config.cardSetup.issues.map((issue) => (
                      <p key={issue}>{issue}</p>
                    ))}
                  </motion.div>
                ) : null}

                <motion.div>
                  <label className={t.labelClass}>Nome no cartão</label>
                  <input
                    className={t.fieldShell}
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    required
                    autoComplete="cc-name"
                  />
                </motion.div>

                <motion.div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={t.labelClass}>CPF</label>
                    <input
                      className={t.fieldShell}
                      value={holderCpf}
                      onChange={(e) => setHolderCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      required
                      inputMode="numeric"
                    />
                  </div>
                  <motion.div>
                    <label className={t.labelClass}>Telefone</label>
                    <input
                      className={t.fieldShell}
                      value={holderPhone}
                      onChange={(e) => setHolderPhone(e.target.value)}
                      inputMode="tel"
                    />
                  </motion.div>
                </motion.div>

                <motion.div>
                  <label className={t.labelClass}>Número do cartão</label>
                  <input
                    className={t.fieldShell}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </motion.div>

                <motion.div className="grid grid-cols-3 gap-3">
                  <motion.div>
                    <label className={t.labelClass}>Mês</label>
                    <input
                      className={t.fieldShell}
                      value={cardExpMonth}
                      onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="MM"
                      required
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                    />
                  </motion.div>
                  <motion.div>
                    <label className={t.labelClass}>Ano</label>
                    <input
                      className={t.fieldShell}
                      value={cardExpYear}
                      onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="AAAA"
                      required
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                    />
                  </motion.div>
                  <motion.div>
                    <label className={t.labelClass}>CVV</label>
                    <input
                      className={t.fieldShell}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      required
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </motion.div>
                </motion.div>

                <motion.div>
                  <label className={t.labelClass}>Parcelas</label>
                  <input
                    className={cn(t.fieldShell, t.disabledField)}
                    value="1x (à vista)"
                    readOnly
                    disabled
                    aria-readonly="true"
                  />
                </motion.div>

                <p
                  className={cn(
                    'font-bold uppercase tracking-widest',
                    isCompactLight ? 'pt-1 text-[9px]' : 'pt-2 text-[10px]',
                    t.textSubtle
                  )}
                >
                  Endereço de cobrança (Efí)
                </p>

                <motion.div>
                  <label className={t.labelClass}>CEP</label>
                  <input
                    className={t.fieldShell}
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    required
                    inputMode="numeric"
                  />
                </motion.div>

                <motion.div>
                  <label className={t.labelClass}>Rua</label>
                  <input className={t.fieldShell} value={street} onChange={(e) => setStreet(e.target.value)} required />
                </motion.div>

                <motion.div className="grid grid-cols-2 gap-3">
                  <motion.div>
                    <label className={t.labelClass}>Número</label>
                    <input
                      className={t.fieldShell}
                      value={streetNumber}
                      onChange={(e) => setStreetNumber(e.target.value)}
                      required
                    />
                  </motion.div>
                  <motion.div>
                    <label className={t.labelClass}>Bairro</label>
                    <input
                      className={t.fieldShell}
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      required
                    />
                  </motion.div>
                </motion.div>

                <motion.div className="grid grid-cols-3 gap-3">
                  <motion.div className="col-span-2">
                    <label className={t.labelClass}>Cidade</label>
                    <input className={t.fieldShell} value={city} onChange={(e) => setCity(e.target.value)} required />
                  </motion.div>
                  <motion.div>
                    <label className={t.labelClass}>UF</label>
                    <input
                      className={t.fieldShell}
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                      required
                    />
                  </motion.div>
                </motion.div>

                <motion.button
                  type="submit"
                  disabled={cardLoading || config.cardTokenizationReady === false}
                  whileTap={{ scale: 0.99 }}
                  style={
                    variant === 'app'
                      ? undefined
                      : { background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)` }
                  }
                  className={cn(payCtaClass, isCompactLight ? 'mt-1' : 'mt-2')}
                >
                  {cardLoading ? (
                    <Loader2 className={cn('animate-spin', isCompactLight ? 'h-4 w-4' : 'h-5 w-5')} />
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pagar com cartão
                    </>
                  )}
                </motion.button>

                {cardPaymentError ? (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-snug',
                      variant === 'light'
                        ? 'border-red-300 bg-red-50 text-red-800'
                        : 'border-red-500/40 bg-red-950/50 text-red-200'
                    )}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">{cardPaymentError}</p>
                  </motion.div>
                ) : null}
              </form>
            )}
          </motion.div>
        </>
      )}

      {showFooter && (
        <p
          className={cn(
            'flex items-center justify-center gap-1.5 text-center font-medium',
            isCompactLight ? 'mt-3 text-[10px]' : 'mt-5 text-[11px]',
            t.footerText
          )}
        >
          <ShieldCheck className={cn('h-3.5 w-3.5', t.footerIcon)} />
          Checkout EFI Bank · {config?.amountLabel || catalogPrice.label}/mês · Liberação automática
        </p>
      )}
    </div>
  );
}
