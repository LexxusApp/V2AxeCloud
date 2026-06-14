import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Wallet,
  Cake,
} from 'lucide-react';
import { DashboardPedidosRezaAltar, type DashboardPedidoReza } from '../components/dashboard/DashboardPedidosRezaAltar';
import { DashboardAcoesAdministrativas } from '../components/dashboard/DashboardAcoesAdministrativas';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import LuxuryLoading from '../components/LuxuryLoading';
import { AppPageShell } from '../components/app/AppTopNav';
import { AppDemoPanelHeader } from '../components/ui/appDemoUi';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';
import {
  countsTowardSaldo,
  isLancamentoNoMesRef,
  normalizeMovimentoTipo,
  parseFinanceiroDataRef,
} from '../lib/financeiroSaldo';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import { authFetch } from '../lib/authenticatedFetch';

type DashboardBirthday = {
  id: string;
  nome: string;
  foto_url?: string | null;
  data_nascimento: string;
  day: number;
};

type DashboardNotice = {
  id: string;
  titulo: string;
  categoria?: string | null;
  data_publicacao?: string | null;
  created_at?: string | null;
};

type DashboardBundle = {
  transactions: any[];
  childrenData: any[];
  allChildren: any[];
  historyData: any[];
  pedidosData: DashboardPedidoReza[];
  noticesData: DashboardNotice[];
  birthdayData: DashboardBirthday[];
};

function birthdaysThisMonth(children: any[]): DashboardBirthday[] {
  const month = new Date().getMonth();
  return children
    .filter((c) => {
      const raw = String(c?.data_nascimento || '').trim();
      if (!raw) return false;
      const d = new Date(`${raw.slice(0, 10)}T12:00:00`);
      return !Number.isNaN(d.getTime()) && d.getMonth() === month;
    })
    .map((c) => {
      const raw = String(c.data_nascimento).slice(0, 10);
      const d = new Date(`${raw}T12:00:00`);
      return {
        id: String(c.id),
        nome: String(c.nome || 'Filho de santo'),
        foto_url: c.foto_url,
        data_nascimento: raw,
        day: d.getDate(),
      };
    })
    .sort((a, b) => a.day - b.day)
    .slice(0, 8);
}

async function fetchDashboardFinanceBundle(
  user: { id: string },
  tenantIdEfetivo: string,
  userRole: string,
  tenantIdDasProps: string | undefined | null
): Promise<DashboardBundle> {
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

    const txUrl = `/api/transactions?tenantId=${encodeURIComponent(
      tenantIdEfetivo || ''
    )}&userId=${encodeURIComponent(user.id)}&userRole=${encodeURIComponent(
      userRole || ''
    )}&limit=400`;

    const tidEnc = encodeURIComponent(tenantIdEfetivo || '');
    const [childrenRes, txRes, lojaRes, pedidosRes, noticesRes] = await Promise.all([
      authFetch(
        `/api/children?userId=${encodeURIComponent(user.id)}&tenantId=${encodeURIComponent(
          tenantIdEfetivo || user.id
        )}&userRole=${encodeURIComponent(userRole || '')}`
      ).then(async (r) => {
        if (!r.ok) return { data: [] as any[] };
        return r.json() as Promise<{ data?: any[] }>;
      }),
      authFetch(txUrl).then(async (r) => {
        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          console.error('[Dashboard] /api/transactions', r.status, errText);
          return { data: [] as any[] };
        }
        return r.json() as Promise<{ data?: any[] }>;
      }),
      userRole !== 'filho' && lojaTenantPk
        ? authFetch(
            `/api/loja-pedidos?userId=${encodeURIComponent(user.id)}&userRole=${encodeURIComponent(
              userRole || ''
            )}&tenantId=${encodeURIComponent(tenantIdEfetivo || '')}`
          ).then(async (r) => {
            if (!r.ok) return { data: [] as any[] };
            return r.json() as Promise<{ data?: any[] }>;
          })
        : Promise.resolve({ data: [] as any[] }),
      userRole !== 'filho'
        ? authFetch(`/api/v1/atendimentos/pedidos-reza?tenantId=${tidEnc}`).then(async (r) =>
            r.ok ? r.json() : { items: [] }
          )
        : Promise.resolve({ items: [] }),
      userRole !== 'filho'
        ? authFetch(`/api/notices?tenantId=${tidEnc}`).then(async (r) =>
            r.ok ? r.json() : { data: [] }
          )
        : Promise.resolve({ data: [] }),
    ]);

    const children = (childrenRes.data || []).filter((c: any) => {
      const s = String(c?.status ?? 'Ativo').trim().toLowerCase();
      return s === 'ativo' || s === 'active' || s === '';
    });
    const rawTx = (txRes.data || []) as any[];
    const normalized = rawTx.map((t) => ({ ...t, valor: Number(t.valor) || 0 }));

    const counted = normalized.filter((t) => countsTowardSaldo(t));
    let rec = 0;
    let des = 0;
    for (const t of counted) {
      const n = Number(t.valor) || 0;
      const mt = normalizeMovimentoTipo(t.tipo);
      if (mt === 'entrada') rec += n;
      else if (mt === 'saida') des += n;
    }
    const saldoLiquido = rec - des;
    if (import.meta.env.DEV) {
      console.log('[FinanceDebug][Dashboard]', {
        userId: user.id,
        tenantIdEfetivo: tenantIdEfetivo || '(vazio)',
        tenantIdDasProps:
          tenantIdDasProps != null && String(tenantIdDasProps).trim() !== '' ? tenantIdDasProps : '(vazio)',
        usouFallbackLocalStorage:
          !String(tenantIdDasProps ?? '').trim() && Boolean(String(tenantIdEfetivo || '').trim()),
        saldoLiquido,
        txCount: normalized.length,
      });
    }

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
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    );

    const pedidosRaw = (pedidosRes.items || pedidosRes.data || []) as DashboardPedidoReza[];
    const pedidosData = [...pedidosRaw]
      .sort((a, b) => {
        const rank = (s: string) =>
          s === 'pendente' ? 0 : s === 'em_atendimento' ? 1 : s === 'concluido' ? 2 : 3;
        const diff = rank(String(a.status)) - rank(String(b.status));
        if (diff !== 0) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5);

    const noticesRaw = (noticesRes.data || []) as DashboardNotice[];
    const noticesData = [...noticesRaw]
      .sort(
        (a, b) =>
          new Date(String(b.data_publicacao || b.created_at || 0)).getTime() -
          new Date(String(a.data_publicacao || a.created_at || 0)).getTime()
      )
      .slice(0, 8);

    return {
      transactions: normalized,
      childrenData: children.slice(0, 4),
      allChildren: children,
      historyData: merged.slice(0, 8),
      pedidosData,
      noticesData,
      birthdayData: birthdaysThisMonth(children),
    };
  } catch (e) {
    console.error('Error fetching dashboard data:', e);
    return {
      transactions: [],
      childrenData: [],
      allChildren: [],
      historyData: [],
      pedidosData: [],
      noticesData: [],
      birthdayData: [],
    };
  }
}

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  user: any;
  userRole?: 'admin' | 'filho';
  tenantData?: any;
  isAdminGlobal?: boolean;
  setSelectedChildId?: (id: string) => void;
  systemVersion?: string;
  isSessionReady?: boolean;
}

export default function Dashboard({ setActiveTab, user, userRole = 'admin', tenantData, isAdminGlobal = false, setSelectedChildId, systemVersion = '1.0.0', isSessionReady = false }: DashboardProps) {
  const initialTenantFromStorage = typeof window !== 'undefined'
    ? String(localStorage.getItem('tenant_id') || '').trim()
    : '';
  const [authLoading, setAuthLoading] = useState(true);
  const tenantId = useMemo(
    () => resolveTenantIdForFinance(tenantData?.tenant_id || initialTenantFromStorage, user?.id),
    [tenantData?.tenant_id, user?.id, initialTenantFromStorage]
  );
  /** Último bundle válido — evita “sumir” dados durante revalidação SWR ou HMR. */
  const lastBundleRef = useRef<DashboardBundle | null>(null);

  const dashboardCalendar = useMemo(() => {
    const anchor = new Date();
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const rawMonth = format(anchor, 'MMMM yyyy', { locale: ptBR });
    const monthTitle = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
    return { days, monthTitle, anchor };
  }, []);

  const [flowPeriod, setFlowPeriod] = useState<'6months' | 'month'>('6months');
  const [flowPeriodOpen, setFlowPeriodOpen] = useState(false);

  const dashboardSwrKey =
    user?.id && tenantId
      ? (['dashboard-finance', user.id, tenantId, userRole] as const)
      : null;
  const { data: dashboardBundle, isLoading, isValidating, error, mutate } = useSWR(
    dashboardSwrKey,
    () => fetchDashboardFinanceBundle(user!, tenantId, userRole, tenantData?.tenant_id),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
      errorRetryCount: 2,
    }
  );

  if (dashboardBundle) {
    lastBundleRef.current = dashboardBundle;
  }
  const resolvedBundle = dashboardBundle ?? lastBundleRef.current;
  const transactions = resolvedBundle?.transactions ?? [];
  const childrenData = resolvedBundle?.childrenData ?? [];
  const historyData = resolvedBundle?.historyData ?? [];
  const noticesData = resolvedBundle?.noticesData ?? [];
  const allChildren = resolvedBundle?.allChildren ?? [];
  const pedidosData = resolvedBundle?.pedidosData ?? [];
  const birthdayData = resolvedBundle?.birthdayData ?? [];

  const birthdayMonthLabel = useMemo(() => {
    const raw = format(new Date(), 'MMMM', { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  const recentChildrenForActions = useMemo(() => {
    const cutoff = Date.now() - 90 * 86_400_000;
    return [...allChildren]
      .filter((c) => {
        const raw = String(c?.created_at || '').trim();
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      })
      .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, 5);
  }, [allChildren]);

  const { stats, flowChartData, flowYMax, hasMonthFinanceData } = useMemo(() => {
    const anchor = new Date();
    const prevMonthRef = subMonths(anchor, 1);

    const counted = transactions.filter((t) => countsTowardSaldo(t));

    let rec = 0;
    let des = 0;
    for (const t of counted) {
      const n = Number(t.valor) || 0;
      const mt = normalizeMovimentoTipo(t.tipo);
      if (mt === 'entrada') rec += n;
      else if (mt === 'saida') des += n;
    }

    const curMonthRec = counted
      .filter((t) => isLancamentoNoMesRef(t, anchor) && normalizeMovimentoTipo(t.tipo) === 'entrada')
      .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

    const prevRec = counted
      .filter(
        (t) =>
          isLancamentoNoMesRef(t, prevMonthRef) && normalizeMovimentoTipo(t.tipo) === 'entrada'
      )
      .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

    let growthPct: number | null = null;
    if (prevRec > 0) {
      growthPct = Math.round(((curMonthRec - prevRec) / prevRec) * 100);
    } else if (curMonthRec > 0) {
      growthPct = 100;
    }

    const lucro = rec - des;
    let marginPct: number | null = null;
    if (rec > 0) {
      marginPct = Math.round((lucro / rec) * 100);
    } else if (rec === 0 && des === 0) {
      marginPct = null;
    } else {
      marginPct = null;
    }

    const hasData = rec > 0 || des > 0;

    const monthLabel = (ref: Date) => {
      const abbr = format(ref, 'MMM', { locale: ptBR }).replace('.', '').toUpperCase();
      return `01/${abbr}`;
    };

    const monthlyFlow: Array<{ name: string; val: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthRef = subMonths(anchor, i);
      let monthNet = 0;
      for (const t of counted) {
        if (!isLancamentoNoMesRef(t, monthRef)) continue;
        const n = Number(t.valor) || 0;
        const mt = normalizeMovimentoTipo(t.tipo);
        if (mt === 'entrada') monthNet += n;
        else if (mt === 'saida') monthNet -= n;
      }
      monthlyFlow.push({ name: monthLabel(monthRef), val: Math.max(0, monthNet) });
    }

    const daysInMonth = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
    const dailyFlow: Array<{ name: string; val: number }> = daysInMonth.map((day) => {
      let dayNet = 0;
      for (const t of counted) {
        const d = parseFinanceiroDataRef(t);
        if (!d || !isSameDay(d, day)) continue;
        const n = Number(t.valor) || 0;
        const mt = normalizeMovimentoTipo(t.tipo);
        if (mt === 'entrada') dayNet += n;
        else if (mt === 'saida') dayNet -= n;
      }
      return { name: format(day, 'dd', { locale: ptBR }), val: Math.max(0, dayNet) };
    });

    const flowSeries = monthlyFlow;
    const flowMax = Math.max(...flowSeries.map((p) => p.val), 0);
    const flowYMax =
      flowMax <= 0
        ? 5000
        : Math.ceil(flowMax / 1000) * 1000 || 1000;

    return {
      stats: {
        totalReceita: rec,
        totalDespesa: des,
        lucroLiquido: lucro,
        growthPct,
        marginPct,
      },
      hasMonthFinanceData: hasData,
      flowChartData: { monthly: monthlyFlow, daily: dailyFlow },
      flowYMax,
    };
  }, [transactions]);

  const activeFlowChart = useMemo(
    () => (flowPeriod === 'month' ? flowChartData.daily : flowChartData.monthly),
    [flowChartData, flowPeriod]
  );

  const activeFlowYMax = useMemo(() => {
    const max = Math.max(...activeFlowChart.map((p) => p.val), 0);
    if (max <= 0) return flowPeriod === 'month' ? 1000 : flowYMax;
    const step = max <= 1000 ? 200 : 1000;
    return Math.ceil(max / step) * step;
  }, [activeFlowChart, flowPeriod, flowYMax]);

  useEffect(() => {
    const onFinanceUpdated = () => {
      void mutate();
    };
    window.addEventListener('axecloud:finance-updated', onFinanceUpdated);
    return () => window.removeEventListener('axecloud:finance-updated', onFinanceUpdated);
  }, [mutate]);

  useEffect(() => {
    if (!tenantId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribeTimer = window.setTimeout(() => {
      channel = supabase
        .channel(`dashboard_finance_${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'financeiro',
            filter: `tenant_id=eq.${tenantId}`,
          },
          () => {
            void mutate();
          }
        )
        .subscribe();
    }, 0);
    return () => {
      window.clearTimeout(subscribeTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [tenantId, mutate]);

  const loading = Boolean(
    dashboardSwrKey && !resolvedBundle && (isLoading || isValidating)
  );

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const hasUser = !!data.session?.user;
      setAuthLoading(false);
      if (!hasUser && !loading) {
        window.location.href = '/login';
      }
    }).catch(() => {
      if (cancelled) return;
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loading]);

  if (!user && authLoading) {
    return <div className="h-[70vh] flex items-center justify-center"><LuxuryLoading /></div>;
  }

  if (loading) return <div className="h-[70vh] flex items-center justify-center"><LuxuryLoading /></div>;

  const fetchFailed = Boolean(dashboardSwrKey && error && !resolvedBundle);

  const terreiroNome = tenantData?.nome?.trim() || '';

  const now = new Date();
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = (terreiroNome.split(' ')[0] || 'Zelador').trim();
  const formattedDate = (() => {
    const raw = format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  return (
    <AppPageShell>
      {fetchFailed && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-200">
            Não foi possível carregar os dados do terreiro. Verifique a conexão ou tente de novo.
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-black"
          >
            Recarregar
          </button>
        </div>
      )}

      <AppDemoPanelHeader
        title={`${timeGreeting}, ${firstName}`}
        description={formattedDate}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Section (65%) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Card: entradas + fluxo financeiro */}
          <div className="app-v3-panel p-6 md:p-8 relative overflow-hidden group">
            <div className="relative z-10 flex justify-between items-start gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-400 leading-snug">
                  Entradas no caixa (acumulado)
                </p>
                <h2 className="text-3xl md:text-4xl font-black mt-1 tracking-tighter text-white truncate">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceita)}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-bold leading-snug">
                  {stats.growthPct !== null ? (
                    <>
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 shrink-0',
                          stats.growthPct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        )}
                      >
                        {stats.growthPct >= 0 ? <Plus className="w-3 h-3" /> : null}
                        {stats.growthPct < 0 ? '−' : null}
                        {Math.abs(stats.growthPct)}%
                      </span>
                      <span className="text-gray-500 font-medium">
                        em relação ao mês anterior (receitas)
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500 font-medium">
                      Sem comparativo com o mês anterior
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
              </div>
            </div>

            <div className="relative z-10 flex justify-end mb-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFlowPeriodOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a1a] px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 transition-colors hover:border-white/20 hover:text-white"
                  aria-expanded={flowPeriodOpen}
                  aria-haspopup="listbox"
                >
                  {flowPeriod === 'month' ? 'Este mês' : 'Últimos 6 meses'}
                  <ChevronDown
                    className={cn('h-3 w-3 text-gray-500 transition-transform', flowPeriodOpen && 'rotate-180')}
                  />
                </button>
                {flowPeriodOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Fechar filtro"
                      onClick={() => setFlowPeriodOpen(false)}
                    />
                    <ul
                      role="listbox"
                      className="absolute right-0 z-20 mt-1.5 min-w-[9.5rem] overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] py-0.5 shadow-xl"
                    >
                      {(
                        [
                          { id: 'month' as const, label: 'Este mês' },
                          { id: '6months' as const, label: 'Últimos 6 meses' },
                        ] as const
                      ).map((opt) => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={flowPeriod === opt.id}
                            className={cn(
                              'w-full px-3 py-2 text-left text-[10px] font-semibold transition-colors',
                              flowPeriod === opt.id
                                ? 'bg-[#FF9F0A]/15 text-[#FF9F0A]'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            )}
                            onClick={() => {
                              setFlowPeriod(opt.id);
                              setFlowPeriodOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="h-48 md:h-56 w-full relative z-10 min-w-0">
              {!hasMonthFinanceData ? (
                <div className="flex h-full min-h-[192px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/25 px-6 text-center">
                  <Wallet className="mb-3 h-10 w-10 text-[#FF9F0A]/35" aria-hidden />
                  <p className="text-sm font-bold text-gray-400">Nenhum lançamento financeiro confirmado</p>
                  <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-gray-600">
                    Quando houver entradas ou saídas confirmadas no painel financeiro, o fluxo será exibido aqui.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={192} debounce={50}>
                  <AreaChart
                    data={activeFlowChart}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fluxoOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF9F0A" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#FF9F0A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#2a2a2a" strokeDasharray="0" vertical horizontal />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8E8E93', fontSize: 11, fontWeight: 500 }}
                      dy={8}
                      interval={flowPeriod === 'month' ? 'preserveStartEnd' : 0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8E8E93', fontSize: 11, fontWeight: 500 }}
                      domain={[0, activeFlowYMax]}
                      tickCount={6}
                      width={48}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="val"
                      stroke="#FF9F0A"
                      strokeWidth={2.5}
                      fill="url(#fluxoOrangeGradient)"
                      fillOpacity={1}
                      dot={{ r: 4, fill: '#FF9F0A', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#FF9F0A', stroke: '#121212', strokeWidth: 2 }}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {userRole !== 'filho' && tenantId && (
            <DashboardPedidosRezaAltar
              pedidos={pedidosData}
              tenantId={tenantId}
              onRefresh={() => mutate()}
              onOpenAtendimentos={() => setActiveTab('atendimentos')}
            />
          )}

          {/* Card: Filhos de Santo */}
          <div className="app-v3-panel p-8">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold">Filhos de Santo</h3>
                <button onClick={() => setActiveTab('children')} className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">Ver todos</button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {childrenData.map((filho, idx) => (
                  <div
                    key={filho.id}
                    className="flex flex-col items-center cursor-pointer group"
                    onClick={() => {
                      if (setSelectedChildId) {
                        setSelectedChildId(filho.id);
                        setActiveTab('profile');
                      }
                    }}
                  >
                    {/* Avatar com anel pulsante permanente */}
                    <div className="relative w-20 h-20">
                      {/* Anel externo pulsante */}
                      <span className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping-slow" />
                      {/* Anel fixo dourado */}
                      <span className="absolute inset-0 rounded-full border-2 border-primary/80 group-hover:border-primary transition-colors" />
                      {/* Foto */}
                      <div className="absolute inset-[3px] rounded-full overflow-hidden">
                        <Avatar
                          src={filho.foto_url}
                          name={filho.nome}
                          shape="circle"
                          textSize="text-lg"
                          className="w-full h-full"
                        />
                      </div>
                      {/* Brilho ao hover */}
                      <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs font-bold mt-3 text-center text-primary">{filho.nome.split(' ')[0]}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-center truncate w-full uppercase tracking-widest font-medium">Ativo</p>
                  </div>
                ))}
                {childrenData.length === 0 && Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center opacity-20">
                     <div className="w-20 h-20 rounded-full bg-white/5"></div>
                     <div className="w-16 h-2 bg-white/5 mt-4 rounded"></div>
                  </div>
                ))}
             </div>
          </div>

          <DashboardAcoesAdministrativas
            transactions={transactions}
            children={recentChildrenForActions}
            notices={noticesData}
            pedidos={pedidosData}
            onOpenFinancial={() => setActiveTab('financial')}
            onOpenMural={() => setActiveTab('mural')}
          />
        </div>

        {/* Right Section (35%) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Card: Calendário */}
          <div className="app-v3-panel p-8">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Calendário</h3>
                <ChevronRight className="w-5 h-5 text-gray-600" />
             </div>
             
             <p className="text-xs font-bold text-primary text-center mb-6 uppercase tracking-widest">
                {dashboardCalendar.monthTitle}
             </p>
             
             <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-center sm:gap-y-2">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                  <span key={day} className="col-span-1 text-[8px] font-bold uppercase text-gray-600 sm:text-[9px]">
                    <span className="sm:hidden">{day.charAt(0)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </span>
                ))}
                {dashboardCalendar.days.map(day => {
                  const inMonth = isSameMonth(day, dashboardCalendar.anchor);
                  const isTodayCell = isSameDay(day, new Date());
                  return (
                    <span
                      key={day.toISOString()}
                      className={cn(
                        'flex min-h-[1.75rem] items-center justify-center rounded-md p-1 text-[11px] font-bold sm:min-h-[2rem] sm:rounded-lg sm:p-2 sm:text-xs',
                        !inMonth && 'text-gray-700 opacity-35',
                        inMonth && !isTodayCell && 'text-gray-400',
                        isTodayCell && 'bg-primary text-black shadow-[0_0_15px_rgba(250,204,21,0.35)]'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  );
                })}
             </div>
          </div>

          {/* Card: Histórico */}
          <div className="app-v3-panel p-8 flex flex-col min-h-[400px]">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold">Histórico</h3>
                <button aria-label="Mais opções de histórico" className="text-gray-600 hover:text-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
             </div>

             <div className="space-y-6 flex-1">
               {historyData.length > 0 ? historyData.map((transaction, idx) => (
                 <div key={idx} className="flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 transition-all text-black",
                         transaction.tipo === 'entrada' ? "bg-emerald-500" : "bg-rose-500"
                       )}>
                          {transaction.tipo === 'entrada' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">{transaction.descricao || 'Transação'}</span>
                          <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">{new Date(transaction.data).toLocaleDateString('pt-BR')}</span>
                       </div>
                    </div>
                    <span className={cn(
                      "text-xs font-black",
                      transaction.tipo === 'entrada' ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {transaction.tipo === 'entrada' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.valor)}
                    </span>
                 </div>
               )) : (
                 <div className="flex flex-col items-center justify-center h-full opacity-20 italic text-sm text-center">Nenhum histórico disponível.</div>
               )}
             </div>
          </div>

          {/* Card: Aniversariantes do mês */}
          <div className="app-v3-panel p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <Cake className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Aniversariantes do mês</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{birthdayMonthLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('children')}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Ver membros
              </button>
            </div>

            {birthdayData.length > 0 ? (
              <div className="space-y-4">
                {birthdayData.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      if (setSelectedChildId) {
                        setSelectedChildId(person.id);
                        setActiveTab('profile');
                      }
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-[#1E242B] bg-[#12161A] px-3 py-2.5 text-left transition-colors hover:border-primary/25 hover:bg-white/[0.03]"
                  >
                    <Avatar
                      src={person.foto_url}
                      name={person.nome}
                      shape="circle"
                      textSize="text-sm"
                      className="h-11 w-11 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{person.nome}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Dia {person.day}
                      </p>
                    </div>
                    <Cake className="h-4 w-4 shrink-0 text-primary/50" aria-hidden />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[100px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 text-center">
                <Cake className="mb-2 h-8 w-8 text-primary/30" aria-hidden />
                <p className="text-sm font-bold text-gray-400">Nenhum aniversariante em {birthdayMonthLabel}</p>
                <p className="mt-1 text-xs font-medium text-gray-600">
                  Cadastre a data de nascimento nos perfis dos filhos de santo.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppPageShell>
  );
}
