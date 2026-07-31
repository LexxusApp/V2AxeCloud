import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Megaphone,
  MessageCircle,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type EventItem = {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string;
  descricao?: string;
};

type NoticeItem = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  data_publicacao: string;
};

type ParticipationStatus = 'pendente' | 'confirmado' | 'recusado' | 'presente' | null;

type Props = {
  memberName: string;
  houseName: string;
  memberSince?: string;
  hasDebt: boolean;
  debtLoading: boolean;
  nextEvent: EventItem | null;
  nextParticipation: ParticipationStatus;
  participationBusy: boolean;
  obligationsUnread: number;
  notices: NoticeItem[];
  onNavigate: (tab: string) => void;
  onRespond: (action: 'confirmar' | 'declinar') => void;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatEventDate(value: string) {
  try {
    return {
      day: format(parseISO(value), 'dd'),
      month: format(parseISO(value), 'MMM', { locale: ptBR }).replace('.', '').toUpperCase(),
      full: format(parseISO(value), "EEEE, dd 'de' MMMM", { locale: ptBR }),
    };
  } catch {
    return { day: '—', month: '—', full: value };
  }
}

export default function FilhoMobileCentral({
  memberName,
  houseName,
  memberSince,
  hasDebt,
  debtLoading,
  nextEvent,
  nextParticipation,
  participationBusy,
  obligationsUnread,
  notices,
  onNavigate,
  onRespond,
}: Props) {
  const firstName = memberName.trim().split(/\s+/)[0] || 'Axé';
  const eventDate = nextEvent ? formatEventDate(nextEvent.data) : null;
  const urgentNotice = notices.find((notice) => notice.categoria === 'Urgente') || notices[0] || null;
  const pendingRsvp = Boolean(nextEvent && (!nextParticipation || nextParticipation === 'pendente'));
  const attentionCount = Number(hasDebt) + Number(pendingRsvp) + obligationsUnread + Number(Boolean(urgentNotice));
  const journeyStarted = memberSince ? new Date(memberSince) : null;
  const daysInHouse = journeyStarted && !Number.isNaN(journeyStarted.getTime())
    ? Math.max(1, Math.floor((Date.now() - journeyStarted.getTime()) / 86_400_000))
    : null;

  const primaryAction = debtLoading
    ? { kicker: 'Sincronizando sua conta', title: 'Conferindo sua caminhada', body: 'Estamos reunindo as informações mais recentes da casa.', tab: 'profile', icon: Sparkles }
    : hasDebt
    ? { kicker: 'Mensalidade em aberto', title: 'Regularize sua contribuição', body: 'O financeiro da casa registrou uma pendência neste mês.', tab: 'financial', icon: CircleDollarSign }
    : pendingRsvp
      ? { kicker: 'Sua resposta é necessária', title: 'Confirme a próxima gira', body: 'A casa precisa saber quem estará na corrente.', tab: 'calendar', icon: CalendarDays }
      : obligationsUnread > 0
        ? { kicker: 'Novo registro no seu caminho', title: 'Veja suas obrigações', body: `${obligationsUnread} ${obligationsUnread === 1 ? 'orientação nova' : 'orientações novas'} aguardando leitura.`, tab: 'obrigacoes', icon: Flame }
        : { kicker: 'Sua caminhada está em dia', title: 'Tudo certo por aqui', body: 'Acompanhe os próximos movimentos e recados da casa.', tab: 'calendar', icon: Check };
  const PrimaryIcon = primaryAction.icon;

  const quickActions = [
    { label: 'Giras', detail: nextEvent ? `${eventDate?.day} ${eventDate?.month}` : 'Sem agenda', tab: 'calendar', icon: CalendarDays, tone: 'cyan' },
    { label: 'Obrigações', detail: obligationsUnread ? `${obligationsUnread} nova${obligationsUnread === 1 ? '' : 's'}` : 'Em dia', tab: 'obrigacoes', icon: Flame, tone: 'violet' },
    { label: 'Mensalidade', detail: debtLoading ? 'Conferindo' : hasDebt ? 'Pendente' : 'Em dia', tab: 'financial', icon: Wallet, tone: hasDebt ? 'rose' : 'green' },
    { label: 'Biblioteca', detail: 'Estudos da casa', tab: 'library', icon: BookOpen, tone: 'gold' },
  ];

  return (
    <div className="filho-mobile-central filho-home-experience">
      <section className="filho-mobile-hero">
        <div className="filho-mobile-hero__orb" />
        <p><Sparkles /> AxéCloud · sua corrente</p>
        <h1>{greeting()},<br /><strong>{firstName}.</strong></h1>
        <div className="filho-mobile-hero__footer">
          <span>{houseName}</span>
          <button type="button" onClick={() => onNavigate('chat')}>
            <MessageCircle /> Falar com a casa
          </button>
        </div>
      </section>

      <section className="filho-mobile-attention">
        <header>
          <div><p>Agora</p><h2>O que pede sua atenção</h2></div>
          <span>{attentionCount || '0'}</span>
        </header>
        <button type="button" onClick={() => onNavigate(primaryAction.tab)} className="filho-mobile-attention__card">
          <i><PrimaryIcon /></i>
          <span><small>{primaryAction.kicker}</small><strong>{primaryAction.title}</strong><em>{primaryAction.body}</em></span>
          <ChevronRight />
        </button>
      </section>

      <section className="filho-mobile-quick" aria-label="Acessos rápidos">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.tab} type="button" onClick={() => onNavigate(action.tab)} className={`is-${action.tone}`}>
              <span><Icon /></span><strong>{action.label}</strong><small>{action.detail}</small>
            </button>
          );
        })}
      </section>

      <section className="filho-mobile-gira">
        <header><div><p>Próximo movimento</p><h2>A casa se prepara</h2></div><button type="button" onClick={() => onNavigate('calendar')}>Agenda <ArrowRight /></button></header>
        {nextEvent && eventDate ? (
          <article>
            <div className="filho-mobile-gira__date"><strong>{eventDate.day}</strong><span>{eventDate.month}</span></div>
            <div className="filho-mobile-gira__copy">
              <span>{nextEvent.tipo || 'Gira'}</span>
              <h3>{nextEvent.titulo}</h3>
              <p><Clock3 /> {eventDate.full} · {String(nextEvent.hora || '').slice(0, 5)}</p>
            </div>
            <div className="filho-mobile-gira__status">
              {nextParticipation === 'confirmado' || nextParticipation === 'presente' ? (
                <span className="is-confirmed"><Check /> Presença confirmada</span>
              ) : nextParticipation === 'recusado' ? (
                <span className="is-declined">Você informou que não irá</span>
              ) : (
                <>
                  <p>A casa precisa da sua resposta</p>
                  <div>
                    <button type="button" disabled={participationBusy} onClick={() => onRespond('confirmar')}>Vou participar</button>
                    <button type="button" disabled={participationBusy} onClick={() => onRespond('declinar')}>Não poderei</button>
                  </div>
                </>
              )}
            </div>
          </article>
        ) : (
          <div className="filho-mobile-empty"><CalendarDays /><span><strong>A agenda está livre</strong><small>Quando uma gira for marcada, ela aparecerá aqui.</small></span></div>
        )}
      </section>

      {urgentNotice ? (
        <section className="filho-mobile-message">
          <div><Megaphone /></div>
          <span>
            <small>Recado da casa · {urgentNotice.categoria}</small>
            <strong>{urgentNotice.titulo}</strong>
            <p>{urgentNotice.conteudo || 'Abra o mural para ler o comunicado completo.'}</p>
          </span>
          <button type="button" onClick={() => onNavigate('mural')}>Ler</button>
        </section>
      ) : null}

      <section className="filho-mobile-journey">
        <div><p>Sua caminhada</p><h2>Presença que constrói história.</h2></div>
        <span><strong>{daysInHouse ?? '—'}</strong><small>dias de caminhada registrados</small></span>
        <button type="button" onClick={() => onNavigate('obrigacoes')}>Ver meu caminho <ArrowRight /></button>
      </section>
    </div>
  );
}
