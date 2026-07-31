import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  CalendarDays,
  HandHeart,
  Landmark,
  Megaphone,
  Sparkles,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type HouseTimelineKind = 'gira' | 'member' | 'finance' | 'notice' | 'care';

export type HouseTimelineEvent = {
  id: string;
  kind: HouseTimelineKind;
  title: string;
  detail: string;
  date: string;
  tab: string;
  future?: boolean;
};

type TimelineFilter = 'all' | 'community' | 'routine' | 'finance';

const EVENT_META = {
  gira: { icon: CalendarDays, label: 'Gira', tone: 'gold' },
  member: { icon: UserPlus, label: 'Corrente', tone: 'blue' },
  finance: { icon: Wallet, label: 'Financeiro', tone: 'green' },
  notice: { icon: Megaphone, label: 'Comunicado', tone: 'terra' },
  care: { icon: HandHeart, label: 'Acolhimento', tone: 'violet' },
} as const;

const FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'community', label: 'Comunidade' },
  { id: 'routine', label: 'Rotina' },
  { id: 'finance', label: 'Financeiro' },
];

function matchesFilter(event: HouseTimelineEvent, filter: TimelineFilter) {
  if (filter === 'all') return true;
  if (filter === 'community') return event.kind === 'member' || event.kind === 'care';
  if (filter === 'routine') return event.kind === 'gira' || event.kind === 'notice';
  return event.kind === 'finance';
}

function formatTimelineDate(value: string, future?: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startDate - startToday) / 86_400_000);

  if (days === 0) return future ? 'Hoje · próximo movimento' : 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days > 1 && days <= 7) return `Em ${days} dias`;
  if (days < -1 && days >= -7) return `Há ${Math.abs(days)} dias`;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
    .format(date)
    .replace('.', '');
}

export function HouseTimeline({
  events,
  onNavigate,
  kicker = 'História em movimento',
  title = 'Linha do tempo da casa',
  description = 'Os acontecimentos da corrente reunidos em uma narrativa única.',
}: {
  events: HouseTimelineEvent[];
  onNavigate: (tab: string) => void;
  kicker?: string;
  title?: string;
  description?: string;
}) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const visibleEvents = useMemo(
    () => events.filter((event) => matchesFilter(event, filter)).slice(0, 9),
    [events, filter],
  );

  return (
    <section className="house-timeline" aria-labelledby="house-timeline-title">
      <div className="house-timeline__header">
        <div>
          <p className="dashboard-v5-section-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {kicker}
          </p>
          <h2 id="house-timeline-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="house-timeline__filters" aria-label="Filtrar linha do tempo">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(filter === item.id && 'is-active')}
              aria-pressed={filter === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visibleEvents.length ? (
        <div className="house-timeline__rail">
          {visibleEvents.map((event, index) => {
            const meta = EVENT_META[event.kind];
            const Icon = meta.icon;
            return (
              <motion.button
                key={`${event.kind}-${event.id}`}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(index * 0.045, 0.24) }}
                onClick={() => onNavigate(event.tab)}
                className="house-timeline__event"
                data-tone={meta.tone}
                data-future={event.future ? 'true' : 'false'}
              >
                <span className="house-timeline__node">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="house-timeline__content">
                  <span className="house-timeline__meta">
                    <span>{event.future ? 'Próximo' : meta.label}</span>
                    <time dateTime={event.date}>{formatTimelineDate(event.date, event.future)}</time>
                  </span>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </span>
                <ArrowUpRight className="house-timeline__arrow h-4 w-4" aria-hidden />
              </motion.button>
            );
          })}
        </div>
      ) : events.length ? (
        <div className="house-timeline__filtered-empty">
          <Landmark className="h-5 w-5" aria-hidden />
          <div>
            <strong>Nenhum acontecimento neste filtro</strong>
            <p>Escolha “Tudo” para rever a história recente da casa.</p>
          </div>
          <button type="button" onClick={() => setFilter('all')}>Mostrar tudo</button>
        </div>
      ) : (
        <div className="house-timeline__empty">
          <div>
            <span>01</span>
            <p>Cadastre a corrente</p>
          </div>
          <div>
            <span>02</span>
            <p>Agende uma gira</p>
          </div>
          <div>
            <span>03</span>
            <p>Publique a primeira memória</p>
          </div>
          <strong>A história da sua casa começará a aparecer aqui.</strong>
        </div>
      )}
    </section>
  );
}
