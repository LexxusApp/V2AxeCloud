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
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { writeCachedTenantIdForUser } from '../lib/tenantCache';
import { resolveTenantFromSupabase } from '../lib/resolveTenantFromSupabase';
import { authFetch } from '../lib/authenticatedFetch';
import { ROUTES } from '../lib/routes';
import { navigateToMarketingDocument } from '../lib/purgeServiceWorker';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { isValidFilhoLoginId, normalizeFilhoLoginIdInput } from '../../lib/filhoMatricula';
import {
  clearRememberedLoginEmail,
  readRememberedLoginEmail,
  writeRememberedLoginEmail,
} from '../lib/loginRemember';

const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';

type LoginRole = 'zelador' | 'membro';
type LoginStep = 'choose' | 'form';

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

const fontLogin = "[font-family:'Manrope','Segoe_UI',Arial,sans-serif]";

const AUTH_MODAL_CARD = cn(
  'relative w-full'
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

function isFilhoLoginModeParam(raw: string | null): boolean {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === 'filho' || v === 'filho-de-santo' || v === 'filhos' || v === 'membro' || v === '1' || v === 'true';
}

function isZeladorLoginModeParam(raw: string | null): boolean {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  return v === 'zelador' || v === 'lider' || v === 'admin' || v === 'pai' || v === 'mae';
}

export default function Login() {
  const bootMode = (() => {
    if (typeof window === 'undefined') return null as LoginRole | null;
    const params = new URLSearchParams(window.location.search);
    const modo = params.get('modo') || params.get('mode');
    if (isFilhoLoginModeParam(modo)) return 'membro';
    if (isZeladorLoginModeParam(modo)) return 'zelador';
    return null;
  })();

  const [step, setStep] = useState<LoginStep>(() => (bootMode ? 'form' : 'choose'));
  const [role, setRole] = useState<LoginRole | null>(() => bootMode);
  const [email, setEmail] = useState(() => readRememberedLoginEmail() || '');
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

  const isMembro = role === 'membro';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const updated = params.get('updated') === 'true';
    const modo = params.get('modo') || params.get('mode');
    const modoFilho = isFilhoLoginModeParam(modo);
    const modoZelador = isZeladorLoginModeParam(modo);

    if (modoFilho) {
      setRole('membro');
      setStep('form');
    } else if (modoZelador) {
      setRole('zelador');
      setStep('form');
    }

    if (!updated && !modoFilho && !modoZelador) return;

    window.history.replaceState({}, document.title, ROUTES.login);

    if (!updated) return;

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

  const pickRole = (next: LoginRole) => {
    if (loading) return;
    setRole(next);
    setStep('form');
    setError(null);
    setInfo(null);
  };

  const backToChoose = () => {
    if (loading) return;
    setStep('choose');
    setRole(null);
    setError(null);
    setInfo(null);
    setPassword('');
    setCpfPrefix('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    const filhoSurface = role === 'membro';
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
        if (rememberMe) {
          writeRememberedLoginEmail(loginEmail);
        } else {
          clearRememberedLoginEmail();
        }
      } else {
        if (!isValidFilhoLoginId(childId)) {
          throw new Error('Informe o registro (ex.: AXC-2021-B2CA). Pode digitar com ou sem hífen.');
        }
        if (cpfPrefix.length < 6) {
          throw new Error('Digite os 6 primeiros dígitos do CPF.');
        }

        const response = await fetch('/api/auth/filho-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: normalizeFilhoLoginIdInput(childId) || childId,
            cpfPrefix,
          }),
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
            // Mesmo se a resolução do tenant falhar, registra o login do membro.
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
                  tenantResolve: 'fallback',
                },
              },
              postSession.access_token
            );
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
          mode: role === 'membro' ? 'filho' : 'zelador',
          ...(role === 'membro' ? { childId } : { email: email.trim().toLowerCase() }),
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
        'axe-login-page relative isolate min-h-[100dvh] overflow-x-hidden bg-[#faf8f4] antialiased text-[#1b1813]',
        fontLogin
      )}
    >
      <aside className="axe-login-story" aria-label="Identidade AxéCloud">
        <a href={ROUTES.home} className="axe-login-story-brand">
          <img src="/axecloud-trident.png" alt="" width="44" height="54" />
          <strong>Axé<span>Cloud</span></strong>
        </a>
        <div className="axe-login-story-copy">
          <p>ACESSO À SUA CASA</p>
          <h2>Entre.<br /><span>A casa continua.</span></h2>
          <p>Um acesso para quem cuida da gestão. Outro para quem faz parte da corrente. Cada pessoa vê somente o que precisa.</p>
          <div className="axe-login-signals">
            <span><Lock aria-hidden /><strong>Ambiente protegido</strong><small>Dados isolados por casa.</small></span>
            <span><Users aria-hidden /><strong>Dois acessos</strong><small>Zeladoria e membros.</small></span>
            <span><Sparkles aria-hidden /><strong>Privacidade</strong><small>Permissões bem definidas.</small></span>
          </div>
        </div>
        <small>AxéCloud · Gestão profissional para casas de axé</small>
      </aside>

      <section className="axe-login-panel">
        <div className="axe-login-mobile-top">
          <a href={ROUTES.home} className="axe-login-mobile-brand">
            <img src="/axecloud-trident.png" alt="" width="34" height="42" />
            <strong>Axé<span>Cloud</span></strong>
          </a>
          <a
            href={ROUTES.home}
            onClick={(event) => {
              event.preventDefault();
              void navigateToMarketingDocument(ROUTES.home);
            }}
          >
            Conhecer o site <ArrowRight aria-hidden />
          </a>
        </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-36 -top-36 h-[34rem] w-[34rem] rounded-full bg-[#f0b400]/[0.09] blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[38rem] w-[38rem] rounded-full bg-[#e2bc5a]/[0.12] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(120,82,0,.45)_0.55px,transparent_0.55px)] [background-size:22px_22px]" />
        <div className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c48a00]/10" />
      </div>

      <a
        href={ROUTES.home}
        onClick={(event) => {
          event.preventDefault();
          void navigateToMarketingDocument(ROUTES.home);
        }}
        className="axe-login-back absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1.25rem,env(safe-area-inset-top))] z-20 inline-flex items-center gap-2 text-xs font-semibold text-[#1b1813]/60 transition-colors hover:text-[#a87500]"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Conhecer o AxéCloud
      </a>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 my-auto w-full max-w-[42rem] py-2 sm:py-0"
      >
        <div className={cn(AUTH_MODAL_CARD, 'axe-login-auth-shell', step === 'form' && 'axe-login-form-surface')}>
          <div className="relative z-10 w-full space-y-5">
            {showAlert && (
              <div className="flex items-start gap-3 rounded-xl border border-[#c48a00]/25 bg-[#f5e5b5]/40 px-4 py-3 text-[#775400]">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
                <p className="flex-1 pr-1 text-[0.8125rem] font-bold leading-snug">
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

            <h1 className="sr-only">{SITE_TITLE} para terreiros</h1>

            <AnimatePresence mode="wait">
              {step === 'choose' ? (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="axe-login-choice"
                >
                  <div className="axe-login-choice-heading">
                    <p>PORTAL AXÉCLOUD <span>•</span> ACESSO À CASA</p>
                    <h2>Escolha como<br /><span>entrar.</span></h2>
                    <p>Dois acessos, cada um com as informações certas para o seu papel na casa.</p>
                  </div>

                  <div className="axe-login-paths">
                    <motion.button
                      type="button"
                      whileHover={{ x: 6 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => pickRole('zelador')}
                      className="axe-login-path axe-login-path-dark"
                    >
                      <span className="axe-login-path-number">01</span>
                      <span className="axe-login-path-icon">
                        <Sparkles className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                      </span>
                      <span className="axe-login-path-copy">
                        <small>GESTÃO DA CASA</small>
                        <strong>Sou zelador(a)</strong>
                        <em>Pai de santo, mãe de santo ou responsável pela administração.</em>
                      </span>
                      <ArrowRight className="axe-login-path-arrow" aria-hidden />
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ x: 6 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => pickRole('membro')}
                      className="axe-login-path axe-login-path-light"
                    >
                      <span className="axe-login-path-number">02</span>
                      <span className="axe-login-path-icon">
                        <Users className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                      </span>
                      <span className="axe-login-path-copy">
                        <small>CORRENTE DA CASA</small>
                        <strong>Sou membro(a)</strong>
                        <em>Filho de santo ou filha de santo com registro na casa.</em>
                      </span>
                      <ArrowRight className="axe-login-path-arrow" aria-hidden />
                    </motion.button>
                  </div>

                  <p className="axe-login-help">
                    PRIMEIRO ACESSO?{' '}
                    <a href={ROUTES.instrucoesMembro} className="font-semibold text-[#a87500] hover:underline">
                      Acesso do membro
                    </a>
                    {' · '}
                    <a href={ROUTES.instrucoes} className="font-semibold text-[#a87500] hover:underline">
                      Guia do zelador
                    </a>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={`form-${role}`}
                  initial={{ opacity: 0, x: isMembro ? 24 : -24, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: isMembro ? -18 : 18, filter: 'blur(4px)' }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <button
                    type="button"
                    onClick={backToChoose}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1b1813]/50 transition-colors hover:text-[#a87500]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    Trocar perfil
                  </button>

                  <div className="space-y-1">
                    <p className="text-[0.63rem] font-bold uppercase tracking-[0.28em] text-[#aa7600]">
                      {isMembro ? 'Portal do membro' : 'Gestão da casa de axé'}
                    </p>
                    <h2 className="text-[2rem] font-bold leading-[1.02] tracking-[-0.045em] text-[#1b1813]">
                      {isMembro ? 'Entre na corrente.' : 'Bem-vindo de volta.'}
                    </h2>
                    <p className="max-w-[22rem] text-[13px] leading-snug text-[#1b1813]/55">
                      {isMembro
                        ? 'Registro + 6 primeiros dígitos do CPF. Não use senha de e-mail ou WhatsApp.'
                        : 'E-mail e senha da gestão do terreiro.'}
                    </p>
                  </div>

                  <form onSubmit={handleAuth} className="space-y-[8px]">
                    {!isMembro ? (
                      <div className="space-y-[8px]">
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
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRememberMe(checked);
                                if (!checked) clearRememberedLoginEmail();
                              }}
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
                          <span className="text-[12px] font-medium text-[#1b1813]/65">Lembrar meu e-mail</span>
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-[8px]">
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
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck={false}
                              value={childId}
                              onChange={(e) => setChildId(normalizeFilhoLoginIdInput(e.target.value))}
                              onBlur={() => setChildId((v) => normalizeFilhoLoginIdInput(v))}
                              placeholder="Ex.: AXC-2021-B2CA"
                              className={fieldShell}
                            />
                          </div>
                          <p className="text-[11px] leading-snug text-[#1b1813]/45">
                            Vem no WhatsApp da casa. Pode digitar sem hífen — o sistema formata.
                          </p>
                        </div>

                        <div className="space-y-[8px] rounded-[0.9rem] border border-[#c48a00]/35 bg-[#f5e5b5]/35 p-3">
                          <div className="space-y-[5px]">
                            <div className="flex flex-wrap items-end justify-between gap-2">
                              <label htmlFor="filho-cpf-prefix" className={cn(labelClass, 'text-[#7b5700]')}>
                                Senha = 6 primeiros dígitos do CPF
                              </label>
                              <span
                                className={cn(
                                  'tabular-nums text-[11px] font-bold',
                                  cpfPrefix.length === 6 ? 'text-emerald-700' : 'text-[#a87500]'
                                )}
                                aria-live="polite"
                              >
                                {cpfPrefix.length}/6
                              </span>
                            </div>
                            <div className="relative">
                              <KeyRound
                                className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#b47d00]"
                                strokeWidth={1.5}
                              />
                              <input
                                id="filho-cpf-prefix"
                                type="text"
                                required
                                maxLength={6}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={cpfPrefix}
                                onChange={(e) => setCpfPrefix(e.target.value.replace(/\D/g, ''))}
                                placeholder="123456"
                                aria-describedby="filho-cpf-hint"
                                className={cn(
                                  fieldShell,
                                  'border-[#c48a00]/40 bg-white tracking-[0.35em] placeholder:tracking-[0.2em] placeholder:text-[#1b1813]/28'
                                )}
                              />
                            </div>
                            <div className="flex justify-between gap-1 px-0.5" aria-hidden>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'h-1 flex-1 rounded-full transition-colors',
                                    i < cpfPrefix.length ? 'bg-[#b47d00]' : 'bg-[#1b1813]/12'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          <p id="filho-cpf-hint" className="text-[12px] font-semibold leading-snug text-[#5c4310]">
                            Não é a senha do WhatsApp nem do e-mail.
                            <span className="mt-1 block font-medium text-[#5c4310]/85">
                              Ex.: CPF <span className="font-mono">123.456.789-00</span> → digite{' '}
                              <span className="font-mono font-bold text-[#7b5700]">123456</span>
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    {error && (
                      <p className="rounded-xl border border-red-600/20 bg-red-50 px-3 py-2 text-center text-[11px] font-semibold text-red-700">
                        {error}
                      </p>
                    )}
                    {info && (
                      <p className="rounded-xl border border-[#c48a00]/25 bg-[#f5e5b5]/35 px-3 py-2 text-center text-[11px] font-semibold text-[#775400]">
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
                      ) : isMembro ? (
                        'Entrar como membro'
                      ) : (
                        'Entrar como zelador'
                      )}
                    </motion.button>
                  </form>

                  <p className="text-center text-[11px] text-[#1b1813]/40">
                    <a
                      href={isMembro ? ROUTES.instrucoesMembro : ROUTES.instrucoes}
                      className="font-semibold text-[#a87500] hover:underline"
                    >
                      {isMembro ? 'Instruções de acesso do membro' : 'Instruções de uso do painel'}
                    </a>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      </section>
    </div>
  );
}
