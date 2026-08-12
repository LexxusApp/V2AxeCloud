import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import {
  ArrowUpRight,
  CalendarDays,
  Heart,
  Megaphone,
  Plus,
  ChevronRight,
  ChevronDown,
  Users,
  Wallet,
  Cake,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Settings,
  Sparkles,
  ArrowRight,
  Landmark,
  Images,
  Package,
  BookOpen,
  HandHeart,
  TrendingUp,
} from 'lucide-react';
import { DashboardPedidosRezaAltar, type DashboardPedidoReza } from '../components/dashboard/DashboardPedidosRezaAltar';
import { DashboardAcoesAdministrativas } from '../components/dashboard/DashboardAcoesAdministrativas';
import { DashboardSystemInsightCard } from '../components/dashboard/DashboardSystemInsightCard';
import PreceitoCommandCenter from '../components/preceito/PreceitoCommandCenter';
import {
  HouseTimeline,
  type HouseTimelineEvent,
} from '../components/dashboard/HouseTimeline';
import {
  pickNextUpcomingEvent,
  type DashboardNextEvent,
} from '../components/dashboard/DashboardProximaGira';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ComposedChart,
  Area,
  Line,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import LuxuryLoading from '../components/LuxuryLoading';
import { AppPageShell } from '../components/app/AppTopNav';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabase';
import {
  countsTowardSaldo,
  isLancamentoNoMesRef,
  normalizeMovimentoTipo,
  parseFinanceiroDataRef,
} from '../lib/financeiroSaldo';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import { authFetch, ensureFreshAccessToken } from '../lib/authenticatedFetch';
import { ROUTES } from '../lib/routes';
import { notifySessionExpired } from '../lib/supabase';
import { excludeObrigacaoEvents } from '../lib/calendarEventFilters';

const SESSION_EXPIRED_ERR = 'SESSION_EXPIRED';
const DASHBOARD_FETCH_ERR = 'DASHBOARD_FETCH_FAILED';

// Painel administrativo antigo, substituído pela home V5 (.dashboard-v5-legacy
// fica com display:none no CSS). Mantido no código como referência/rollback.
const SHOW_LEGACY_DASHBOARD = false;

function bundleHasMeaningfulData(bundle: DashboardBundle | null | undefined): boolean {
  if (!bundle) return false;
  return (
    bundle.transactions.length > 0 ||
    bundle.allChildren.length > 0 ||
    bundle.noticesData.length > 0 ||
    bundle.pedidosData.length > 0 ||
    bundle.nextEvent != null
  );
}

async function parseApiJson<T>(response: Response, empty: T): Promise<T> {
  if (response.status === 401) {
    notifySessionExpired('dashboard_api_401');
    throw new Error(SESSION_EXPIRED_ERR);
  }
  if (!response.ok) return empty;
  return response.json() as Promise<T>;
}

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
  nextEvent: DashboardNextEvent | null;
  /** True if the house has ever scheduled a gira/event (past or future), excluding obrigações. */
  hasAnyGira: boolean;
  pedidosData: DashboardPedidoReza[];
  noticesData: DashboardNotice[];
  birthdayData: DashboardBirthday[];
  upcomingEvents: DashboardNextEvent[];
  pixConfig: {
    chave_pix?: string | null;
    valor_mensalidade?: number | null;
    mensalidade_ativa?: boolean | null;
  } | null;
};

type SetupStepV5 = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  tab: string;
};

type HouseMission = {
  title: string;
  detail: string;
  cta: string;
  tab: string;
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
    await ensureFreshAccessToken();

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
    const today = format(new Date(), 'yyyy-MM-dd');
    const [childrenRes, txRes, lojaRes, pedidosRes, noticesRes, eventsRes, pixConfigRes] = await Promise.all([
      authFetch(
        `/api/children?userId=${encodeURIComponent(user.id)}&tenantId=${encodeURIComponent(
          tenantIdEfetivo || user.id
        )}&userRole=${encodeURIComponent(userRole || '')}`
      ).then((r) => parseApiJson<{ data?: any[] }>(r, { data: [] })),
      authFetch(txUrl).then(async (r) => {
        if (r.status === 401) {
          const errText = await r.text().catch(() => '');
          console.error('[Dashboard] /api/transactions', r.status, errText);
          notifySessionExpired('dashboard_transactions_401');
          throw new Error(SESSION_EXPIRED_ERR);
        }
        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          console.error('[Dashboard] /api/transactions', r.status, errText);
          if (r.status === 401) {
            notifySessionExpired('dashboard_transactions_401');
            throw new Error(SESSION_EXPIRED_ERR);
          }
          throw new Error(DASHBOARD_FETCH_ERR);
        }
        return r.json() as Promise<{ data?: any[] }>;
      }),
      userRole !== 'filho' && lojaTenantPk
        ? authFetch(
            `/api/loja-pedidos?userId=${encodeURIComponent(user.id)}&userRole=${encodeURIComponent(
              userRole || ''
            )}&tenantId=${encodeURIComponent(tenantIdEfetivo || '')}`
          ).then((r) => parseApiJson<{ data?: any[] }>(r, { data: [] }))
        : Promise.resolve({ data: [] as any[] }),
      userRole !== 'filho'
        ? authFetch(`/api/v1/atendimentos/pedidos-reza?tenantId=${tidEnc}`).then((r) =>
            parseApiJson<{ items?: DashboardPedidoReza[]; data?: DashboardPedidoReza[] }>(r, {
              items: [],
            })
          )
        : Promise.resolve({ items: [] as DashboardPedidoReza[], data: undefined }),
      userRole !== 'filho'
        ? authFetch(`/api/notices?tenantId=${tidEnc}`).then((r) =>
            parseApiJson<{ data?: any[] }>(r, { data: [] })
          )
        : Promise.resolve({ data: [] }),
      // Sem `start=today`: precisamos de giras passadas para a jornada de estrutura
      // (já agendou = etapa ok), e ainda derivamos a próxima gira no cliente.
      authFetch(`/api/events?tenantId=${tidEnc}&scope=calendar`).then((r) =>
        parseApiJson<{ data?: any[] }>(r, { data: [] })
      ),
      userRole !== 'filho'
        ? authFetch(`/api/v1/financial/pix-config?tenantId=${tidEnc}`).then((r) =>
            parseApiJson<any>(r, null)
          )
        : Promise.resolve(null),
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

    const merged = [...normalized.filter((transaction) => countsTowardSaldo(transaction)), ...lojaHistorico].sort(
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

    const calendarEvents = excludeObrigacaoEvents(
      (eventsRes.data || []) as DashboardNextEvent[],
    );
    const upcomingEvents = [...calendarEvents]
      .filter((e) => String(e.data || '') >= today)
      .sort((a, b) => {
        const first = new Date(`${a.data}T${a.hora || '00:00'}`).getTime();
        const second = new Date(`${b.data}T${b.hora || '00:00'}`).getTime();
        return first - second;
      })
      .slice(0, 4);

    return {
      transactions: normalized,
      childrenData: children.slice(0, 4),
      allChildren: children,
      historyData: merged.slice(0, 8),
      nextEvent: pickNextUpcomingEvent(calendarEvents),
      hasAnyGira: calendarEvents.length > 0,
      pedidosData,
      noticesData,
      birthdayData: birthdaysThisMonth(children),
      upcomingEvents,
      pixConfig: pixConfigRes?.data || pixConfigRes || null,
    };
  } catch (e) {
    if (e instanceof Error && e.message === SESSION_EXPIRED_ERR) throw e;
    if (e instanceof Error && e.message === DASHBOARD_FETCH_ERR) throw e;
    console.error('Error fetching dashboard data:', e);
    return {
      transactions: [],
      childrenData: [],
      allChildren: [],
      historyData: [],
      nextEvent: null,
      hasAnyGira: false,
      pedidosData: [],
      noticesData: [],
      birthdayData: [],
      upcomingEvents: [],
      pixConfig: null,
    };
  }
}

function useCoarsePointerOrMobile(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px), (pointer: coarse)');
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
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
  const reduceChartGpu = useCoarsePointerOrMobile();
  const tenantId = useMemo(
    () =>
      resolveTenantIdForFinance(
        tenantData?.tenant_id || initialTenantFromStorage,
        user?.id,
        userRole === 'filho'
      ),
    [tenantData?.tenant_id, user?.id, userRole, initialTenantFromStorage]
  );
  /** Último bundle válido — evita “sumir” dados durante revalidação SWR ou HMR. */
  const lastBundleRef = useRef<DashboardBundle | null>(null);

  const [flowPeriod, setFlowPeriod] = useState<'6months' | 'month'>('6months');
  const [flowPeriodOpen, setFlowPeriodOpen] = useState(false);

  const dashboardSwrKey =
    user?.id && tenantId && isSessionReady
      ? (['dashboard-finance', user.id, tenantId, userRole] as const)
      : null;
  const { data: dashboardBundle, isLoading, isValidating, error, mutate } = useSWR(
    dashboardSwrKey,
    () => fetchDashboardFinanceBundle(user!, tenantId, userRole, tenantData?.tenant_id),
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      keepPreviousData: true,
      errorRetryCount: 2,
    }
  );

  if (dashboardBundle) {
    const prev = lastBundleRef.current;
    if (!prev || bundleHasMeaningfulData(dashboardBundle) || !bundleHasMeaningfulData(prev)) {
      lastBundleRef.current = dashboardBundle;
    }
  }
  const resolvedBundle = dashboardBundle ?? lastBundleRef.current;
  const transactions = resolvedBundle?.transactions ?? [];
  const childrenData = resolvedBundle?.childrenData ?? [];
  const nextEvent = resolvedBundle?.nextEvent ?? null;
  const hasAnyGira = resolvedBundle?.hasAnyGira ?? false;
  const noticesData = resolvedBundle?.noticesData ?? [];
  const allChildren = resolvedBundle?.allChildren ?? [];
  const pedidosData = resolvedBundle?.pedidosData ?? [];
  const birthdayData = resolvedBundle?.birthdayData ?? [];
  const upcomingEvents = resolvedBundle?.upcomingEvents ?? [];
  const pixConfig = resolvedBundle?.pixConfig ?? null;

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

    const monthlyFlow: Array<{ name: string; entradas: number; saidas: number; saldo: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthRef = subMonths(anchor, i);
      let entradas = 0;
      let saidas = 0;
      for (const t of counted) {
        if (!isLancamentoNoMesRef(t, monthRef)) continue;
        const n = Number(t.valor) || 0;
        const mt = normalizeMovimentoTipo(t.tipo);
        if (mt === 'entrada') entradas += n;
        else if (mt === 'saida') saidas += n;
      }
      monthlyFlow.push({ name: monthLabel(monthRef), entradas, saidas, saldo: entradas - saidas });
    }

    const daysInMonth = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
    const dailyFlow: Array<{ name: string; entradas: number; saidas: number; saldo: number }> = daysInMonth.map((day) => {
      let entradas = 0;
      let saidas = 0;
      for (const t of counted) {
        const d = parseFinanceiroDataRef(t);
        if (!d || !isSameDay(d, day)) continue;
        const n = Number(t.valor) || 0;
        const mt = normalizeMovimentoTipo(t.tipo);
        if (mt === 'entrada') entradas += n;
        else if (mt === 'saida') saidas += n;
      }
      return { name: format(day, 'dd', { locale: ptBR }), entradas, saidas, saldo: entradas - saidas };
    });

    const flowSeries = monthlyFlow;
    const flowMax = Math.max(...flowSeries.flatMap((p) => [p.entradas, p.saidas, Math.abs(p.saldo)]), 0);
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
    const max = Math.max(
      ...activeFlowChart.flatMap((p) => [p.entradas, p.saidas, Math.abs(p.saldo)]),
      0,
    );
    if (max <= 0) return flowPeriod === 'month' ? 1000 : flowYMax;
    const step = max <= 1000 ? 200 : 1000;
    return Math.ceil(max / step) * step;
  }, [activeFlowChart, flowPeriod, flowYMax]);

  const pendingMensalidades = useMemo(
    () =>
      transactions.filter((transaction) => {
        const categoria = String(transaction?.categoria || '').trim().toLowerCase();
        const status = String(transaction?.status || '').trim().toLowerCase();
        return categoria === 'mensalidade' && (status === 'pendente' || status === 'atrasado');
      }).length,
    [transactions],
  );
  const pendingMensalidadesValue = useMemo(
    () =>
      transactions
        .filter((transaction) => {
          const categoria = String(transaction?.categoria || '').trim().toLowerCase();
          const status = String(transaction?.status || '').trim().toLowerCase();
          return categoria === 'mensalidade' && (status === 'pendente' || status === 'atrasado');
        })
        .reduce((total, transaction) => total + (Number(transaction?.valor) || 0), 0),
    [transactions],
  );
  const pendingRezas = pedidosData.filter((pedido) => pedido.status === 'pendente').length;
  const incompleteProfiles = allChildren.filter(
    (child) => !String(child?.telefone || child?.celular || '').trim() || !String(child?.data_nascimento || '').trim(),
  ).length;
  const withoutAppAccess = allChildren.filter(
    (child) => !String(child?.user_id || '').trim(),
  ).length;
  const houseTimelineEvents = useMemo<HouseTimelineEvent[]>(() => {
    const events: HouseTimelineEvent[] = [];

    upcomingEvents.slice(0, 2).forEach((event) => {
      if (!event?.id || !event?.data) return;
      events.push({
        id: String(event.id),
        kind: 'gira',
        title: String(event.titulo || 'Próxima gira da casa'),
        detail: event.descricao
          ? String(event.descricao)
          : `${event.tipo || 'Encontro'}${event.hora ? ` · ${String(event.hora).slice(0, 5)}` : ''}`,
        date: `${event.data}T${event.hora || '12:00:00'}`,
        tab: 'calendar',
        future: true,
      });
    });

    [...allChildren]
      .filter((child) => child?.id && child?.created_at)
      .sort(
        (a, b) =>
          new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
      )
      .slice(0, 4)
      .forEach((child) => {
        events.push({
          id: String(child.id),
          kind: 'member',
          title: `${String(child.nome || 'Novo membro')} passou a fazer parte da corrente`,
          detail: child.orixa_frente
            ? `Cadastro espiritual · ${String(child.orixa_frente)}`
            : 'Novo cadastro na comunidade da casa',
          date: String(child.created_at),
          tab: 'children',
        });
      });

    [...transactions]
      .filter((transaction) => transaction?.id && transaction?.data)
      .sort(
        (a, b) =>
          new Date(String(b.data)).getTime() - new Date(String(a.data)).getTime(),
      )
      .slice(0, 5)
      .forEach((transaction) => {
        const movement = normalizeMovimentoTipo(transaction.tipo);
        const amount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(transaction.valor) || 0);
        const category = String(transaction.categoria || '').trim();
        events.push({
          id: String(transaction.id),
          kind: 'finance',
          title:
            category.toLowerCase() === 'mensalidade'
              ? 'Mensalidade registrada'
              : movement === 'saida'
                ? 'Saída registrada no caixa'
                : 'Entrada registrada no caixa',
          detail: `${String(transaction.descricao || category || 'Movimentação financeira')} · ${amount}`,
          date: String(transaction.data),
          tab: 'financial',
        });
      });

    noticesData.slice(0, 4).forEach((notice) => {
      const date = String(notice.data_publicacao || notice.created_at || '');
      if (!notice?.id || !date) return;
      events.push({
        id: String(notice.id),
        kind: 'notice',
        title: 'Comunicado publicado para a corrente',
        detail: String(notice.titulo || notice.categoria || 'Novo aviso da casa'),
        date,
        tab: 'mural',
      });
    });

    pedidosData.slice(0, 4).forEach((pedido) => {
      if (!pedido?.id || !pedido?.created_at) return;
      const isPending = pedido.status === 'pendente';
      events.push({
        id: String(pedido.id),
        kind: 'care',
        title: isPending ? 'Novo pedido de reza recebido' : 'Pedido de reza acolhido',
        detail: `${String(pedido.nome || 'Fiel')} · ${String(pedido.categoria || pedido.linha || 'Acolhimento espiritual')}`,
        date: String(pedido.created_at),
        tab: 'atendimentos',
      });
    });

    return events
      .filter((event) => !Number.isNaN(new Date(event.date).getTime()))
      .sort((a, b) => {
        if (a.future !== b.future) return a.future ? -1 : 1;
        const first = new Date(a.date).getTime();
        const second = new Date(b.date).getTime();
        return a.future ? first - second : second - first;
      });
  }, [allChildren, noticesData, pedidosData, transactions, upcomingEvents]);
  const [directorsInvited, setDirectorsInvited] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('axecloud:onboarding-directors') === '1' : false,
  );

  const toggleDirectorsInvited = () => {
    setDirectorsInvited((current) => {
      const next = !current;
      localStorage.setItem('axecloud:onboarding-directors', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    const onFinanceUpdated = () => {
      void mutate();
    };
    window.addEventListener('axecloud:finance-updated', onFinanceUpdated);
    return () => window.removeEventListener('axecloud:finance-updated', onFinanceUpdated);
  }, [mutate]);

  useEffect(() => {
    let debounce: number | undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void (async () => {
          await ensureFreshAccessToken();
          await mutate();
        })();
      }, 350);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (debounce) window.clearTimeout(debounce);
    };
  }, [mutate, tenantId]);

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
        window.location.href = ROUTES.login;
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

  const staleDataBanner = Boolean(
    dashboardSwrKey && error && resolvedBundle && bundleHasMeaningfulData(resolvedBundle)
  );

  const terreiroNome = tenantData?.nome?.trim() || '';

  const now = new Date();
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = (terreiroNome.split(' ')[0] || 'Zelador').trim();
  const formattedDate = (() => {
    const raw = format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();
  // Casa viva em 3 passos (linguagem da casa, não do software).
  const pixOk = Boolean(String(pixConfig?.chave_pix || '').trim());
  const mensalidadeConfigurada =
    pixConfig?.mensalidade_ativa !== false && Number(pixConfig?.valor_mensalidade) > 0;
  const setupStepsV5: SetupStepV5[] = [
    {
      id: 'corrente',
      label: 'Corrente',
      detail: 'Cadastre ao menos uma pessoa da casa',
      done: allChildren.length > 0,
      tab: 'children',
    },
    {
      id: 'dinheiro',
      label: 'Mensalidade',
      detail: 'Chave Pix e valor para receber a contribuição',
      done: pixOk && mensalidadeConfigurada,
      tab: 'financial-configs',
    },
    {
      id: 'agenda',
      label: 'Agenda',
      detail: 'Marque uma gira para a corrente acompanhar',
      done: hasAnyGira,
      tab: 'calendar',
    },
  ];
  const setupDoneCount = setupStepsV5.filter((step) => step.done).length;
  const setupProgressV5 = Math.round((setupDoneCount / setupStepsV5.length) * 100);
  const setupPendingSteps = setupStepsV5.filter((step) => !step.done);
  const nextSetupStep = setupPendingSteps[0] ?? null;
  const setupComplete = setupPendingSteps.length === 0;

  // Uma missão por sessão: o que a casa precisa agora.
  const houseMission: HouseMission = (() => {
    if (!setupComplete && nextSetupStep) {
      return {
        title: nextSetupStep.label,
        detail: nextSetupStep.detail,
        cta:
          nextSetupStep.id === 'corrente'
            ? 'Cadastrar pessoa'
            : nextSetupStep.id === 'dinheiro'
              ? 'Configurar mensalidade'
              : 'Marcar gira',
        tab: nextSetupStep.tab,
      };
    }
    if (withoutAppAccess > 0) {
      return {
        title: 'Ativar acesso da corrente',
        detail:
          withoutAppAccess === 1
            ? '1 pessoa ainda não entrou no app · Registro + 6 dígitos do CPF'
            : `${withoutAppAccess} pessoas ainda não entraram no app · Registro + 6 dígitos do CPF`,
        cta: 'Enviar acesso',
        tab: 'children',
      };
    }
    if (pendingMensalidades > 0) {
      return {
        title: 'Cobrar mensalidades',
        detail: `${pendingMensalidades} pessoa${pendingMensalidades === 1 ? '' : 's'} ainda sem confirmação neste mês`,
        cta: 'Ver cobranças',
        tab: 'financial-mensalidades',
      };
    }
    if (pendingRezas > 0) {
      return {
        title: 'Acolher pedidos de reza',
        detail: `${pendingRezas} pedido${pendingRezas === 1 ? '' : 's'} esperando resposta da casa`,
        cta: 'Ver pedidos',
        tab: 'atendimentos',
      };
    }
    if (!nextEvent) {
      return {
        title: 'Marcar a próxima gira',
        detail: 'A corrente fica alinhada quando a agenda está clara',
        cta: 'Abrir agenda',
        tab: 'calendar',
      };
    }
    return {
      title: nextEvent.titulo,
      detail: `Próxima gira em ${format(new Date(`${nextEvent.data}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}${nextEvent.hora ? ` · ${nextEvent.hora.slice(0, 5)}` : ''}`,
      cta: 'Ver gira',
      tab: 'calendar',
    };
  })();

  return (
    <AppPageShell>
      <div className="dashboard-v5">
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
      {staleDataBanner && !fetchFailed && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
          <p className="text-[11px] font-medium text-gray-400">
            Exibindo últimos dados salvos. Toque em recarregar se algo parecer desatualizado.
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="text-[10px] font-black uppercase tracking-widest text-primary"
          >
            Recarregar
          </button>
        </div>
      )}

      <section className="dashboard-v5-hero mb-6 overflow-hidden rounded-[2rem]" aria-labelledby="dashboard-v5-title">
        <div className="dashboard-v5-hero__content">
          <div className="min-w-0">
            <p className="dashboard-v5-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {setupComplete ? 'Sua casa hoje' : 'Primeiros passos da casa'}
            </p>
            <h1 id="dashboard-v5-title" className="mt-3 font-display text-3xl font-black tracking-[-0.035em] text-[#FFFDF7] sm:text-4xl">
              {timeGreeting}, {firstName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-[#D8E0D7]">
              {formattedDate}. Agora: <span className="text-[#FFFDF7]">{houseMission.title.toLowerCase()}</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button type="button" onClick={() => setActiveTab(houseMission.tab)} className="dashboard-v5-hero__primary">
                {houseMission.tab === 'children' ? (
                  <Users className="h-4 w-4" aria-hidden />
                ) : houseMission.tab.startsWith('financial') ? (
                  <Wallet className="h-4 w-4" aria-hidden />
                ) : houseMission.tab === 'atendimentos' ? (
                  <HandHeart className="h-4 w-4" aria-hidden />
                ) : (
                  <CalendarDays className="h-4 w-4" aria-hidden />
                )}
                {houseMission.cta}
              </button>
              <button type="button" onClick={() => setActiveTab('children')} className="dashboard-v5-hero__secondary">
                Ver corrente
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="dashboard-v5-hero__moment">
            <div className="flex items-center justify-between gap-3">
              <span className="dashboard-v5-hero__moment-label">Missão de agora</span>
              <Landmark className="h-4 w-4 text-[#E8C767]" aria-hidden />
            </div>
            <p className="mt-5 text-2xl font-black leading-tight text-white">{houseMission.title}</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-[#B8C5BB]">
              {houseMission.detail}
            </p>
            <div className="mt-5 h-px bg-white/10" />
            <p className="mt-4 text-xs font-semibold leading-relaxed text-[#AEBBAF]">
              “Organização também é uma forma de cuidado.”
            </p>
          </div>
        </div>
      </section>

      <PreceitoCommandCenter tenantId={tenantId} />

      <DashboardSystemInsightCard
        tenantId={tenantId}
        userEmail={user?.email}
        userRole={userRole}
        zeladorFirstName={
          String(tenantData?.cargo || user?.user_metadata?.nome_zelador || "Alex")
            .trim()
            .split(/\s+/)[0] || "Alex"
        }
      />

      <div className="dashboard-v5-home grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <div className="space-y-5">
          <section className="dashboard-v5-module-launcher" aria-labelledby="quick-access-v5">
            <div className="dashboard-v5-section-heading">
              <div>
                <p className="dashboard-v5-section-kicker">Da casa</p>
                <h2 id="quick-access-v5">Onde cuidar</h2>
              </div>
              <p>Escolha só o que precisa agora.</p>
            </div>
            <div className="dashboard-v5-module-grid">
              {[
                { label: 'Corrente', detail: `${allChildren.length} pessoas`, icon: Users, tab: 'children', tone: 'blue' },
                { label: 'Giras', detail: nextEvent ? 'próxima marcada' : 'marcar gira', icon: CalendarDays, tab: 'calendar', tone: 'gold' },
                { label: 'Mensalidades', detail: pendingMensalidades > 0 ? `${pendingMensalidades} pendentes` : 'em dia', icon: Wallet, tab: 'financial', tone: 'green' },
                { label: 'Avisos', detail: noticesData.length > 0 ? `${noticesData.length} no mural` : 'avisar a casa', icon: Megaphone, tab: 'mural', tone: 'terra' },
                { label: 'Galeria', detail: 'fotos da casa', icon: Images, tab: 'gallery', tone: 'violet' },
                { label: 'Almoxarifado', detail: 'itens da casa', icon: Package, tab: 'inventory', tone: 'blue' },
                { label: 'Biblioteca', detail: 'estudo e tradição', icon: BookOpen, tab: 'library', tone: 'gold' },
                { label: 'Rezas', detail: pendingRezas > 0 ? `${pendingRezas} aguardando` : 'nenhum pedido', icon: HandHeart, tab: 'atendimentos', tone: 'terra' },
              ].map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.label}
                    type="button"
                    onClick={() => setActiveTab(module.tab)}
                    className="dashboard-v5-module"
                    data-tone={module.tone}
                  >
                    <span className="dashboard-v5-module__icon"><Icon className="h-5 w-5" aria-hidden /></span>
                    <span className="min-w-0">
                      <strong>{module.label}</strong>
                      <small>{module.detail}</small>
                    </span>
                    <ArrowUpRight className="dashboard-v5-module__arrow h-4 w-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="dashboard-v5-routine" aria-labelledby="routine-v5">
            <div className="dashboard-v5-section-heading">
              <div>
                <p className="dashboard-v5-section-kicker">Hoje</p>
                <h2 id="routine-v5">O que pede atenção</h2>
              </div>
              <p>Só o que a casa precisa olhar agora.</p>
            </div>
            <div className="dashboard-v5-routine-list">
              {[
                withoutAppAccess > 0
                  ? {
                      label:
                        withoutAppAccess === 1
                          ? '1 pessoa ainda não entrou no app'
                          : `${withoutAppAccess} pessoas ainda não entraram no app`,
                      detail: 'Enviar acesso · entram com Registro + 6 dígitos do CPF',
                      tab: 'children',
                      status: 'Ativar',
                      tone: 'gold',
                    }
                  : null,
                pendingMensalidades > 0
                  ? {
                      label: 'Há mensalidades para confirmar',
                      detail: `${pendingMensalidades} pessoa${pendingMensalidades === 1 ? '' : 's'} · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingMensalidadesValue)}`,
                      tab: 'financial-mensalidades',
                      status: 'Cobrar',
                      tone: 'gold',
                    }
                  : {
                      label: 'Mensalidades em dia',
                      detail: 'Ninguém aguardando confirmação agora',
                      tab: 'financial-mensalidades',
                      status: 'Em dia',
                      tone: 'green',
                    },
                nextEvent
                  ? {
                      label: nextEvent.titulo,
                      detail: `Gira em ${format(new Date(`${nextEvent.data}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}`,
                      tab: 'calendar',
                      status: 'Agenda',
                      tone: 'blue',
                    }
                  : {
                      label: 'Ainda sem próxima gira',
                      detail: 'Marque a data e avise a corrente',
                      tab: 'calendar',
                      status: 'Marcar',
                      tone: 'blue',
                    },
                withoutAppAccess > 0
                  ? null
                  : pendingRezas > 0
                    ? {
                        label: `${pendingRezas} pedido${pendingRezas === 1 ? '' : 's'} de reza`,
                        detail: 'Pessoas aguardando acolhimento da casa',
                        tab: 'atendimentos',
                        status: 'Acolher',
                        tone: 'terra',
                      }
                    : {
                        label: 'Pedidos de reza em dia',
                        detail: 'Nenhum pedido aguardando agora',
                        tab: 'atendimentos',
                        status: 'Em dia',
                        tone: 'green',
                      },
              ]
                .filter(Boolean)
                .map((item, index) => (
                <button key={`${item!.label}-${index}`} type="button" onClick={() => setActiveTab(item!.tab)} className="dashboard-v5-routine-item" data-tone={item!.tone}>
                  <span className="dashboard-v5-routine-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <strong>{item!.label}</strong>
                    <small>{item!.detail}</small>
                  </span>
                  <span className="dashboard-v5-routine-status">{item!.status}</span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          {!setupComplete ? (
          <section className="dashboard-v5-progress" aria-labelledby="progress-v5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dashboard-v5-section-kicker">Casa viva</p>
                <h2 id="progress-v5">Sua casa em 3 passos</h2>
              </div>
              <TrendingUp className="h-5 w-5 text-[#D8AD37]" aria-hidden />
            </div>
            <div className="dashboard-v5-progress__body">
              <div className="dashboard-v5-progress__ring" style={{ '--progress': `${setupProgressV5 * 3.6}deg` } as React.CSSProperties}>
                <span>{setupProgressV5}%</span>
              </div>
              <div>
                <strong>
                  {`${setupDoneCount} de ${setupStepsV5.length} passos`}
                </strong>
                <p>
                  Só o essencial: corrente, mensalidade e uma gira.
                </p>
              </div>
            </div>
            <ul className="dashboard-v5-progress__steps" aria-label="Passos da casa">
              {setupStepsV5.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(step.tab)}
                    className={cn(
                      'dashboard-v5-progress__step',
                      step.done && 'is-done',
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="dashboard-v5-progress__step-label block">{step.label}</span>
                      {!step.done ? (
                        <small className="dashboard-v5-progress__step-detail">{step.detail}</small>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {nextSetupStep ? (
              <button
                type="button"
                onClick={() => setActiveTab(nextSetupStep.tab)}
                className="dashboard-v5-progress__action"
              >
                Fazer agora: {nextSetupStep.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </section>
          ) : null}

          <section className="dashboard-v5-message">
            <p className="dashboard-v5-section-kicker">Mensagem da casa</p>
            <blockquote>“Organizar é abrir espaço para cuidar melhor de cada pessoa da corrente.”</blockquote>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span>AxéCloud</span>
              <Sparkles className="h-4 w-4 text-[#E8C767]" aria-hidden />
            </div>
          </section>

          <section className="dashboard-v5-current">
            <div>
              <p className="dashboard-v5-section-kicker">Sua corrente</p>
              <h2>Quem faz a casa</h2>
            </div>
            <div className="mt-5 flex items-center">
              {childrenData.slice(0, 5).map((filho, index) => (
                <Avatar
                  key={filho.id}
                  src={filho.foto_url}
                  name={filho.nome}
                  shape="circle"
                  textSize="text-xs"
                  className={cn('h-10 w-10 border-2 border-[#FFFDF8]', index > 0 && '-ml-2.5')}
                />
              ))}
              <button type="button" onClick={() => setActiveTab('children')} className="ml-3 text-xs font-black text-[#526A55]">
                Ver {allChildren.length} pessoas
              </button>
            </div>
          </section>
        </aside>
      </div>

      <HouseTimeline events={houseTimelineEvents} onNavigate={setActiveTab} />

      {/* Painel administrativo antigo: substituído pela home V5 e oculto via CSS.
          Não montar evita DOM morto e os warnings de 0x0 do Recharts no console. */}
      {SHOW_LEGACY_DASHBOARD && (
      <div className="dashboard-v5-legacy">
      <section className="app-metric-rail mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo da casa">
        {[
          {
            label: 'Filhos ativos',
            value: String(allChildren.length),
            helper: allChildren.length === 1 ? 'pessoa na corrente' : 'pessoas na corrente',
            icon: Users,
            accent: 'text-sky-300',
            iconBg: 'border-sky-400/20 bg-sky-400/10',
            action: () => setActiveTab('children'),
          },
          {
            label: 'Cobranças pendentes',
            value: String(pendingMensalidades),
            helper:
              pendingMensalidades > 0
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingMensalidadesValue)
                : 'nenhuma pendência',
            icon: Wallet,
            accent: pendingMensalidades > 0 ? 'text-amber-300' : 'text-[#CBD5E1]',
            iconBg:
              pendingMensalidades > 0
                ? 'border-amber-400/20 bg-amber-400/10'
                : 'border-white/10 bg-white/[0.04]',
            action: () => setActiveTab('financial'),
          },
          {
            label: 'Avisos recentes',
            value: String(noticesData.length),
            helper: noticesData.length === 1 ? 'comunicado publicado' : 'comunicados publicados',
            icon: Megaphone,
            accent: 'text-violet-300',
            iconBg: 'border-violet-400/20 bg-violet-400/10',
            action: () => setActiveTab('mural'),
          },
          {
            label: 'Pedidos de reza',
            value: String(pedidosData.filter((pedido) => pedido.status === 'pendente').length),
            helper: 'aguardando acolhimento',
            icon: Heart,
            accent: 'text-rose-300',
            iconBg: 'border-rose-400/20 bg-rose-400/10',
            action: () => setActiveTab('atendimentos'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="group rounded-2xl border border-[#252C35] bg-[#151A21] p-4 text-left shadow-[0_18px_44px_-34px_rgba(0,0,0,0.9)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-[#181E26] sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl border', item.iconBg)}>
                  <Icon className={cn('h-5 w-5', item.accent)} aria-hidden />
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-[#475569] transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#AAB4C2]">
                {item.label}
              </p>
              <p className="mt-1 truncate font-display text-2xl font-black tracking-tight text-[#F8FAFC] sm:text-3xl">
                {item.value}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-[#7F8B9C]">{item.helper}</p>
            </button>
          );
        })}
      </section>

      <section className="app-command-strip mb-6 rounded-2xl border border-[#252C35] bg-[#12161A] p-3 sm:p-4" aria-label="Ações rápidas">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="shrink-0 px-1 xl:w-44">
            <p className="text-sm font-extrabold text-[#F8FAFC]">Ações rápidas</p>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">Resolva a rotina em poucos cliques.</p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
            {[
              allChildren.length === 0
                ? { label: 'Cadastrar primeiro filho', icon: Users, tab: 'children', primary: true }
                : pendingMensalidades > 0
                  ? { label: 'Revisar cobranças', icon: Wallet, tab: 'financial', primary: true }
                  : !nextEvent
                    ? { label: 'Agendar próxima gira', icon: CalendarDays, tab: 'calendar', primary: true }
                    : { label: 'Publicar novo aviso', icon: Megaphone, tab: 'mural', primary: true },
              { label: 'Cadastrar filho', icon: Users, tab: 'children', primary: false },
              { label: 'Lançar movimentação', icon: Wallet, tab: 'financial', primary: false },
              { label: 'Criar gira', icon: CalendarDays, tab: 'calendar', primary: false },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => setActiveTab(action.tab)}
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-bold transition-all sm:px-4',
                    action.primary
                      ? 'border-primary bg-primary text-[#17130D] shadow-sm hover:bg-[#FFD34E]'
                      : 'border-[#252C35] bg-[#181D24] text-[#CBD5E1] hover:border-primary/30 hover:bg-primary/[0.08] hover:text-[#F8FAFC]',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', action.primary ? 'text-[#17130D]' : 'text-primary')} aria-hidden />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="app-focus-board mb-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#252C35] bg-[#11151A] p-5 text-[#F8FAFC]" aria-labelledby="attention-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">Prioridades</p>
              <h2 id="attention-title" className="mt-1 text-lg font-black">O que precisa de atenção</h2>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden />
          </div>
          <div className="space-y-2">
            {[
              pendingMensalidades > 0
                ? { label: `${pendingMensalidades} cobrança${pendingMensalidades === 1 ? '' : 's'} pendente${pendingMensalidades === 1 ? '' : 's'}`, detail: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingMensalidadesValue), tab: 'financial-mensalidades', color: 'text-amber-300' }
                : null,
              pendingRezas > 0
                ? { label: `${pendingRezas} pedido${pendingRezas === 1 ? '' : 's'} de reza`, detail: 'aguardando acolhimento', tab: 'atendimentos', color: 'text-rose-300' }
                : null,
              !nextEvent
                ? { label: 'Próxima gira não agendada', detail: 'organize o calendário da casa', tab: 'calendar', color: 'text-sky-300' }
                : null,
              incompleteProfiles > 0
                ? { label: `${incompleteProfiles} cadastro${incompleteProfiles === 1 ? '' : 's'} incompleto${incompleteProfiles === 1 ? '' : 's'}`, detail: 'faltam contato ou nascimento', tab: 'children', color: 'text-violet-300' }
                : null,
            ].filter(Boolean).map((item) => item && (
              <button key={item.label} type="button" onClick={() => setActiveTab(item.tab)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-left transition hover:border-primary/25 hover:bg-white/[0.06]">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full bg-current', item.color)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{item.label}</span>
                  <span className="block text-xs font-semibold text-[#7F8B9C]">{item.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#64748B]" aria-hidden />
              </button>
            ))}
            {pendingMensalidades === 0 && pendingRezas === 0 && nextEvent && incompleteProfiles === 0 ? (
              <div className="flex min-h-24 items-center justify-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-200">Tudo em ordem por aqui.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#252C35] bg-[#11151A] p-5 text-[#F8FAFC]" aria-labelledby="onboarding-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Primeiros passos</p>
              <h2 id="onboarding-title" className="mt-1 text-lg font-black">Prepare sua casa no AxéCloud</h2>
            </div>
            <Settings className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Cadastrar um filho', done: allChildren.length > 0, tab: 'children' },
              { label: 'Configurar chave Pix', done: Boolean(String(pixConfig?.chave_pix || '').trim()), tab: 'financial-configs' },
              { label: 'Ativar mensalidade', done: mensalidadeConfigurada, tab: 'financial-configs' },
              { label: 'Agendar primeira gira', done: hasAnyGira, tab: 'calendar' },
              { label: 'Publicar primeiro aviso', done: noticesData.length > 0, tab: 'mural' },
              { label: 'Convidar diretoria', done: directorsInvited, tab: 'settings', manual: true },
            ].map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={() => step.manual ? toggleDirectorsInvited() : setActiveTab(step.tab)}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-bold transition',
                  step.done
                    ? 'border-emerald-400/15 bg-emerald-400/[0.05] text-[#9CA8B8]'
                    : 'border-white/10 bg-white/[0.035] text-white hover:border-primary/30',
                )}
              >
                {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-[#64748B]" />}
                <span className={cn(step.done && 'line-through decoration-[#64748B]')}>{step.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#64748B]">O item “Convidar diretoria” pode ser marcado manualmente.</p>
        </section>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Section (65%) */}
        <div className="space-y-6 lg:col-span-8">
          
          {/* Card: entradas + fluxo financeiro */}
          <div className="app-v3-panel group relative overflow-hidden p-5 sm:p-6">
            <div className="relative z-10 flex justify-between items-start gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-300 leading-snug">
                  Movimentação financeira
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <div><p className="text-xs font-semibold text-gray-500">Entradas</p><p className="text-lg font-black text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.totalReceita)}</p></div>
                  <div><p className="text-xs font-semibold text-gray-500">Saídas</p><p className="text-lg font-black text-rose-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.totalDespesa)}</p></div>
                  <div><p className="text-xs font-semibold text-gray-500">Saldo líquido</p><p className={cn('text-lg font-black', stats.lucroLiquido >= 0 ? 'text-primary' : 'text-rose-400')}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.lucroLiquido)}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs font-bold leading-snug">
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

            <div className="relative z-10 h-44 w-full min-w-0 sm:h-48">
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
                  <ComposedChart
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
                      domain={[-activeFlowYMax, activeFlowYMax]}
                      tickCount={6}
                      width={48}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{ background: '#0B0D11', border: '1px solid #303844', borderRadius: 12 }}
                      labelStyle={{ color: '#F8FAFC', fontWeight: 800 }}
                      formatter={(value: number, name: string) => [
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                        name === 'entradas' ? 'Entradas' : name === 'saidas' ? 'Saídas' : 'Saldo',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="entradas"
                      stroke="#34D399"
                      strokeWidth={2}
                      fill="#34D399"
                      fillOpacity={0.12}
                      dot={false}
                      isAnimationActive={!reduceChartGpu}
                      animationDuration={reduceChartGpu ? 0 : 800}
                    />
                    <Area
                      type="monotone"
                      dataKey="saidas"
                      stroke="#FB7185"
                      strokeWidth={2}
                      fill="#FB7185"
                      fillOpacity={0.1}
                      dot={false}
                      isAnimationActive={!reduceChartGpu}
                    />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      stroke="#FFC107"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#FFC107', strokeWidth: 0 }}
                      isAnimationActive={!reduceChartGpu}
                    />
                  </ComposedChart>
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
                {childrenData.length === 0 ? (
                  <div className="col-span-2 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[#303844] bg-black/15 px-5 text-center md:col-span-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10">
                      <Users className="h-6 w-6 text-primary" aria-hidden />
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-[#E2E8F0]">Comece cadastrando a corrente</p>
                    <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-[#64748B]">
                      Adicione os primeiros filhos de santo para organizar contatos, mensalidades e acessos ao portal.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('children')}
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-[#080A0D] transition-colors hover:bg-[#FFD34E]"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Cadastrar primeiro filho
                    </button>
                  </div>
                ) : null}
             </div>
          </div>
        </div>

        {/* Right Section (35%) */}
        <div className="space-y-6 lg:col-span-4">
          <section className="app-v3-panel p-5 sm:p-6" aria-labelledby="agenda-title">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                  <CalendarDays className="h-5 w-5 text-sky-300" aria-hidden />
                </div>
                <div>
                  <h3 id="agenda-title" className="text-lg font-black">Agenda e lembretes</h3>
                  <p className="text-xs font-bold text-[#7F8B9C]">Próximos compromissos da casa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className="text-xs font-black text-primary hover:underline"
              >
                Abrir agenda
              </button>
            </div>

            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {upcomingEvents.map((event, index) => {
                  const eventDate = new Date(`${event.data}T12:00:00`);
                  return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setActiveTab('calendar')}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:border-primary/25',
                      index === 0 ? 'border-primary/20 bg-primary/[0.07]' : 'border-white/10 bg-white/[0.025]',
                    )}
                  >
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-center', index === 0 ? 'border-primary/25 bg-primary/10 text-primary' : 'border-sky-400/20 bg-sky-400/10 text-sky-300')}>
                      <span className="text-base font-black leading-none">{format(eventDate, 'dd')}</span>
                      <span className="text-[9px] font-black uppercase leading-none">{format(eventDate, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{event.titulo}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#7F8B9C]">{event.hora ? `${event.hora.slice(0, 5)} · ` : ''}{index === 0 ? 'próximo evento' : event.tipo || 'compromisso'}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#64748B]" aria-hidden />
                  </button>
                )})}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-7 text-center">
                <CalendarDays className="mx-auto mb-2 h-7 w-7 text-sky-300/40" />
                <p className="text-sm font-bold text-gray-300">Nenhum evento agendado</p>
                <button type="button" onClick={() => setActiveTab('calendar')} className="mt-3 text-xs font-black text-primary hover:underline">Agendar primeira gira</button>
              </div>
            )}

            <div className="my-5 h-px bg-white/10" />
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cake className="h-4 w-4 text-violet-300" aria-hidden />
                <h4 className="text-sm font-black">Aniversariantes de {birthdayMonthLabel}</h4>
              </div>
              <button type="button" onClick={() => setActiveTab('children')} className="text-xs font-bold text-primary hover:underline">Ver membros</button>
            </div>
            {birthdayData.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {birthdayData.slice(0, 5).map((person) => (
                  <button key={person.id} type="button" onClick={() => { if (setSelectedChildId) { setSelectedChildId(person.id); setActiveTab('profile'); } }} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] py-1.5 pl-1.5 pr-3 hover:border-violet-300/30">
                    <Avatar src={person.foto_url} name={person.nome} shape="circle" textSize="text-xs" className="h-7 w-7" />
                    <span className="max-w-24 truncate text-xs font-bold text-white">{person.nome.split(' ')[0]} · {person.day}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white/[0.025] px-3 py-3 text-xs font-semibold text-[#7F8B9C]">Nenhum aniversariante neste mês.</p>
            )}
          </section>
        </div>

      </div>

      <div className="mt-8">
        <DashboardAcoesAdministrativas
          transactions={transactions}
          children={recentChildrenForActions}
          notices={noticesData}
          pedidos={pedidosData}
          onOpenFinancial={() => setActiveTab('financial')}
          onOpenMural={() => setActiveTab('mural')}
        />
      </div>
      </div>
      )}
      </div>
    </AppPageShell>
  );
}
