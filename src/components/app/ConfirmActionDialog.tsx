import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import {
  HOUSE_CONFIRM_EVENT,
  type HouseConfirmEventDetail,
  type HouseConfirmTone,
} from '../../lib/confirmAction';
import { cn } from '../../lib/utils';

type PendingConfirmation = Omit<HouseConfirmEventDetail, 'resolve'> & {
  resolve: (confirmed: boolean) => void;
};

const toneStyles: Record<HouseConfirmTone, { icon: string; button: string }> = {
  danger: {
    icon: 'border-rose-200 bg-rose-50 text-rose-600',
    button: 'bg-rose-600 text-white hover:bg-rose-500',
  },
  warning: {
    icon: 'border-amber-200 bg-amber-50 text-amber-700',
    button: 'bg-[#DCA900] text-[#17130D] hover:bg-[#F0BD15]',
  },
  primary: {
    icon: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    button: 'bg-[#173C2E] text-white hover:bg-[#24533F]',
  },
};

export function ConfirmActionDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<HouseConfirmEventDetail>).detail;
      if (!detail?.resolve || !detail.title || !detail.description) return;
      pendingRef.current?.resolve(false);
      const next = { ...detail };
      pendingRef.current = next;
      setPending(next);
    };

    window.addEventListener(HOUSE_CONFIRM_EVENT, onRequest);
    return () => {
      window.removeEventListener(HOUSE_CONFIRM_EVENT, onRequest);
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    };
  }, []);

  const finish = (confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(confirmed);
  };

  const tone = pending?.tone || 'warning';
  const Icon = tone === 'danger' ? ShieldAlert : tone === 'primary' ? CheckCircle2 : AlertTriangle;

  return (
    <Dialog.Root open={Boolean(pending)} onOpenChange={(open) => !open && finish(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] bg-[#090B0A]/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[301] w-[min(100vw-2rem,27rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#DED5C7] bg-[#FFFDF8] p-5 text-[#17130D] shadow-[0_32px_100px_-30px_rgba(0,0,0,.72)] outline-none sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <div className="flex items-start gap-4">
            <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl border', toneStyles[tone].icon)}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#9A7600]">Confirmação AxéCloud</p>
              <Dialog.Title className="mt-1 font-display text-xl font-black tracking-tight text-[#17130D]">
                {pending?.title || 'Confirmar ação'}
              </Dialog.Title>
              <Dialog.Description className="mt-2 whitespace-pre-line text-sm font-semibold leading-relaxed text-[#665F55]">
                {pending?.description || ''}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#DDD4C6] text-[#6F675C] transition hover:bg-[#F1EBDD]" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => finish(false)} className="min-h-12 rounded-xl border border-[#D7CFC1] bg-white px-4 text-sm font-black text-[#514B40] transition hover:bg-[#F5F0E6]">
              {pending?.cancelLabel || 'Cancelar'}
            </button>
            <button type="button" onClick={() => finish(true)} className={cn('min-h-12 rounded-xl px-4 text-sm font-black transition', toneStyles[tone].button)}>
              {pending?.confirmLabel || 'Confirmar'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
