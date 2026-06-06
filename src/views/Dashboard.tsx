import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LuxuryLoading from '../components/LuxuryLoading';
import { supabase } from '../lib/supabase';
import {
  countsTowardSaldo,
  isLancamentoNoMesRef,
  normalizeMovimentoTipo,
  parseFinanceiroDataRef,
} from '../lib/financeiroSaldo';
import { resolveTenantIdForFinance } from '../lib/tenantCache';
import { fetchDashboardBundle, type DashboardBundle } from '../lib/fetchDashboardBundle';
import { DashboardHome } from '../components/dashboard/DashboardHome';

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

  const dashboardSwrKey =
    user?.id && tenantId
      ? (['dashboard-finance', user.id, tenantId, userRole] as const)
      : null;
  const { data: dashboardBundle, isLoading, isValidating, error, mutate } = useSWR(
    dashboardSwrKey,
    () => fetchDashboardBundle(user!, tenantId, userRole, tenantData?.tenant_id),
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
    <>
      {fetchFailed && (
        <div className="mx-3 mb-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:mx-4 lg:mx-6">
          <p className="text-sm font-medium text-amber-200">
            Não foi possível carregar os dados do terreiro. Verifique a conexão ou tente de novo.
          </p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-black"
          >
            Recarregar
          </button>
        </div>
      )}

      {resolvedBundle ? (
        <DashboardHome
          tenantData={tenantData}
          setActiveTab={setActiveTab}
          setSelectedChildId={setSelectedChildId}
          bundle={resolvedBundle}
          stats={stats}
          hasMonthFinanceData={hasMonthFinanceData}
          activeFlowChart={activeFlowChart}
          activeFlowYMax={activeFlowYMax}
          flowPeriod={flowPeriod}
          setFlowPeriod={setFlowPeriod}
          dashboardCalendar={dashboardCalendar}
          formattedDate={formattedDate}
          timeGreeting={timeGreeting}
          firstName={firstName}
        />
      ) : null}
    </>
  );
}
