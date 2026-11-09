import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Eye, EyeOff, Loader2, Trash2, X } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { performFastLogout } from '../../lib/logout';

type DeleteAccountModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string | null;
};

export function DeleteAccountModal({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountModalProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountEmail = String(userEmail || '').trim().toLowerCase();

  async function handlePermanentDelete() {
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

    setLoading(true);
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
      setLoading(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (loading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setConfirmEmail('');
      setCurrentPassword('');
      setError(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(100vw-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-[#DED8CB] bg-[#F9F6EE] p-6 text-[#171A16] shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-700">
                <Trash2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <Dialog.Title className="text-base font-black text-[#B04A32] sm:text-lg">
                  Excluir conta e acesso permanentemente?
                </Dialog.Title>
                <p className="text-xs font-semibold text-[#6F675C]">
                  Ação irreversível de encerramento total
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

          <Dialog.Description className="mt-4 text-xs font-medium leading-relaxed text-[#6F675C]">
            Todos os dados deste terreiro serão apagados permanentemente da plataforma (mural, calendário, filhos de santo, financeiro, relatórios, galeria e acessos de login). Esta ação não poderá ser desfeita.
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#6F675C]">
                Digite seu e-mail para confirmar ({accountEmail || 'seu@email.com'})
              </label>
              <input
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={accountEmail || 'seu@email.com'}
                className="mt-1.5 w-full rounded-xl border border-[#D8D2C4] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#B04A32] focus:outline-none focus:ring-1 focus:ring-[#B04A32]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#6F675C]">
                Confirme sua senha atual
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full rounded-xl border border-[#D8D2C4] bg-white px-3.5 py-2.5 pr-10 text-xs font-semibold text-[#171A16] placeholder:text-[#9B9184] focus:border-[#B04A32] focus:outline-none focus:ring-1 focus:ring-[#B04A32]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#4E473D] hover:text-[#17130D]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-[#B04A32]">{error}</p>}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleClose(false)}
              className="rounded-xl border border-[#D8D2C4] bg-white px-4 py-2.5 text-xs font-black text-[#4A463E] hover:bg-[#F5F0E5] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handlePermanentDelete()}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#B04A32] px-4 py-2.5 text-xs font-black text-white hover:bg-[#9C3F2A] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Excluindo…
                </>
              ) : (
                'Excluir definitivamente'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
