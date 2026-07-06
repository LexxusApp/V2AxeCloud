import type { ReactNode } from 'react';
import { Heart } from 'lucide-react';
import { PedidosRezaZeladorPanel, type PedidoRezaUiItem } from './PedidosRezaZeladorPanel';

export type PedidosRezaZeladorScreenProps = {
  items: PedidoRezaUiItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onStartPrayer: (id: string) => void;
  onFinishPrayer: (id: string) => void;
  onArchive: (id: string) => void;
  zeladorLabel?: string;
  busy?: boolean;
  headerAction?: ReactNode;
  error?: string | null;
  description?: ReactNode;
  /** `embedded` = dentro do simulador da landing (sem card duplicado). */
  variant?: 'standalone' | 'embedded';
};

export function PedidosRezaZeladorScreen({
  items,
  selectedId,
  onSelect,
  onAccept,
  onStartPrayer,
  onFinishPrayer,
  onArchive,
  zeladorLabel,
  busy,
  headerAction,
  error,
  description,
  variant = 'standalone',
}: PedidosRezaZeladorScreenProps) {
  const body = (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#1E242B] pb-6 lg:flex-row lg:items-center">
        <div className="text-center md:text-left">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-400">
            <Heart className="h-3 w-3 fill-rose-500/30" aria-hidden />
            Pedidos de Reza
          </div>
          <h3 className="font-display text-lg font-black text-[#F1F5F9]">
            Atendimento Espiritual &amp; Pedidos de Reza
          </h3>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {description ?? (
              <>
                Pedidos do Espaço do Fiel com notificação por WhatsApp — aceite o pedido e o fiel é avisado
                automaticamente.
              </>
            )}
          </p>
        </div>
        {headerAction ? <div className="flex shrink-0 justify-center lg:justify-end">{headerAction}</div> : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <PedidosRezaZeladorPanel
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        onAccept={onAccept}
        onStartPrayer={onStartPrayer}
        onFinishPrayer={onFinishPrayer}
        onArchive={onArchive}
        zeladorLabel={zeladorLabel}
        busy={busy}
      />
    </div>
  );

  if (variant === 'embedded') {
    return <div className="landing-v3 w-full text-[#F1F5F9]">{body}</div>;
  }

  return (
    <div className="landing-v3 w-full text-[#F1F5F9]">
      <div className="overflow-hidden rounded-3xl border border-[#1E242B] bg-[#0B0D11] shadow-xl transition-shadow duration-300 hover:shadow-2xl">
        <div className="bg-[#0D0F12] p-6 md:p-8">{body}</div>
      </div>
    </div>
  );
}
