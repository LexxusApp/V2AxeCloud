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
  UserCircle,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { writeCachedTenantIdForUser } from '../lib/tenantCache';
import { resolveTenantFromSupabase } from '../lib/resolveTenantFromSupabase';
import { authFetch } from '../lib/authenticatedFetch';
import { ROUTES } from '../lib/routes';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { isValidFilhoLoginId } from '../../lib/filhoMatricula';

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
  "[font-family:'Outfit',system-ui,sans-serif]";

const AUTH_MODAL_CARD = cn(
  'relative w-full overflow-hidden rounded-[1.5rem] border border-[#1b1813]/10 bg-[#fffdf8]',
  'shadow-[0_28px_90px_rgba(73,52,13,0.16)]'
);

const AUTH_MODAL_RADIUS = 'rounded-[0.9rem]';

const fieldShell = cn(
  'h-12 w-full pl-[44px] pr-3 text-[0.9rem] font-medium leading-none text-[#1b1813] placeholder:text-[#1b1813]/35',
  'border border-[#1b1813]/12 bg-[#f8f4eb]',
  AUTH_MODAL_RADIUS,
  'outline-none transition-all focus:border-[#c48a00]/65 focus:bg-white focus:shadow-[0_0_0_3px_rgba(196,138,0,.09)]',
  '[@media(max-height:700px)]:h-10'
);

const labelClass =
  'block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#1b1813]/55';

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

    window.history.replaceState({}, document.title, ROUTES.login);

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

  const forgotPasswordHref = email.trim()
    ? `${ROUTES.forgotPassword}?email=${encodeURIComponent(email.trim())}`
    : ROUTES.forgotPassword;

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
        if (!isValidFilhoLoginId(childId)) {
          throw new Error('Informe o registro completo (ex.: AXC-2021-B2CA).');
        }
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

        if (data.access_token && data.refresh_token) {
          const { error: signInError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          if (signInError) throw signInError;
        } else if (data.email && data.password) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          if (signInError) throw signInError;
        } else {
          throw new Error('Resposta de login inválida.');
        }
        persistFilhoFlag(true);
      }

      const {
        data: { session: postSession },
      } = await supabase.auth.getSession();
      if (postSession?.user) {
        persistFilhoFlag(filhoSurface, postSession.user.id);
        if (filhoSurface) {
          try {
            const r = await authFetch(
              `/api/tenant-info?userId=${encodeURIComponent(postSession.user.id)}&email=${encodeURIComponent(postSession.user.email || '')}`,
              {},
              postSession.access_token
            );
            let tenantId = '';
            let nomeTerreiro = '';
            if (r.ok) {
              const j = await r.json();
              tenantId = String(j.tenant_id || '').trim();
              nomeTerreiro = String(j.nome_terreiro || '').trim();
            }
            if (!tenantId || tenantId === postSession.user.id) {
              tenantId = await resolveTenantFromSupabase(
                postSession.user.id,
                postSession.user.email
              );
            }
            if (tenantId && tenantId !== postSession.user.id) {
              writeCachedTenantIdForUser(postSession.user.id, tenantId, nomeTerreiro || undefined);
            }
            void postAuthAuditLog(
              {
                action: 'auth.login_success',
                status: 'success',
                terreiroId: tenantId || null,
                details: {
                  surface: 'app',
                  mode: 'filho',
                  email: postSession.user.email,
                  userId: postSession.user.id,
                },
              },
              postSession.access_token
            );
          } catch {
            const tenantId = await resolveTenantFromSupabase(
              postSession.user.id,
              postSession.user.email
            );
            if (tenantId && tenantId !== postSession.user.id) {
              writeCachedTenantIdForUser(postSession.user.id, tenantId);
            }
          }
        } else {
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
                mode: 'zelador',
                email: postSession.user.email,
                userId: postSession.user.id,
              },
            },
            postSession.access_token
          );
        }
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

  const switchSurface = (nextIsFilho: boolean) => {
    if (loading || nextIsFilho === filhoSurface) return;
    setFilhoSurface(nextIsFilho);
    setError(null);
    setInfo(null);
  };

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-[#faf8f4] px-4 py-4 antialiased text-[#1b1813] sm:h-[100dvh] sm:max-h-[100dvh] sm:overflow-hidden sm:px-6 sm:py-5',
        fontLogin
      )}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-36 -top-36 h-[34rem] w-[34rem] rounded-full bg-[#f0b400]/[0.09] blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[38rem] w-[38rem] rounded-full bg-[#e2bc5a]/[0.12] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(120,82,0,.45)_0.55px,transparent_0.55px)] [background-size:22px_22px]" />
        <div className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c48a00]/10" />
      </div>

      <a
        href={ROUTES.home}
        className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1.25rem,env(safe-area-inset-top))] z-20 inline-flex items-center gap-2 text-xs font-semibold text-[#1b1813]/60 transition-colors hover:text-[#a87500]"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Conhecer o AxéCloud
      </a>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 my-auto w-full max-w-[22rem] py-2 sm:py-0 md:max-w-[54rem]"
      >
        <div
          data-login-mode={filhoSurface ? 'filho' : 'zelador'}
          className={cn(
            AUTH_MODAL_CARD,
            '[perspective:1600px] md:min-h-[36rem] md:rounded-[1.8rem]'
          )}
        >
        <div
          className={cn(
            'relative z-10 w-full space-y-4 p-6 transition-[left] duration-700 ease-[cubic-bezier(.77,0,.18,1)] motion-reduce:transition-none sm:p-8',
            'md:absolute md:inset-y-0 md:flex md:w-1/2 md:flex-col md:justify-center md:overflow-y-auto md:px-10 md:py-8',
            filhoSurface ? 'md:left-1/2' : 'md:left-0'
          )}
        >
        {showAlert && (
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border border-[#c48a00]/25 bg-[#f5e5b5]/40 px-4 py-3 text-[#775400]'
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

        <header className="space-y-3 text-left">
          <div className="mb-7 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#c48a00]/55 text-lg text-[#b47d00]">✦</span>
            <span className="text-xl tracking-[-0.04em] [font-family:'Fraunces',Georgia,serif]">
              Axé<span className="text-[#b47d00]">Cloud</span>
            </span>
          </div>
          <h1 className="sr-only">{SITE_TITLE} para terreiros</h1>
          <p className="text-[0.63rem] font-bold uppercase tracking-[0.28em] text-[#aa7600]">
            {filhoSurface ? 'Portal do filho de santo' : 'Gestão da casa de axé'}
          </p>
          <h2 className="text-[2.15rem] font-medium leading-[1.02] tracking-[-0.045em] text-[#1b1813] [font-family:'Fraunces',Georgia,serif]">
            {filhoSurface ? 'Entre na corrente.' : 'Bem-vindo de volta.'}
          </h2>
          <div className="space-y-0.5 text-[13px] leading-snug">
            <p className="max-w-[19rem] text-[#1b1813]/55">
              {filhoSurface
                ? 'Use o registro entregue pela sua casa e os seis primeiros dígitos do CPF.'
                : 'Entre com o e-mail e a senha usados na gestão do terreiro.'}
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
                      <a
                        href={forgotPasswordHref}
                        className="pb-[1px] text-[11px] font-semibold text-[#a87500] transition-colors hover:text-[#7b5700]"
                      >
                        Esqueceu sua senha?
                      </a>
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
                        className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#1b1813]/35 transition-colors hover:text-[#1b1813]"
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
                    <span className="text-[12px] font-medium text-[#1b1813]/65">Lembrar de mim</span>
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
                    onClick={() => switchSurface(false)}
                    className="-mt-1 mb-0 text-[11px] font-semibold text-[#1b1813]/50 transition-colors hover:text-[#a87500] md:hidden"
                  >
                    ← Voltar ao login do zelador
                  </button>
                  <div className="space-y-[5px]">
                    <label className={labelClass}>Registro</label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-primary"
                        strokeWidth={1.5}
                      />
                      <input
                        type="text"
                        required
                        maxLength={14}
                        value={childId}
                        onChange={(e) =>
                          setChildId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                        }
                        placeholder="Ex.: AXC-2021-B2CA"
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
                  'rounded-xl border border-red-600/20 bg-red-50 px-3 py-2 text-center text-[11px] font-semibold text-red-700'
                )}
              >
                {error}
              </p>
            )}
            {info && (
              <p
                className={cn(
                  'rounded-xl border border-[#c48a00]/25 bg-[#f5e5b5]/35 px-3 py-2 text-center text-[11px] font-semibold text-[#775400]'
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
                'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#f5b800] px-5 text-sm font-bold text-[#17130c]',
                'shadow-[0_12px_30px_rgba(186,128,0,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#ffc318] disabled:opacity-60'
              )}
            >
              {loading ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin text-black" strokeWidth={2.5} />
              ) : filhoSurface ? (
                'Entrar como filho'
              ) : (
                'Entrar como zelador'
              )}
            </motion.button>
          </form>

          {!filhoSurface && (
            <div className="space-y-3 md:hidden">
              <div className="flex items-center gap-2 px-0.5">
                <div className="h-px flex-1 bg-[#1b1813]/10" />
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-[#1b1813]/40">
                  Acesso do filho
                </span>
                <div className="h-px flex-1 bg-[#1b1813]/10" />
              </div>
              <button
                type="button"
                onClick={() => switchSurface(true)}
                className={cn(
                  'relative flex h-11 w-full items-center justify-center text-sm font-semibold text-[#1b1813]',
                  AUTH_MODAL_RADIUS,
                  'border border-[#1b1813]/12 bg-[#f8f4eb] transition-colors hover:border-[#c48a00]/40 hover:bg-white'
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
        </div>
        </div>

        <motion.aside
          aria-label="Alternar tipo de acesso"
          animate={{ rotateY: filhoSurface ? [0, -5, 0] : [0, 5, 0] }}
          transition={{ duration: 0.72, ease: [0.77, 0, 0.18, 1] }}
          className={cn(
            'absolute inset-y-0 hidden w-1/2 overflow-hidden bg-[#1b1813] text-[#faf8f4] md:flex',
            'items-center justify-center p-9 text-center transition-[left] duration-700 ease-[cubic-bezier(.77,0,.18,1)] motion-reduce:transition-none [backface-visibility:hidden] [transform-style:preserve-3d]',
            filhoSurface ? 'left-0 rounded-l-[1.75rem]' : 'left-1/2 rounded-r-[1.75rem]'
          )}
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#e5ad1a]/20" />
          <div className="pointer-events-none absolute -bottom-32 -left-28 h-80 w-80 rounded-full border border-[#e5ad1a]/10" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(224,171,32,.16),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:radial-gradient(rgba(255,215,111,.8)_0.5px,transparent_0.5px)] [background-size:18px_18px]" />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={filhoSurface ? 'convite-zelador' : 'convite-filho'}
              initial={{ opacity: 0, x: filhoSurface ? -28 : 28, filter: 'blur(5px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: filhoSurface ? 28 : -28, filter: 'blur(5px)' }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="relative z-10 flex max-w-[18rem] flex-col items-center"
            >
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-full border border-[#e5ad1a]/35 bg-[#e5ad1a]/[0.06] text-[#e5ad1a]">
                {filhoSurface ? (
                  <Lock className="h-8 w-8" strokeWidth={1.45} aria-hidden />
                ) : (
                  <UserCircle className="h-9 w-9" strokeWidth={1.35} aria-hidden />
                )}
              </div>
              <p className="mb-3 text-[0.61rem] font-bold uppercase tracking-[0.3em] text-[#d6a526]">
                Dois caminhos, uma casa
              </p>
              <h2 className="text-[2.55rem] font-medium leading-[0.98] tracking-[-0.045em] [font-family:'Fraunces',Georgia,serif]">
                {filhoSurface ? 'Você cuida da casa?' : 'Você faz parte da corrente?'}
              </h2>
              <p className="mt-5 text-sm font-normal leading-relaxed text-white/58">
                {filhoSurface
                  ? 'Use o e-mail e a senha da gestão para acessar o painel do terreiro.'
                  : 'Entre com o registro entregue pela casa e acompanhe sua vida no axé.'}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => switchSurface(!filhoSurface)}
                className="mt-8 inline-flex h-12 min-w-52 items-center justify-center rounded-full border border-[#e5ad1a]/55 bg-transparent px-6 text-xs font-bold tracking-[0.04em] text-[#f0bd36] transition-all hover:-translate-y-0.5 hover:bg-[#e5ad1a] hover:text-[#17130c] disabled:opacity-60"
              >
                {filhoSurface ? 'Entrar como zelador' : 'Entrar como filho'}
              </button>
            </motion.div>
          </AnimatePresence>
        </motion.aside>
        </div>
      </motion.div>
    </div>
  );
}
