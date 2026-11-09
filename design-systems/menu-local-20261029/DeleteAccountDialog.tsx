import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { WorkflowDialog } from './WorkflowUI';
import { authFetch } from '../../src/lib/authenticatedFetch';
import { performFastLogout } from '../../src/lib/logout';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string | null;
};

export function DeleteAccountDialog({ open, onOpenChange, userEmail }: Props) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountEmail = String(userEmail || '').trim().toLowerCase();

  const handleDelete = async () => {
    const typed = confirmEmail.trim().toLowerCase();
    if (!accountEmail) {
      setError('E-mail da conta não identificado na sessão.');
      return;
    }
    if (typed !== accountEmail) {
      setError(`Digite exatamente o e-mail cadastrado (${accountEmail}) para confirmar.`);
      return;
    }
    if (!currentPassword) {
      setError('Digite sua senha atual para autorizar a exclusão.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/account/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed, currentPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Falha ao excluir conta (${res.status})`);
      }
      onOpenChange(false);
      await performFastLogout();
      window.location.href = '/entrar?deleted=true';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir conta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkflowDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next);
          if (!next) {
            setConfirmEmail('');
            setCurrentPassword('');
            setError(null);
          }
        }
      }}
      title="Excluir conta e acesso permanentemente"
      description="Ação definitiva e irreversível de encerramento total."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 12, lineHeight: 1.55 }}>
          <strong>Atenção:</strong> Todos os dados deste terreiro serão apagados permanentemente da plataforma (mural, calendário, filhos de santo, financeiro, relatórios, galeria e acessos de login). Esta ação não poderá ser desfeita.
        </div>

        <div className="wf-field">
          <label htmlFor="delete-email">
            Digite seu e-mail cadastrado ({accountEmail || 'seu@email.com'})
          </label>
          <input
            id="delete-email"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={accountEmail || 'seu@email.com'}
          />
        </div>

        <div className="wf-field">
          <label htmlFor="delete-pass">Digite sua senha atual para confirmar</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="delete-pass"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Sua senha atual"
              style={{ width: '100%', paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: 8, background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: '#66746c' }}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className="wf-error" role="alert">{error}</p>}

        <div className="wf-confirm-actions">
          <button
            type="button"
            className="wf-button secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="wf-button"
            style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {busy ? 'Excluindo…' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </WorkflowDialog>
  );
}
