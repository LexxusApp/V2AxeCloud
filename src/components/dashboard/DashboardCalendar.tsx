import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { authFetch } from '../../lib/authenticatedFetch';
import { excludeObrigacaoEvents } from '../../lib/calendarEventFilters';
import { CALENDAR_EVENT_LEGEND, getCalendarEventCellClass } from '../../lib/calendarEventColors';
import { setCalendarFocusEventId } from '../../lib/calendarFocus';

export type DashboardCalendarEvent = {
  id: string;
  data: string;
  tipo?: string | null;
  titulo?: string | null;
};

type DashboardCalendarProps = {
  tenantId: string;
  onOpenCalendar: () => void;
};

async function fetchMonthEvents(
  tenantId: string,
  gridStart: Date,
  gridEnd: Date,
): Promise<DashboardCalendarEvent[]> {
  const start = format(gridStart, 'yyyy-MM-dd');
  const end = format(gridEnd, 'yyyy-MM-dd');
  const url = `/api/events?tenantId=${encodeURIComponent(tenantId)}&start=${start}&end=${end}&scope=calendar`;
  const response = await authFetch(url);
  if (!response.ok) return [];
  const { data } = (await response.json()) as { data?: DashboardCalendarEvent[] };
  return excludeObrigacaoEvents(data || []);
}

export function DashboardCalendar({ tenantId, onOpenCalendar }: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const { monthTitle, days, gridStart, gridEnd } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStartDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEndDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const rawMonth = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
    return {
      monthTitle: rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1),
      days: eachDayOfInterval({ start: gridStartDate, end: gridEndDate }),
      gridStart: gridStartDate,
      gridEnd: gridEndDate,
    };
  }, [currentMonth]);

  const monthKey = format(startOfMonth(currentMonth), 'yyyy-MM');
  const { data: events = [] } = useSWR(
    tenantId ? (['dashboard-calendar', tenantId, monthKey] as const) : null,
    () => fetchMonthEvents(tenantId, gridStart, gridEnd),
    { revalidateOnFocus: false, dedupingInterval: 5000 },
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DashboardCalendarEvent[]>();
    for (const event of events) {
      const key = event.data.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const handleDayClick = (day: Date, dayEvents: DashboardCalendarEvent[]) => {
    if (dayEvents.length > 0) {
      setCalendarFocusEventId(dayEvents[0].id);
    }
    onOpenCalendar();
  };

  const today = new Date();

  return (
    <div className="app-v3-panel p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenCalendar}
          className="text-left text-xl font-bold transition-colors hover:text-primary"
        >
          Calendário
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-primary">
        {monthTitle}
      </p>

      <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-center sm:gap-y-2">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
          <span key={day} className="col-span-1 text-[8px] font-bold uppercase text-gray-600 sm:text-[9px]">
            <span className="sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:inline">{day}</span>
          </span>
        ))}

        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isTodayCell = isSameDay(day, today);
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const hasEvents = dayEvents.length > 0;
          const primaryTipo = dayEvents[0]?.tipo;

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => handleDayClick(day, dayEvents)}
              title={
                hasEvents
                  ? dayEvents.map((e) => e.titulo || e.tipo || 'Evento').join(', ')
                  : undefined
              }
              className={cn(
                'flex min-h-[2rem] items-center justify-center rounded-md p-0.5 transition-colors sm:min-h-[2.25rem] sm:rounded-lg sm:p-1',
                !inMonth && 'opacity-35',
                isTodayCell && 'bg-primary text-black shadow-[0_0_15px_rgba(250,204,21,0.35)]',
                !isTodayCell && hasEvents && getCalendarEventCellClass(primaryTipo),
                !isTodayCell && !hasEvents && 'hover:bg-white/[0.04]',
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-bold sm:text-xs',
                  !inMonth && !hasEvents && !isTodayCell && 'text-gray-700',
                  !isTodayCell && !hasEvents && inMonth && 'text-gray-400',
                )}
              >
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-white/5 pt-4">
        {CALENDAR_EVENT_LEGEND.map((item) => (
          <div key={item.tipo} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', item.swatchClass)} aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
