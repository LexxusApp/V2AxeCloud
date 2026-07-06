import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ResetPassword from '../views/ResetPassword';
import { supabase } from '../lib/supabase';
import { isPasswordRecoveryUrl } from '../lib/authRecovery';
import { ROUTES } from '../lib/routes';
import { goToLogin } from '../lib/navigation';

/** Tela de redefinição após link enviado por e-mail (Supabase PASSWORD_RECOVERY). */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
        setInvalid(false);
      }
    };

    const markInvalid = () => {
      if (!cancelled) {
        setInvalid(true);
        setReady(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        markReady();
      } else if (event === 'SIGNED_IN' && session && isPasswordRecoveryUrl()) {
        markReady();
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session && isPasswordRecoveryUrl()) {
        markReady();
        return;
      }
      if (!isPasswordRecoveryUrl()) {
        markInvalid();
        return;
      }
      timeoutId = window.setTimeout(() => {
        void supabase.auth.getSession().then(({ data: retry }) => {
          if (cancelled) return;
          if (retry.session) markReady();
          else markInvalid();
        });
      }, 1200);
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (invalid) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-300">
        <p className="max-w-sm text-sm leading-relaxed">
          Link inválido ou expirado. Solicite uma nova recuperação de senha na tela de login.
        </p>
        <button
          type="button"
          onClick={() => goToLogin()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black hover:opacity-90"
        >
          Ir para {ROUTES.login}
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Validando link" />
      </div>
    );
  }

  return <ResetPassword />;
}
