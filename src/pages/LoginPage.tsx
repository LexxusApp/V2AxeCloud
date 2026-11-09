import { useEffect, useState } from 'react';
import Login from '../views/Login';
import { supabase } from '../lib/supabase';
import { isPasswordRecoveryUrl } from '../lib/authRecovery';
import { navigateTo, goToResetPassword } from '../lib/navigation';
import { readPersistedFilhoFlag } from '../lib/appSessionAnchors';

function openSignedInSpace(userId: string) {
  // The member login must select the personal space before the pilot's
  // server-side mode switch. The server still validates the member record.
  navigateTo(readPersistedFilhoFlag(userId) ? '/dashboard?space=member' : '/dashboard', true);
}

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
      if (data.session?.user && !isPasswordRecoveryUrl()) openSignedInSpace(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        goToResetPassword();
        return;
      }
      if (session?.user && event !== 'INITIAL_SESSION' && !isPasswordRecoveryUrl()) {
        openSignedInSpace(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Login />;
}
