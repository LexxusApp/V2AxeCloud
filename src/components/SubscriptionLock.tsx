import React, { useState, useEffect } from 'react';
import { Lock, CreditCard, ShieldAlert, Sparkles, MessageCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthScreenBackground } from './AuthScreenBackground';
import { CHECKOUT_URLS } from '../constants/plans';
import { supabase } from '../lib/supabase';

interface SubscriptionLockProps {
  plan?: string;
  subscriptionStatus?: string;
}

export default function SubscriptionLock({ plan, subscriptionStatus }: SubscriptionLockProps) {
  const [loading, setLoading] = useState(false);
  const isPending = subscriptionStatus === 'pending';

  useEffect(() => {
    if (!isPending) return;
    const tick = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const res = await fetch(
        `/api/v1/onboarding/status?tenantId=${encodeURIComponent(uid)}`
      );
      if (!res.ok) return;
      const body = await res.json();
      if (body.active) window.location.reload();
    };
    const id = window.setInterval(tick, 5000);
    void tick();
    return () => window.clearInterval(id);
  }, [isPending]);

  const openCheckoutWindow = (url: string) => {
    const width = 500;
    const height = 750;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      url,
      'EfiCheckout',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid && isPending) {
        window.location.href = `/checkout?tenant=${encodeURIComponent(uid)}`;
        return;
      }
      if (uid) {
        const res = await fetch('/api/v1/checkout/efi/resume', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session!.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data.checkoutPath || data.checkoutUrl)) {
          window.location.href = data.checkoutPath || data.checkoutUrl;
          return;
        }
        if (data.alreadyActive) {
          window.location.reload();
          return;
        }
      }

      const slug = plan?.toLowerCase() || 'premium';
      if (CHECKOUT_URLS[slug]) {
        openCheckoutWindow(CHECKOUT_URLS[slug]);
      } else {
        window.location.href = '/register';
      }
    } finally {
      setLoading(false);
    }
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-6 backdrop-blur-2xl"
    >
      <AuthScreenBackground variant="dark" className="fixed inset-0" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative max-w-md w-full rounded-[2rem] border border-primary/20 bg-card p-12 text-center shadow-[0_0_50px_rgba(212,175,55,0.1)]"
      >
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/40 shadow-[0_10px_30px_rgba(212,175,55,0.3)]"
        >
          <Lock className="h-10 w-10 text-black" />
        </motion.div>

        <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight text-white">
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

        <p className="mb-10 text-sm font-medium leading-relaxed text-gray-400">
          {isPending
            ? 'Conclua o pagamento na EFI (Pix é instantâneo). Assim que confirmado, o painel libera automaticamente.'
            : 'Sua assinatura expirou ou está inativa. Regularize para voltar a gerenciar seu terreiro.'}
        </p>

        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckout}
            disabled={loading}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 font-black text-black shadow-[0_10px_20px_rgba(212,175,55,0.2)] transition-all hover:-translate-y-1 hover:bg-primary/90 hover:shadow-[0_15px_30px_rgba(212,175,55,0.4)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                {isPending ? 'IR PARA CHECKOUT' : `REGULARIZAR (${plan?.toUpperCase() || 'PREMIUM'})`}
              </>
            )}
          </motion.button>

          <button
            onClick={handleSupport}
            className="flex w-full flex-col items-center gap-1 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Falar com Suporte
            </span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 flex items-center justify-center gap-2 border-t border-white/5 pt-8"
        >
          <Sparkles className="h-4 w-4 text-primary/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
            Pagamento EFI · Liberação automática
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
