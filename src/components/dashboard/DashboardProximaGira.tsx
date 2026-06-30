import React from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { setCalendarFocusEventId } from '../../lib/calendarFocus';
import { excludeObrigacaoEvents } from '../../lib/calendarEventFilters';

export type DashboardNextEvent = {
  id: string;
  titulo: string;
  data: string;
  hora?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status_confirmacao?: string | null;
  banner_url?: string | null;
};

function formatHoraEvento(hora?: string | null): string {
  const raw = (hora || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return raw.slice(0, 5);
}

function tipoBadgeClass(tipo?: string | null) {
  switch (tipo) {
    case 'Festa':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
    case 'Obrigação':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    case 'Manutenção':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/25';
    case 'Gira':
      return 'bg-white/10 text-white border-white/15';
    default:
      return 'bg-primary/15 text-primary border-primary/25';
  }
}

type DashboardProximaGiraProps = {
  event: DashboardNextEvent | null;
  onOpenCalendar: () => void;
};

export function DashboardProximaGira({ event, onOpenCalendar }: DashboardProximaGiraProps) {
  const handleOpen = () => {
    if (event?.id) setCalendarFocusEventId(event.id);
    onOpenCalendar();
  };

  if (!event) {
    return (
      <div className="app-v3-panel overflow-hidden p-0">
        <div className="border-b border-[#1E242B] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight">Próxima gira</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                Agenda do terreiro
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center px-4 py-6 text-center sm:px-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[#2F3643] bg-[#12161A]">
            <CalendarIcon className="h-6 w-6 text-gray-600" aria-hidden />
          </div>
          <p className="text-xs font-bold text-gray-400">Nenhuma gira agendada</p>
          <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-gray-600">
            Cadastre a próxima gira ou festa no calendário para avisar a casa.
          </p>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15"
          >
            Abrir calendário
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const horaFmt = formatHoraEvento(event.hora);
  const eventDate = parseISO(event.data);
  const diaMes = format(eventDate, 'dd/MM', { locale: ptBR });
  const mesAbrev = format(eventDate, 'MMM', { locale: ptBR }).replace('.', '').toUpperCase();
  const diaNum = format(eventDate, 'd');
  const dataFmt = format(eventDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataFmtCap = dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1);
  const daysUntil = differenceInCalendarDays(eventDate, new Date());
  const countdownLabel =
    daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`;
  const descricao = (event.descricao || '').trim();
  const tipo = event.tipo || 'Evento';

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group app-v3-panel w-full overflow-hidden p-0 text-left transition-all hover:border-primary/25 hover:shadow-[0_0_40px_rgba(250,204,21,0.06)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#1E242B] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight">Próxima gira</h3>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
              Toque para ver no calendário
            </p>
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>

      <div className="flex gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        <div
          className="flex h-[3.25rem] w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border border-primary/25 bg-primary/10"
          aria-label={`Data: ${diaMes}`}
        >
          <span className="text-[8px] font-black uppercase tracking-wider text-primary">{mesAbrev}</span>
          <span className="text-xl font-black leading-none text-white tabular-nums">{diaNum}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest',
                tipoBadgeClass(tipo),
              )}
            >
              {tipo}
            </span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
              {countdownLabel}
            </span>
          </div>

          <h4 className="line-clamp-2 text-sm font-black leading-snug text-white">{event.titulo}</h4>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1 font-medium">
              <CalendarDays className="h-3 w-3 shrink-0 text-primary" aria-hidden />
              {dataFmtCap}
            </span>
            {horaFmt ? (
              <span className="inline-flex items-center gap-1 font-medium">
                <Clock className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                {horaFmt}
              </span>
            ) : null}
          </div>

          {descricao ? (
            <p className="line-clamp-2 text-[10px] leading-relaxed text-gray-500">{descricao}</p>
          ) : null}

          {event.status_confirmacao && event.status_confirmacao !== 'Confirmado' ? (
            <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
              {event.status_confirmacao}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#1E242B] px-4 py-2.5 sm:px-5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
          Ver detalhes e convidados
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">
          Calendário
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </button>
  );
}

export function pickNextUpcomingEvent(events: DashboardNextEvent[]): DashboardNextEvent | null {
  const now = Date.now();
  const parseEventDateTime = (e: DashboardNextEvent) => {
    const [y, m, d] = e.data.split('-').map(Number);
    const parts = (e.hora || '0:0').toString().split(':').map((p) => parseInt(p, 10) || 0);
    return new Date(y, m - 1, d, parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0);
  };

  return (
    excludeObrigacaoEvents(events)
      .filter((e) => {
        try {
          return parseEventDateTime(e).getTime() > now;
        } catch {
          return false;
        }
      })
      .sort((a, b) => parseEventDateTime(a).getTime() - parseEventDateTime(b).getTime())[0] ?? null
  );
}
