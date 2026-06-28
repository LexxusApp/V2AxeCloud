import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { navigateTo } from '../lib/navigation';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { BRAND_LOGO_ALT, BRAND_LOGO_HEIGHT, BRAND_LOGO_LOGIN_CLASS, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH } from '../constants/brandLogo';

const fontLogin =
  "[font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif]";

const AUTH_MODAL_CARD = cn(
  'relative w-full overflow-hidden rounded-xl border border-primary/20 bg-card',
  'shadow-[0_0_50px_rgba(212,175,55,0.1)]',
  'p-5 pt-3 sm:p-6 sm:pt-4'
);

const AUTH_MODAL_RADIUS = 'rounded-lg';

const fieldShell = cn(
  'w-full h-[38px] pl-[42px] pr-3 text-sm font-bold leading-none text-white placeholder:text-gray-500',
  'border border-white/10 bg-background',
  AUTH_MODAL_RADIUS,
  'outline-none transition-all focus:border-primary/50',
  '[@media(max-height:700px)]:h-[34px]'
);

const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-gray-500';

function humanizeResetError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return 'Não foi possível redefinir a senha. Tente solicitar um novo link.';
  if (lower.includes('same password') || lower.includes('different from')) {
    return 'A nova senha deve ser diferente da senha anterior.';
  }
  if (lower.includes('weak') || lower.includes('at least')) {
    return 'Escolha uma senha mais forte (mínimo 8 caracteres, com letras e números).';
  }
  if (lower.includes('session') || lower.includes('jwt') || lower.includes('expired')) {
    return 'Este link expirou ou já foi usado. Solicite uma nova recuperação de senha.';
  }
  return msg;
}

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      await supabase.auth.signOut();
      navigateTo(`${ROUTES.login}?updated=true`, true);
    } catch (err: unknown) {
      setError(humanizeResetError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-4 antialiased text-white backdrop-blur-2xl sm:h-[100dvh] sm:max-h-[100dvh] sm:overflow-hidden sm:px-6 sm:py-5',
        fontLogin
      )}
    >
      <AuthScreenBackground variant="dark" className="fixed inset-0" />

      <a
        href={ROUTES.login}
        className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1.5rem,env(safe-area-inset-top))] z-20 inline-flex items-center gap-1.5 text-xs font-semibold text-primary/90 transition-colors hover:text-primary [text-shadow:0_2px_10px_rgba(0,0,0,0.85)]"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Voltar ao login
      </a>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 my-auto w-full max-w-[22rem] py-2 sm:max-w-md sm:py-0"
      >
        <div className={cn(AUTH_MODAL_CARD, 'space-y-4')}>
          <header className="space-y-2.5 text-center">
            <div className="flex justify-center">
              <img
                src={BRAND_LOGO_SRC}
                alt={BRAND_LOGO_ALT}
                width={BRAND_LOGO_WIDTH}
                height={BRAND_LOGO_HEIGHT}
                decoding="async"
                className={BRAND_LOGO_LOGIN_CLASS}
              />
            </div>
            <h1 className="text-lg font-black text-white">Nova senha</h1>
            <p className="sr-only">{SITE_TITLE} — redefinição de senha</p>
            <p className="text-[13px] leading-snug text-gray-400">
              Escolha uma senha forte para continuar acessando sua zeladoria.
            </p>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-red-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
              <p className="text-[0.8125rem] font-bold leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-[8px]">
            <div className="space-y-[5px]">
              <label className={labelClass}>Nova senha</label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                  strokeWidth={1.5}
                />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={cn(fieldShell, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9ca0aa] transition-colors hover:text-zinc-200"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.65} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.65} />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-[5px]">
              <label className={labelClass}>Confirmar nova senha</label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                  strokeWidth={1.5}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={fieldShell}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-black uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
