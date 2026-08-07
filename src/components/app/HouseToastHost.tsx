import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  HOUSE_TOAST_EVENT,
  type HouseToastDetail,
  type HouseToastType,
} from '../../lib/houseToast';

type ToastState = { message: string; type: HouseToastType; id: number } | null;

export function HouseToastHost() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<HouseToastDetail>).detail;
      const message = String(detail?.message || '').trim();
      if (!message) return;
      setToast({
        message,
        type: detail?.type || 'success',
        id: Date.now(),
      });
    };
    window.addEventListener(HOUSE_TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(HOUSE_TOAST_EVENT, onToast as EventListener);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const Icon =
    toast.type === 'error' ? XCircle : toast.type === 'info' ? Info : CheckCircle2;

  return (
    <div className="house-toast-host" role="status" aria-live="polite">
      <div
        className={cn(
          'house-toast',
          toast.type === 'success' && 'is-success',
          toast.type === 'info' && 'is-info',
          toast.type === 'error' && 'is-error',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <p>{toast.message}</p>
        <button
          type="button"
          className="house-toast__close"
          aria-label="Fechar"
          onClick={() => setToast(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
