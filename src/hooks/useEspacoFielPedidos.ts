import { useCallback, useEffect, useState } from 'react';
import {
  loadStoredPedidoTokens,
  storePedidoToken,
  type PedidoRezaItem,
  type VelaCor,
} from '../lib/pedidosRezaTypes';
import {
  pedidoDbToUi,
  type PedidoRezaUiItem,
} from '../components/pedidos-reza/PedidosRezaZeladorPanel';

export type TerreiroPedidosReza = {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  fotoUrl?: string;
};

function mapPublicToPrayerRequest(
  item: PedidoRezaItem,
): PedidoRezaUiItem & { token: string } {
  const ui = pedidoDbToUi(item);
  return { ...ui, token: item.acesso_token || '' };
}

export function useEspacoFielPedidos() {
  const [terreiros, setTerreiros] = useState<TerreiroPedidosReza[]>([]);
  const [terreirosLoading, setTerreirosLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Array<PedidoRezaUiItem & { token: string }>>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);

  const loadTerreiros = useCallback(async () => {
    setTerreirosLoading(true);
    try {
      const res = await fetch('/api/v1/landing/terreiros-pedidos-reza', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.items)) {
        setTerreiros(json.items as TerreiroPedidosReza[]);
      }
    } catch {
      setTerreiros([]);
    } finally {
      setTerreirosLoading(false);
    }
  }, []);

  const refreshPedidos = useCallback(async () => {
    const tokens = loadStoredPedidoTokens();
    if (tokens.length === 0) {
      setPedidos([]);
      return;
    }
    setPedidosLoading(true);
    try {
      const results = await Promise.all(
        tokens.map(async (token) => {
          const res = await fetch(`/api/v1/public/pedidos-reza/${encodeURIComponent(token)}`, {
            cache: 'no-store',
          });
          if (!res.ok) return null;
          const json = await res.json();
          const item = json.item as PedidoRezaItem;
          return mapPublicToPrayerRequest({ ...item, acesso_token: token });
        }),
      );
      setPedidos(results.filter((r): r is PedidoRezaUiItem & { token: string } => r != null));
    } finally {
      setPedidosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTerreiros();
    void refreshPedidos();
  }, [loadTerreiros, refreshPedidos]);

  useEffect(() => {
    const t = window.setInterval(() => void refreshPedidos(), 15000);
    return () => window.clearInterval(t);
  }, [refreshPedidos]);

  const submitPedido = useCallback(
    async (payload: {
      slug: string;
      nome: string;
      mensagem: string;
      categoria: string;
      linha: string;
      vela: VelaCor;
      whatsapp: string;
    }) => {
      const res = await fetch(
        `/api/v1/public/consulente/${encodeURIComponent(payload.slug)}/pedidos-reza`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: payload.nome,
            mensagem: payload.mensagem,
            categoria: payload.categoria,
            linha: payload.linha,
            vela: payload.vela,
            whatsapp: payload.whatsapp,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar o pedido.');
      if (json.acessoToken) storePedidoToken(json.acessoToken);
      await refreshPedidos();
      return { id: json.id as string, token: json.acessoToken as string };
    },
    [refreshPedidos],
  );

  return {
    terreiros,
    terreirosLoading,
    pedidos,
    pedidosLoading,
    submitPedido,
    refreshPedidos,
  };
}
