/** Tipos e helpers compartilhados — pedidos de reza (site ↔ app). */

export type PedidoRezaStatus = 'pendente' | 'aceito' | 'em_oracao' | 'concluido' | 'cancelado';

export type VelaCor = 'Branca' | 'Vermelha' | 'Azul' | 'Verde' | 'Amarela' | 'Preta' | 'Nenhuma';

export type PedidoRezaSender = 'zelador' | 'visitante' | 'sistema';

export type PedidoRezaMensagem = {
  id: string;
  created_at: string;
  sender: PedidoRezaSender;
  texto: string;
};

export type PedidoRezaItem = {
  id: string;
  created_at: string;
  updated_at?: string;
  nome: string;
  whatsapp: string | null;
  mensagem: string;
  status: PedidoRezaStatus;
  observacao_interna: string | null;
  categoria: string | null;
  linha: string | null;
  vela: VelaCor | null;
  nome_terreiro: string | null;
  acesso_token?: string | null;
  chatMessages?: PedidoRezaMensagem[];
};

export const PEDIDO_STATUS_UI: Record<PedidoRezaStatus, 'Pendente' | 'Aceito' | 'Em Oração' | 'Concluído' | 'Arquivado'> = {
  pendente: 'Pendente',
  aceito: 'Aceito',
  em_oracao: 'Em Oração',
  concluido: 'Concluído',
  cancelado: 'Arquivado',
};

export const CANDLE_COLOR_HEX: Record<string, string> = {
  Branca: '#FFFFFF',
  Vermelha: '#EF4444',
  Azul: '#3B82F6',
  Verde: '#10B981',
  Amarela: '#F59E0B',
  Preta: '#27272A',
  Nenhuma: '#6B7280',
};

export const CANDLE_COLOR_LABEL: Record<string, string> = {
  Branca: 'Branca (Paz / Oxalá)',
  Vermelha: 'Vermelha (Lei / Ogum)',
  Azul: 'Azul (Mar / Yemanjá)',
  Verde: 'Verde (Saúde / Oxóssi)',
  Amarela: 'Amarela (Amor / Oxum)',
  Preta: 'Preta (Defesa / Exu)',
  Nenhuma: 'Apenas preces',
};

export const CANDLE_DOT_CLASS: Record<string, string> = {
  Branca: 'bg-white border-gray-400',
  Vermelha: 'bg-red-600 border-red-800',
  Azul: 'bg-blue-600 border-blue-800',
  Verde: 'bg-emerald-600 border-emerald-800',
  Amarela: 'bg-yellow-500 border-yellow-700',
  Preta: 'bg-gray-950 border-gray-900',
  Nenhuma: 'bg-gray-400 border-[#1E242B]',
};

export const VELAS_VALIDAS = new Set<VelaCor>([
  'Branca',
  'Vermelha',
  'Azul',
  'Verde',
  'Amarela',
  'Preta',
  'Nenhuma',
]);

export const PEDIDO_STORAGE_KEY = 'axe_pedidos_reza_tokens_v1';

export function formatPedidoTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatPedidoDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export function mapMensagemToChat(msg: PedidoRezaMensagem) {
  return {
    id: msg.id,
    sender: msg.sender === 'zelador' ? ('Zelador' as const) : msg.sender === 'visitante' ? ('Visitante' as const) : ('Sistema' as const),
    text: msg.texto,
    time: formatPedidoTime(msg.created_at),
    isSystem: msg.sender === 'sistema',
  };
}

export function loadStoredPedidoTokens(): string[] {
  try {
    const raw = localStorage.getItem(PEDIDO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string' && t.length > 8);
  } catch {
    return [];
  }
}

export function storePedidoToken(token: string) {
  const existing = loadStoredPedidoTokens();
  if (existing.includes(token)) return;
  localStorage.setItem(PEDIDO_STORAGE_KEY, JSON.stringify([token, ...existing].slice(0, 20)));
}
