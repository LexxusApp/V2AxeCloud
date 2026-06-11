import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../lib/authenticatedFetch';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import {
  PedidosRezaZeladorScreen,
} from '../components/pedidos-reza/PedidosRezaZeladorScreen';
import {
  pedidoDbToUi,
  type PedidoRezaUiItem,
} from '../components/pedidos-reza/PedidosRezaZeladorPanel';
import type { PedidoRezaItem, PedidoRezaMensagem, PedidoRezaStatus } from '../lib/pedidosRezaTypes';

interface AtendimentosProps {
  tenantData?: { tenant_id?: string | null; nome?: string | null; nome_terreiro?: string | null };
  setActiveTab: (tab: string) => void;
}

export default function Atendimentos({ tenantData, setActiveTab }: AtendimentosProps) {
  const tenantId = tenantData?.tenant_id;
  const zeladorLabel = tenantData?.nome
    ? `Zelador (${tenantData.nome})`
    : tenantData?.nome_terreiro
      ? `Zelador (${tenantData.nome_terreiro})`
      : 'Zelador';

  const [rawItems, setRawItems] = useState<PedidoRezaItem[]>([]);
  const [messagesById, setMessagesById] = useState<Record<string, PedidoRezaMensagem[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uiItems: PedidoRezaUiItem[] = useMemo(
    () => rawItems.map((item) => pedidoDbToUi(item, messagesById[item.id] || [])),
    [rawItems, messagesById],
  );

  const loadList = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const res = await authFetch(
        `/api/v1/atendimentos/pedidos-reza?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar pedidos');
      const items = (json.items || []) as PedidoRezaItem[];
      setRawItems(items);
      if (!selectedId && items.length > 0) {
        setSelectedId(items[0].id);
      } else if (selectedId && !items.find((i) => i.id === selectedId)) {
        setSelectedId(items[0]?.id ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pedidos');
    }
  }, [tenantId, selectedId]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!tenantId) return;
      try {
        const res = await authFetch(
          `/api/v1/atendimentos/pedidos-reza/${id}?tenantId=${encodeURIComponent(tenantId)}`,
        );
        const json = await res.json();
        if (!res.ok) return;
        if (json.mensagens) {
          setMessagesById((prev) => ({ ...prev, [id]: json.mensagens }));
        }
        if (json.item) {
          setRawItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...json.item } : p)));
        }
      } catch {
        /* polling silencioso */
      }
    },
    [tenantId],
  );

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void loadList().finally(() => setLoading(false));
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId || !tenantId) return;
    void loadDetail(selectedId);
    const t = window.setInterval(() => void loadDetail(selectedId), 12000);
    return () => window.clearInterval(t);
  }, [selectedId, tenantId, loadDetail]);

  useEffect(() => {
    if (!tenantId) return;
    const t = window.setInterval(() => void loadList(), 20000);
    return () => window.clearInterval(t);
  }, [tenantId, loadList]);

  async function patchStatus(id: string, status: PedidoRezaStatus) {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/atendimentos/pedidos-reza/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao actualizar');
      if (json.item) {
        setRawItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...json.item } : p)));
      }
      if (json.mensagens) {
        setMessagesById((prev) => ({ ...prev, [id]: json.mensagens }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao actualizar');
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!tenantId || !selectedId || !chatInput.trim()) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/v1/atendimentos/pedidos-reza/${selectedId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, texto: chatInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar');
      setChatInput('');
      await loadDetail(selectedId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar mensagem');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PedidosRezaZeladorScreen
        items={uiItems}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAccept={(id) => void patchStatus(id, 'aceito')}
        onStartPrayer={(id) => void patchStatus(id, 'em_oracao')}
        onFinishPrayer={(id) => void patchStatus(id, 'aceito')}
        onArchive={(id) => {
          void patchStatus(id, 'concluido').then(() => {
            setRawItems((prev) => prev.filter((p) => p.id !== id));
            setSelectedId((cur) => (cur === id ? null : cur));
          });
        }}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onSendChat={() => void sendChat()}
        zeladorLabel={zeladorLabel}
        busy={busy}
        error={error}
        description={
          <>
            Pedidos reais enviados pelo{' '}
            <a href="/espaco-do-fiel" target="_blank" rel="noreferrer" className="font-semibold text-[#FACC15] hover:underline">
              Espaço do Fiel
            </a>{' '}
            e pelo portal do consulente — aceite, acenda a vela virtual e responda no chat pastoral.
          </>
        }
        headerAction={
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1E242B] bg-[#12161A] px-3 py-2 text-xs font-bold text-[#F1F5F9] transition hover:border-[#2F3643]"
          >
            Configurar portal
          </button>
        }
      />
    </AppPageShell>
  );
}
