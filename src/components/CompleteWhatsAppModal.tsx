import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatBrazilPhone, normalizeBrazilPhone } from '../../lib/brazilPhone';
import { authFetch } from '../lib/authenticatedFetch';

type Props = {
  open: boolean;
  leaderName?: string | null;
  terreiroName?: string | null;
  onClose: () => void;
  onSaved: (whatsapp: string) => void;
};

export function CompleteWhatsAppModal({ open, leaderName, terreiroName, onClose, onSaved }: Props) {
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWhatsapp('');
    setError(null);
    setSaving(false);
  }, [open]);

  if (typeof document === 'undefined') return null;

  const firstName = String(leaderName || '').trim().split(/\s+/)[0] || 'responsável pela casa';
  const house = String(terreiroName || '').trim() || 'sua casa';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalized = normalizeBrazilPhone(whatsapp);
    if (!normalized) {
      setError('Informe um WhatsApp brasileiro válido com DDD.');
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch('/api/v1/account/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: normalized }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o WhatsApp.');
      onSaved(String(payload.whatsapp || normalized));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o WhatsApp.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#07110c]/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-whatsapp-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-[#d8cbaa] bg-[#fbf6eb] shadow-[0_30px_100px_rgba(0,0,0,.45)]"
          >
            <header className="relative overflow-hidden bg-[#0d2d21] px-6 py-6 text-white sm:px-8">
              <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-[#edbd2b]/25" aria-hidden />
              <div className="relative flex items-start justify-between gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#edbd2b] text-[#102219] shadow-lg shadow-black/15">
                  <MessageCircle className="h-6 w-6" />
                </span>
                <button type="button" onClick={onClose} disabled={saving} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="relative mt-5 text-[10px] font-black uppercase tracking-[.18em] text-[#edbd2b]">Acompanhamento AxéCloud</p>
              <h2 id="complete-whatsapp-title" className="relative mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">Complete seu contato</h2>
            </header>

            <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
              <p className="text-sm font-medium leading-7 text-[#514b40]">
                Olá, <strong className="text-[#173c2e]">{firstName}</strong>! Aqui é o Lucas, do AxéCloud. Vi que você acabou de cadastrar <strong className="text-[#173c2e]">{house}</strong> e quero te ajudar a configurar o sistema. O campo de WhatsApp não foi preenchido. Informe seu número abaixo para continuarmos o acompanhamento.
              </p>

              <div>
                <label htmlFor="complete-whatsapp-input" className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-[#5d5548]">WhatsApp com DDD</label>
                <div className="relative">
                  <MessageCircle className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#927322]" />
                  <input
                    id="complete-whatsapp-input"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(formatBrazilPhone(event.target.value))}
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    required
                    placeholder="(71) 99999-9999"
                    className="h-14 w-full rounded-2xl border border-[#cfc2a6] bg-white pl-12 pr-4 text-base font-bold text-[#17251e] outline-none transition placeholder:text-[#a9a08f] focus:border-[#b3860b] focus:ring-4 focus:ring-[#e8b929]/15"
                    aria-invalid={Boolean(error)}
                  />
                </div>
                {error ? <p className="mt-2 text-xs font-bold text-red-700" role="alert">{error}</p> : null}
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-[#eee5d2] px-4 py-3 text-[11px] font-semibold leading-relaxed text-[#645b4d]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#176047]" />
                O número será usado no acompanhamento da conta e também atualizado no perfil público da casa.
              </div>

              <button type="submit" disabled={saving} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#176047] px-5 text-sm font-black text-white shadow-lg shadow-[#176047]/20 transition hover:bg-[#104b37] disabled:cursor-wait disabled:opacity-70">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar WhatsApp'}
              </button>
            </form>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
