import { useEffect, useState } from 'react';
import Login from '../views/Login';
import { supabase } from '../lib/supabase';
import { isPasswordRecoveryUrl } from '../lib/authRecovery';
import { goToDashboard, goToResetPassword } from '../lib/navigation';

/** Tela de login em /entrar — redireciona para o painel se já houver sessão. */
export default function LoginPage() {
  const [, setChecked] = useState(false);

  useEffect(() => {
    if (isPasswordRecoveryUrl()) {
      goToResetPassword();
      return;
    }

    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setChecked(true);
      if (data.session?.user && !isPasswordRecoveryUrl()) goToDashboard();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        goToResetPassword();
        return;
      }
      if (session?.user && event !== 'INITIAL_SESSION' && !isPasswordRecoveryUrl()) {
        goToDashboard();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Login />;
}
