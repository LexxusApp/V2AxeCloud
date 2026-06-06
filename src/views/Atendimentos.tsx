import { useCallback, useEffect, useState } from 'react';
import { HandHeart, Loader2, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { authFetch } from '../lib/authenticatedFetch';
import PageHeader from '../components/PageHeader';
import LuxuryLoading from '../components/LuxuryLoading';
import { cn } from '../lib/utils';

type PedidoReza = {
  id: string;
  created_at: string;
  nome: string;
  whatsapp: string | null;
  mensagem: string;
  status: 'pendente' | 'em_atendimento' | 'concluido' | 'cancelado';
  observacao_interna: string | null;
};

const STATUS_LABEL: Record<PedidoReza['status'], string> = {
  pendente: 'Pendente',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_CLASS: Record<PedidoReza['status'], string> = {
  pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  em_atendimento: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  concluido: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  cancelado: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
};

const STATUS_ACCENT: Record<PedidoReza['status'], string> = {
  pendente: 'bg-amber-400',
  em_atendimento: 'bg-sky-400',
  concluido: 'bg-emerald-400',
  cancelado: 'bg-zinc-500',
};

function formatPedidoWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

interface AtendimentosProps {
  tenantData?: { tenant_id?: string | null };
  setActiveTab: (tab: string) => void;
}

export default function Atendimentos({ tenantData, setActiveTab }: AtendimentosProps) {
  const tenantId = tenantData?.tenant_id;
  const [items, setItems] = useState<PedidoReza[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/v1/atendimentos/pedidos-reza?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar pedidos');
      setItems(json.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updatePedido(id: string, patch: { status?: PedidoReza['status']; observacao_interna?: string }) {
    if (!tenantId) return;
    setBusyId(id);
    try {
      const res = await authFetch(`/api/v1/atendimentos/pedidos-reza/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao actualizar');
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch, ...(json.item || {}) } : p)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao actualizar');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LuxuryLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atendimentos"
        subtitle="Pedidos de reza e contactos enviados pelo portal do consulente."
        tenantData={tenantData}
        setActiveTab={setActiveTab}
        actions={
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="app-page-action"
          >
            Configurar portal
          </button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
          <HandHeart className="mx-auto h-10 w-10 text-primary/60" />
          <p className="mt-4 text-sm font-semibold text-white">Nenhum pedido de reza ainda</p>
          <p className="mt-2 text-xs text-gray-500">
            Active o portal do consulente em Configurações para receber pedidos pela internet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((pedido) => (
            <motion.article
              key={pedido.id}
              layout
              className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-card to-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div
                className={cn('absolute left-0 top-0 h-full w-[3px]', STATUS_ACCENT[pedido.status])}
                aria-hidden
              />

              <div className="flex gap-3 p-3 pl-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-black/30">
                  <HandHeart className="h-4 w-4 text-primary/80" strokeWidth={2} aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{pedido.nome}</p>
                      <p className="mt-0.5 text-[10px] font-medium tabular-nums text-gray-500">
                        {formatPedidoWhen(pedido.created_at)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                        STATUS_CLASS[pedido.status],
                      )}
                    >
                      {STATUS_LABEL[pedido.status]}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-400">
                    {pedido.mensagem}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                    {pedido.whatsapp ? (
                      <a
                        href={`https://wa.me/55${pedido.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold text-emerald-400 transition hover:text-emerald-300"
                      >
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{pedido.whatsapp}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-600">Sem WhatsApp</span>
                    )}

                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        value={pedido.status}
                        disabled={busyId === pedido.id}
                        onChange={(e) =>
                          void updatePedido(pedido.id, {
                            status: e.target.value as PedidoReza['status'],
                          })
                        }
                        className="max-w-[8.5rem] rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold text-white"
                      >
                        {(Object.keys(STATUS_LABEL) as PedidoReza['status'][]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      {busyId === pedido.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
