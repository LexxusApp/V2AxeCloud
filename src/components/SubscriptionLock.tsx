import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Lock,
  Loader2,
  MessageCircle,
  QrCode,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthScreenBackground } from './AuthScreenBackground';
import { supabase } from '../lib/supabase';

interface SubscriptionLockProps {
  plan?: string;
  subscriptionStatus?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function SubscriptionLock({ plan, subscriptionStatus }: SubscriptionLockProps) {
  const isPending = subscriptionStatus === 'pending';

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [holderName, setHolderName] = useState('');
  const [holderCpf, setHolderCpf] = useState('');
  const [amountLabel, setAmountLabel] = useState('');
  const [pixAvailable, setPixAvailable] = useState(true);
  const [initLoading, setInitLoading] = useState(true);

  const [pixLoading, setPixLoading] = useState(false);
  const [pixTxid, setPixTxid] = useState<string | null>(null);
  const [pixCopy, setPixCopy] = useState<string | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const pollAccessActive = useCallback(async () => {
    if (!tenantId) return false;
    const res = await fetch(`/api/v1/onboarding/status?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return false;
    const body = await res.json();
    return !!body.active;
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) {
          setError('Sessão inválida. Faça login novamente.');
          return;
        }
        if (cancelled) return;
        setTenantId(uid);

        const [cfgRes, ctxRes] = await Promise.all([
          fetch('/api/v1/checkout/efi/config', { cache: 'no-store' }),
          fetch(`/api/v1/checkout/efi/context?tenantId=${encodeURIComponent(uid)}`, {
            cache: 'no-store',
            headers: await authHeaders(),
          }),
        ]);

        const cfg = await cfgRes.json().catch(() => ({}));
        if (!cfgRes.ok) throw new Error(cfg.error || 'Pagamento indisponível no momento.');
        if (cancelled) return;
        setPixAvailable(!!cfg.pixAvailable);
        setAmountLabel(String(cfg.amountLabel || '').trim());

        if (ctxRes.ok) {
          const ctx = await ctxRes.json();
          if (cancelled) return;
          setHolderName(String(ctx.nomeZelador || ctx.nomeTerreiro || '').trim());
          if (ctx.active) {
            window.location.reload();
            return;
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar dados de pagamento.');
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tenantId || paymentConfirmed) return;
    const tick = async () => {
      if (await pollAccessActive()) window.location.reload();
    };
    const id = window.setInterval(tick, 5000);
    void tick();
    return () => window.clearInterval(id);
  }, [tenantId, paymentConfirmed, pollAccessActive]);

  useEffect(() => {
    if (!pixTxid || !tenantId || paymentConfirmed) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/v1/checkout/efi/pix/${encodeURIComponent(pixTxid)}/status?tenantId=${encodeURIComponent(tenantId)}`,
          { headers: await authHeaders() }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.paid || data.active) {
          setPaymentConfirmed(true);
          window.clearInterval(interval);
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch {
        /* ignore */
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [pixTxid, paymentConfirmed, tenantId]);

  const handleGeneratePix = async () => {
    if (!tenantId) return;
    setPixLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/checkout/efi/pix', {
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
        window.location.reload();
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

  const handleSupport = () => {
    window.open(
      'https://wa.me/558481232810?text=Ol%C3%A1,%20minha%20assinatura%20est%C3%A1%20suspensa%20e%20preciso%20de%20ajuda%20para%20renovar%20meu%20plano%20no%20Ax%C3%A9Cloud',
      '_blank'
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-6 backdrop-blur-2xl"
    >
      <AuthScreenBackground variant="dark" className="fixed inset-0" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative my-auto max-h-[min(92dvh,900px)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-primary/20 bg-card p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.1)] sm:p-10"
      >
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/40 shadow-[0_10px_30px_rgba(212,175,55,0.3)]"
        >
          <Lock className="h-9 w-9 text-black" />
        </motion.div>

        {paymentConfirmed ? (
          <>
            <Check className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-2 text-2xl font-black text-white">Pagamento confirmado!</h2>
            <p className="text-sm text-gray-400">Liberando seu acesso ao painel…</p>
            <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
          </>
        ) : (
          <>
            <h2 className="mb-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {isPending ? (
                <>
                  Aguardando <span className="text-primary">pagamento</span>
                </>
              ) : (
                <>
                  Seu acesso ao <span className="text-primary">AxéCloud</span> está suspenso
                </>
              )}
            </h2>

            <p className="mb-6 text-sm font-medium leading-relaxed text-gray-400">
              {isPending
                ? 'Gere o QR Code Pix abaixo. Assim que o pagamento for confirmado, o painel libera automaticamente.'
                : 'Sua assinatura expirou ou está inativa. Pague via Pix para voltar a gerenciar seu terreiro.'}
              {amountLabel ? (
                <span className="mt-2 block text-primary font-bold">
                  Valor: {amountLabel}
                  {plan ? ` · Plano ${plan.toUpperCase()}` : ''}
                </span>
              ) : null}
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-left text-[13px] text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {initLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !pixAvailable ? (
              <p className="mb-6 text-sm text-gray-500">PIX indisponível no momento. Fale com o suporte.</p>
            ) : !pixQr ? (
              <div className="mb-6 space-y-3 text-left">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Nome do pagador
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    placeholder="Como no comprovante"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">
                    CPF (opcional)
                  </label>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary/50"
                    value={holderCpf}
                    onChange={(e) => setHolderCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="00000000000"
                    inputMode="numeric"
                  />
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleGeneratePix()}
                  disabled={pixLoading || !tenantId}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-black text-black shadow-[0_10px_20px_rgba(212,175,55,0.2)] transition-all hover:bg-primary/90 disabled:opacity-60"
                >
                  {pixLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="h-5 w-5" />
                      Gerar QR Code
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <p className="text-sm text-gray-400">
                  Escaneie o QR Code ou copie o Pix. Validade: 1 hora.
                </p>
                {pixQr && (
                  <img
                    src={pixQr}
                    alt="QR Code PIX"
                    className="mx-auto rounded-xl border border-white/10 bg-white p-2"
                  />
                )}
                <button
                  type="button"
                  onClick={() => void handleCopyPix()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3 text-xs font-bold text-primary"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado!' : 'Copiar Pix copia e cola'}
                </button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-primary/80" />
                  Aguardando confirmação do pagamento…
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPixQr(null);
                    setPixTxid(null);
                    setPixCopy(null);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400"
                >
                  Gerar novo QR Code
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSupport}
              className="flex w-full flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold uppercase tracking-widest text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Falar com Suporte
              </span>
            </button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 flex items-center justify-center gap-2 border-t border-white/5 pt-6"
            >
              <Sparkles className="h-4 w-4 text-primary/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
                Pagamento EFI · Liberação automática
              </span>
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
