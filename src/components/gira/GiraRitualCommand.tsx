import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Flame,
  LayoutList,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Ticket,
  Trash2,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { format, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { CalendarEvent } from '../../views/Calendar';
import GiraPreparationCenter from './GiraPreparationCenter';
import {
  AxeBadge,
  AxeButton,
  AxeCard,
  AxeEmptyState,
  AxeMetricCard,
  AxeMetricRail,
  AxePageHeader,
} from '../shared/AxePageScaffold';

type ViewMode = 'agenda' | 'calendar';

type Props = {
  events: CalendarEvent[];
  agendaEvents: CalendarEvent[];
  nextEvent: CalendarEvent | null;
  eventsThisMonth: CalendarEvent[];
  calendarDays: Date[];
  currentMonth: Date;
  monthStart: Date;
  view: ViewMode;
  nextConfirmedCount: number;
  nextUnconfirmedCount: number;
  confirmationsByEvent: Record<string, unknown[]>;
  loading: boolean;
  isNotifying: string | null;
  hasAccess: boolean;
  fetchError: string | null;
  tenantId?: string;
  onNavigate: (tab: string) => void;
  onViewChange: (view: ViewMode) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onShare: () => void;
  onOpen: (event: CalendarEvent) => void;
  onNotify: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
  onOperations: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

function isPassed(event: CalendarEvent) {
  return new Date(`${event.data}T${event.hora || '23:59'}`).getTime() < Date.now();
}

function getToneVariant(type: string): 'emerald' | 'amber' | 'blue' | 'purple' {
  const value = type.toLowerCase();
  if (value.includes('obriga')) return 'purple';
  if (value.includes('festa')) return 'amber';
  if (value.includes('reuni')) return 'blue';
  return 'emerald';
}

function distance(event: CalendarEvent | null) {
  if (!event) return null;
  const date = new Date(`${event.data}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

export default function GiraRitualCommand(props: Props) {
  const {
    events,
    agendaEvents,
    nextEvent,
    eventsThisMonth,
    calendarDays,
    currentMonth,
    monthStart,
    view,
    nextConfirmedCount,
    nextUnconfirmedCount,
    confirmationsByEvent,
    loading,
    isNotifying,
    hasAccess,
    fetchError,
    tenantId,
    onNavigate,
    onViewChange,
    onCreate,
    onRefresh,
    onShare,
    onOpen,
    onNotify,
    onEdit,
    onOperations,
    onDelete,
    onPreviousMonth,
    onNextMonth,
    onToday,
  } = props;

  const days = distance(nextEvent);
  const upcoming = agendaEvents.filter((event) => !isPassed(event));
  const totalParticipation = nextConfirmedCount + nextUnconfirmedCount;
  const response = Math.round((nextConfirmedCount / Math.max(1, totalParticipation)) * 100);

  return (
    <div className="space-y-5">
      {/* 1. Unified Header */}
      <AxePageHeader
        kicker="Ritual · Calendário Litúrgico"
        title="Giras & Trabalhos"
        description="Giras não são apenas eventos: são movimentos sagrados da casa. Planeje o fundamento, mobilize a corrente e conduza cada etapa com excelência."
        actions={
          <>
            <AxeButton
              type="button"
              variant="ghost"
              onClick={onRefresh}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Atualizar</span>
            </AxeButton>
            <AxeButton
              type="button"
              variant="secondary"
              onClick={onShare}
              icon={Share2}
            >
              <span className="hidden sm:inline">Compartilhar</span>
            </AxeButton>
            <AxeButton
              type="button"
              variant="primary"
              onClick={onCreate}
              icon={Plus}
            >
              Criar gira
            </AxeButton>
          </>
        }
      />

      {fetchError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-black underline hover:text-red-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* 2. Unified KPI Rail */}
      <AxeMetricRail>
        <AxeMetricCard
          label="Giras no mês"
          value={eventsThisMonth.length}
          icon={CalendarDays}
          tone="emerald"
          subtext="programadas"
        />
        <AxeMetricCard
          label="Confirmados"
          value={nextConfirmedCount}
          icon={UserRoundCheck}
          tone="blue"
          subtext="na próxima gira"
        />
        <AxeMetricCard
          label="Sem resposta"
          value={nextUnconfirmedCount}
          icon={Users}
          tone="amber"
          subtext="aguardando"
        />
        <AxeMetricCard
          label="Próxima gira"
          value={
            days === null
              ? '—'
              : days === 0
              ? 'Hoje'
              : days === 1
              ? 'Amanhã'
              : `${days} dias`
          }
          icon={Flame}
          tone="purple"
          subtext={nextEvent ? nextEvent.titulo : 'Nenhuma gira'}
        />
      </AxeMetricRail>

      {/* 3. Hero Mission Card (Next Upcoming Gira) */}
      {nextEvent ? (
        <AxeCard className="overflow-hidden border-[#D8CDBA] p-0 shadow-[0_4px_20px_rgba(28,37,31,0.05)]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Visual Column / Banner */}
            <div className="relative min-h-[160px] bg-gradient-to-br from-[#1F5942] to-[#122A20] text-white p-6 flex flex-col justify-between lg:col-span-4 overflow-hidden">
              {nextEvent.banner_url ? (
                <img
                  src={nextEvent.banner_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
                />
              ) : (
                <div
                  className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[#B88728]/20 blur-2xl"
                  aria-hidden
                />
              )}

              <div className="relative z-10 flex items-center justify-between">
                <AxeBadge variant={getToneVariant(nextEvent.tipo)}>
                  {nextEvent.tipo}
                </AxeBadge>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {days === 0 ? 'Acontece hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`}
                </span>
              </div>

              <div className="relative z-10 mt-6 flex items-baseline gap-3">
                <span className="font-display text-5xl font-black tracking-tight tabular-nums text-white">
                  {format(parseISO(nextEvent.data), 'dd')}
                </span>
                <div>
                  <p className="font-display text-lg font-black uppercase tracking-wide text-amber-300">
                    {format(parseISO(nextEvent.data), 'MMMM', { locale: ptBR })}
                  </p>
                  <p className="text-xs text-white/70">
                    {format(parseISO(nextEvent.data), "EEEE", { locale: ptBR })} · {nextEvent.hora}
                  </p>
                </div>
              </div>
            </div>

            {/* Content & Actions Column */}
            <div className="p-5 sm:p-6 lg:col-span-8 flex flex-col justify-between space-y-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-black text-[#17251D]">
                  {nextEvent.titulo}
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#59655E] line-clamp-2">
                  {nextEvent.descricao || 'A preparação da próxima gira já pode começar.'}
                </p>

                {/* Participation Progress */}
                <div className="mt-4 rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD3]">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#17251D]">
                      Presença da corrente: <strong className="text-[#1F5942]">{nextConfirmedCount} confirmados</strong>
                      {nextUnconfirmedCount > 0 && ` · ${nextUnconfirmedCount} sem resposta`}
                    </span>
                    <span className="text-[#8A958E]">{response}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E6DFD3]">
                    <div
                      className="h-full rounded-full bg-[#1F5942] transition-all duration-500"
                      style={{ width: `${response}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F0EBE1]">
                <AxeButton
                  type="button"
                  variant="primary"
                  onClick={() => onOpen(nextEvent)}
                  icon={ArrowUpRight}
                  iconPosition="right"
                >
                  Abrir missão
                </AxeButton>
                <AxeButton
                  type="button"
                  variant="secondary"
                  style={{ backgroundColor: '#F2F8F4', color: '#174C37', borderColor: '#A6C8B5' }}
                  onClick={() => onNotify(nextEvent)}
                  disabled={isNotifying === nextEvent.id}
                  icon={Bell}
                  loading={isNotifying === nextEvent.id}
                >
                  Avisar WhatsApp
                </AxeButton>
                <AxeButton
                  type="button"
                  variant="ghost"
                  onClick={() => onOperations(nextEvent)}
                  disabled={!hasAccess}
                  icon={Ticket}
                >
                  Operação
                </AxeButton>
                <AxeButton
                  type="button"
                  variant="ghost"
                  onClick={() => onEdit(nextEvent)}
                  icon={Edit3}
                >
                  Editar gira
                </AxeButton>
              </div>
            </div>
          </div>
        </AxeCard>
      ) : (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                <span>✦</span>
                <span>Calendário Litúrgico & Trabalhos</span>
              </div>
              <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                Planeje as Giras da Casa com Excelência
              </h3>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                Cadastre os toques sagrados, defina a linha espiritual (Caboclo, Preto Velho, Exu) e envie convites automáticos no WhatsApp para os médiuns confirmarem presença.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <AxeButton
                  onClick={onCreate}
                  icon={Plus}
                  variant="primary"
                  size="lg"
                >
                  Criar primeira gira
                </AxeButton>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                <Flame className="h-5 w-5" />
              </div>
              <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                1. Linha & Fundamento
              </strong>
              <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                Defina a falange, cores de velas, firmezas de porteira e preceitos do dia.
              </p>
            </div>

            <div className="rounded-2xl border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                <Sparkles className="h-5 w-5" />
              </div>
              <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                2. Confirmação dos Filhos
              </strong>
              <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                Acompanhe em tempo real quem confirmou presença ou justificou ausência.
              </p>
            </div>

            <div className="rounded-2xl border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                <Ticket className="h-5 w-5" />
              </div>
              <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                3. Portaria & Senhas
              </strong>
              <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                Distribua senhas digitais para assistência e consulentes pelo celular.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Preparation Center */}
      {nextEvent && (
        <GiraPreparationCenter
          event={nextEvent}
          tenantId={tenantId}
          confirmedCount={nextConfirmedCount}
          unconfirmedCount={nextUnconfirmedCount}
          onNavigate={onNavigate}
          onOpenEvent={() => onOpen(nextEvent)}
        />
      )}

      {/* 5. View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#E6DFD3] bg-white p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onViewChange('agenda')}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all',
              view === 'agenda'
                ? 'border-[#1F5942] bg-[#1F5942] text-white shadow-xs'
                : 'border-transparent text-[#59655E] hover:border-[#E6DFD3] hover:text-[#17251D]',
            )}
          >
            <LayoutList className="h-4 w-4" />
            Linha ritual
          </button>
          <button
            type="button"
            onClick={() => onViewChange('calendar')}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all',
              view === 'calendar'
                ? 'border-[#1F5942] bg-[#1F5942] text-white shadow-xs'
                : 'border-transparent text-[#59655E] hover:border-[#E6DFD3] hover:text-[#17251D]',
            )}
          >
            <CalendarRange className="h-4 w-4" />
            Calendário mensal
          </button>
        </div>

        <span className="text-xs font-bold text-[#8A958E] px-2">
          {eventsThisMonth.length} {eventsThisMonth.length === 1 ? 'movimento' : 'movimentos'} neste mês
        </span>
      </div>

      {/* 6. View: Agenda (Linha Ritual) */}
      {view === 'agenda' ? (
        <section className="space-y-3" aria-label="Linha ritual da casa">
          {upcoming.length > 0 ? (
            upcoming.map((event, index) => {
              const confirmedCount = confirmationsByEvent[event.id]?.length || 0;
              return (
                <motion.article
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#E6DFD3] bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(28,37,31,0.03)] transition-all hover:border-[#D8CDBA] hover:shadow-[0_4px_16px_rgba(28,37,31,0.06)]"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Date Block */}
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] text-center">
                      <strong className="font-display text-lg font-black leading-none text-[#17251D] tabular-nums">
                        {format(parseISO(event.data), 'dd')}
                      </strong>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#B88728]">
                        {format(parseISO(event.data), 'MMM', { locale: ptBR })}
                      </span>
                    </div>

                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => onOpen(event)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <AxeBadge variant={getToneVariant(event.tipo)}>
                          {event.tipo}
                        </AxeBadge>
                        <h3 className="font-display text-base font-black text-[#17251D] group-hover:text-[#1F5942] transition-colors truncate">
                          {event.titulo}
                        </h3>
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#59655E] truncate">
                        <Clock className="h-3.5 w-3.5 text-[#8A958E]" />
                        {event.hora}
                        {event.descricao ? ` · ${event.descricao}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Confirmed Counter + Actions */}
                  <div className="flex items-center gap-3 sm:shrink-0 justify-between sm:justify-end border-t sm:border-t-0 border-[#F0EBE1] pt-2 sm:pt-0">
                    <div className="text-right">
                      <strong className="block font-display text-base font-black text-[#1F5942] tabular-nums">
                        {confirmedCount}
                      </strong>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A958E]">
                        confirmados
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onNotify(event)}
                        title="Avisar WhatsApp"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFD3] bg-white text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D]"
                      >
                        <Bell className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(event)}
                        title="Editar gira"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFD3] bg-white text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D]"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOperations(event)}
                        disabled={!hasAccess}
                        title="Operação e senhas"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFD3] bg-white text-[#59655E] hover:border-[#D8CDBA] hover:text-[#1F5942] disabled:opacity-40"
                      >
                        <Ticket className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(event)}
                        title="Excluir gira"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })
          ) : !events.length ? (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                    <span>✦</span>
                    <span>Calendário Litúrgico & Trabalhos</span>
                  </div>
                  <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                    Planeje as Giras da Casa com Excelência
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                    Cadastre os toques sagrados, defina a linha espiritual (Caboclo, Preto Velho, Exu) e envie convites automáticos no WhatsApp para os médiuns confirmarem presença.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <AxeButton
                      onClick={onCreate}
                      icon={Plus}
                      variant="primary"
                      size="lg"
                    >
                      Criar primeira gira
                    </AxeButton>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                    <Flame className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    1. Linha & Fundamento
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Defina a falange, cores de velas, firmezas de porteira e preceitos do dia.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    2. Confirmação dos Filhos
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Acompanhe em tempo real quem confirmou presença ou justificou ausência.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    3. Portaria & Senhas
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Distribua senhas digitais para assistência e consulentes pelo celular.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AxeEmptyState
              icon={CalendarDays}
              title="Nenhuma gira futura cadastrada"
              description="Cadastre a próxima gira para que os filhos de santo possam confirmar presença pelo app."
              action={{
                label: 'Criar gira',
                onClick: onCreate,
                icon: Plus,
              }}
            />
          )}
        </section>
      ) : (
        /* 7. View: Monthly Calendar */
        <section className="rounded-2xl border border-[#E6DFD3] bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(28,37,31,0.03)]" aria-label="Calendário mensal">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B88728]">Visão mensal</p>
              <h2 className="font-display text-lg sm:text-xl font-black capitalize text-[#17251D]">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <AxeButton type="button" variant="ghost" size="sm" onClick={onToday}>
                Hoje
              </AxeButton>
              <button
                type="button"
                onClick={onPreviousMonth}
                aria-label="Mês anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6DFD3] text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNextMonth}
                aria-label="Próximo mês"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6DFD3] text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-1 pb-2 border-b border-[#E6DFD3] text-center text-[11px] font-extrabold uppercase tracking-wider text-[#8A958E]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <span key={day} className="py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {calendarDays.map((day) => {
                  const dayEvents = events.filter((event) => isSameDay(parseISO(event.data), day));
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-[88px] rounded-xl border p-1.5 transition-colors flex flex-col justify-between',
                        isToday
                          ? 'border-[#1F5942] bg-[#E8F5EE]/30'
                          : isCurrentMonth
                          ? 'border-[#E6DFD3] bg-[#FAF7F2]/40 hover:bg-[#FAF7F2]'
                          : 'border-transparent bg-stone-50/50 opacity-40',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-black tabular-nums',
                            isToday
                              ? 'bg-[#1F5942] text-white'
                              : isCurrentMonth
                              ? 'text-[#17251D]'
                              : 'text-[#8A958E]',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-black text-[#1F5942]">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => onOpen(event)}
                            className="w-full truncate rounded-md bg-[#1F5942]/10 hover:bg-[#1F5942]/20 px-1.5 py-0.5 text-left text-[10px] font-bold text-[#1F5942] transition-colors"
                          >
                            {event.hora ? `${event.hora.slice(0, 5)} ` : ''}
                            {event.titulo}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="block text-[9px] font-bold text-[#8A958E] px-1">
                            +{dayEvents.length - 2} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
