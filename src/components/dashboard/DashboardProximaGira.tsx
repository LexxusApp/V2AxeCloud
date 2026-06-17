import React, { useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Sparkles,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { setCalendarFocusEventId } from '../../lib/calendarFocus';

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

function EventBanner({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full min-h-[11rem] w-full items-center justify-center bg-gradient-to-br from-primary/20 via-[#12161A] to-[#0B0D11]">
        <CalendarDays className="h-12 w-12 text-white/15" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-full min-h-[11rem] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
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
        <div className="border-b border-[#1E242B] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-bold">Próxima gira</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Agenda do terreiro
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-[#2F3643] bg-[#12161A]">
            <CalendarIcon className="h-8 w-8 text-gray-600" aria-hidden />
          </div>
          <p className="text-sm font-bold text-gray-400">Nenhuma gira agendada</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-gray-600">
            Cadastre a próxima obrigação ou festa no calendário para avisar a casa.
          </p>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15"
          >
            Abrir calendário
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const horaFmt = formatHoraEvento(event.hora);
  const dataFmt = format(parseISO(event.data), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const dataFmtCap = dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1);
  const daysUntil = differenceInCalendarDays(parseISO(event.data), new Date());
  const countdownLabel =
    daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`;
  const descricao = (event.descricao || '').trim();
  const tipo = event.tipo || 'Evento';
  const hasBanner = Boolean(event.banner_url?.trim());

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group app-v3-panel w-full overflow-hidden p-0 text-left transition-all hover:border-primary/25 hover:shadow-[0_0_40px_rgba(250,204,21,0.06)]"
    >
      <div className="flex items-center justify-between border-b border-[#1E242B] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-bold">Próxima gira</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
              Toque para ver no calendário
            </p>
          </div>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>

      <div className="relative overflow-hidden">
        {hasBanner ? (
          <EventBanner url={event.banner_url!} alt={event.titulo} />
        ) : (
          <div className="flex min-h-[11rem] w-full items-center justify-center bg-gradient-to-br from-primary/20 via-[#12161A] to-[#0B0D11]">
            <CalendarDays className="h-14 w-14 text-white/10" aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0D11] via-[#0B0D11]/55 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-2">
          <span
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm',
              tipoBadgeClass(tipo),
            )}
          >
            {tipo}
          </span>
          <span className="rounded-lg border border-primary/30 bg-black/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary backdrop-blur-sm">
            {countdownLabel}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-16">
          <h4 className="line-clamp-2 text-xl font-black leading-tight text-white">{event.titulo}</h4>
        </div>
      </div>

      <div className="space-y-3 px-6 py-5">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2.5 text-gray-300">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="font-semibold">{dataFmtCap}</span>
          </div>
          {horaFmt ? (
            <div className="flex items-center gap-2.5 text-gray-300">
              <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="font-semibold">{horaFmt}</span>
            </div>
          ) : null}
        </div>

        {descricao ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-gray-500">{descricao}</p>
        ) : null}

        {event.status_confirmacao && event.status_confirmacao !== 'Confirmado' ? (
          <span className="inline-flex rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">
            {event.status_confirmacao}
          </span>
        ) : null}

        <div className="flex items-center justify-between border-t border-[#1E242B] pt-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Ver detalhes e convidados
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            Calendário
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
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
    [...events]
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
