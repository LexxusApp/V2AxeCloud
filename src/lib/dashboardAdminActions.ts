export type AdminActionTone = 'emerald' | 'amber' | 'rose' | 'sky';

export type DashboardAdminAction = {
  id: string;
  tone: AdminActionTone;
  label: string;
  detail: string;
  at: string;
};

const TONE_DOT: Record<AdminActionTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-[#FACC15]',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
};

export function adminActionDotClass(tone: AdminActionTone): string {
  return TONE_DOT[tone] || TONE_DOT.emerald;
}

export function formatAdminActionWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Hoje às ${time}`;
  if (diffDays === 1) return `Ontem às ${time}`;
  if (diffDays > 1 && diffDays < 7) return `Há ${diffDays} dias atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

type BuildAdminActionsInput = {
  transactions?: Array<{ tipo?: string; descricao?: string; valor?: number; data?: string; categoria?: string }>;
  children?: Array<{ id?: string; nome?: string; created_at?: string; cargo?: string; categoria?: string }>;
  notices?: Array<{ id?: string; titulo?: string; categoria?: string; data_publicacao?: string; created_at?: string }>;
  pedidos?: Array<{ id?: string; nome?: string; status?: string; created_at?: string; mensagem?: string }>;
  max?: number;
};

export function buildDashboardAdminActions(input: BuildAdminActionsInput): DashboardAdminAction[] {
  const max = input.max ?? 6;
  const items: DashboardAdminAction[] = [];

  for (const tx of input.transactions || []) {
    const at = String(tx.data || '').trim();
    if (!at) continue;
    const desc = String(tx.descricao || '').trim();
    const cat = String(tx.categoria || '').toLowerCase();
    const valor = Number(tx.valor) || 0;
    const tipo = String(tx.tipo || '').toLowerCase();

    if (cat === 'mensalidade' || /mensalidade/i.test(desc)) {
      items.push({
        id: `tx-mens-${at}-${desc.slice(0, 24)}`,
        tone: 'emerald',
        label: 'Mensalidade Lançada:',
        detail: `${brl(valor)} registrado — ${desc.replace(/^Mensalidade\s*[-–]?\s*/i, '') || 'contribuição na corrente'}.`,
        at,
      });
      continue;
    }

    if (tipo === 'entrada') {
      items.push({
        id: `tx-in-${at}-${desc.slice(0, 24)}`,
        tone: 'emerald',
        label: 'Entrada Registrada:',
        detail: `${brl(valor)} em ${desc || 'tesouraria do terreiro'}.`,
        at,
      });
      continue;
    }

    if (tipo === 'saida' || tipo === 'saída') {
      items.push({
        id: `tx-out-${at}-${desc.slice(0, 24)}`,
        tone: 'amber',
        label: 'Despesa Lançada:',
        detail: `${brl(valor)} — ${desc || 'saída no caixa do terreiro'}.`,
        at,
      });
    }
  }

  for (const child of input.children || []) {
    const at = String(child.created_at || '').trim();
    const nome = String(child.nome || 'Novo membro').trim();
    if (!at || !nome) continue;
    const papel = String(child.cargo || child.categoria || 'corrente').trim();
    items.push({
      id: `child-${child.id || nome}`,
      tone: 'amber',
      label: 'Filho Cadastrado:',
      detail: `${nome} foi adicionado com sucesso à corrente${papel ? ` (${papel})` : ''}.`,
      at,
    });
  }

  for (const notice of input.notices || []) {
    const at = String(notice.data_publicacao || notice.created_at || '').trim();
    const titulo = String(notice.titulo || 'Comunicado').trim();
    if (!at) continue;
    const cat = String(notice.categoria || '').toLowerCase();
    const isPreceito = cat.includes('preceito') || /resguardo/i.test(titulo);
    items.push({
      id: `notice-${notice.id || titulo}`,
      tone: 'rose',
      label: isPreceito ? 'Resguardo Publicado:' : 'Aviso no Mural:',
      detail: `"${titulo}" publicado para leitura da corrente.`,
      at,
    });
  }

  for (const pedido of input.pedidos || []) {
    const at = String(pedido.created_at || '').trim();
    const nome = String(pedido.nome || 'Consulente').trim();
    if (!at) continue;
    const trecho = String(pedido.mensagem || '').trim().slice(0, 80);
    items.push({
      id: `pedido-${pedido.id || nome}`,
      tone: 'sky',
      label: 'Pedido de Reza:',
      detail: `${nome} enviou pedido de amparo${trecho ? ` — "${trecho}${pedido.mensagem && pedido.mensagem.length > 80 ? '…' : ''}"` : ''}.`,
      at,
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, max);
}
