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
    chatMessages: r.chatMessages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      time: m.time,
      isSystem: m.id.startsWith('m-sys-'),
    })),
  }));
}

export function DemoRezaPanel({ notify }: DemoRezaPanelProps) {
  const [items, setItems] = useState<PedidoRezaUiItem[]>(seedToUi);
  const [selectedId, setSelectedId] = useState('pr-2');
  const [chatInput, setChatInput] = useState('');

  const zeladorLabel = useMemo(() => 'Zelador (Pai Alexandre)', []);

  function updateStatus(id: string, status: PedidoRezaUiItem['status'], systemMsg?: string) {
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const chatMessages = systemMsg
          ? [
              ...r.chatMessages,
              {
                id: 'm-sys-' + Date.now(),
                sender: 'Sistema' as const,
                text: systemMsg,
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                isSystem: true,
              },
            ]
          : r.chatMessages;
        return { ...r, status, chatMessages };
      }),
    );
  }

  function sendChat() {
    if (!chatInput.trim() || !selectedId) return;
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== selectedId) return r;
        return {
          ...r,
          chatMessages: [
            ...r.chatMessages,
            {
              id: 'm-' + Date.now(),
              sender: 'Zelador' as const,
              text: chatInput.trim(),
              time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        };
      }),
    );
    setChatInput('');
    notify('Mensagem pastoral enviada (demo).');
  }

  return (
    <PedidosRezaZeladorScreen
      variant="embedded"
      items={items}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAccept={(id) => {
        updateStatus(
          id,
          'Aceito',
          'Saravá! O Zelador aceitou seu pedido e firmou a vela em nosso congá de caridade.',
        );
        notify('Pedido aceito e altar firmado (demo).');
      }}
      onStartPrayer={(id) => {
        updateStatus(id, 'Em Oração', 'Corrente Espiritual Ativa no terreiro! Mentalize pensamentos de cura e amparo.');
        notify('Vibração espiritual iniciada (demo).');
      }}
      onFinishPrayer={(id) => {
        updateStatus(id, 'Aceito');
        notify('Sessão de oração finalizada (demo).', 'info');
      }}
      onArchive={(id) => {
        setItems((prev) => prev.filter((r) => r.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        notify('Pedido arquivado (demo).', 'info');
      }}
      chatInput={chatInput}
      onChatInputChange={setChatInput}
      onSendChat={sendChat}
      zeladorLabel={zeladorLabel}
      description={
        <>
          Painel do zelador — como os pedidos do{' '}
          <a href="/espaco-do-fiel" className="font-semibold text-[#FACC15] hover:underline">
            Espaço do Fiel
          </a>{' '}
          chegam ao terreiro. Dados só nesta demo; pedidos reais aparecem no app autenticado.
        </>
      }
    />
  );
}
