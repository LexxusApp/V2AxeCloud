import { Check, Flame, Heart, Leaf, Sparkles } from 'lucide-react';
import {
  CANDLE_COLOR_HEX,
  CANDLE_DOT_CLASS,
  type VelaCor,
} from '../../lib/pedidosRezaTypes';
import { cn } from '../../lib/utils';

export type PedidoRezaChatBubble = {
  id: string;
  sender: 'Zelador' | 'Visitante' | 'Sistema';
  text: string;
  time: string;
  isSystem?: boolean;
};

export type PedidoRezaUiItem = {
  id: string;
  solicitante: string;
  casa: string;
  categoria: string;
  linha: string;
  vela: VelaCor;
  status: 'Pendente' | 'Aceito' | 'Em Oração';
  intencao: string;
  data: string;
  chatMessages: PedidoRezaChatBubble[];
};

type PedidosRezaZeladorPanelProps = {
  items: PedidoRezaUiItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
  onStartPrayer: (id: string) => void;
  onFinishPrayer: (id: string) => void;
  onArchive: (id: string) => void;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  zeladorLabel?: string;
  busy?: boolean;
  maxHeightClass?: string;
};

const QUICK_TEMPLATES = [
  { text: 'Sua vela está firmada em nosso congá de paz e luz. Confie!', label: '🕯️ Confirmar Vela' },
  {
    text: 'Para acalmar do cansaço, tome um banho de ervas frias (Alecrim e Alfazema) antes de dormir.',
    label: '🌿 Banho de Ervas',
  },
  { text: 'Que Oxalá cubra você e os seus de absoluta proteção e amor.', label: '✨ Benção Oxalá' },
] as const;

export function PedidosRezaZeladorPanel({
  items,
  selectedId,
  onSelect,
  onAccept,
  onStartPrayer,
  onFinishPrayer,
  onArchive,
  chatInput,
  onChatInputChange,
  onSendChat,
  zeladorLabel = 'Zelador',
  busy = false,
  maxHeightClass = 'max-h-[620px]',
}: PedidosRezaZeladorPanelProps) {
  const pendingCount = items.filter((r) => r.status === 'Pendente').length;
  const currentReq = items.find((r) => r.id === selectedId) ?? null;

  return (
    <div className={cn('grid grid-cols-1 gap-6 lg:grid-cols-12', maxHeightClass && '')}>
      {/* Lista */}
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-sm lg:col-span-5',
          maxHeightClass,
        )}
      >
        <div className="flex items-center justify-between border-b border-[#1E242B] bg-[#12161A] p-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <h6 className="font-display text-xs font-black uppercase tracking-wider text-[#F1F5F9]">
              Terminal da Zeladoria
            </h6>
          </div>
          <span className="rounded border border-[#1E242B] bg-[#1E2530] px-2 py-0.5 text-[10px] font-bold text-amber-400">
            {pendingCount} Pendentes
          </span>
        </div>

        <div className="flex gap-1.5 border-b border-[#1E242B] bg-[#12161A]/50 p-3">
          <span className="rounded border border-[#1E242B] bg-[#1E252E] px-2 py-1 text-[9px] font-bold uppercase text-[#94A3B8]">
            Pedidos Ativos
          </span>
        </div>

        <div className="max-h-[500px] flex-grow space-y-2 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">Nenhum pedido de amparo encontrado.</div>
          ) : (
            items.map((req) => {
              const isSelected = req.id === selectedId;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => onSelect(req.id)}
                  className={cn(
                    'w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all',
                    isSelected
                      ? 'border-[#FACC15]/40 bg-[#1E2530] shadow'
                      : 'border-[#1E242B] bg-[#12161A] hover:bg-[#1E2530]/50',
                  )}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-1.5">
                    <div>
                      <p className="text-xs font-bold text-[#F1F5F9]">{req.solicitante}</p>
                      <p className="mt-0.5 text-[10px] text-[#94A3B8]">{req.casa}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-sans text-[8px] text-gray-500">
                        {req.data.split(' ')[1] || req.data}
                      </span>
                      {req.status === 'Pendente' ? (
                        <span className="animate-pulse rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#FACC15]">
                          Pendente
                        </span>
                      ) : req.status === 'Em Oração' ? (
                        <span className="rounded border border-violet-500/20 bg-violet-600/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-400">
                          Em Prece
                        </span>
                      ) : (
                        <span className="rounded border border-emerald-500/20 bg-emerald-600/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                          Aceito
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mb-2 line-clamp-2 text-[11px] italic leading-relaxed text-gray-400">
                    &quot;{req.intencao}&quot;
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded border border-[#1E242B] bg-[#12161A]/60 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-[#94A3B8]">
                      {req.categoria}
                    </span>
                    <span className="rounded border border-[#1E242B] bg-[#12161A]/60 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-[#94A3B8]">
                      {req.linha}
                    </span>
                    <div className="ml-auto flex items-center gap-1 text-[8.5px] font-medium text-gray-500">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full border',
                          CANDLE_DOT_CLASS[req.vela] || 'bg-white border-gray-400',
                        )}
                      />
                      <span>{req.vela !== 'Nenhuma' ? `Vela ${req.vela}` : 'Sem vela'}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detalhe */}
      <div
        className={cn(
          'flex flex-col justify-between rounded-2xl border border-[#1E242B] bg-[#13171D] p-5 shadow-lg lg:col-span-7',
          maxHeightClass,
        )}
      >
        {!currentReq ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 p-10 text-center">
            <Heart className="h-10 w-10 animate-pulse text-gray-600" />
            <h6 className="font-display text-xs font-bold uppercase text-[#F1F5F9]">Nenhum pedido selecionado</h6>
            <p className="text-[11px] text-[#94A3B8]">
              Selecione um pedido ao lado para gerenciar, acender a vela espiritual ou conversar com o solicitante.
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="rounded-xl border border-[#1E242B] bg-[#12161A] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="rounded border border-[#FACC15]/30 bg-[#FACC15]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FACC15]">
                    {currentReq.categoria}
                  </span>
                  <p className="mt-1 font-display text-sm font-black text-[#F1F5F9]">{currentReq.solicitante}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onArchive(currentReq.id)}
                  className="rounded-lg border border-[#1E242B] bg-[#1E252E] p-1 px-2.5 text-[10px] text-gray-500 transition-colors hover:border-rose-900/40 hover:bg-rose-950/40 hover:text-red-400"
                >
                  Arquivar
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 border-t border-[#1E242B] pt-2 text-[10px] text-gray-500">
                <div>
                  <span className="block font-medium">CASA SOLICITADA</span>
                  <span className="font-semibold text-[#F1F5F9]">{currentReq.casa}</span>
                </div>
                <div>
                  <span className="block font-medium">LINHA RELIGIOSA</span>
                  <span className="font-semibold text-[#F1F5F9]">{currentReq.linha}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-[#1E242B] bg-[#12161A]/40 p-4 md:grid-cols-12">
              <div className="relative flex h-32 flex-col items-center justify-center overflow-hidden rounded-lg border border-[#1E242B] bg-[#12161A] p-2.5 md:col-span-5">
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[7.5px] font-bold uppercase text-[#94A3B8]">Congá Digital</span>
                </div>
                {currentReq.vela !== 'Nenhuma' ? (
                  <div className="flex flex-col items-center">
                    {currentReq.status !== 'Pendente' ? (
                      <div className="relative mb-1">
                        <svg className="h-8 w-6 animate-bounce text-[#FACC15]" viewBox="0 0 20 30" fill="currentColor">
                          <path
                            d="M10 0C6 8 4 14 4 19C4 25.1 8 30 10 30C12 30 16 25.1 16 19C15.9 14 14 8 10 0Z"
                            className="animate-pulse text-amber-500"
                          />
                          <path
                            d="M10 6C8 11.3 7 15.3 7 18.7C7 22.8 9.7 26 10 26C10.3 26 13 22.8 13 18.7C13 15.3 12 11.3 10 6Z"
                            className="text-yellow-300"
                          />
                        </svg>
                        <div className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 animate-ping rounded-full bg-orange-500 opacity-60 blur-md" />
                      </div>
                    ) : (
                      <div className="mb-1 flex h-8 items-center justify-center text-[10px] font-bold uppercase italic tracking-wider text-gray-600">
                        Apagada
                      </div>
                    )}
                    <div
                      className="relative h-12 w-5 rounded-sm border border-black/10 shadow-md transition-all"
                      style={{ backgroundColor: CANDLE_COLOR_HEX[currentReq.vela] || '#FFFFFF' }}
                    >
                      <div className="absolute left-0 top-1 h-0.5 w-full bg-black/10 opacity-60" />
                      <div className="absolute left-1.5 top-1.5 h-3 w-1 rounded bg-black/10" />
                    </div>
                    <span className="mt-1.5 text-[8px] font-bold uppercase text-[#94A3B8]">
                      Vela {currentReq.vela}
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <Heart className="mx-auto mb-1 h-6 w-6 text-gray-500 opacity-50" />
                    <span className="block text-[8px] font-bold uppercase text-gray-500">Apenas Corrente de Preces</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 md:col-span-7">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Ações do Altar &amp; Aceite
                </p>
                {currentReq.status === 'Pendente' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] leading-tight text-[#94A3B8]">
                      Zelador avalia o pedido e firma a vela mental do solicitante em nosso congá de caridade.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAccept(currentReq.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FACC15] p-2 text-[10.5px] font-extrabold text-[#080A0D] shadow hover:bg-[#FDE047] disabled:opacity-60"
                    >
                      <Flame className="h-3.5 w-3.5 animate-pulse fill-current text-orange-600" />
                      Aceitar e Firmar Altar
                    </button>
                  </div>
                ) : currentReq.status === 'Aceito' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      <span>Pedido aceito, vela de {currentReq.vela} ativada!</span>
                    </div>
                    <p className="text-[10px] leading-tight text-[#94A3B8]">
                      Inicie uma corrente sintonizada de vibrações de caridade agora para este irmão em aflição.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onStartPrayer(currentReq.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 p-2 text-[10.5px] font-extrabold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Começar Vibração Espiritual Ativa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded border border-violet-950 bg-violet-950/20 p-2 text-center">
                      <span className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-400">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-violet-500" />
                        Em Oração Ativa na Casa
                      </span>
                      <span className="mt-0.5 block text-[9px] text-[#94A3B8]">
                        Sua casa está ativamente emanando bençãos.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onFinishPrayer(currentReq.id)}
                      className="w-full rounded-lg border border-[#1E242B] bg-[#1E2530] p-2 text-[9.5px] font-bold text-[#94A3B8] hover:bg-white/5 disabled:opacity-60"
                    >
                      Finalizar Sessão de Oração
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex max-h-[250px] min-h-[190px] flex-grow flex-col overflow-hidden rounded-xl border border-[#1E242B] bg-[#12161A]/60">
              <div className="flex items-center justify-between border-b border-[#1E242B] bg-[#12161A] p-2 text-[9.5px] font-bold uppercase text-[#94A3B8]">
                <span>Chat Pastoral e Conselhos Litúrgicos</span>
                <span className="rounded bg-red-950/40 px-1 text-[8px] font-normal text-rose-400">Canal Privado</span>
              </div>
              <div className="flex flex-grow flex-col justify-end space-y-2 overflow-y-auto p-3">
                {currentReq.chatMessages.map((msg) => {
                  if (msg.isSystem || msg.sender === 'Sistema') {
                    return (
                      <div key={msg.id} className="my-1.5 text-center">
                        <span className="rounded-full border border-[#1E242B] bg-[#1E2530] px-2 py-0.5 text-[8.5px] text-[#FACC15]">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }
                  const isZelador = msg.sender === 'Zelador';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex max-w-[85%] flex-col',
                        isZelador ? 'items-end self-end' : 'items-start self-start',
                      )}
                    >
                      <span className="mb-0.5 text-[8px] text-gray-500">
                        {isZelador ? zeladorLabel : `${currentReq.solicitante} (Fiel)`} • {msg.time}
                      </span>
                      <div
                        className={cn(
                          'rounded-xl p-2.5 text-[11px] leading-relaxed',
                          isZelador
                            ? 'rounded-tr-none bg-[#FACC15] text-[#080A0D]'
                            : 'rounded-tl-none border border-[#1E242B] bg-[#1E2530] text-[#F1F5F9]',
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 border-t border-[#1E242B] bg-[#12161A] p-2">
                <input
                  type="text"
                  placeholder="Diga uma orientação pastoral, banho de ervas ou mensagem ao fiel..."
                  value={chatInput}
                  disabled={busy}
                  onChange={(e) => onChatInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSendChat();
                  }}
                  className="flex-grow rounded-lg border border-[#1E242B] bg-[#12161A] px-2.5 py-1.5 text-xs text-[#F1F5F9] placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#FACC15]"
                />
                <button
                  type="button"
                  disabled={busy || !chatInput.trim()}
                  onClick={onSendChat}
                  className="rounded-lg bg-[#FACC15] px-3 py-1.5 text-xs font-bold text-[#080A0D] transition-all hover:bg-[#FDE047] disabled:opacity-60"
                >
                  Enviar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#1E242B] bg-[#12161A]/20 p-2 text-[9px] text-[#94A3B8]">
              <span className="mr-1 flex items-center gap-0.5 font-bold uppercase tracking-wider text-gray-500">
                <Leaf className="h-3 w-3 text-emerald-400" /> Rezário / Conselhos Rápidos:
              </span>
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => onChatInputChange(t.text)}
                  className="rounded border border-[#1E242B] bg-[#1E252E] px-1.5 py-1 font-medium text-[#F1F5F9] transition-colors hover:bg-[#1E2530]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function pedidoDbToUi(
  item: {
    id: string;
    created_at: string;
    nome: string;
    mensagem: string;
    status: string;
    categoria?: string | null;
    linha?: string | null;
    vela?: string | null;
    nome_terreiro?: string | null;
  },
  mensagens: Array<{ id: string; created_at: string; sender: string; texto: string }> = [],
): PedidoRezaUiItem {
  const statusMap: Record<string, PedidoRezaUiItem['status']> = {
    pendente: 'Pendente',
    aceito: 'Aceito',
    em_oracao: 'Em Oração',
    em_atendimento: 'Em Oração',
    concluido: 'Aceito',
    cancelado: 'Pendente',
  };
  return {
    id: item.id,
    solicitante: item.nome,
    casa: item.nome_terreiro || 'Terreiro',
    categoria: item.categoria || 'Pedido de Amparo',
    linha: item.linha || 'Corrente',
    vela: (item.vela as VelaCor) || 'Nenhuma',
    status: statusMap[item.status] || 'Pendente',
    intencao: item.mensagem,
    data: new Date(item.created_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    chatMessages: mensagens.map((m) => ({
      id: m.id,
      sender:
        m.sender === 'zelador' ? 'Zelador' : m.sender === 'sistema' ? 'Sistema' : 'Visitante',
      text: m.texto,
      time: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      isSystem: m.sender === 'sistema',
    })),
  };
}
