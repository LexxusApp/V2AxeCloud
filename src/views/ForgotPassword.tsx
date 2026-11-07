import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { navigateTo } from '../lib/navigation';
import { navigateToMarketingDocument } from '../lib/purgeServiceWorker';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { humanizePasswordPolicyError, PASSWORD_HINT_PT, validateStrongPassword } from '../../lib/passwordPolicy';

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
    const rawDigits = whatsapp.replace(/\D/g, '');
    if (!rawDigits.match(/^\d{10,13}$/)) {
      setError('Informe o WhatsApp cadastrado no terreiro com DDD.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginEmail, whatsapp: rawDigits }),
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
    const cleanCode = code.trim();
    if (!loginEmail || !cleanCode || !newPassword || !confirmPassword) {
      setError('Preencha o código e a nova senha.');
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
          whatsapp: whatsapp.replace(/\D/g, ''),
          code: cleanCode,
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
    <div className="axe-login-page-v2">
      {/* Background Altar Photo in Crystal Clear Quality */}
      <div className="axe-login-bg-photo" aria-hidden="true">
        <img src="/login-bg-trident.png" alt="" />
        <div className="axe-login-bg-overlay" />
      </div>

      {/* Ambient Lighting & Sacred Geometry Grid */}
      <div className="axe-login-ambient-glow" aria-hidden="true" />
      <div className="axe-login-bg-grid" aria-hidden="true" />

      {/* Quick back shortcut button */}
      <a
        href={ROUTES.login}
        className="fixed left-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-xs font-bold text-zinc-300 shadow-lg backdrop-blur-md transition-all hover:border-amber-500/40 hover:bg-black/75 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5 text-amber-400" />
        <span>Voltar ao login</span>
      </a>

      {/* Main Card with High Performance Border Beam */}
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
          <p className="axe-login-subtitle">Recuperação de Acesso</p>
          <h1 className="axe-login-headline">
            {step === 'request' ? 'Recuperar sua senha' : 'Criar nova senha'}
            <small>
              {step === 'request'
                ? 'Informe seus dados cadastrados para receber um código de validação no WhatsApp.'
                : 'Digite o código recebido no WhatsApp e defina sua nova senha de acesso.'}
            </small>
          </h1>
        </header>

        {/* Alert Feedback Messages */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="flex-1 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {info && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/40 p-3.5 text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="flex-1 text-xs font-semibold leading-relaxed">{info}</p>
          </div>
        )}

        {/* Dynamic Step Content */}
        <AnimatePresence mode="wait">
          {step === 'request' ? (
            /* STEP 1: SOLICITAR CÓDIGO */
            <motion.form
              key="step-request"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.24 }}
              onSubmit={(e) => void handleRequestCode(e)}
              className="space-y-4"
            >
              {/* E-mail Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  E-mail de Login
                </label>
                <div className="axe-login-input-shell">
                  <Mail className="input-icon h-4 w-4" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="seu-email@exemplo.com"
                  />
                </div>
              </div>

              {/* WhatsApp Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    WhatsApp do Terreiro
                  </label>
                  <span className="text-[10px] font-bold text-amber-400">Com DDD</span>
                </div>
                <div className="axe-login-input-shell">
                  <Phone className="input-icon h-4 w-4" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => {
                      setWhatsapp(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <p className="text-[11px] leading-snug text-zinc-400">
                  Enviaremos uma mensagem segura com o código de 6 dígitos.
                </p>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-submit-zelador mt-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Enviar código no WhatsApp</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            /* STEP 2: DIGITAR CÓDIGO E NOVA SENHA */
            <motion.form
              key="step-confirm"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.24 }}
              onSubmit={(e) => void handleConfirm(e)}
              className="space-y-4"
            >
              {/* Back to Edit Header */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs">
                <span className="truncate font-semibold text-zinc-300">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setCode('');
                    setError(null);
                    setInfo(null);
                  }}
                  className="font-bold text-amber-400 hover:text-amber-300"
                >
                  Alterar dados
                </button>
              </div>

              {/* 6 Digits Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Código de 6 dígitos
                  </label>
                  <span className="text-[10px] font-bold text-amber-400">Recebido via WhatsApp</span>
                </div>
                <div className="axe-login-input-shell">
                  <KeyRound className="input-icon h-4 w-4" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (error) setError(null);
                    }}
                    placeholder="000000"
                    style={{ letterSpacing: '0.25em', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  Nova Senha
                </label>
                <div className="axe-login-input-shell">
                  <Lock className="input-icon h-4 w-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Mínimo 8 caracteres"
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
                <p className="text-[11px] leading-relaxed text-zinc-400">{PASSWORD_HINT_PT}</p>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  Confirmar Nova Senha
                </label>
                <div className="axe-login-input-shell">
                  <KeyRound className="input-icon h-4 w-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Digite a nova senha novamente"
                  />
                </div>
              </div>

              {/* Buttons Row */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-submit-zelador"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Salvar nova senha e entrar</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={(e) => void handleRequestCode(e)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold text-zinc-300 transition-all hover:border-amber-500/30 hover:bg-white/[0.06] hover:text-white active:scale-[0.99] disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                  Reenviar código no WhatsApp
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Footer Navigation */}
        <footer className="mt-6 border-t border-white/[0.08] pt-4 text-center">
          <a
            href={ROUTES.login}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 transition-colors hover:text-amber-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Lembrou da senha? Fazer login</span>
          </a>
        </footer>
      </motion.div>
    </div>
  );
}
