import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Login from '../views/Login';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { supabase } from '../lib/supabase';
import { goToDashboard } from '../lib/navigation';

/** Tela de login em /login â€” redireciona para o painel se jÃ¡ houver sessÃ£o. */
export default function LoginPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        goToDashboard();
        return;
      }
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) goToDashboard();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <AuthScreenBackground variant="dark" className="fixed inset-0" />
        <Loader2 className="relative z-10 h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return <Login />;
}
