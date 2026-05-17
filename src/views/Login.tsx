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
  Users,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { writeCachedTenantIdForUser } from '../lib/tenantCache';

const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';

/** Tokens — ouro principal do mockup anotado. */
const GOLD = '#f2b90f';
const GOLD_DARK = '#c88900';
const R_CARD = 'login-radius';
const fontLogin = "[font-family:Montserrat,system-ui,sans-serif]";

const fieldShell = cn(
  'w-full h-[42px] pl-[46px] pr-3 text-[14px] leading-none text-white placeholder:text-[#8f939c]',
  'bg-[#0a0b0d]/95 border border-white/[0.22]',
  R_CARD,
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.45)]',
  'outline-none transition-[border-color,box-shadow] duration-200',
  'focus:border-[#f2b90f]/70 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(242,185,15,0.28),0_8px_24px_rgba(0,0,0,0.45)]'
);

const loginPanel = cn(
  R_CARD,
  'border border-white/[0.16]',
  'bg-[#060708]/76 backdrop-blur-xl',
  'shadow-[0_20px_56px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]',
  'px-[16px] py-[17px] sm:px-[18px] sm:py-[19px]'
);

const labelClass =
  'block text-[10px] font-bold text-[#c4c7d0] uppercase tracking-[0.16em]';

function LogoEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 88" className={className} aria-hidden fill="none">
      <circle cx="44" cy="44" r="30" stroke="currentColor" strokeWidth="2" />
      <circle cx="44" cy="44" r="7" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const x1 = 44 + Math.cos(a) * 16;
        const y1 = 44 + Math.sin(a) * 16;
        const x2 = 44 + Math.cos(a) * 28.5;
        const y2 = 44 + Math.sin(a) * 28.5;
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx={x2} cy={y2} r="3" fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
}

/** Ícone inferior: três silhuetas dentro de círculo com aro dourado (mockup). */
function UsersCircleBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-[#f2b90f]/75 bg-black/35 shadow-[0_0_18px_rgba(242,185,15,0.15)]',
        className
      )}
      aria-hidden
    >
      <Users className="h-5 w-5 text-[#f2b90f]" strokeWidth={1.45} />
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
        if (cpfPrefix.length < 4) {
          throw new Error('Digite pelo menos os 4 primeiros dígitos do CPF.');
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
        try {
          const r = await fetch(
            `/api/tenant-info?userId=${encodeURIComponent(postSession.user.id)}&email=${encodeURIComponent(postSession.user.email || '')}`
          );
          if (r.ok) {
            const j = await r.json();
            const tid = String(j.tenant_id || '').trim() || postSession.user.id;
            writeCachedTenantIdForUser(postSession.user.id, tid);
          } else {
            writeCachedTenantIdForUser(postSession.user.id, postSession.user.id);
          }
        } catch {
          writeCachedTenantIdForUser(postSession.user.id, postSession.user.id);
        }
      }
    } catch (err: unknown) {
      setError(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative h-screen h-[100dvh] min-h-[520px] flex flex-col items-center justify-center overflow-hidden isolate antialiased text-white px-[clamp(14px,4vw,40px)] py-[14px]',
        fontLogin
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#050505]" aria-hidden />
      <img
        src={`${import.meta.env.BASE_URL}login-bg-premium.png`}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover object-center select-none brightness-[0.92]"
      />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-black/28" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background: `
            radial-gradient(ellipse 115% 95% at 50% 42%, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.48) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.1) 38%, rgba(0,0,0,0.45) 100%)
          `,
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[360px]"
      >
        <div className={cn(loginPanel, 'space-y-[10px]')}>
        {showAlert && (
          <div
            className={cn(
              'flex items-start gap-3 border border-[#f2b90f]/45 bg-[#f2b90f]/10 px-4 py-3 text-[#f2b90f]',
              R_CARD,
              'shadow-[0_0_32px_rgba(212,158,36,0.14)]'
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
              className="shrink-0 rounded-md p-1 text-[#f2b90f]/85 hover:bg-[#f2b90f]/12 hover:text-[#f2b90f] transition-colors -mr-1 -mt-0.5"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        <header className="text-center space-y-[6px] [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
          <div className="flex justify-center text-[#f2b90f] drop-shadow-[0_0_16px_rgba(242,185,15,0.35)]">
            <LogoEmblem className="h-[54px] w-[54px]" />
          </div>
          <div className="space-y-[4px]">
            <h1 className="sr-only">Axé Cloud — Gestão sagrada para terreiros</h1>
            <p
              className="text-[clamp(22px,2.9vw,30px)] leading-[0.95] flex flex-wrap items-baseline justify-center drop-shadow-[0_4px_9px_rgba(0,0,0,0.75)]"
              aria-hidden
            >
              <span className="font-black text-white tracking-[0.12em]">AXÉ</span>
              <span className="font-light text-[#e8ebf0] tracking-[0.18em] pl-[8px]">CLOUD</span>
            </p>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#f2b90f]"
              aria-hidden
            >
              GESTÃO SAGRADA
            </p>
          </div>
          <div className="space-y-[2px] pt-[1px] text-[13px] leading-[1.32]">
            <p className="font-medium text-white">Conecte-se ao seu terreiro.</p>
            <p className="mx-auto max-w-[280px] text-[12px] text-[#c8cad2]">
              Organize, comunique e fortaleça sua casa com tecnologia e Axé.
            </p>
            <a
              href="/"
              className="inline-block pt-1 text-[11px] font-semibold text-[#f2b90f]/90 hover:text-[#f2b90f] transition-colors"
            >
              ← Conhecer o AxéCloud
            </a>
          </div>
        </header>

        <div className="space-y-[10px]">
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
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#f2b90f]"
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
                        className="pb-[1px] text-[11px] font-medium text-[#f2b90f] hover:text-[#ffd85a] disabled:opacity-50 transition-colors"
                      >
                        {forgotLoading ? 'Enviando...' : 'Esqueceu sua senha?'}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#f2b90f]"
                        strokeWidth={1.5}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        autoComplete="current-password"
                        className={cn(fieldShell, 'pr-[40px]')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-[8px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9ca0aa] transition-colors hover:text-zinc-200"
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
                        rememberMe ? 'border-[#f2b90f] bg-[#f2b90f]/10' : 'border-[#f2b90f] bg-transparent'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only"
                      />
                      {rememberMe && (
                        <svg className="h-3.5 w-3.5 text-[#f2b90f]" viewBox="0 0 12 10" fill="none" aria-hidden>
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
                    className="-mt-1 mb-0 text-[11px] font-semibold text-zinc-500 transition-colors hover:text-[#f2b90f]"
                  >
                    ← Voltar ao login do zelador
                  </button>
                  <div className="space-y-[5px]">
                    <label className={labelClass}>ID (4 dígitos)</label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#f2b90f]"
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
                    <label className={labelClass}>4 primeiros dígitos do CPF</label>
                    <div className="relative">
                      <KeyRound
                        className="pointer-events-none absolute left-[14px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#f2b90f]"
                        strokeWidth={1.5}
                      />
                      <input
                        type="text"
                        required
                        maxLength={4}
                        inputMode="numeric"
                        value={cpfPrefix}
                        onChange={(e) => setCpfPrefix(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ex.: 1234"
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
                  'text-center text-[11px] font-semibold text-red-400 bg-red-950/35 py-2 border border-red-900/45',
                  R_CARD
                )}
              >
                {error}
              </p>
            )}
            {info && (
              <p
                className={cn(
                  'text-center text-[11px] font-semibold text-[#f2b90f] bg-[#f2b90f]/8 py-2 border border-[#f2b90f]/28',
                  R_CARD
                )}
              >
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(180deg, #ffd33d 0%, #efb611 44%, #c48602 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.38), 0 8px 28px rgba(242,185,15,0.34), 0 0 0 1px rgba(242,185,15,0.36)',
              }}
              className={cn(
                R_CARD,
                'flex h-[42px] w-full items-center justify-center gap-2 text-[14px] font-black uppercase tracking-[0.11em] text-black',
                'hover:brightness-[1.03] active:brightness-[0.97] transition-[filter,transform] duration-150',
                'active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100'
              )}
            >
              {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin text-black" strokeWidth={2.5} /> : 'Entrar'}
            </button>
          </form>

          {!filhoSurface && (
            <div className="space-y-[6px]">
              <div className="flex items-center gap-[8px] px-0.5">
                <div className="h-px flex-1 bg-white/[0.2]" />
                <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8bbc4]">
                  Acesso do filho
                </span>
                <div className="h-px flex-1 bg-white/[0.2]" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilhoSurface(true);
                  setError(null);
                  setInfo(null);
                }}
                className={cn(
                  'relative flex h-[42px] w-full items-center justify-center text-[14px] font-medium text-white',
                  R_CARD,
                  'border border-white/[0.2] bg-[#0a0b0d]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                  'hover:border-white/[0.22] hover:bg-[#1f1f1f] transition-colors duration-200'
                )}
              >
                <KeyRound
                  className="pointer-events-none absolute left-[14px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#f2b90f]"
                  strokeWidth={1.5}
                />
                <span className="w-full text-center">Login filho</span>
              </button>
            </div>
          )}

          <a
            href="/register"
            className={cn(
              'group flex w-full items-center gap-[9px] px-[11px] py-[8px]',
              R_CARD,
              'border border-white/[0.2] bg-[#0a0b0d]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
              'hover:border-white/[0.18] transition-colors duration-200'
            )}
          >
            <UsersCircleBadge />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[12.5px] font-medium leading-snug text-white">Cadastre seu terreiro</p>
              <p className="mt-[1px] text-[10px] font-medium leading-[1.3] text-[#c8cad2]">
                Crie sua conta, pague com Pix e libere o painel na hora.
              </p>
            </div>
            <ChevronRight
              className="h-[18px] w-[18px] shrink-0 text-[#f2b90f] transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.85}
            />
          </a>
        </div>

        <p className="login-footer-rule flex items-center justify-center gap-[8px] whitespace-nowrap px-2 pt-[1px] text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8cad2]">
          <ShieldCheck className="h-[15px] w-[15px] shrink-0 text-[#f2b90f]" strokeWidth={1.55} />
          Seguro, confiável e feito para terreiros
        </p>
        </div>
      </motion.div>

      {/* Detalhe do mockup (marcações vermelhas): filete dourado horizontal no rodapé da tela. */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[25] h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${GOLD} 12%, ${GOLD} 88%, transparent 100%)`,
          boxShadow: `0 0 10px ${GOLD_DARK}, 0 0 1px rgba(242,185,15,0.9)`,
          opacity: 0.95,
        }}
        aria-hidden
      />
    </div>
  );
}
