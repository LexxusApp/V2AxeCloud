import { useId, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Cake,
  HandHeart,
  Megaphone,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  format,
  getDate,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import Avatar from '../Avatar';
import { ZeladorIdentityBadge } from '../ZeladorIdentityBadge';
import type { DashboardBundle } from '../../lib/fetchDashboardBundle';
import { sumTodayFlow } from '../../lib/fetchDashboardBundle';

type FlowPoint = { name: string; val: number };

type DashboardHomeProps = {
  tenantData?: any;
  setActiveTab: (tab: string) => void;
  setSelectedChildId?: (id: string) => void;
  bundle: DashboardBundle;
  stats: {
    totalReceita: number;
    totalDespesa: number;
    lucroLiquido: number;
    growthPct: number | null;
  };
  hasMonthFinanceData: boolean;
  activeFlowChart: FlowPoint[];
  activeFlowYMax: number;
  flowPeriod: '6months' | 'month';
  setFlowPeriod: (p: '6months' | 'month') => void;
  dashboardCalendar: { days: Date[]; monthTitle: string; anchor: Date };
  formattedDate: string;
  timeGreeting: string;
  firstName: string;
};

function money(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-white/[0.08] bg-[#141414] shadow-sm isolate',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <h3 className="text-[13px] font-bold text-white">{title}</h3>
        {action}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'gold' | 'sky' | 'emerald';
}) {
  const tones = {
    default: 'border-white/[0.08] bg-[#141414] text-white',
    gold: 'border-primary/25 bg-primary/10 text-primary',
    sky: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  };
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3', tones[tone])}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-[11px] text-zinc-600">{children}</p>;
}

function parseBirthDate(raw?: string | null): Date | null {
  if (!raw) return null;
  try {
    return parseISO(String(raw).slice(0, 10));
  } catch {
    return null;
  }
}

function idadeCompletando(birth: Date, ref: Date): number {
  return ref.getFullYear() - birth.getFullYear();
}

function isBirthdayOnDate(birth: Date, ref: Date): boolean {
  return birth.getMonth() === ref.getMonth() && birth.getDate() === ref.getDate();
}

function pedidoResumo(mensagem?: string): string {
  const text = String(mensagem || '').trim();
  if (!text) return 'Pedido de reza';
  const firstLine = text.split(/\r?\n/)[0]?.trim() || text;
  return firstLine.length > 48 ? `${firstLine.slice(0, 45)}…` : firstLine;
}

const PEDIDO_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_atendimento: 'Em reza',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export function DashboardHome({
  tenantData,
  setActiveTab,
  setSelectedChildId,
  bundle,
  stats,
  hasMonthFinanceData,
  activeFlowChart,
  activeFlowYMax,
  flowPeriod,
  setFlowPeriod,
  dashboardCalendar,
  formattedDate,
  timeGreeting,
  firstName,
}: DashboardHomeProps) {
  const flowGradientId = useId().replace(/:/g, '');
  const { childrenData, events, notices, pedidos, historyData, transactions } = bundle;
  const today = startOfDay(new Date());
  const anchor = dashboardCalendar.anchor;

  const pedidosPendentes = pedidos.filter((p) => p.status === 'pendente').length;
  const pedidosEmReza = pedidos.filter((p) => p.status === 'em_atendimento').length;
  const pedidosHoje = pedidos.filter((p) => {
    try {
      return isToday(new Date(p.created_at));
    } catch {
      return false;
    }
  }).length;
  const girasNoMes = events.length;

  const agendaHoje = events
    .filter((e) => {
      try {
        const d = parseISO(String(e.data).slice(0, 10));
        return isSameDay(d, today);
      } catch {
        return false;
      }
    })
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

  const proximasGiras = events
    .filter((e) => {
      try {
        const d = parseISO(String(e.data).slice(0, 10));
        return d >= today;
      } catch {
        return false;
      }
    })
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .slice(0, 4);

  const aniversarios = childrenData
    .map((c) => {
      const birth = parseBirthDate(c.data_nascimento);
      if (!birth || !isSameMonth(birth, anchor)) return null;
      return { child: c, birth };
    })
    .filter(Boolean)
    .sort((a, b) => getDate(a!.birth) - getDate(b!.birth)) as Array<{ child: (typeof childrenData)[0]; birth: Date }>;

  const mesAniversario = format(anchor, 'MMMM', { locale: ptBR });
  const mesAniversarioLabel = mesAniversario.charAt(0).toUpperCase() + mesAniversario.slice(1);

  const receberHoje = sumTodayFlow(transactions, 'entrada');
  const pagarHoje = sumTodayFlow(transactions, 'saida');

  return (
    <div className="dashboard-compact min-h-screen bg-transparent px-3 py-4 font-sans text-white sm:px-4 lg:px-6 lg:py-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{formattedDate}</p>
          <h1 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">
            {timeGreeting}, <span className="text-primary">{firstName}</span>
          </h1>
        </div>
        <div className="hidden sm:block">
          <ZeladorIdentityBadge tenantData={tenantData} />
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <KpiCard label="Filhos ativos" value={childrenData.length} tone="gold" />
        <KpiCard label="Pedidos de reza" value={pedidosPendentes} tone="sky" />
        <KpiCard label="Giras no mês" value={girasNoMes} />
        <KpiCard
          label="Lucro (total)"
          value={money(stats.lucroLiquido)}
          tone={stats.lucroLiquido >= 0 ? 'emerald' : 'default'}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-4">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-3 xl:col-span-8">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel
              title="Fluxo financeiro"
              action={
                <div className="flex rounded-lg border border-white/10 p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFlowPeriod('month')}
                    className={cn(
                      'rounded-md px-2 py-0.5',
                      flowPeriod === 'month' ? 'bg-primary text-black' : 'text-zinc-500',
                    )}
                  >
                    Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowPeriod('6months')}
                    className={cn(
                      'rounded-md px-2 py-0.5',
                      flowPeriod === '6months' ? 'bg-primary text-black' : 'text-zinc-500',
                    )}
                  >
                    6 meses
                  </button>
                </div>
              }
            >
              {!hasMonthFinanceData ? (
                <EmptyHint>Nenhum lançamento confirmado ainda.</EmptyHint>
              ) : (
                <div className="dashboard-chart relative h-28 w-full min-w-0 overflow-hidden sm:h-32">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={activeFlowChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={flowGradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FBBC00" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#FBBC00" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#262626" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#737373', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        domain={[0, activeFlowYMax]}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                      />
                      <Area
                        type="monotone"
                        dataKey="val"
                        stroke="#FBBC00"
                        strokeWidth={2}
                        fill={`url(#${flowGradientId})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-[11px]">
                <div>
                  <p className="text-zinc-500">Receitas</p>
                  <p className="font-bold text-emerald-400">{money(stats.totalReceita)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Despesas</p>
                  <p className="font-bold text-rose-400">{money(stats.totalDespesa)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Variação</p>
                  <p className="font-bold text-white">
                    {stats.growthPct != null ? `${stats.growthPct > 0 ? '+' : ''}${stats.growthPct}%` : '—'}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel
              title="Agenda de hoje"
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Ver calendário
                </button>
              }
            >
              {agendaHoje.length === 0 ? (
                <EmptyHint>Nenhuma gira ou evento para hoje.</EmptyHint>
              ) : (
                <ul className="space-y-2">
                  {agendaHoje.map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2 text-[12px]">
                      <span className="shrink-0 font-mono text-[11px] font-bold text-primary">
                        {ev.hora ? String(ev.hora).slice(0, 5) : '—'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-200">{ev.titulo}</p>
                        {ev.tipo ? <p className="text-[10px] text-zinc-600">{ev.tipo}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel
              title="Comunicados"
              className="lg:col-span-2"
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab('mural')}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                >
                  Mural <ChevronRight className="h-3 w-3" />
                </button>
              }
            >
              {notices.length === 0 ? (
                <EmptyHint>Nenhum aviso publicado.</EmptyHint>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {notices.slice(0, 4).map((n) => (
                    <li key={n.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px]">
                      <p className="truncate font-semibold text-zinc-200">{n.titulo}</p>
                      <p className="text-[10px] text-zinc-600">
                        {n.categoria || 'Geral'}
                        {n.data_publicacao
                          ? ` · ${format(new Date(n.data_publicacao), 'dd/MM', { locale: ptBR })}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            title="Filhos de santo"
            action={
              <button
                type="button"
                onClick={() => setActiveTab('children')}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Ver todos
              </button>
            }
          >
            {childrenData.length === 0 ? (
              <EmptyHint>Cadastre filhos de santo em Membros.</EmptyHint>
            ) : (
              <div className="dashboard-avatar-scroll flex gap-3 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {childrenData.slice(0, 12).map((filho) => (
                  <button
                    key={filho.id}
                    type="button"
                    onClick={() => {
                      setSelectedChildId?.(filho.id);
                      setActiveTab('profile');
                    }}
                    className="flex w-14 shrink-0 flex-col items-center gap-1"
                  >
                    <Avatar
                      src={filho.foto_url}
                      name={filho.nome}
                      shape="circle"
                      textSize="text-xs"
                      className="h-11 w-11 border border-white/10"
                    />
                    <span className="w-full truncate text-center text-[10px] font-semibold text-zinc-400">
                      {filho.nome.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel
              title="Pedidos de reza"
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab('atendimentos')}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                >
                  Ver todos <ChevronRight className="h-3 w-3" />
                </button>
              }
            >
              <p className="mb-3 text-[11px] text-zinc-500">
                <span className="font-semibold text-amber-400">Pendentes: {pedidosPendentes}</span>
                {' · '}
                <span className="font-semibold text-sky-400">Em reza: {pedidosEmReza}</span>
                {' · '}
                <span className="font-semibold text-zinc-400">Recebidos hoje: {pedidosHoje}</span>
              </p>
              {pedidos.length === 0 ? (
                <EmptyHint>Nenhum pedido recebido pelo portal do consulente.</EmptyHint>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {pedidos.slice(0, 6).map((p) => {
                    const dataLabel = format(new Date(p.created_at), "d MMM yy", { locale: ptBR });
                    return (
                      <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-zinc-100">
                            {p.nome}
                            <span className="font-normal text-zinc-500"> — </span>
                            <span className="font-normal text-zinc-400">{pedidoResumo(p.mensagem)}</span>
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                            {PEDIDO_STATUS_LABEL[p.status] || p.status}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium capitalize text-zinc-500">
                          {dataLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title={`Aniversariantes de ${mesAniversarioLabel}`}
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab('children')}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                >
                  Membros <ChevronRight className="h-3 w-3" />
                </button>
              }
            >
              {aniversarios.length === 0 ? (
                <EmptyHint>Nenhum aniversário em {mesAniversarioLabel.toLowerCase()}.</EmptyHint>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {aniversarios.slice(0, 8).map(({ child, birth }) => {
                    const dia = getDate(birth);
                    const hoje = isBirthdayOnDate(birth, today);
                    const dataLabel = format(birth, "dd 'de' MMMM", { locale: ptBR });
                    const idade = idadeCompletando(birth, anchor);
                    return (
                      <li key={child.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums',
                            hoje
                              ? 'bg-primary text-black ring-2 ring-primary/40'
                              : 'border border-white/10 bg-white/[0.04] text-zinc-300',
                          )}
                        >
                          {String(dia).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-bold text-zinc-100">{child.nome}</p>
                          <p className="text-[10px] text-zinc-500">
                            {dataLabel}
                            {idade > 0 ? ` · ${idade} ${idade === 1 ? 'ano' : 'anos'}` : ''}
                            {hoje ? (
                              <span className="ml-1 font-bold text-primary">· Hoje!</span>
                            ) : null}
                          </p>
                        </div>
                        {hoje ? (
                          <Cake className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChildId?.(child.id);
                              setActiveTab('profile');
                            }}
                            className="shrink-0"
                          >
                            <Avatar
                              src={child.foto_url}
                              name={child.nome}
                              shape="circle"
                              textSize="text-[9px]"
                              className="h-8 w-8 border border-white/10"
                            />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="min-w-0 space-y-3 xl:col-span-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-500">
                <ArrowUpRight className="h-3 w-3 text-emerald-400" /> A receber hoje
              </p>
              <p className="mt-1 text-sm font-black text-emerald-400">{money(receberHoje)}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-500">
                <ArrowDownRight className="h-3 w-3 text-rose-400" /> A pagar hoje
              </p>
              <p className="mt-1 text-sm font-black text-rose-400">{money(pagarHoje)}</p>
            </div>
          </div>

          <Panel title="Calendário">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-primary">
              {dashboardCalendar.monthTitle}
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
                <span key={`${d}-${i}`} className="text-[8px] font-bold text-zinc-600">
                  {d}
                </span>
              ))}
              {dashboardCalendar.days.map((day) => {
                const inMonth = isSameMonth(day, dashboardCalendar.anchor);
                const isTodayCell = isSameDay(day, new Date());
                const hasEvent = events.some((e) => {
                  try {
                    return isSameDay(parseISO(String(e.data).slice(0, 10)), day);
                  } catch {
                    return false;
                  }
                });
                const hasBirthday = childrenData.some((c) => {
                  const b = parseBirthDate(c.data_nascimento);
                  return b ? isBirthdayOnDate(b, day) : false;
                });
                return (
                  <span
                    key={day.toISOString()}
                    className={cn(
                      'relative flex h-7 items-center justify-center rounded-md text-[10px] font-semibold',
                      !inMonth && 'text-zinc-700 opacity-40',
                      inMonth && !isTodayCell && 'text-zinc-400',
                      isTodayCell && 'bg-primary font-black text-black',
                    )}
                  >
                    {format(day, 'd')}
                    {hasEvent && inMonth && !isTodayCell ? (
                      <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-[3px] rounded-full bg-primary" />
                    ) : null}
                    {hasBirthday && inMonth && !isTodayCell ? (
                      <span className="absolute bottom-0.5 left-1/2 h-1 w-1 translate-x-[3px] rounded-full bg-sky-400" />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Próximas giras"
            action={
              <CalendarDays className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
            }
          >
            {proximasGiras.length === 0 ? (
              <EmptyHint>Nenhuma gira agendada.</EmptyHint>
            ) : (
              <ul className="space-y-2">
                {proximasGiras.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate font-medium text-zinc-300">{ev.titulo}</span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                      {format(parseISO(String(ev.data).slice(0, 10)), 'dd/MM', { locale: ptBR })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Movimentações recentes">
            {historyData.length === 0 ? (
              <EmptyHint>Sem movimentações recentes.</EmptyHint>
            ) : (
              <ul className="space-y-2">
                {historyData.map((tx, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-zinc-500">{tx.descricao || 'Lançamento'}</span>
                    <span
                      className={cn(
                        'shrink-0 font-bold tabular-nums',
                        tx.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400',
                      )}
                    >
                      {tx.tipo === 'entrada' ? '+' : '−'}
                      {money(Number(tx.valor) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { tab: 'financial', label: 'Financeiro', icon: Wallet },
          { tab: 'children', label: 'Membros', icon: Users },
          { tab: 'calendar', label: 'Giras', icon: CalendarDays },
          { tab: 'mural', label: 'Comunicados', icon: Megaphone },
          { tab: 'atendimentos', label: 'Atendimentos', icon: HandHeart },
        ].map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-zinc-400 transition hover:border-primary/30 hover:text-primary"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
