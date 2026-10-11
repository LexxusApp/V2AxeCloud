import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { PASSWORD_HINT_PT, validateStrongPassword } from '../../../lib/passwordPolicy';

type SettingsAccountCredentialsPanelProps = {
  userEmail?: string | null;
  onEmailChanged?: (email: string) => void;
};

export function SettingsAccountCredentialsPanel({
  userEmail,
  onEmailChanged,
}: SettingsAccountCredentialsPanelProps) {
  const [displayEmail, setDisplayEmail] = useState(String(userEmail || '').trim());

  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setDisplayEmail(String(userEmail || '').trim());
  }, [userEmail]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function notify(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
  }

  async function handleChangeEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      notify('Informe o novo e-mail.', 'error');
      return;
    }
    if (!emailCurrentPassword) {
      notify('Informe a senha atual para confirmar a alteração de e-mail.', 'error');
      return;
    }

    setIsChangingEmail(true);
    try {
      const response = await authFetch('/api/v1/account/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: trimmed, currentPassword: emailCurrentPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Falha ao alterar e-mail (${response.status})`);
      }

      const updated = String(data.email || trimmed);
      setDisplayEmail(updated);
      setNewEmail('');
      setEmailCurrentPassword('');
      onEmailChanged?.(updated);
      notify('E-mail alterado com sucesso. Use o novo endereço no próximo login.', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao alterar e-mail.', 'error');
    } finally {
      setIsChangingEmail(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify('Preencha todos os campos de senha.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('A confirmação da nova senha não confere.', 'error');
      return;
    }
    const passwordCheck = validateStrongPassword(newPassword);
    if (passwordCheck.ok === false) {
      notify(passwordCheck.message, 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await authFetch('/api/v1/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Falha ao alterar senha (${response.status})`);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('Senha alterada com sucesso.', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erro ao alterar senha.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <section className="animate-fadeIn space-y-4">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-3 py-2 text-xs font-bold ${
            toast.type === 'error'
              ? 'border-red-500/30 bg-red-950/30 text-red-300'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="border-b border-[#D8D0C4] pb-3.5">
        <h3 className="font-display text-lg font-black text-[#17130D]">Segurança e acesso</h3>
        <p className="mt-1 text-xs font-semibold text-[#665F55]">
          Altere separadamente o e-mail de login ou a senha da conta.
        </p>
      </div>

      <div className="settings-security-workbench grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="settings-dark-surface settings-security-card flex h-full flex-col gap-4 rounded-[1.25rem] border border-[#CFC5B4] bg-[#FFFFFF] p-5 shadow-[0_12px_30px_-20px_rgba(45,35,20,0.25)]">
          <div className="flex items-center gap-2 text-[#17251D]">
            <Mail className="h-4 w-4 text-[#17633B]" aria-hidden />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#17251D]">Alterar e-mail</span>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              E-mail atual
            </label>
            <input
              type="email"
              readOnly
              value={displayEmail}
              className="w-full cursor-default rounded-lg border border-[#CFC5B4] bg-[#F4EDE0] p-2.5 text-xs font-bold text-[#1E1A14]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              Novo e-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novo@email.com"
              className="w-full rounded-lg border border-[#CFC5B4] bg-white p-2.5 text-xs font-semibold text-[#17130D] focus:border-[#17633B] focus:outline-none focus:ring-1 focus:ring-[#17633B]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              Senha atual (confirmação)
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={emailCurrentPassword}
              onChange={(e) => setEmailCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full rounded-lg border border-[#CFC5B4] bg-white p-2.5 text-xs font-semibold text-[#17130D] focus:border-[#17633B] focus:outline-none focus:ring-1 focus:ring-[#17633B]"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleChangeEmail()}
            disabled={isChangingEmail}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-[#1F3627] bg-[#17251D] px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-[#233B2E] disabled:opacity-50"
          >
            {isChangingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isChangingEmail ? 'Alterando e-mail…' : 'Salvar novo e-mail'}
          </button>
        </div>

        <div className="settings-dark-surface settings-security-card flex h-full flex-col gap-4 rounded-[1.25rem] border border-[#CFC5B4] bg-[#FFFFFF] p-5 shadow-[0_12px_30px_-20px_rgba(45,35,20,0.25)]">
          <div className="flex items-center gap-2 text-[#17251D]">
            <Lock className="h-4 w-4 text-[#17633B]" aria-hidden />
            <span className="text-[11px] font-black uppercase tracking-wider text-[#17251D]">Alterar senha</span>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              Senha atual
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Senha atual"
                className="w-full rounded-lg border border-[#CFC5B4] bg-white p-2.5 pr-10 text-xs font-semibold text-[#17130D] focus:border-[#17633B] focus:outline-none focus:ring-1 focus:ring-[#17633B]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#4E473D] hover:text-[#17130D]"
                aria-label={showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              Nova senha
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ex.: Axé@2026"
                className="w-full rounded-lg border border-[#CFC5B4] bg-white p-2.5 pr-10 text-xs font-semibold text-[#17130D] focus:border-[#17633B] focus:outline-none focus:ring-1 focus:ring-[#17633B]"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#4E473D] hover:text-[#17130D]"
                aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] font-semibold leading-relaxed text-[#4A4338]">{PASSWORD_HINT_PT}</p>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#1E1A14]">
              Confirmar nova senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full rounded-lg border border-[#CFC5B4] bg-white p-2.5 text-xs font-semibold text-[#17130D] focus:border-[#17633B] focus:outline-none focus:ring-1 focus:ring-[#17633B]"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleChangePassword()}
            disabled={isChangingPassword}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-[#1F3627] bg-[#17251D] px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-[#233B2E] disabled:opacity-50"
          >
            {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {isChangingPassword ? 'Alterando senha…' : 'Salvar nova senha'}
          </button>
        </div>
      </div>
    </section>
  );
}
