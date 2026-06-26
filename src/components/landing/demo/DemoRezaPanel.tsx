import { useMemo, useState } from 'react';
import { PedidosRezaZeladorScreen } from '../../pedidos-reza/PedidosRezaZeladorScreen';
import type { PedidoRezaUiItem } from '../../pedidos-reza/PedidosRezaZeladorPanel';
import { PRAYER_REQUESTS_INITIAL } from '../../espaco-fiel/espacoFielV3Data';
import type { DemoToast } from './demoUi';

type DemoRezaPanelProps = {
  notify: (message: string, type?: DemoToast['type']) => void;
};

function seedToUi(): PedidoRezaUiItem[] {
  return PRAYER_REQUESTS_INITIAL.map((r) => ({
    id: r.id,
    solicitante: r.solicitante,
    casa: r.casa,
    categoria: r.categoria,
    linha: r.linha,
    vela: r.vela,
    status: r.status,
    intencao: r.intencao,
    data: r.data,
    whatsapp: '11999998888',
  }));
}

export function DemoRezaPanel({ notify }: DemoRezaPanelProps) {
  const [items, setItems] = useState<PedidoRezaUiItem[]>(seedToUi);
  const [selectedId, setSelectedId] = useState('pr-2');

  const zeladorLabel = useMemo(() => 'Zelador (Pai Alexandre)', []);

  function updateStatus(id: string, status: PedidoRezaUiItem['status']) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    if (status === 'Aceito') {
      notify('Pedido aceito (demo). O fiel receberia WhatsApp sobre a próxima gira.');
    }
  }

  return (
    <PedidosRezaZeladorScreen
      variant="embedded"
      items={items}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAccept={(id) => updateStatus(id, 'Aceito')}
      onStartPrayer={(id) => updateStatus(id, 'Em Oração')}
      onFinishPrayer={(id) => updateStatus(id, 'Aceito')}
      onArchive={(id) => {
        setItems((prev) => prev.filter((r) => r.id !== id));
        setSelectedId((cur) => (cur === id ? items[0]?.id ?? null : cur));
        notify('Pedido arquivado (demo).');
      }}
      zeladorLabel={zeladorLabel}
      description={
        <>
          Demonstração do fluxo com WhatsApp — sem chat pastoral. Ao aceitar, o fiel é notificado automaticamente.
        </>
      }
    />
  );
}
