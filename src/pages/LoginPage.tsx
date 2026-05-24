import { useEffect, useState } from 'react';
import Login from '../views/Login';
import { supabase } from '../lib/supabase';
import { goToDashboard } from '../lib/navigation';

/** Tela de login em /login — redireciona para o painel se já houver sessão. */
export default function LoginPage() {
  const [, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setChecked(true);
      if (data.session?.user) goToDashboard();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) goToDashboard();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Login />;
}
