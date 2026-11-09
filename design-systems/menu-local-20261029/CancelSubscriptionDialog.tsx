import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { WorkflowDialog } from './WorkflowUI';
import { authFetch } from '../../src/lib/authenticatedFetch';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTrial?: boolean;
  expiresAt?: string | null;
  onSuccess?: () => void | Promise<void>;
};

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  isTrial = false,
  expiresAt,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cancelar assinatura.');
      }
      setSuccess(true);
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setReason('');
      }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao cancelar assinatura.');
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
            setError(null);
            setSuccess(false);
            setReason('');
          }
        }
      }}
      title={isTrial ? 'Cancelar teste gratuito' : 'Cancelar renovação da assinatura'}
      description={
        isTrial
          ? 'Encerramento do período de testes sem futuras cobranças de mensalidade ou Pix.'
          : 'Interrupção da renovação automática de cobranças do terreiro.'
      }
    >
      {success ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', background: '#eaf4ed', borderRadius: 12, marginTop: 16 }}>
          <CheckCircle2 size={32} color="#1f6147" style={{ margin: '0 auto 8px' }} />
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#143c2c' }}>
            Assinatura cancelada com sucesso
          </h4>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#31543b' }}>
            Nenhuma nova cobrança será gerada. Atualizando dados...
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#4d594b', margin: 0 }}>
            {isTrial ? (
              <>
                Ao cancelar seu teste, <strong>nenhuma cobrança futura de mensalidade ou Pix</strong> será gerada para o terreiro. Seus dados cadastrados continuarão preservados para caso decida reativar futuramente.
              </>
            ) : (
              <>
                Ao cancelar, a renovação automática será desativada e você não receberá novas cobranças de Pix.
                {expiresAt ? <> O acesso permanece liberado até o fim do ciclo atual em <strong>{expiresAt}</strong>.</> : null}
              </>
            )}
          </p>

          <div className="wf-field">
            <label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</label>
            <input
              id="cancel-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Conte para nós o que motivou sua decisão (opcional)"
            />
          </div>

          {error && <p className="wf-error" role="alert">{error}</p>}

          <div className="wf-confirm-actions">
            <button
              type="button"
              className="wf-button secondary"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Voltar e manter assinatura
            </button>
            <button
              type="button"
              className="wf-button"
              style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}
              disabled={busy}
              onClick={() => void handleCancel()}
            >
              {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      )}
    </WorkflowDialog>
  );
}
