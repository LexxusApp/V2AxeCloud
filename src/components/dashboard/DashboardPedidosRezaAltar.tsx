import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import type { PedidoRezaStatus } from '../../lib/pedidosRezaTypes';
import { CANDLE_DOT_CLASS } from '../../lib/pedidosRezaTypes';
import { cn } from '../../lib/utils';

export type DashboardPedidoReza = {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  mensagem?: string;
  vela?: string | null;
  categoria?: string | null;
  linha?: string | null;
  nome_terreiro?: string | null;
};

type Toast = { message: string; type: 'success' | 'error' };

type DashboardPedidosRezaAltarProps = {
  pedidos: DashboardPedidoReza[];
  tenantId: string;
  onRefresh?: () => void | Promise<unknown>;
  onOpenAtendimentos?: () => void;
  maxItems?: number;
};

function formatPedidoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function baseVelasCount(pedido: DashboardPedidoReza): number {
  const v = String(pedido.vela || '').trim();
  // Firmeza virtual do fiel (cor escolhida no Espaço do Fiel) conta mesmo enquanto pendente.
  if (v && v !== 'Nenhuma') return 1;
  if (pedido.status === 'aceito' || pedido.status === 'em_oracao' || pedido.status === 'em_atendimento') {
    return 1;
  }
  return 0;
}

export function DashboardPedidosRezaAltar({
  pedidos,
  tenantId,
  onRefresh,
  onOpenAtendimentos,
  maxItems = 3,
}: DashboardPedidosRezaAltarProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [extraVelas, setExtraVelas] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  const visible = useMemo(() => pedidos.slice(0, maxItems), [pedidos, maxItems]);

  useEffect(() => {
    setExtraVelas({});
  }, [pedidos]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const patchStatus = useCallback(
    async (id: string, status: PedidoRezaStatus) => {
      const res = await authFetch(`/api/v1/atendimentos/pedidos-reza/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((json as { error?: string }).error || 'Erro ao actualizar pedido'));
      return json;
    },
    [tenantId],
  );

  const handleFirmarVela = useCallback(
    async (pedido: DashboardPedidoReza) => {
      if (busyId) return;
      setBusyId(pedido.id);
      try {
        const nome = pedido.nome || 'o necessitado';

        if (pedido.status === 'pendente') {
          await patchStatus(pedido.id, 'aceito');
        } else if (pedido.status === 'aceito') {
          await patchStatus(pedido.id, 'em_oracao');
        }

        setExtraVelas((prev) => ({ ...prev, [pedido.id]: (prev[pedido.id] || 0) + 1 }));
        showToast(`Vela litúrgica firmada com sucesso no congá para ${nome}!`);
        await onRefresh?.();
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Não foi possível firmar a vela.', 'error');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onRefresh, patchStatus, showToast],
  );

  return (
    <div className="relative space-y-5 rounded-3xl border border-[#1E242B] bg-[#13171D] p-6">
      {toast && (
        <div
          className={cn(
            'absolute right-4 top-4 z-20 max-w-xs rounded-xl border px-3 py-2 text-[11px] font-bold shadow-lg',
            toast.type === 'error'
              ? 'border-red-500/30 bg-red-950/90 text-red-200'
              : 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200',
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-[#1E242B] pb-4">
        <div>
          <h4 className="font-display flex items-center gap-2 text-sm font-black text-white">
            <Heart className="h-4 w-4 animate-pulse fill-rose-500/20 text-rose-500" aria-hidden />
            Pedidos de Rezo Coletivos & Firmesa de Velas
          </h4>
          <p className="mt-0.5 text-xs text-gray-400">
            Clique em &quot;Firmar Vela&quot; para consagrar uma vela espiritual para o enfermo ou necessitado.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAtendimentos}
          className="rounded border border-rose-500/20 bg-rose-950/40 px-2 py-0.5 text-[9.5px] font-black uppercase text-rose-400 transition-colors hover:border-rose-500/40 hover:text-rose-300"
        >
          Doações Espirituais
        </button>
      </div>

      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1E242B] bg-[#0D0F12] px-6 py-10 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 animate-pulse fill-rose-500/10 text-rose-500/40" aria-hidden />
            <p className="text-sm font-bold text-gray-400">Nenhum pedido de reza activo</p>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-gray-500">
              Pedidos enviados pelo portal do consulente aparecem aqui para firmar vela no congá.
            </p>
          </div>
        ) : (
          visible.map((req) => {
            const velasListed = baseVelasCount(req) + (extraVelas[req.id] || 0);
            const motivo =
              req.mensagem?.trim() ||
              [req.categoria, req.linha].filter(Boolean).join(' · ') ||
              'Pedido de amparo espiritual';
            const isBusy = busyId === req.id;

            return (
              <div
                key={req.id}
                className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#1E242B] bg-[#0D0F12] p-4 sm:flex-row sm:items-center"
              >
                <div className="max-w-md space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-black text-white">{req.nome}</span>
                    <span className="font-mono text-[9.5px] text-[#FACC15]">{formatPedidoDate(req.created_at)}</span>
                  </div>
                  <p className="text-[11px] leading-normal text-gray-400">{motivo}</p>
                  {req.vela && req.vela !== 'Nenhuma' ? (
                    <div className="flex items-center gap-1.5 text-[9px] font-medium text-gray-500">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full border',
                          CANDLE_DOT_CLASS[req.vela] || 'bg-white border-gray-400',
                        )}
                      />
                      <span>
                        Vela virtual {req.vela}
                        {req.status === 'pendente' ? ' (aguardando altar)' : ''}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-xl border border-[#1E242B] bg-[#13171D] px-2.5 py-1.5">
                    <span className="text-[10px] text-gray-400">Velas:</span>
                    <span className="text-[11px] font-black text-[#FACC15]">
                      {velasListed} 🕯️
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleFirmarVela(req)}
                    className={cn(
                      'cursor-pointer rounded-xl border border-emerald-500/20 bg-[#2E5A44]/30 px-3 py-1.5 text-[10px] font-bold tracking-tight text-[#10B981] transition-all hover:bg-[#2E5A44]/60 active:scale-95 disabled:cursor-wait disabled:opacity-60',
                    )}
                  >
                    {isBusy ? 'Firmando…' : '🕯️ Firmar Vela'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
