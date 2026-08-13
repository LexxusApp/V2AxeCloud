import { BellRing, CalendarClock, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export const GIRA_REMINDER_FEATURE_NOTIF_ID = 'system_feature_gira_reminder_v1';
export const OPEN_GIRA_REMINDER_CONFIG_EVENT = 'axecloud:open-gira-reminder-config';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfigure: () => void;
};

export function GiraReminderFeatureModal({ open, onClose, onConfigure }: Props) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gira-reminder-feature-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2A3340] bg-[#12171E] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <BellRing className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/90">
                Atualização do sistema
              </p>
              <h2
                id="gira-reminder-feature-title"
                className="mt-1 font-display text-lg font-extrabold leading-snug text-white"
              >
                Nova função: lembrete automático de gira
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#8B96A8] hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#B7C0CE]">
          <p>
            Agora você pode ligar lembretes no WhatsApp para a corrente: o sistema avisa de tanto em tanto
            tempo e também no dia da gira.
          </p>
          <ul className="space-y-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[12px]">
            <li className="flex gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <span>Escolha o intervalo (1 a 7 dias) em cada gira.</span>
            </li>
            <li className="flex gap-2">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <span>O aviso na criação da gira continua imediato; o lembrete é o reforço automático.</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/5 px-5 py-4 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#FFC700] px-4 text-sm font-black text-[#17130D] transition hover:brightness-105"
          >
            Configurar agora
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-bold text-[#C5CDD8] hover:bg-white/5"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function requestOpenGiraReminderConfig() {
  try {
    sessionStorage.setItem('axecloud_open_gira_reminder', '1');
  } catch {
    /* storage bloqueado */
  }
  window.dispatchEvent(new CustomEvent(OPEN_GIRA_REMINDER_CONFIG_EVENT));
}
