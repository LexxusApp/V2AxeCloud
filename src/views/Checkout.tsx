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
  TreePine,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { LANDING_PRICE } from '../constants/landingFeatures';
import { createEfiPaymentToken, detectCardBrand, loadEfiPaymentScript } from '../lib/efiCardToken';

const GOLD = '#f2b90f';
const R_CARD = 'rounded-[14px]';
const fontLogin = '[font-family:Montserrat,system-ui,sans-serif]';

const fieldShell = cn(
  'w-full h-[42px] pl-3 pr-3 text-[14px] text-white placeholder:text-[#8f939c]',
  'bg-[#0a0b0d]/95 border border-white/[0.22]',
  R_CARD,
  'outline-none transition-[border-color] duration-200 focus:border-[#f2b90f]/70'
);

const labelClass = 'block text-[10px] font-bold text-[#c4c7d0] uppercase tracking-[0.16em] mb-1';

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

export default function Checkout() {
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
  const [holderName, setHolderName] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [holderPhone, setHolderPhone] = useState('');
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
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, ctxRes] = await Promise.all([
        fetch('/api/v1/checkout/efi/config', { cache: 'no-store' }),
        fetch(`/api/v1/checkout/efi/context?tenantId=${encodeURIComponent(readTenantFromUrl())}`, {
          cache: 'no-store',
          headers: await authHeaders(),
        }),
      ]);

      const cfg = await cfgRes.json().catch(() => ({}));
      if (!cfgRes.ok) throw new Error(cfg.error || 'Checkout indisponível');

      setConfig(cfg as EfiConfig);
      if (cfg.pixAvailable && cfg.cardAvailable) setMethod('pix');
      else if (!cfg.pixAvailable && cfg.cardAvailable) setMethod('card');
      else if (cfg.pixAvailable) setMethod('pix');

      if (ctxRes.ok) {
        const context = (await ctxRes.json()) as CheckoutContext;
        setCtx(context);
        setHolderName(context.nomeZelador || context.nomeTerreiro || '');
        if (context.active) setAlreadyActive(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar checkout.');
    } finally {
      setLoading(false);
    }
  }, []);

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
    }
  }, [method]);

  const pollActivation = useCallback(async () => {
    const tenantId = ctx?.tenantId || readTenantFromUrl();
    if (!tenantId) return false;
    const res = await fetch(
      `/api/v1/onboarding/status?tenantId=${encodeURIComponent(tenantId)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.active;
  }, [ctx?.tenantId]);

  useEffect(() => {
    if (!pixTxid || paymentConfirmed) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/v1/checkout/efi/pix/${encodeURIComponent(pixTxid)}/status?tenantId=${encodeURIComponent(ctx?.tenantId || readTenantFromUrl())}`,
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
  }, [pixTxid, paymentConfirmed, ctx?.tenantId]);

  const handleGeneratePix = async () => {
    setPixLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/checkout/efi/pix', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          tenantId: ctx?.tenantId || readTenantFromUrl(),
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

      const res = await fetch('/api/v1/checkout/efi/card', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          tenantId: ctx?.tenantId || readTenantFromUrl(),
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
      if (!res.ok) throw new Error(data.error || 'Pagamento recusado.');

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
      setError(err instanceof Error ? err.message : 'Erro no pagamento com cartão.');
    } finally {
      setCardLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        className={cn('flex min-h-screen items-center justify-center login-bg-screen', fontLogin)}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#f2b90f]" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('min-h-screen text-white login-bg-screen', fontLogin)}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6"
      >
        <header className="mb-6 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f2b90f]/40 bg-black/40"
            whileHover={{ scale: 1.03 }}
          >
            <TreePine className="h-7 w-7 text-[#f2b90f]" />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#f2b90f]">AxéCloud</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Checkout seguro</h1>
          <p className="mt-2 text-sm text-[#b8bbc4]">
            Plano Premium {config?.amountLabel || LANDING_PRICE.label}
            {LANDING_PRICE.period}
          </p>
        </header>

        {paymentConfirmed ? (
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className={cn(R_CARD, 'border border-[#f2b90f]/30 bg-[#060708]/90 p-8 text-center')}
          >
            <Check className="mx-auto mb-4 h-10 w-10 text-[#f2b90f]" />
            <h2 className="text-xl font-black">Pagamento confirmado!</h2>
            <p className="mt-2 text-sm text-[#b8bbc4]">Redirecionando para o painel…</p>
            <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-[#f2b90f]" />
          </motion.div>
        ) : alreadyActive ? (
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className={cn(R_CARD, 'border border-[#f2b90f]/30 bg-[#060708]/90 p-8 text-center')}
          >
            <Check className="mx-auto mb-4 h-10 w-10 text-[#f2b90f]" />
            <h2 className="text-xl font-black">Assinatura já ativa</h2>
            <p className="mt-2 text-sm text-[#b8bbc4]">
              Este terreiro já possui acesso liberado. Não é necessário pagar novamente.
            </p>
            <motion.a
              href="/dashboard"
              style={{
                background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)`,
              }}
              className={cn(
                R_CARD,
                'mt-6 inline-flex h-[44px] items-center justify-center px-8 text-[14px] font-black uppercase tracking-[0.1em] text-black'
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
                className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-[13px] text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {(config?.pixAvailable || config?.cardAvailable) && (
              <motion.div
                className={cn(R_CARD, 'mb-4 flex border border-white/15 bg-[#060708]/76 p-1')}
                layout
                role="tablist"
                aria-label="Forma de pagamento"
              >
                {config?.pixAvailable && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === 'pix'}
                    onClick={() => setMethod('pix')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-all sm:text-xs',
                      method === 'pix'
                        ? 'bg-[#f2b90f] text-black'
                        : 'text-[#9a9da6] hover:text-white'
                    )}
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
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
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-all sm:text-xs',
                      method === 'card'
                        ? 'bg-[#f2b90f] text-black'
                        : 'text-[#9a9da6] hover:text-white'
                    )}
                  >
                    <CreditCard className="h-4 w-4 shrink-0" />
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
              initial={{ opacity: 0, x: method === 'pix' ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(R_CARD, 'border border-white/[0.16] bg-[#060708]/76 p-6 backdrop-blur-xl')}
            >
              {method === 'pix' ? (
                <motion.div className="space-y-4" layout>
                  {!config?.pixAvailable ? (
                    <motion.div className="space-y-2 text-sm text-[#b8bbc4]">
                      <p>PIX não disponível neste deploy. O servidor não conseguiu carregar chave + certificado .p12.</p>
                      {config?.pixSetup?.issues?.length ? (
                        <ul className="list-inside list-disc space-y-1 text-[#9a9ea8]">
                          {config.pixSetup.issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Confira na Vercel (mesmo ambiente Preview/Production da URL): EFI_PIX_KEY,
                          EFI_PIX_CERT_BASE64 e EFI_CLIENT_ID / EFI_CLIENT_SECRET.
                        </p>
                      )}
                    </motion.div>
                  ) : !pixQr ? (
                    <>
                      <p className="text-sm leading-relaxed text-[#b8bbc4]">
                        Gere o QR Code na hora. O Pix confirma em segundos e liberamos seu acesso
                        automaticamente.
                      </p>
                      <div>
                        <label className={labelClass}>Nome do pagador</label>
                        <input
                          className={fieldShell}
                          value={holderName}
                          onChange={(e) => setHolderName(e.target.value)}
                          placeholder="Como no comprovante"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>CPF (opcional)</label>
                        <input
                          className={fieldShell}
                          value={holderCpf}
                          onChange={(e) => setHolderCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          placeholder="00000000000"
                          inputMode="numeric"
                        />
                      </div>
                      <motion.button
                        type="button"
                        disabled={pixLoading}
                        onClick={() => void handleGeneratePix()}
                        whileTap={{ scale: 0.99 }}
                        style={{
                          background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)`,
                        }}
                        className={cn(
                          R_CARD,
                          'flex h-[44px] w-full items-center justify-center gap-2 text-[14px] font-black uppercase tracking-[0.1em] text-black disabled:opacity-50'
                        )}
                      >
                        {pixLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
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
                      <p className="mb-4 text-sm text-[#b8bbc4]">
                        Escaneie o QR Code ou copie o código Pix. Validade: 1 hora.
                      </p>
                      {pixQr && (
                        <motion.img
                          src={pixQr}
                          alt="QR Code PIX"
                          className="mx-auto mb-4 rounded-xl border border-white/10 bg-white p-2"
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopyPix()}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#f2b90f]/40 bg-black/40 px-4 py-2 text-xs font-bold text-[#f2b90f]"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copiado!' : 'Copiar Pix copia e cola'}
                      </button>
                      <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-[#f2b90f]/80" />
                      <p className="mt-3 text-[11px] text-[#9a9da6]">Aguardando confirmação do pagamento…</p>
                    </motion.div>
                  )}
                </motion.div>
              ) : !config?.cardAvailable ? (
                <p className="text-sm text-[#b8bbc4]">
                  Pagamento com cartão indisponível. Configure EFI_CLIENT_ID e EFI_CLIENT_SECRET na Vercel.
                </p>
              ) : (
                <form onSubmit={(e) => void handleCardPay(e)} className="space-y-3">
                  <p className="text-sm leading-relaxed text-[#b8bbc4]">
                    Assinatura mensal recorrente ({config.amountLabel || LANDING_PRICE.label}
                    {LANDING_PRICE.period}). Os dados do cartão são tokenizados pela Efí — não passam
                    pelo nosso servidor.
                  </p>

                  {config.cardTokenizationReady === false && config.cardSetup?.issues?.length ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-[13px] text-amber-100">
                      {config.cardSetup.issues.map((issue) => (
                        <p key={issue}>{issue}</p>
                      ))}
                    </motion.div>
                  ) : null}

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <label className={labelClass}>Nome no cartão</label>
                    <input
                      className={fieldShell}
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      required
                      autoComplete="cc-name"
                    />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.div>
                      <label className={labelClass}>CPF</label>
                      <input
                        className={fieldShell}
                        value={holderCpf}
                        onChange={(e) => setHolderCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        required
                        inputMode="numeric"
                      />
                    </motion.div>
                    <motion.div>
                      <label className={labelClass}>Telefone</label>
                      <input
                        className={fieldShell}
                        value={holderPhone}
                        onChange={(e) => setHolderPhone(e.target.value)}
                        inputMode="tel"
                      />
                    </motion.div>
                  </div>

                  <motion.div>
                    <label className={labelClass}>Número do cartão</label>
                    <input
                      className={fieldShell}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      required
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                  </motion.div>

                  <motion.div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Validade (mês)</label>
                      <input
                        className={fieldShell}
                        value={cardExpMonth}
                        onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="MM"
                        required
                        inputMode="numeric"
                        autoComplete="cc-exp-month"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Validade (ano)</label>
                      <input
                        className={fieldShell}
                        value={cardExpYear}
                        onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="AAAA"
                        required
                        inputMode="numeric"
                        autoComplete="cc-exp-year"
                      />
                    </div>
                    <motion.div>
                      <label className={labelClass}>CVV</label>
                      <input
                        className={fieldShell}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        required
                        inputMode="numeric"
                        autoComplete="cc-csc"
                      />
                    </motion.div>
                  </motion.div>

                  <motion.div>
                    <label className={labelClass}>Parcelas</label>
                    <input
                      className={cn(fieldShell, 'text-[#9a9da6]')}
                      value="1x (à vista)"
                      readOnly
                      disabled
                      aria-readonly="true"
                    />
                  </motion.div>

                  <p className="pt-2 text-[10px] font-bold uppercase tracking-widest text-[#9a9da6]">
                    Endereço de cobrança (exigido pela Efí)
                  </p>

                  <motion.div>
                    <label className={labelClass}>CEP</label>
                    <input
                      className={fieldShell}
                      value={zipcode}
                      onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      required
                      inputMode="numeric"
                    />
                  </motion.div>

                  <motion.div>
                    <label className={labelClass}>Rua</label>
                    <input className={fieldShell} value={street} onChange={(e) => setStreet(e.target.value)} required />
                  </motion.div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.div>
                      <label className={labelClass}>Número</label>
                      <input
                        className={fieldShell}
                        value={streetNumber}
                        onChange={(e) => setStreetNumber(e.target.value)}
                        required
                      />
                    </motion.div>
                    <motion.div>
                      <label className={labelClass}>Bairro</label>
                      <input
                        className={fieldShell}
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        required
                      />
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <motion.div className="col-span-2">
                      <label className={labelClass}>Cidade</label>
                      <input className={fieldShell} value={city} onChange={(e) => setCity(e.target.value)} required />
                    </motion.div>
                    <motion.div>
                      <label className={labelClass}>UF</label>
                      <input
                        className={fieldShell}
                        value={stateUf}
                        onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                        required
                      />
                    </motion.div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={cardLoading || config.cardTokenizationReady === false}
                    whileTap={{ scale: 0.99 }}
                    style={{
                      background: `linear-gradient(180deg, ${GOLD} 0%, #c88900 100%)`,
                    }}
                    className={cn(
                      R_CARD,
                      'mt-2 flex h-[44px] w-full items-center justify-center gap-2 text-[14px] font-black uppercase tracking-[0.1em] text-black disabled:opacity-50'
                    )}
                  >
                    {cardLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pagar com cartão
                      </>
                    )}
                  </motion.button>
                </form>
              )}
            </motion.div>
          </>
        )}

        <p className="login-footer-rule mt-6 flex items-center justify-center gap-2 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8cad2]">
          <ShieldCheck className="h-4 w-4 text-[#f2b90f]" />
          Pagamento EFI · Liberação automática
        </p>
      </motion.div>
    </motion.div>
  );
}
