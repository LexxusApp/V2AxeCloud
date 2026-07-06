import { useState } from 'react';
import { Bell, BellOff, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const DISMISS_KEY = 'axe_filho_push_nudge_dismissed';

type FilhoPushPromptProps = {
  permission: NotificationPermission | null;
  loading: boolean;
  onSubscribe: () => void;
};

export function FilhoPushPrompt({ permission, loading, onSubscribe }: FilhoPushPromptProps) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1',
  );

  if (!permission || permission === 'granted') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (permission === 'denied') {
    return (
      <div className="app-v3-panel mx-auto flex w-full max-w-2xl items-start gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1E242B] bg-[#12161A]">
          <BellOff className="h-4 w-4 text-[#64748B]" aria-hidden />
        </div>
        <p className="min-w-0 text-xs leading-relaxed text-[#94A3B8]">
          Notificações bloqueadas neste navegador. Para receber avisos do terreiro, permita o site em{' '}
          <span className="font-semibold text-[#F1F5F9]">Configurações do site</span> (ícone ao lado do endereço).
        </p>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className="app-v3-panel mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <Bell className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-[#F1F5F9]">Avisos do terreiro no celular</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">Mural, giras e eventos em tempo real.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-[#64748B] transition-colors hover:text-[#F1F5F9]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Agora não
        </button>
        <button
          type="button"
          onClick={onSubscribe}
          disabled={loading}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-[#12161A] px-3 py-2 text-xs font-bold text-primary transition-all',
            'hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50',
          )}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {loading ? 'Ativando…' : 'Ativar notificações'}
        </button>
      </div>
    </div>
  );
}
