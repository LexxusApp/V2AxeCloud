import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, TreePine } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { RegistrationProgress } from '../components/RegistrationProgress';
import { RegistrationCheckoutPanel } from '../components/RegistrationCheckoutPanel';

const fontLogin = '[font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif]';

function readTenantFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('tenant')?.trim() || '';
}

/** Checkout do cadastro (passo 2 após /register). Renovação usa /assinatura/renovar. */
export default function Checkout() {
  const { premium: landingPrice } = usePlansCatalog();
  const tenantId = readTenantFromUrl();

  if (!tenantId) {
    return (
      <motion.div className={cn('relative flex min-h-screen items-center justify-center px-4', fontLogin)}>
        <AuthScreenBackground variant="dark" />
        <p className="relative z-10 max-w-sm text-center text-sm text-[#b8bbc4]">
          Link de ativação inválido. Volte ao cadastro ou faça login.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('relative min-h-screen text-white', fontLogin)}
    >
      <AuthScreenBackground />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6"
      >
        <RegistrationProgress currentStep={2} variant="dark" />

        <header className="mb-6 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f2b90f]/40 bg-black/40"
            whileHover={{ scale: 1.03 }}
          >
            <TreePine className="h-7 w-7 text-[#f2b90f]" />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#f2b90f]">AxéCloud</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Ativação do sistema</h1>
          <p className="mt-2 text-sm text-[#b8bbc4]">
            Passo 2 — pagamento via PIX. Plano Premium {landingPrice.label}
            {landingPrice.period}
          </p>
        </header>

        <RegistrationCheckoutPanel tenantId={tenantId} variant="dark" purpose="onboarding" showFooter={false} />

        <p className="login-footer-rule mt-6 flex items-center justify-center gap-2 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8cad2]">
          <ShieldCheck className="h-4 w-4 text-[#f2b90f]" />
          Pagamento EFI · Liberação automática
        </p>
      </motion.div>
    </motion.div>
  );
}
