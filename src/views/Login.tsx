import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  User,
  Loader2,
  KeyRound,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  UserCircle,
  Users,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { writeCachedTenantIdForUser } from '../lib/tenantCache';
import { authFetch } from '../lib/authenticatedFetch';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { AxeCloudLogoMark } from '../components/AxeCloudLogoMark';
import { ROUTES } from '../lib/routes';

const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';

async function postAuthAuditLog(
  payload: {
    action: 'auth.login_success' | 'auth.login_failed';
    status: 'success' | 'failed';
    terreiroId?: string | null;
    details?: Record<string, unknown>;
  },
  accessToken?: string | null
) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    await fetch('/api/auth/audit-log', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    /* auditoria best-effort */
  }
}

const fontLogin =
  "[font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif]";

/** Mesmo card do SubscriptionLock, com cantos menos arredondados */
const AUTH_MODAL_CARD = cn(
  'relative w-full overflow-hidden rounded-xl border border-primary/20 bg-card',
  'shadow-[0_0_50px_rgba(212,175,55,0.1)]',
  'p-5 sm:p-6'
);

const AUTH_MODAL_RADIUS = 'rounded-lg';

const fieldShell = cn(
  'w-full h-[38px] pl-[42px] pr-3 text-sm font-bold leading-none text-white placeholder:text-gray-500',
  'border border-white/10 bg-background',
  AUTH_MODAL_RADIUS,
  'outline-none transition-all focus:border-primary/50'
);

const labelClass =
  'block text-[10px] font-black uppercase tracking-widest text-gray-500';

/** Ícone inferior: três silhuetas dentro de círculo com aro dourado (mockup). */
function UsersCircleBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 shadow-[0_0_18px_rgba(212,175,55,0.12)]',
        className
      )}
      aria-hidden
    >
      <Users className="h-5 w-5 text-primary" strokeWidth={1.45} />
    </div>
  );
}

function humanizeAuthError(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return 'Não foi possível efetuar o login. Tente novamente em instantes.';

  if (lower.includes('failed to fetch') || lower === 'load failed' || lower.includes('networkerror')) {
    return 'Não conseguimos conectar ao servidor. Verifique sua internet, aguarde alguns segundos e tente de novo.';
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return 'O servidor demorou para responder. Tente novamente em alguns instantes.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente de novo.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  }
  if (lower.includes('jwt') && lower.includes('expir')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (lower.includes('user banned') || lower.includes('user_banned')) {
    return 'Conta bloqueada. Entre em contato com o suporte.';
  }
  return msg;
}

function persistFilhoFlag(isFilho: boolean, userId?: string | null) {
  try {
    if (isFilho) {
      localStorage.setItem(FILHO_FLAG_KEY, 'true');
      if (userId) localStorage.setItem(FILHO_FLAG_USER_KEY, userId);
      return;
    }
    localStorage.removeItem(FILHO_FLAG_KEY);
    localStorage.removeItem(FILHO_FLAG_USER_KEY);
  } catch {
    // no-op
  }
}

export default function Login() {
  const [filhoSurface, setFilhoSurface] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [childId, setChildId] = useState('');
  const [cpfPrefix, setCpfPrefix] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAlert, setShowAlert] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('updated') === 'true';
  });
  const alertHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('updated') !== 'true') return;

    window.history.replaceState({}, document.title, '/login');

    alertHideTimerRef.current = window.setTimeout(() => {
      setShowAlert(false);
      alertHideTimerRef.current = null;
    }, 4000);

    return () => {
      if (alertHideTimerRef.current) {
        clearTimeout(alertHideTimerRef.current);
        alertHideTimerRef.current = null;
      }
    };
  }, []);

  const closeUpdateAlert = () => {
    if (alertHideTimerRef.current) {
      clearTimeout(alertHideTimerRef.current);
      alertHideTimerRef.current = null;
    }
    setShowAlert(false);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    const raw = email.trim();
    if (!raw) {
      setError('Preencha seu e-mail acima para receber o link de recuperação.');
      return;
    }
    if (!raw.includes('@')) {
      setError('A recuperação de senha é enviada por e-mail. Informe o endereço cadastrado.');
      return;
    }
    const targetEmail = raw;
    setForgotLoading(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetErr) throw resetErr;
      setInfo('Enviamos um link de recuperação para o seu e-mail.');
    } catch (err: unknown) {
      setError(humanizeAuthError(err));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (!filhoSurface) {
        persistFilhoFlag(false);
        const loginEmail = email.trim();
        if (!loginEmail.includes('@')) {
          throw new Error('Informe o e-mail cadastrado pelo zelador para entrar.');
        }
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (signErr) throw signErr;
      } else {
        if (cpfPrefix.length < 6) {
          throw new Error('Digite os 6 primeiros dígitos do CPF.');
        }

        const response = await fetch('/api/auth/filho-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, cpfPrefix }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao fazer login.');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) throw signInError;
        persistFilhoFlag(true);
      }

      const {
        data: { session: postSession },
      } = await supabase.auth.getSession();
      if (postSession?.user) {
        persistFilhoFlag(filhoSurface, postSession.user.id);
        let tenantId = postSession.user.id;
        try {
          const r = await authFetch(
            `/api/tenant-info?userId=${encodeURIComponent(postSession.user.id)}&email=${encodeURIComponent(postSession.user.email || '')}`,
            {},
            postSession.access_token
          );
          if (r.ok) {
            const j = await r.json();
            tenantId = String(j.tenant_id || '').trim() || postSession.user.id;
            writeCachedTenantIdForUser(postSession.user.id, tenantId);
          } else {
            writeCachedTenantIdForUser(postSession.user.id, postSession.user.id);
          }
        } catch {
          writeCachedTenantIdForUser(postSession.user.id, postSession.user.id);
        }
        void postAuthAuditLog(
          {
            action: 'auth.login_success',
            status: 'success',
            terreiroId: tenantId,
            details: {
              surface: 'app',
              mode: filhoSurface ? 'filho' : 'zelador',
              email: postSession.user.email,
              userId: postSession.user.id,
            },
          },
          postSession.access_token
        );
      }
    } catch (err: unknown) {
      const msg = humanizeAuthError(err);
      void postAuthAuditLog({
        action: 'auth.login_failed',
        status: 'failed',
        terreiroId: null,
        details: {
          surface: 'app',
          mode: filhoSurface ? 'filho' : 'zelador',
          ...(filhoSurface ? { childId } : { email: email.trim().toLowerCase() }),
          message: msg.slice(0, 300),
        },
      });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative isolate flex min-h-screen min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 py-4 antialiased text-white backdrop-blur-2xl sm:px-6 sm:py-5',
        fontLogin
      )}
    >
      <AuthScreenBackground variant="dark" className="fixed inset-0" />

      <a
        href={ROUTES.home}
        className="absolute left-6 top-6 z-20 inline-flex items-center gap-1.5 text-xs font-semibold text-primary/90 transition-colors hover:text-primary [text-shadow:0_2px_10px_rgba(0,0,0,0.85)]"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Conhecer o AxéCloud
      </a>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 my-auto w-full max-w-[22rem] sm:max-w-md"
      >
        <div className={cn(AUTH_MODAL_CARD, 'space-y-4')}>
        {showAlert && (
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-primary',
              'shadow-[0_0_24px_rgba(212,175,55,0.08)]'
            )}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[0.8125rem] font-bold leading-snug flex-1 pr-1">
              Sistema atualizado. Faça o login novamente.
            </p>
            <button
              type="button"
              onClick={closeUpdateAlert}
              aria-label="Fechar aviso de atualização"
              className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-primary/85 transition-colors hover:bg-primary/12 hover:text-primary"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        <header className="space-y-4 text-center">
          <div className="flex justify-center py-1">
            <AxeCloudLogoMark size="large" />
          </div>
          <h1 className="sr-only">Axé Cloud — Gestão sagrada para terreiros</h1>
          <div className="space-y-0.5 text-[13px] leading-snug">
            <p className="font-medium text-white">Conecte-se ao seu terreiro.</p>
            <p className="mx-auto max-w-[260px] text-gray-400">
              Organize, comunique e fortaleça sua casa com tecnologia e Axé.
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <form onSubmit={handleAuth} className="space-y-[8px]">
            <AnimatePresence mode="wait">
              {!filhoSurface ? (
                <motion.div
                  key="zelador"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="space-y-[8px]"
                >
                  <div className="space-y-[5px]">
                    <label className={labelClass}>E-mail</label>
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
                        placeholder="Digite seu e-mail"
                        className={fieldShell}
                      />
                    </div>
                  </div>

                  <div className="space-y-[5px]">
                    <div className="flex items-end justify-between gap-4">
                      <label className={labelClass}>Senha</label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={forgotLoading}
                        className="pb-[1px] text-[11px] font-medium text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                      >
                        {forgotLoading ? 'Enviando...' : 'Esqueceu sua senha?'}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                        strokeWidth={1.5}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
                        className={cn(fieldShell, 'pr-12')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9ca0aa] transition-colors hover:text-zinc-200"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" strokeWidth={1.65} />
                        ) : (
                          <Eye className="h-5 w-5" strokeWidth={1.65} />
                        )}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer select-none items-center gap-[8px] pt-[1px]">
                    <span
                      className={cn(
                        'flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors',
                        rememberMe ? 'border-primary bg-primary/10' : 'border-primary bg-transparent'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only"
                      />
                      {rememberMe && (
                        <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 12 10" fill="none" aria-hidden>
                          <path
                            d="M1 5l3.5 3.5L11 1"
                            stroke="currentColor"
                            strokeWidth="1.85"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="text-[12px] font-medium text-white">Lembrar de mim</span>
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="filho"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="space-y-[8px]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFilhoSurface(false);
                      setError(null);
                      setInfo(null);
                    }}
                    className="-mt-1 mb-0 text-[11px] font-semibold text-gray-500 transition-colors hover:text-primary"
                  >
                    ← Voltar ao login do zelador
                  </button>
                  <div className="space-y-[5px]">
                    <label className={labelClass}>ID (4 dígitos)</label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                        strokeWidth={1.5}
                      />
                      <input
                        type="text"
                        required
                        maxLength={4}
                        value={childId}
                        onChange={(e) => setChildId(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                        placeholder="Ex.: 2E6B"
                        className={fieldShell}
                      />
                    </div>
                  </div>
                  <div className="space-y-[5px]">
                    <label className={labelClass}>6 primeiros dígitos do CPF</label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                        strokeWidth={1.5}
                      />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        inputMode="numeric"
                        value={cpfPrefix}
                        onChange={(e) => setCpfPrefix(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ex.: 123456"
                        className={fieldShell}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p
                className={cn(
                  'rounded-lg border border-red-500/30 bg-red-950/40 py-2 text-center text-[11px] font-semibold text-red-200'
                )}
              >
                {error}
              </p>
            )}
            {info && (
              <p
                className={cn(
                  'rounded-lg border border-primary/30 bg-primary/10 py-2 text-center text-[11px] font-semibold text-primary'
                )}
              >
                {info}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className={cn(
                AUTH_MODAL_RADIUS,
                'flex h-10 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-black',
                'shadow-[0_10px_20px_rgba(212,175,55,0.2)] transition-all hover:bg-primary/90 disabled:opacity-60'
              )}
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin text-black" strokeWidth={2.5} /> : 'Entrar'}
            </motion.button>
          </form>

          {!filhoSurface && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-0.5">
                <div className="h-px flex-1 bg-white/10" />
                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Acesso do filho
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilhoSurface(true);
                  setError(null);
                  setInfo(null);
                }}
                className={cn(
                  'relative flex h-10 w-full items-center justify-center text-sm font-bold text-white',
                  AUTH_MODAL_RADIUS,
                  'border border-white/10 bg-background transition-colors hover:border-primary/30 hover:bg-background/80'
                )}
              >
                <UserCircle
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span className="w-full text-center">Login filho</span>
              </button>
            </div>
          )}

          <a
            href="/register"
            className={cn(
              'group flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-background px-3 py-2.5',
              'transition-colors hover:border-primary/20'
            )}
          >
            <UsersCircleBadge />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold leading-snug text-white">Cadastre seu terreiro</p>
              <p className="mt-0.5 text-[10px] font-medium leading-snug text-gray-400">
                Crie sua conta, pague com Pix e libere o painel na hora.
              </p>
            </div>
            <ChevronRight
              className="h-[18px] w-[18px] shrink-0 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.85}
            />
          </a>
        </div>

        <p className="flex items-center justify-center gap-2 border-t border-white/5 pt-4 text-[9px] font-black uppercase tracking-[0.28em] text-gray-600">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary/40" strokeWidth={1.55} />
          Seguro, confiável e feito para terreiros
        </p>
        </div>
      </motion.div>
    </div>
  );
}
