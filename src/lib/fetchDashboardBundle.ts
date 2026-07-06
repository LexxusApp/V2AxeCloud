import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from './supabase';
import { authFetch } from './authenticatedFetch';
import {
  countsTowardSaldo,
  normalizeMovimentoTipo,
} from './financeiroSaldo';

export type DashboardEvent = {
  id: string;
  titulo: string;
  data: string;
  hora?: string | null;
  tipo?: string | null;
};

export type DashboardNotice = {
  id: string;
  titulo: string;
  categoria?: string | null;
  data_publicacao?: string | null;
};

export type DashboardPedido = {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  mensagem?: string;
};

export type DashboardChild = {
  id: string;
  nome: string;
  foto_url?: string | null;
  data_nascimento?: string | null;
};

export type DashboardBundle = {
  transactions: any[];
  childrenData: DashboardChild[];
  historyData: any[];
  events: DashboardEvent[];
  notices: DashboardNotice[];
  pedidos: DashboardPedido[];
};

export async function fetchDashboardBundle(
  user: { id: string },
  tenantIdEfetivo: string,
  userRole: string,
  tenantIdDasProps: string | undefined | null,
): Promise<DashboardBundle> {
  const empty: DashboardBundle = {
    transactions: [],
    childrenData: [],
    historyData: [],
    events: [],
    notices: [],
    pedidos: [],
  };

  try {
    let lojaTenantPk: string | null = null;
    if (userRole !== 'filho') {
      const seed = tenantIdEfetivo || user.id;
      const { data: plRow } = await supabase
        .from('perfil_lider')
        .select('id')
        .or(`id.eq.${seed},tenant_id.eq.${seed}`)
        .maybeSingle();
      lojaTenantPk = plRow?.id || seed;
    }

    const tid = encodeURIComponent(tenantIdEfetivo || '');
    const uid = encodeURIComponent(user.id);
    const role = encodeURIComponent(userRole || '');

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const txUrl = `/api/transactions?tenantId=${tid}&userId=${uid}&userRole=${role}&limit=400`;

    const [childrenRes, txRes, lojaRes, eventsRes, noticesRes, pedidosRes] = await Promise.all([
      authFetch(`/api/children?userId=${uid}&tenantId=${encodeURIComponent(tenantIdEfetivo || user.id)}&userRole=${role}`).then(
        async (r) => (r.ok ? r.json() : { data: [] }),
      ),
      authFetch(txUrl).then(async (r) => (r.ok ? r.json() : { data: [] })),
      userRole !== 'filho' && lojaTenantPk
        ? authFetch(`/api/loja-pedidos?userId=${uid}&userRole=${role}&tenantId=${tid}`).then(async (r) =>
            r.ok ? r.json() : { data: [] },
          )
        : Promise.resolve({ data: [] }),
      authFetch(`/api/events?tenantId=${tid}&start=${monthStart}&end=${monthEnd}&scope=calendar`).then(async (r) =>
        r.ok ? r.json() : { data: [] },
      ),
      authFetch(`/api/notices?tenantId=${tid}`).then(async (r) => (r.ok ? r.json() : { data: [] })),
      userRole !== 'filho'
        ? authFetch(`/api/v1/atendimentos/pedidos-reza?tenantId=${tid}`).then(async (r) =>
            r.ok ? r.json() : { items: [] },
          )
        : Promise.resolve({ items: [] }),
    ]);

    const children = ((childrenRes.data || []) as DashboardChild[]).filter((c) => {
      const s = String((c as any)?.status ?? 'Ativo').trim().toLowerCase();
      return s === 'ativo' || s === 'active' || s === '';
    });

    const rawTx = (txRes.data || []) as any[];
    const normalized = rawTx.map((t) => ({ ...t, valor: Number(t.valor) || 0 }));

    const lojaRows = (lojaRes.data || []) as any[];
    const lojaHistorico = lojaRows.map((p) => {
      const acao = p.tipo === 'reserva' ? 'reservou na loja' : 'comprou na loja';
      const met =
        p.metodo_pagamento === 'mensalidade'
          ? 'mensalidade'
          : p.metodo_pagamento === 'pix'
            ? 'PIX'
            : p.metodo_pagamento === 'reserva'
              ? 'reserva'
              : String(p.metodo_pagamento || '');
      return {
        tipo: 'entrada',
        descricao: `${p.filho_nome || 'Filho de santo'} ${acao} (${met}): ${p.resumo_itens || ''}`,
        valor: Number(p.valor_total) || 0,
        data: p.created_at,
      };
    });

    const merged = [...normalized, ...lojaHistorico].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
    );

    return {
      transactions: normalized,
      childrenData: children,
      historyData: merged.slice(0, 6),
      events: (eventsRes.data || []) as DashboardEvent[],
      notices: ((noticesRes.data || []) as DashboardNotice[]).slice(0, 5),
      pedidos: ((pedidosRes.items || pedidosRes.data || []) as DashboardPedido[]).slice(0, 10),
    };
  } catch (e) {
    console.error('[Dashboard] fetch bundle:', e);
    return empty;
  }
}

export function sumTodayFlow(transactions: any[], tipo: 'entrada' | 'saida'): number {
  const today = format(new Date(), 'yyyy-MM-dd');
  let sum = 0;
  for (const t of transactions) {
    if (!countsTowardSaldo(t)) continue;
    const mt = normalizeMovimentoTipo(t.tipo);
    if (mt !== tipo) continue;
    const raw = String(t.data || t.data_vencimento || '').slice(0, 10);
    if (raw === today) sum += Number(t.valor) || 0;
  }
  return sum;
}
