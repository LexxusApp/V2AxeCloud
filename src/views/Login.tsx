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
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Mail,
  HelpCircle,
  Phone,
  FileText,
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
import { validateStrongPassword } from '../../lib/passwordPolicy';
import {
  clearRememberedLoginEmail,
  readRememberedLoginEmail,
  writeRememberedLoginEmail,
  readRememberLoginPreference,
  writeRememberLoginPreference,
} from '../lib/loginRemember';

const FILHO_FLAG_KEY = 'axecloud_is_filho';
const FILHO_FLAG_USER_KEY = 'axecloud_is_filho_user_id';

type LoginRole = 'zelador' | 'membro';

interface RestoredAccountInfo {
  isRestored: boolean;
  email: string;
  nomeZelador: string;
  nomeTerreiro: string;
}

function formatZeladorGreeting(name: string): string {
  if (!name) return 'Zelador(a)';
  return name.split(',')[0].trim();
}

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
  if (lower.includes('registro ou cpf incorretos') || lower.includes('invalid_credentials')) {
    return 'Identificação ou 6 dígitos do CPF não encontrados. Confira os dados ou procure a zeladoria.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('muitas tentativas')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente de novo.';
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
    if (typeof window === 'undefined') return 'zelador' as LoginRole;
    const params = new URLSearchParams(window.location.search);
    const modo = params.get('modo') || params.get('mode');
    if (isFilhoLoginModeParam(modo)) return 'membro';
    if (isZeladorLoginModeParam(modo)) return 'zelador';
    return 'zelador';
  })();

  const [role, setRole] = useState<LoginRole>(bootMode);
  const [email, setEmail] = useState(() => readRememberedLoginEmail() || '');
  const [password, setPassword] = useState('');
  const [childId, setChildId] = useState('');
  const [cpfPrefix, setCpfPrefix] = useState('');
  const [rememberMe, setRememberMe] = useState(readRememberLoginPreference);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAlert, setShowAlert] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('updated') === 'true';
  });
  const alertHideTimerRef = useRef<number | null>(null);
  const [restoredAccount, setRestoredAccount] = useState<RestoredAccountInfo | null>(null);
  const [checkingRestored, setCheckingRestored] = useState(false);
  const [newRestoredPassword, setNewRestoredPassword] = useState('');
  const [confirmRestoredPassword, setConfirmRestoredPassword] = useState('');
  const [showRestoredPassword, setShowRestoredPassword] = useState(false);
  const [restoredSubmitting, setRestoredSubmitting] = useState(false);
  const [restoredError, setRestoredError] = useState<string | null>(null);

  const isMembro = role === 'membro';

  useEffect(() => {
    if (isMembro) return;
    writeRememberLoginPreference(rememberMe);
    if (rememberMe) writeRememberedLoginEmail(email);
    else clearRememberedLoginEmail();
  }, [email, rememberMe, isMembro]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const updated = params.get('updated') === 'true';
    const modo = params.get('modo') || params.get('mode');
    const modoFilho = isFilhoLoginModeParam(modo);
    const modoZelador = isZeladorLoginModeParam(modo);

    if (modoFilho) {
      setRole('membro');
    } else if (modoZelador) {
      setRole('zelador');
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

  // Detecção inteligente do tipo de identificação do filho
  const getFilhoInputDetection = (val: string) => {
    const raw = val.trim();
    if (!raw) {
      return {
        badgeClass: 'smart-input-badge',
        badgeText: '✨ Busca inteligente',
        hint: 'Você pode usar seu e-mail cadastrado, WhatsApp ou o código de registro da casa.',
        isHighlight: false,
      };
    }
    if (raw.includes('@')) {
      return {
        badgeClass: 'smart-input-badge type-email',
        badgeText: '✉️ E-mail',
        hint: 'Identificado por e-mail pessoal cadastrado na casa.',
        isHighlight: true,
      };
    }
    const digits = raw.replace(/\D/g, '');
    if (raw.toUpperCase().startsWith('AXC') || raw.includes('-')) {
      return {
        badgeClass: 'smart-input-badge type-registro',
        badgeText: '🆔 Registro',
        hint: 'Identificado por código de matrícula AXC.',
        isHighlight: true,
      };
    }
    if (digits.length >= 8 && digits.length <= 13) {
      return {
        badgeClass: 'smart-input-badge type-whatsapp',
        badgeText: '💬 WhatsApp',
        hint: 'Identificado por número de WhatsApp cadastrado na corrente.',
        isHighlight: true,
      };
    }
    return {
      badgeClass: 'smart-input-badge',
      badgeText: '✨ Identificando...',
      hint: 'Digite seu e-mail, WhatsApp com DDD ou matrícula AXC.',
      isHighlight: false,
    };
  };

  const filhoDetection = getFilhoInputDetection(childId);

  const checkRestoredAccount = async (targetEmail: string): Promise<RestoredAccountInfo | null> => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return null;
    }
    try {
      setCheckingRestored(true);
      const res = await fetch('/api/v1/auth/check-restored-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.isRestored) {
        const accInfo: RestoredAccountInfo = {
          isRestored: true,
          email: data.email || cleanEmail,
          nomeZelador: data.nomeZelador || 'Zelador(a)',
          nomeTerreiro: data.nomeTerreiro || 'Sua Casa de Santo',
        };
        setRestoredAccount(accInfo);
        return accInfo;
      }
    } catch {
      /* verificação best-effort */
    } finally {
      setCheckingRestored(false);
    }
    return null;
  };

  const handleSetupRestoredPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoredAccount) return;
    setRestoredError(null);

    if (newRestoredPassword !== confirmRestoredPassword) {
      setRestoredError('A confirmação da nova senha não confere.');
      return;
    }

    const policy = validateStrongPassword(newRestoredPassword);
    if (policy.ok === false) {
      setRestoredError(policy.message);
      return;
    }

    setRestoredSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/setup-restored-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: restoredAccount.email,
          newPassword: newRestoredPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível definir a nova senha.');
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: restoredAccount.email,
        password: newRestoredPassword,
      });

      if (signInErr) throw signInErr;

      if (rememberMe) {
        writeRememberedLoginEmail(restoredAccount.email);
      }

      const {
        data: { session: postSession },
      } = await supabase.auth.getSession();

      if (postSession?.user) {
        persistFilhoFlag(false, postSession.user.id);
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
              restoredLogin: true,
            },
          },
          postSession.access_token
        );
      }

      window.location.href = ROUTES.dashboard;
    } catch (err: unknown) {
      setRestoredError(humanizeAuthError(err));
    } finally {
      setRestoredSubmitting(false);
    }
  };

  const switchRole = (next: LoginRole) => {
    if (loading) return;
    setRole(next);
    setError(null);
    setInfo(null);
    setRestoredAccount(null);
    setRestoredError(null);
    if (next === 'zelador' && email && email.includes('@') && email.includes('.')) {
      void checkRestoredAccount(email);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const inputTrimmed = childId.trim();
        const isEmailInput = inputTrimmed.includes('@');
        const digitsOnly = inputTrimmed.replace(/\D/g, '');
        const isPhoneInput = digitsOnly.length >= 8 && digitsOnly.length <= 13 && !inputTrimmed.toUpperCase().startsWith('AXC-');

        if (!isEmailInput && !isPhoneInput && !isValidFilhoLoginId(inputTrimmed)) {
          throw new Error('Informe seu E-mail, WhatsApp ou Registro (ex.: AXC-2021-B2CA).');
        }
        if (cpfPrefix.length < 6) {
          throw new Error('Digite os 6 primeiros dígitos do seu CPF.');
        }

        const loginPayloadId = isEmailInput || isPhoneInput
          ? inputTrimmed
          : (normalizeFilhoLoginIdInput(inputTrimmed) || inputTrimmed);

        const response = await fetch('/api/auth/filho-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: loginPayloadId,
            cpfPrefix,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Identificação ou CPF não encontrados.');
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
      if (role === 'zelador') {
        const restored = await checkRestoredAccount(email);
        if (restored) {
          setError(null);
          return;
        }
      }
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
    <div className="axe-login-page-v2">
      {/* Background Altar Photo in Crystal Clear Quality */}
      <div className="axe-login-bg-photo" aria-hidden="true">
        <img src="/login-bg-trident.png" alt="" />
        <div className="axe-login-bg-overlay" />
      </div>

      {/* Ambient Lighting & Sacred Geometry Grid */}
      <div className="axe-login-ambient-glow" aria-hidden="true" />
      <div className="axe-login-bg-grid" aria-hidden="true" />

      {/* Main Login Card with High Performance Border Beam */}
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="axe-login-card"
      >
        {/* Magic UI / 21st.dev Golden Border Beam Runner */}
        <div className="border-beam-track" aria-hidden="true">
          <div className="border-beam-runner" />
        </div>

        {/* Card Header */}
        <header className="axe-login-header">
          <a
            href={ROUTES.home}
            onClick={(event) => {
              event.preventDefault();
              void navigateToMarketingDocument(ROUTES.home);
            }}
            className="axe-login-brand"
          >
            <img src="/axecloud-trident.png" alt="AxéCloud" width="38" height="48" />
            <span className="axe-login-brand-title">
              Axé<span>Cloud</span>
            </span>
          </a>
          <p className="axe-login-subtitle">Acesso à sua Casa</p>
          <h1 className="axe-login-headline">
            {isMembro ? 'Entrar como Filho(a) de Santo' : 'Entrar como Zelador(a)'}
            <small>
              {isMembro
                ? 'Acesse seus avisos, presença e obrigações da casa.'
                : 'Gestão financeira, membros e calendário do terreiro.'}
            </small>
          </h1>
        </header>

        {/* Segmented Dual Role Switcher Tabs */}
        <div className={cn('role-tabs-container', isMembro && 'membro-active')}>
          <div className="active-pill" aria-hidden="true" />

          <button
            type="button"
            className={cn('role-tab-btn', !isMembro && 'active')}
            onClick={() => switchRole('zelador')}
          >
            <span className="tab-badge">Gestão da Casa</span>
            <span className="tab-name">Sou Zelador(a)</span>
          </button>

          <button
            type="button"
            className={cn('role-tab-btn', isMembro && 'active')}
            onClick={() => switchRole('membro')}
          >
            <span className="tab-badge">Corrente da Casa</span>
            <span className="tab-name">Sou Membro(a)</span>
          </button>
        </div>

        {/* Update alert */}
        {showAlert && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="flex-1 text-xs font-semibold leading-snug">
              Sistema atualizado. Faça o login novamente.
            </p>
            <button
              type="button"
              onClick={closeUpdateAlert}
              aria-label="Fechar aviso"
              className="-mr-1 -mt-0.5 rounded-md p-1 text-amber-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Restored Account Password Flow */}
        {restoredAccount ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-4 rounded-2xl border border-amber-500/40 bg-black/60 p-5 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Conta identificada & restaurada
              </span>
              <button
                type="button"
                onClick={() => {
                  setRestoredAccount(null);
                  setRestoredError(null);
                  setNewRestoredPassword('');
                  setConfirmRestoredPassword('');
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Trocar e-mail
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                Axé, {formatZeladorGreeting(restoredAccount.nomeZelador)}!
              </h3>
              <p className="text-xs font-semibold text-amber-400">
                {restoredAccount.nomeTerreiro}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-zinc-300">
              Seu acesso foi restaurado com sucesso. Como a sua senha anterior precisou ser redefinida por segurança, crie sua nova senha de acesso abaixo:
            </p>

            <form onSubmit={handleSetupRestoredPassword} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">E-mail</label>
                <div className="axe-login-input-shell">
                  <Mail className="input-icon h-4 w-4" />
                  <input
                    type="text"
                    disabled
                    value={restoredAccount.email}
                    className="opacity-70 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nova Senha</label>
                <div className="axe-login-input-shell">
                  <Lock className="input-icon h-4 w-4" />
                  <input
                    type={showRestoredPassword ? 'text' : 'password'}
                    required
                    value={newRestoredPassword}
                    onChange={(e) => {
                      setNewRestoredPassword(e.target.value);
                      if (restoredError) setRestoredError(null);
                    }}
                    placeholder="Mínimo 8 caracteres com letras e números"
                    autoComplete="new-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestoredPassword((v) => !v)}
                    aria-label={showRestoredPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="toggle-pwd"
                  >
                    {showRestoredPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Confirmar Nova Senha</label>
                <div className="axe-login-input-shell">
                  <KeyRound className="input-icon h-4 w-4" />
                  <input
                    type={showRestoredPassword ? 'text' : 'password'}
                    required
                    value={confirmRestoredPassword}
                    onChange={(e) => {
                      setConfirmRestoredPassword(e.target.value);
                      if (restoredError) setRestoredError(null);
                    }}
                    placeholder="Digite a nova senha novamente"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {restoredError && (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2 text-center text-xs font-semibold text-red-300">
                  {restoredError}
                </p>
              )}

              <button
                type="submit"
                disabled={restoredSubmitting}
                className="btn-submit-zelador"
              >
                {restoredSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Salvar nova senha e entrar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          /* Main Authentication Forms */
          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isMembro ? (
                /* FORM ZELADOR */
                <motion.div
                  key="form-zelador"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="zelador-login-email" className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        E-mail do Zelador
                      </label>
                      {checkingRestored && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                        </span>
                      )}
                    </div>
                    <div className="axe-login-input-shell">
                      <Mail className="input-icon h-4 w-4" />
                      <input
                        id="zelador-login-email"
                        name="username"
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        onBlur={() => {
                          if (email.includes('@') && email.includes('.')) {
                            void checkRestoredAccount(email);
                          }
                        }}
                        placeholder="seu-email@exemplo.com"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="zelador-login-password" className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        Senha
                      </label>
                      <a
                        href={forgotPasswordHref}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                      >
                        Esqueceu a senha?
                      </a>
                    </div>
                    <div className="axe-login-input-shell">
                      <Lock className="input-icon h-4 w-4" />
                      <input
                        id="zelador-login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        style={{ paddingRight: '44px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="toggle-pwd"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Session Info */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRememberMe(checked);
                          if (!checked) clearRememberedLoginEmail();
                        }}
                        className="accent-[#c48a00] h-4 w-4 rounded cursor-pointer"
                      />
                      <span>Lembrar meu e-mail</span>
                    </label>
                    <span className="text-[11px] text-zinc-500">Sessão segura</span>
                  </div>

                  {/* Submit Zelador */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-submit-zelador"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Entrar na Zeladoria</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              ) : (
                /* FORM MEMBRO (NOVO MÉTODO INTELIGENTE) */
                <motion.div
                  key="form-membro"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  {/* Smart Identifier Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                        E-mail, WhatsApp ou Registro
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Como entrar?</span>
                      </button>
                    </div>
                    <div className="axe-login-input-shell">
                      <User className="input-icon h-4 w-4" />
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={childId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val.includes('@') && val.toUpperCase().startsWith('AXC')) {
                            setChildId(normalizeFilhoLoginIdInput(val));
                          } else {
                            setChildId(val);
                          }
                          if (error) setError(null);
                        }}
                        placeholder="seuemail@gmail.com, celular ou AXC-..."
                        style={{ paddingRight: '142px' }}
                      />
                      <span className={filhoDetection.badgeClass}>
                        {filhoDetection.badgeText}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-[11px] leading-snug transition-colors',
                        filhoDetection.isHighlight ? 'text-amber-400 font-medium' : 'text-zinc-400'
                      )}
                    >
                      {filhoDetection.hint}
                    </p>
                  </div>

                  {/* CPF 6-Digit Password with Visual Dots */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                          Senha de Acesso
                        </label>
                        <span className="cpf-pill">6 Primeiros dígitos do CPF</span>
                      </div>
                      <span
                        className={cn(
                          'cpf-counter',
                          cpfPrefix.length === 6 && 'complete'
                        )}
                      >
                        {cpfPrefix.length}/6
                      </span>
                    </div>
                    <div className="axe-login-input-shell">
                      <Lock className="input-icon h-4 w-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={cpfPrefix}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setCpfPrefix(digits);
                          if (error) setError(null);
                        }}
                        placeholder="Ex: 123456"
                        style={{ paddingRight: '44px', letterSpacing: '0.15em' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="toggle-pwd"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Visual 6 Dots Row */}
                    <div className="cpf-dots-row" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            'cpf-dot',
                            idx < cpfPrefix.length && (cpfPrefix.length === 6 ? 'completed' : 'filled')
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Footer note */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
                    <span className="text-[11px] text-zinc-400">
                      Acesso exclusivo à sua corrente e avisos
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Busca inteligente ativa
                    </span>
                  </div>

                  {/* Submit Membro */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-submit-membro"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Acessar Portal do Membro</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error & Info Feedback */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-center text-xs font-semibold text-red-200"
              >
                {error}
              </motion.div>
            )}

            {info && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-center text-xs font-semibold text-amber-200"
              >
                {info}
              </motion.div>
            )}
          </form>
        )}

        {/* Card Footer */}
        <footer className="axe-login-card-footer">
          <div className="security-badge">
            <ShieldCheck />
            <span>Ambiente protegido · Dados isolados por casa</span>
          </div>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="first-access-link"
          >
            Primeiro acesso à plataforma? <strong>Como funciona</strong>
          </button>
        </footer>
      </motion.div>

      {/* Modal de Ajuda / Instruções de Acesso */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowHelpModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#12100e] p-6 shadow-2xl text-left"
          >
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="absolute right-4 top-4 rounded-full bg-white/5 p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">
              Como funciona o acesso?
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Cada perfil possui um formato seguro e simplificado de entrada:
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 flex gap-3">
                <div className="mt-0.5 text-amber-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Sou Membro (Filho de Santo)</h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                    Você pode digitar seu <strong>E-mail</strong>, seu <strong>WhatsApp com DDD</strong> ou a <strong>Matrícula AXC</strong> entregue pelo terreiro.
                  </p>
                  <p className="text-[11px] text-amber-300/90 mt-1">
                    Sua senha é sempre os <strong>6 primeiros dígitos do seu CPF</strong> (sem pontos nem traço).
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 flex gap-3">
                <div className="mt-0.5 text-emerald-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Sou Zelador(a) da Casa</h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                    Utilize o e-mail cadastrado na criação do terreiro e sua senha pessoal definida no cadastro.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <a
                href={ROUTES.instrucoesMembro}
                className="text-amber-400 hover:underline"
              >
                Guia detalhado do membro
              </a>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white"
              >
                Suporte no WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
