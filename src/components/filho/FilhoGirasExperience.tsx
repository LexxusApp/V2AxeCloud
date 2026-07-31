import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent } from '../../views/Calendar';

type Participation = { status: string | null; id: string };

type Props = {
  events: CalendarEvent[];
  currentMonth: Date;
  loading: boolean;
  error: string | null;
  participations: Record<string, Participation>;
  busyEventId: string | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onRefresh: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onRespond: (eventId: string, action: 'confirmar' | 'declinar') => void;
};

function eventDate(event: CalendarEvent) {
  const time = String(event.hora || '12:00').slice(0, 5);
  return new Date(`${event.data}T${time || '12:00'}`);
}

function timeLabel(value?: string) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

export default function FilhoGirasExperience({
  events,
  currentMonth,
  loading,
  error,
  participations,
  busyEventId,
  onPreviousMonth,
  onNextMonth,
  onRefresh,
  onOpenEvent,
  onRespond,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const now = Date.now();
  const sorted = useMemo(() => [...events].sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime()), [events]);
  const next = sorted.find((event) => eventDate(event).getTime() >= now) || null;
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
    [currentMonth],
  );
  const displayed = selectedDay
    ? sorted.filter((event) => isSameDay(parseISO(event.data), selectedDay))
    : sorted;
  const confirmed = sorted.filter((event) => participations[event.id]?.status === 'confirmado').length;

  const responseButtons = (event: CalendarEvent, compact = false) => {
    const participation = participations[event.id]?.status;
    const passed = eventDate(event).getTime() < now;
    if (passed) return <span className="filho-giras-status is-past">Encontro realizado</span>;
    if (participation === 'confirmado' || participation === 'presente') {
      return <span className="filho-giras-status is-confirmed"><Check /> Presença confirmada</span>;
    }
    if (participation === 'recusado') {
      return <span className="filho-giras-status is-declined">Você informou que não irá</span>;
    }
    return (
      <div className={`filho-giras-response ${compact ? 'is-compact' : ''}`}>
        <button type="button" disabled={busyEventId === event.id} onClick={() => onRespond(event.id, 'confirmar')}>
          {busyEventId === event.id ? <Loader2 className="animate-spin" /> : <Check />} Vou participar
        </button>
        <button type="button" disabled={busyEventId === event.id} onClick={() => onRespond(event.id, 'declinar')}>
          <X /> Não poderei
        </button>
      </div>
    );
  };

  return (
    <div className="filho-giras-page">
      <header className="filho-giras-hero">
        <div className="filho-giras-hero__copy">
          <p><Sparkles /> Agenda da corrente</p>
          <h1>Quando a casa<br /><strong>se encontra.</strong></h1>
          <span>Veja os próximos movimentos e confirme sua presença com tranquilidade.</span>
        </div>
        <div className="filho-giras-hero__numbers">
          <div><small>Este mês</small><strong>{events.length}</strong><span>encontros</span></div>
          <div><small>Confirmados</small><strong>{confirmed}</strong><span>presenças</span></div>
        </div>
      </header>

      {error ? (
        <section className="filho-giras-error">
          <span>Não foi possível atualizar a agenda.</span>
          <button type="button" onClick={onRefresh}><RefreshCw /> Tentar novamente</button>
        </section>
      ) : null}

      {next ? (
        <section className="filho-giras-next">
          <div className="filho-giras-next__visual">
            {next.banner_url ? <img src={next.banner_url} alt="" /> : <div><Flame /></div>}
            <span>{next.tipo || 'Gira'}</span>
          </div>
          <div className="filho-giras-next__copy">
            <p>Próximo movimento</p>
            <h2>{next.titulo}</h2>
            <div>
              <span><CalendarDays /> {format(parseISO(next.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              {timeLabel(next.hora) ? <span><Clock3 /> {timeLabel(next.hora)}</span> : null}
            </div>
            {next.descricao ? <p>{next.descricao}</p> : null}
            <button type="button" onClick={() => onOpenEvent(next)}>Ver detalhes <ArrowRight /></button>
          </div>
          <div className="filho-giras-next__answer">
            <p>A casa precisa da sua resposta</p>
            {responseButtons(next)}
          </div>
        </section>
      ) : (
        <section className="filho-giras-free">
          <span><CalendarDays /></span>
          <div><p>Agenda tranquila</p><h2>Nenhum próximo encontro neste período.</h2><small>Quando a casa marcar uma gira, ela aparecerá em destaque aqui.</small></div>
        </section>
      )}

      <section className="filho-giras-month">
        <header>
          <div><p>Visão do mês</p><h2>{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h2></div>
          <div>
            <button type="button" onClick={onPreviousMonth} aria-label="Mês anterior"><ChevronLeft /></button>
            <button type="button" onClick={() => setSelectedDay(null)} className={!selectedDay ? 'is-active' : ''}>Mês todo</button>
            <button type="button" onClick={onNextMonth} aria-label="Próximo mês"><ChevronRight /></button>
          </div>
        </header>
        <div className="filho-giras-month__days">
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.data), day));
            const selected = selectedDay && isSameDay(day, selectedDay);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => setSelectedDay(selected ? null : day)}
                className={`${selected ? 'is-selected' : ''} ${dayEvents.length ? 'has-event' : ''}`}
              >
                <small>{format(day, 'EEEEE', { locale: ptBR })}</small>
                <strong>{format(day, 'dd')}</strong>
                {dayEvents.length ? <i>{dayEvents.length}</i> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="filho-giras-agenda">
        <header>
          <div><p>{selectedDay ? 'Agenda do dia' : 'Sequência da casa'}</p><h2>{selectedDay ? format(selectedDay, "dd 'de' MMMM", { locale: ptBR }) : 'Todos os encontros'}</h2></div>
          <span><Users /> {displayed.length} {displayed.length === 1 ? 'evento' : 'eventos'}</span>
        </header>

        {loading && !events.length ? (
          <div className="filho-giras-loading"><Loader2 /></div>
        ) : displayed.length ? (
          <div className="filho-giras-list">
            {displayed.map((event) => {
              const date = eventDate(event);
              const passed = date.getTime() < now;
              return (
                <article key={event.id} className={passed ? 'is-past' : ''}>
                  <div className="filho-giras-list__date">
                    <strong>{format(date, 'dd')}</strong>
                    <span>{format(date, 'MMM', { locale: ptBR }).replace('.', '')}</span>
                  </div>
                  <button type="button" onClick={() => onOpenEvent(event)} className="filho-giras-list__copy">
                    <span>{event.tipo || 'Gira'}</span>
                    <h3>{event.titulo}</h3>
                    <p>
                      <Clock3 /> {timeLabel(event.hora) || 'Horário a confirmar'}
                      {event.descricao ? <><MapPin /> {event.descricao}</> : null}
                    </p>
                  </button>
                  <div className="filho-giras-list__answer">{responseButtons(event, true)}</div>
                  <button type="button" onClick={() => onOpenEvent(event)} className="filho-giras-list__open" aria-label="Abrir evento"><ChevronRight /></button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="filho-giras-empty">
            <div aria-hidden><span /><span /><span /></div>
            <CalendarDays />
            <h3>Nenhum encontro neste recorte.</h3>
            <p>Escolha outro dia ou navegue para o próximo mês.</p>
          </div>
        )}
      </section>
    </div>
  );
}
