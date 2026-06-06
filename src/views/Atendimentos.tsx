import { useCallback, useEffect, useState } from 'react';
import { HandHeart, Loader2, MessageCircle, Phone } from 'lucide-react';
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
            className="app-page-action rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary"
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
        <div className="grid gap-4">
          {items.map((pedido) => (
            <motion.article
              key={pedido.id}
              layout
              className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-white">{pedido.nome}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(pedido.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                    STATUS_CLASS[pedido.status],
                  )}
                >
                  {STATUS_LABEL[pedido.status]}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-gray-300">{pedido.mensagem}</p>

              {pedido.whatsapp ? (
                <a
                  href={`https://wa.me/55${pedido.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                  <Phone className="h-3 w-3 opacity-60" />
                  {pedido.whatsapp}
                </a>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  value={pedido.status}
                  disabled={busyId === pedido.id}
                  onChange={(e) =>
                    void updatePedido(pedido.id, { status: e.target.value as PedidoReza['status'] })
                  }
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white"
                >
                  {(Object.keys(STATUS_LABEL) as PedidoReza['status'][]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                {busyId === pedido.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
