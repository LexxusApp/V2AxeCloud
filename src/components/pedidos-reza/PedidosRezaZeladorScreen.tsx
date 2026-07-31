import type { ReactNode } from 'react';
import { CheckCircle2, Clock3, Flame, Heart } from 'lucide-react';
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
  const pendingCount = items.filter((item) => item.status === 'Pendente').length;
  const acceptedCount = items.filter((item) => item.status === 'Aceito').length;
  const prayingCount = items.filter((item) => item.status === 'Em Oração').length;

  const body = (
    <div className={variant === 'standalone' ? 'pedido-reza-screen pedido-reza-screen--standalone animate-fadeIn space-y-5' : 'animate-fadeIn space-y-5'}>
      <div
        className={
          variant === 'embedded'
            ? 'flex flex-col justify-between gap-4 border-b border-[#1E242B] pb-6 lg:flex-row lg:items-center'
            : 'pedido-reza-header flex flex-col justify-between gap-4 border-b border-[#D8D0C4] pb-5 lg:flex-row lg:items-end'
        }
      >
        <div className={variant === 'embedded' ? 'text-center md:text-left' : ''}>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-400">
            <Heart className="h-3 w-3 fill-rose-500/30" aria-hidden />
            Pedidos de Reza
          </div>
          <h3
            className={
              variant === 'embedded'
                ? 'font-display text-lg font-black text-[#F1F5F9]'
                : 'font-display text-2xl font-black tracking-tight text-[#17130D] sm:text-3xl'
            }
          >
            Atendimentos e pedidos de reza
          </h3>
          <p className={variant === 'embedded' ? 'mt-1 text-xs text-[#94A3B8]' : 'mt-1.5 max-w-3xl text-sm font-semibold leading-relaxed text-[#665F55]'}>
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

      {variant === 'standalone' ? (
        <div className="pedido-reza-pulse grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex min-h-[96px] items-center justify-between rounded-2xl border border-[#252C35] bg-[#13171D] p-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Aguardando</span>
              <p className="mt-2 text-2xl font-black text-amber-300">{pendingCount}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">pedidos para acolher</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/20 bg-amber-950/40 text-amber-300">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
          <div className="flex min-h-[96px] items-center justify-between rounded-2xl border border-[#252C35] bg-[#13171D] p-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Acolhidos</span>
              <p className="mt-2 text-2xl font-black text-emerald-400">{acceptedCount}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">prontos para a gira</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-950/40 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="flex min-h-[96px] items-center justify-between rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#171622] to-[#13171D] p-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-300">Em oração</span>
              <p className="mt-2 text-2xl font-black text-violet-300">{prayingCount}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">vibrações ativas</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/25 bg-violet-950/50 text-violet-300">
              <Flame className="h-5 w-5 animate-pulse" />
            </div>
          </div>
        </div>
      ) : null}

      <div className={variant === 'standalone' ? 'pedido-reza-desk rounded-2xl border border-[#252C35] bg-[#0D1014] p-3 shadow-xl sm:p-4' : ''}>
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
    </div>
  );

  if (variant === 'embedded') {
    return <div className="landing-v3 w-full text-[#F1F5F9]">{body}</div>;
  }

  return (
    <div className="landing-v3 w-full">{body}</div>
  );
}
