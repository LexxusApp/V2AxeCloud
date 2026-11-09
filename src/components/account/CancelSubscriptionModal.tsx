import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';

type CancelSubscriptionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTrial?: boolean;
  expiresAt?: string | null;
  onSuccess?: () => void | Promise<void>;
};

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  isTrial = false,
  expiresAt,
  onSuccess,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleConfirmCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erro ao cancelar assinatura (${res.status})`);
      }

      setSuccess(true);
      if (onSuccess) {
        await onSuccess();
      }
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setReason('');
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a assinatura.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (loading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setSuccess(false);
      setReason('');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(100vw-2rem,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-[#DDD5C7] bg-[#FAF6EE] p-6 text-[#1A1D1A] shadow-2xl outline-none focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <Dialog.Title className="text-base font-black tracking-tight text-[#171A16] sm:text-lg">
                  {isTrial ? 'Cancelar teste gratuito do AxéCloud?' : 'Cancelar renovação da assinatura?'}
                </Dialog.Title>
                <p className="text-xs font-semibold text-[#70685C]">
                  {isTrial ? 'Encerramento do período de testes' : 'Interrupção das cobranças automáticas'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={loading}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {success ? (
            <div className="my-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h4 className="mt-2 text-sm font-black text-emerald-950">Assinatura cancelada com sucesso</h4>
              <p className="mt-1 text-xs font-medium text-emerald-800">
                Nenhuma cobrança futura será gerada. Atualizando dados...
              </p>
            </div>
          ) : (
            <>
              <Dialog.Description className="mt-4 text-xs font-medium leading-relaxed text-[#60584D] sm:text-sm">
                {isTrial ? (
                  <>
                    Ao cancelar seu teste, <strong>nenhuma cobrança futura de mensalidade ou Pix</strong> será gerada para o terreiro.
                    Seus dados cadastrados continuarão preservados para caso decida reativar no futuro.
                  </>
                ) : (
                  <>
                    Ao cancelar, a <strong>renovação automática será desativada</strong> e você não receberá novas cobranças de Pix.
                    {expiresAt ? (
                      <>
                        {' '}O acesso ao sistema permanece disponível até o fim do ciclo atual em <strong>{expiresAt}</strong>.
                      </>
                    ) : null}
                  </>
                )}
              </Dialog.Description>

              <div className="mt-4 space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#70685C]">
                  Motivo do cancelamento (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Conte para nós o que motivou sua decisão (opcional)"
                  rows={2}
                  className="w-full rounded-xl border border-[#D5CCBA] bg-white p-3 text-xs font-medium text-[#171A16] placeholder:text-[#9B9184] focus:border-[#1F6147] focus:outline-none focus:ring-1 focus:ring-[#1F6147]"
                />
              </div>

              {error && (
                <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleClose(false)}
                  className="rounded-xl border border-[#D5CCBA] bg-white px-4 py-2.5 text-xs font-black text-[#504A41] hover:bg-[#F2ECE0] disabled:opacity-50"
                >
                  Voltar e manter assinatura
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleConfirmCancel()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-rose-400 bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Cancelando…
                    </>
                  ) : (
                    'Confirmar cancelamento'
                  )}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
