import { motion } from 'framer-motion';
import {
  ArrowUpRight, Bell, CalendarDays, CalendarRange, ChevronLeft, ChevronRight,
  Clock, Edit3, Flame, LayoutList, Loader2, Plus, RefreshCw, Share2,
  Ticket, Trash2,
} from 'lucide-react';
import { format, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import type { CalendarEvent } from '../../views/Calendar';
import GiraPreparationCenter from './GiraPreparationCenter';

type ViewMode = 'agenda' | 'calendar';
type Props = {
  events: CalendarEvent[]; agendaEvents: CalendarEvent[]; nextEvent: CalendarEvent | null;
  eventsThisMonth: CalendarEvent[]; calendarDays: Date[]; currentMonth: Date; monthStart: Date;
  view: ViewMode; nextConfirmedCount: number; nextUnconfirmedCount: number;
  confirmationsByEvent: Record<string, unknown[]>; loading: boolean; isNotifying: string | null;
  hasAccess: boolean; fetchError: string | null; tenantId?: string;
  onNavigate: (tab: string) => void;
  onViewChange: (view: ViewMode) => void; onCreate: () => void; onRefresh: () => void;
  onShare: () => void; onOpen: (event: CalendarEvent) => void;
  onNotify: (event: CalendarEvent) => void; onEdit: (event: CalendarEvent) => void;
  onOperations: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void;
  onPreviousMonth: () => void; onNextMonth: () => void; onToday: () => void;
};

function isPassed(event: CalendarEvent) {
  return new Date(`${event.data}T${event.hora || '23:59'}`).getTime() < Date.now();
}
function tone(type: string) {
  const value = type.toLowerCase();
  if (value.includes('obriga')) return 'is-ritual';
  if (value.includes('festa')) return 'is-celebration';
  if (value.includes('reuni')) return 'is-meeting';
  return 'is-gira';
}
function distance(event: CalendarEvent | null) {
  if (!event) return null;
  const date = new Date(`${event.data}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

export default function GiraRitualCommand(props: Props) {
  const {
    events, agendaEvents, nextEvent, eventsThisMonth, calendarDays, currentMonth, monthStart,
    view, nextConfirmedCount, nextUnconfirmedCount, confirmationsByEvent, loading, isNotifying,
    hasAccess, fetchError, tenantId, onNavigate, onViewChange, onCreate, onRefresh, onShare, onOpen, onNotify, onEdit,
    onOperations, onDelete, onPreviousMonth, onNextMonth, onToday,
  } = props;
  const days = distance(nextEvent);
  const upcoming = agendaEvents.filter((event) => !isPassed(event));
  const response = Math.round((nextConfirmedCount / Math.max(1, nextConfirmedCount + nextUnconfirmedCount)) * 100);

  return (
    <div className="ritual-command">
      <header className="ritual-command__top">
        <div>
          <p className="ritual-command__kicker">Central de operação ritual</p>
          <h1>Giras não são eventos.<br />São movimentos da casa.</h1>
          <p className="ritual-command__intro">Planeje o fundamento, mobilize a corrente e conduza cada etapa até a abertura dos trabalhos.</p>
        </div>
        <div className="ritual-command__top-actions">
          <button type="button" onClick={onRefresh} title="Atualizar"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></button>
          <button type="button" onClick={onShare} title="Compartilhar"><Share2 className="h-4 w-4" /></button>
          <button type="button" onClick={onCreate} className="is-primary"><Plus className="h-4 w-4" /> Criar gira</button>
        </div>
      </header>

      {fetchError ? <div className="ritual-command__error"><span>{fetchError}</span><button type="button" onClick={onRefresh}>Tentar novamente</button></div> : null}

      <section className="ritual-mission">
        {nextEvent ? <>
          <div className="ritual-mission__visual">
            {nextEvent.banner_url ? <img src={nextEvent.banner_url} alt="" /> : null}
            <div className="ritual-mission__visual-fallback"><Flame className="h-16 w-16" /></div>
            <div className="ritual-mission__date"><strong>{format(parseISO(nextEvent.data), 'dd')}</strong><span>{format(parseISO(nextEvent.data), 'MMM', { locale: ptBR })}</span></div>
            <span className={cn('ritual-mission__type', tone(nextEvent.tipo))}>{nextEvent.tipo}</span>
          </div>
          <div className="ritual-mission__body">
            <div className="ritual-mission__countdown"><span className="ritual-live-dot" />{days === 0 ? 'Acontece hoje' : days === 1 ? 'Acontece amanhã' : `Faltam ${days} dias`}</div>
            <h2>{nextEvent.titulo}</h2>
            <p>{nextEvent.descricao || 'A preparação da próxima gira já pode começar.'}</p>
            <div className="ritual-mission__facts">
              <span><CalendarDays className="h-4 w-4" />{format(parseISO(nextEvent.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              <span><Clock className="h-4 w-4" />{nextEvent.hora}</span>
            </div>
            <div className="ritual-mission__participation">
              <div><strong>{nextConfirmedCount}</strong><span>confirmados</span></div>
              <div><strong>{nextUnconfirmedCount}</strong><span>sem resposta</span></div>
              <div className="ritual-mission__response-bar"><span><i style={{ width: `${response}%` }} /></span><small>Resposta da corrente · {response}%</small></div>
            </div>
            <div className="ritual-mission__actions">
              <button type="button" onClick={() => onOpen(nextEvent)} className="is-main">Abrir missão <ArrowUpRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => onNotify(nextEvent)} disabled={isNotifying === nextEvent.id}>
                {isNotifying === nextEvent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Avisar
              </button>
              <button type="button" onClick={() => onOperations(nextEvent)} disabled={!hasAccess}><Ticket className="h-4 w-4" /> Operação</button>
              <button type="button" onClick={() => onEdit(nextEvent)}><Edit3 className="h-4 w-4" /> Editar gira</button>
            </div>
          </div>
        </> : <div className="ritual-mission__empty"><span><Flame className="h-8 w-8" /></span><div><p>Nenhuma gira no horizonte</p><small>Crie a próxima missão ritual da casa.</small></div><button type="button" onClick={onCreate}><Plus className="h-4 w-4" /> Criar primeira gira</button></div>}
      </section>

      {nextEvent ? (
        <GiraPreparationCenter
          event={nextEvent}
          tenantId={tenantId}
          confirmedCount={nextConfirmedCount}
          unconfirmedCount={nextUnconfirmedCount}
          onNavigate={onNavigate}
          onOpenEvent={() => onOpen(nextEvent)}
        />
      ) : null}

      <div className="ritual-command__mode">
        <div>
          <button type="button" onClick={() => onViewChange('agenda')} className={cn(view === 'agenda' && 'is-active')}><LayoutList className="h-4 w-4" /> Linha ritual</button>
          <button type="button" onClick={() => onViewChange('calendar')} className={cn(view === 'calendar' && 'is-active')}><CalendarRange className="h-4 w-4" /> Calendário</button>
        </div>
        <span>{eventsThisMonth.length} movimentos neste mês</span>
      </div>

      {view === 'agenda' ? <section className="ritual-timeline">
        <div className="ritual-timeline__heading"><p>Próximos movimentos</p><h2>A linha ritual da casa</h2></div>
        <div className="ritual-timeline__list">
          {upcoming.map((event, index) => <motion.article key={event.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .05, .25) }} className="ritual-event">
            <div className="ritual-event__date"><strong>{format(parseISO(event.data), 'dd')}</strong><span>{format(parseISO(event.data), 'MMM', { locale: ptBR })}</span></div>
            <button type="button" onClick={() => onOpen(event)} className="ritual-event__identity">
              <span className={cn('ritual-event__tone', tone(event.tipo))}>{event.tipo}</span><strong>{event.titulo}</strong><small>{event.hora} · {event.descricao || 'Sem descrição adicional'}</small>
            </button>
            <div className="ritual-event__confirmed"><strong>{confirmationsByEvent[event.id]?.length || 0}</strong><span>confirmados</span></div>
            <div className="ritual-event__actions">
              <button type="button" onClick={() => onNotify(event)} title="Avisar"><Bell className="h-4 w-4" /></button>
              <button type="button" onClick={() => onEdit(event)} title="Editar"><Edit3 className="h-4 w-4" /></button>
              <button type="button" onClick={() => onOperations(event)} title="Operação" disabled={!hasAccess}><Ticket className="h-4 w-4" /></button>
              <button type="button" onClick={() => onDelete(event)} title="Excluir" className="is-danger"><Trash2 className="h-4 w-4" /></button>
            </div>
          </motion.article>)}
          {!upcoming.length ? <div className="ritual-timeline__empty">Nenhuma gira futura cadastrada.</div> : null}
        </div>
      </section> : <section className="ritual-calendar">
        <header><div><p>Visão mensal</p><h2>{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h2></div><div>
          <button type="button" onClick={onToday}>Hoje</button><button type="button" onClick={onPreviousMonth}><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={onNextMonth}><ChevronRight className="h-4 w-4" /></button>
        </div></header>
        <div className="ritual-calendar__scroll"><div className="ritual-calendar__grid">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day => <span key={day} className="ritual-calendar__weekday">{day}</span>)}
          {calendarDays.map(day => {
            const dayEvents = events.filter(event => isSameDay(parseISO(event.data), day));
            return <div key={day.toISOString()} className={cn('ritual-calendar__day', !isSameMonth(day, monthStart) && 'is-outside', isSameDay(day, new Date()) && 'is-today')}>
              <span>{format(day, 'd')}</span><div>{dayEvents.slice(0,3).map(event => <button key={event.id} type="button" onClick={() => onOpen(event)} className={tone(event.tipo)}><i />{event.hora} {event.titulo}</button>)}</div>
            </div>;
          })}
        </div></div>
      </section>}
    </div>
  );
}
