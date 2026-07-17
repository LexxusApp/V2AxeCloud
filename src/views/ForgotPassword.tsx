import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { navigateTo } from '../lib/navigation';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { BRAND_LOGO_ALT, BRAND_LOGO_HEIGHT, BRAND_LOGO_LOGIN_CLASS, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH } from '../constants/brandLogo';
import { humanizePasswordPolicyError, PASSWORD_HINT_PT, validateStrongPassword } from '../../lib/passwordPolicy';

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

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('email');
    if (prefill) setEmail(prefill.trim());
  }, []);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const loginEmail = email.trim().toLowerCase();
    if (!loginEmail || !loginEmail.includes('@')) {
      setError('Informe o e-mail de login cadastrado.');
      return;
    }
    if (!whatsapp.replace(/\D/g, '').match(/^\d{10,13}$/)) {
      setError('Informe o WhatsApp cadastrado no terreiro, com DDD.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginEmail, whatsapp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao solicitar código.');

      setInfo(
        String(data.message || 'Se os dados coincidirem com o cadastro, enviamos um código de 6 dígitos no WhatsApp.')
      );
      setStep('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const loginEmail = email.trim().toLowerCase();
    if (!loginEmail || !code.trim() || !newPassword || !confirmPassword) {
      setError('Preencha e-mail, código e nova senha.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    const passwordCheck = validateStrongPassword(newPassword);
    if (passwordCheck.ok === false) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginEmail,
          whatsapp,
          code,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao redefinir senha.');

      navigateTo(`${ROUTES.login}?updated=true`, true);
    } catch (err: unknown) {
      setError(humanizePasswordPolicyError(err, err instanceof Error ? err.message : 'Erro ao redefinir senha.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-4 antialiased text-white backdrop-blur-2xl sm:px-6 sm:py-5',
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
            <h1 className="text-lg font-black text-white">Recuperar senha</h1>
            <p className="sr-only">{SITE_TITLE} — recuperação via WhatsApp</p>
            <p className="text-[13px] leading-snug text-gray-400">
              O e-mail de login pode ser fictício. Enviamos um código no WhatsApp cadastrado no terreiro.
            </p>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-red-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
              <p className="text-[0.8125rem] font-bold leading-snug">{error}</p>
            </div>
          )}

          {info && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-4 py-3 text-[0.8125rem] font-bold leading-snug text-emerald-300">
              {info}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={(e) => void handleRequestCode(e)} className="space-y-[8px]">
              <div className="space-y-[5px]">
                <label className={labelClass}>E-mail de login</label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                    strokeWidth={1.5}
                  />
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@login.com"
                    className={fieldShell}
                  />
                </div>
              </div>

              <div className="space-y-[5px]">
                <label className={labelClass}>WhatsApp do terreiro</label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                    strokeWidth={1.5}
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
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
                {loading ? 'Enviando…' : 'Enviar código no WhatsApp'}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleConfirm(e)} className="space-y-[8px]">
              <div className="space-y-[5px]">
                <label className={labelClass}>Código de 6 dígitos</label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                    strokeWidth={1.5}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className={cn(fieldShell, 'tracking-[0.3em]')}
                  />
                </div>
              </div>

              <div className="space-y-[5px]">
                <label className={labelClass}>Nova senha</label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                    strokeWidth={1.5}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ex.: Axé@2026"
                    className={cn(fieldShell, 'pr-12')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-gray-500"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500">{PASSWORD_HINT_PT}</p>
              </div>

              <div className="space-y-[5px]">
                <label className={labelClass}>Confirmar nova senha</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={cn(fieldShell, 'pl-3')}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('request');
                    setCode('');
                    setInfo(null);
                  }}
                  className="flex h-[42px] flex-1 items-center justify-center rounded-lg border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Reenviar código
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-black text-black hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Salvando…' : 'Salvar nova senha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
