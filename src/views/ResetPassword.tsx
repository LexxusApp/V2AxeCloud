import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { navigateTo } from '../lib/navigation';
import { navigateToMarketingDocument } from '../lib/purgeServiceWorker';
import { SITE_TITLE } from '../constants/seoBrandKeywords';
import { humanizePasswordPolicyError, PASSWORD_HINT_PT, validateStrongPassword } from '../../lib/passwordPolicy';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.');
      return;
    }
    const passwordCheck = validateStrongPassword(newPassword);
    if (passwordCheck.ok === false) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);
    try {
      const checkResponse = await fetch('/api/v1/auth/password/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!checkResponse.ok) {
        const payload = await checkResponse.json().catch(() => ({}));
        throw new Error(payload.error || 'A senha escolhida não passou pela verificação de segurança.');
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      await supabase.auth.signOut();
      navigateTo(`${ROUTES.login}?updated=true`, true);
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message || '').toLowerCase();
      if (msg.includes('session') || msg.includes('jwt') || msg.includes('expired')) {
        setError('Este link expirou ou já foi usado. Solicite uma nova recuperação de senha.');
      } else {
        setError(humanizePasswordPolicyError(err, 'Não foi possível redefinir a senha.'));
      }
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
          <p className="axe-login-subtitle">Segurança de Acesso</p>
          <h1 className="axe-login-headline">
            Definir nova senha
            <small>
              Crie uma senha forte e segura para continuar acessando sua zeladoria.
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

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              Nova senha
            </label>
            <div className="axe-login-input-shell">
              <Lock className="input-icon h-4 w-4" />
              <input
                type={showNewPassword ? 'text' : 'password'}
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
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="toggle-pwd"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">{PASSWORD_HINT_PT}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              Confirmar nova senha
            </label>
            <div className="axe-login-input-shell">
              <KeyRound className="input-icon h-4 w-4" />
              <input
                type={showNewPassword ? 'text' : 'password'}
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

          <button
            type="submit"
            disabled={loading}
            className="btn-submit-zelador mt-2"
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
        </form>

        {/* Footer Navigation */}
        <footer className="mt-6 border-t border-white/[0.08] pt-4 text-center">
          <a
            href={ROUTES.login}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 transition-colors hover:text-amber-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar ao login</span>
          </a>
        </footer>
      </motion.div>
    </div>
  );
}
