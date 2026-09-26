import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Anchor,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Flame,
  Leaf,
  MapPin,
  MessageCircle,
  Mountain,
  Package,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Swords,
  TreePine,
  Users,
  Wallet,
  Waves,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardNextEvent } from './DashboardProximaGira';
import { resolveGiraVisualTheme, type GiraVisualThemeId } from '../../lib/giraVisualTheme';

export type DashboardAttentionItem = {
  label: string;
  detail: string;
  tab: string;
  tone?: 'danger' | 'gold' | 'green';
};

type Props = {
  firstName: string;
  terreiroName: string;
  tenantPhoto?: string | null;
  statusLabel: string;
  setupProgress: number;
  setupComplete: boolean;
  nextEvent: DashboardNextEvent | null;
  whatsappFailed: number;
  membersCount: number;
  cashBalance: number;
  attentionItems: DashboardAttentionItem[];
  memberAvatars: Array<{ id: string; name: string; photo?: string | null }>;
  onContinueSetup: () => void;
  onNavigate: (tab: string) => void;
  preceito: ReactNode;
  timeline: ReactNode;
};

const themeIcons: Record<GiraVisualThemeId, typeof TreePine> = {
  caboclo: TreePine,
  exu: Flame,
  'preto-velho': Sparkles,
  ere: Sparkles,
  marinheiro: Anchor,
  boiadeiro: Mountain,
  ogum: Swords,
  oxum: Waves,
  iemanja: Waves,
  xango: Mountain,
  default: Leaf,
};

function formatEventDate(event: DashboardNextEvent | null) {
  if (!event?.data) return 'Data ainda não marcada';
  const date = parseISO(event.data);
  if (Number.isNaN(date.getTime())) return event.data;
  const day = format(date, 'dd MMM', { locale: ptBR }).replace('.', '').toUpperCase();
  const time = String(event.hora || '').slice(0, 5);
  return `${day}${time ? ` · ${time}` : ''}`;
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function GiraArtwork({ themeId }: { themeId: GiraVisualThemeId }) {
  const Icon = themeIcons[themeId];
  return (
    <div className="command-gira__art" aria-hidden>
      <span className="command-gira__orbit command-gira__orbit--one" />
      <span className="command-gira__orbit command-gira__orbit--two" />
      <span className="command-gira__flare" />
      <span className="command-gira__leaf command-gira__leaf--one" />
      <span className="command-gira__leaf command-gira__leaf--two" />
      <Icon className="command-gira__sigil" strokeWidth={1.25} />
    </div>
  );
}

export function DashboardHomeExperience({
  firstName,
  terreiroName,
  tenantPhoto,
  statusLabel,
  setupProgress,
  setupComplete,
  nextEvent,
  whatsappFailed,
  membersCount,
  cashBalance,
  attentionItems,
  memberAvatars,
  onContinueSetup,
  onNavigate,
  preceito,
  timeline,
}: Props) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const theme = useMemo(() => resolveGiraVisualTheme(nextEvent), [nextEvent]);
  const GiraIcon = themeIcons[theme.id];
  const visibleAttention = attentionOpen ? attentionItems : attentionItems.slice(0, 2);
  const whatsappHealthy = whatsappFailed === 0;

  return (
    <div className="dashboard-command" data-gira-theme={theme.id} data-gira-variant={theme.variant}>
      <header className="command-desktop-bar" aria-label="Barra da casa">
        <button type="button" className="command-desktop-bar__house" onClick={() => onNavigate('settings')}>
          <span>{tenantPhoto ? <img src={tenantPhoto} alt="" /> : terreiroName.charAt(0)}</span>
          <strong>{terreiroName}</strong>
          <ChevronDown aria-hidden />
        </button>
        <p className="command-desktop-bar__status"><i />{statusLabel}</p>
        <button type="button" className="command-desktop-bar__search" onClick={() => setQuickOpen(true)}>
          <Search aria-hidden />
          <span>Buscar ou criar...</span>
          <kbd>⌘ K</kbd>
        </button>
        <button type="button" className="command-desktop-bar__profile" onClick={() => onNavigate('settings')}>
          <span>{firstName.charAt(0)}</span>
          <strong>{firstName}</strong>
          <ChevronDown aria-hidden />
        </button>
      </header>
      <motion.section
        className="command-journey"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
        aria-labelledby="dashboard-command-title"
      >
        <div className="command-journey__canopy" aria-hidden />
        <header className="command-journey__intro">
          <p>Central da casa · hoje</p>
          <h1 id="dashboard-command-title">Boa noite, <span>{firstName}.</span></h1>
          <strong>Sua casa em um só ritmo.</strong>
        </header>

        <blockquote>“Disciplina hoje,<br />continuidade amanhã.”</blockquote>

        <div className="command-journey__flow">
          <svg className="command-journey__path" viewBox="0 0 920 130" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="commandFlowGold" x1="0" x2="1">
                <stop offset="0" stopColor="#d9b338" stopOpacity=".28" />
                <stop offset=".52" stopColor="#ffe786" />
                <stop offset="1" stopColor="#42e6a1" stopOpacity=".8" />
              </linearGradient>
              <filter id="commandFlowGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <motion.path
              d="M65 74 C210 8 238 120 365 67 S575 22 664 72 S820 95 870 48"
              fill="none"
              stroke="url(#commandFlowGold)"
              strokeWidth="2.5"
              filter="url(#commandFlowGlow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.25, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>

          <motion.article className="command-node command-node--setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}>
            <div className="command-node__orb" style={{ '--node-progress': `${Math.max(8, setupProgress) * 3.6}deg` } as React.CSSProperties}>
              <Settings aria-hidden />
            </div>
            <p>Agora</p>
            <h2>{setupComplete ? 'Casa configurada' : 'Configuração da casa'}</h2>
            <span>{setupComplete ? 'Tudo pronto para cuidar da casa' : `${setupProgress}% concluído`}</span>
            <button type="button" onClick={onContinueSetup}>{setupComplete ? 'Ver corrente' : 'Continuar'} <ArrowRight aria-hidden /></button>
          </motion.article>

          <motion.article className="command-node command-node--event" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .36 }}>
            <div className="command-node__orb" style={{ '--node-progress': nextEvent ? '305deg' : '42deg' } as React.CSSProperties}>
              <CalendarDays aria-hidden />
            </div>
            <p>Próximo movimento</p>
            <h2>{nextEvent?.titulo || 'Gira ainda não agendada'}</h2>
            <span>{nextEvent ? formatEventDate(nextEvent) : 'Conecte sua comunidade.'}</span>
            <button type="button" onClick={() => onNavigate('calendar')}>Abrir agenda <ArrowRight aria-hidden /></button>
          </motion.article>

          <motion.article className="command-node command-node--whatsapp" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .47 }}>
            <div className="command-node__orb" style={{ '--node-progress': whatsappHealthy ? '330deg' : '210deg' } as React.CSSProperties}>
              <MessageCircle aria-hidden />
            </div>
            <p>{whatsappHealthy ? 'Casa em dia' : 'Precisa revisar'}</p>
            <h2>{whatsappHealthy ? 'WhatsApp funcionando' : `${whatsappFailed} envio${whatsappFailed === 1 ? '' : 's'} com falha`}</h2>
            <span>{whatsappHealthy ? 'Últimos envios sem falha.' : 'Abra o histórico de envios.'}</span>
            <button type="button" className={whatsappHealthy ? 'is-online' : 'is-warning'} onClick={() => onNavigate('settings')}>
              <i /> {whatsappHealthy ? 'Online' : 'Revisar'}
            </button>
          </motion.article>
        </div>

        <aside className={`command-attention${attentionOpen ? ' is-expanded' : ''}`} aria-label="O que pede sua atenção">
          <div className="command-attention__header"><h2>Pede sua atenção</h2>{attentionItems.length > 2 ? <button type="button" onClick={() => setAttentionOpen((value) => !value)}>{attentionOpen ? 'Recolher' : 'Ver todas'} <ArrowRight aria-hidden /></button> : null}</div>
          {attentionItems.length ? (
            <button type="button" className="command-attention__mobile-summary" onClick={() => onNavigate(attentionItems[0].tab)}>
              <span><AlertCircle aria-hidden /></span>
              <span><strong>{attentionItems.length} {attentionItems.length === 1 ? 'ação pede' : 'ações pedem'} você</strong><small>Finalize as informações principais.</small></span>
              <ChevronRight aria-hidden />
            </button>
          ) : null}
          {visibleAttention.length ? visibleAttention.map((item, index) => (
            <button key={`${item.label}-${index}`} type="button" onClick={() => onNavigate(item.tab)} className="command-attention__item" data-tone={item.tone || 'gold'}>
              <span>{item.tone === 'danger' ? <AlertCircle /> : item.tone === 'green' ? <CheckCircle2 /> : <MapPin />}</span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              <ChevronRight aria-hidden />
            </button>
          )) : (
            <div className="command-attention__clear"><CheckCircle2 /><span><strong>Nada urgente agora</strong><small>A rotina da casa está em dia.</small></span></div>
          )}
        </aside>

        <p className="command-journey__values">Terra · disciplina · caminho · evolução</p>
        <div className="command-journey__waves" aria-hidden><i /><i /><i /></div>
        <div className="command-create">
          <button type="button" aria-expanded={quickOpen} onClick={() => setQuickOpen((value) => !value)}><Plus aria-hidden /><span>Criar</span></button>
          <AnimatePresence>
            {quickOpen ? (
              <motion.div className="command-create__menu" initial={{ opacity: 0, y: 10, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .97 }}>
                <button type="button" onClick={() => onNavigate('calendar')}><CalendarDays /> Gira</button>
                <button type="button" onClick={() => onNavigate('children')}><Users /> Membro</button>
                <button type="button" onClick={() => onNavigate('mural')}><Send /> Comunicado</button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.section>

      <motion.section className="command-pulse" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .48 }} aria-label="Pulso da casa">
        <div className="command-pulse__title"><span><Activity /></span><div><h2>Pulso da casa</h2><p>Em tempo real</p></div></div>
        <button type="button" onClick={() => onNavigate('children')}><span><Users /></span><strong>{membersCount}</strong><small>na corrente</small></button>
        <button type="button" onClick={() => onNavigate('financial')}><span><Wallet /></span><strong>{currency(cashBalance)}</strong><small>em caixa</small></button>
        <button type="button" onClick={() => onNavigate('settings')}><span><Send /></span><strong>{whatsappHealthy ? '100%' : whatsappFailed}</strong><small>{whatsappHealthy ? 'WhatsApp entregues' : 'envios para revisar'}</small></button>
      </motion.section>

      <div className="command-focus-grid">
        <motion.section className="command-gira" initial={{ opacity: 0, clipPath: 'inset(0 0 18% 0 round 16px)' }} animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0 round 16px)' }} transition={{ delay: .58, duration: .7 }}>
          <GiraArtwork themeId={theme.id} />
          <div className="command-gira__content">
            <p>Próxima gira</p>
            <h2>{nextEvent?.titulo || 'Organize o próximo movimento'}</h2>
            <div className="command-gira__meta"><span><CalendarDays /> {formatEventDate(nextEvent)}</span><span><MapPin /> Terreiro principal</span></div>
            <blockquote>{nextEvent?.descricao || theme.phrase}</blockquote>
            <div className="command-gira__community">
              <div className="command-gira__avatars">
                {memberAvatars.slice(0, 5).map((member) => member.photo ? <img key={member.id} src={member.photo} alt="" /> : <span key={member.id}>{member.name.charAt(0)}</span>)}
                {membersCount > 5 ? <i>+{membersCount - 5}</i> : null}
              </div>
              <span className="command-gira__count"><i /> {membersCount} na corrente</span>
            </div>
            <button type="button" onClick={() => onNavigate('calendar')}><CalendarDays /> {nextEvent ? 'Abrir organização' : 'Agendar primeira gira'} <ArrowRight /></button>
          </div>
          <span className="command-gira__theme"><GiraIcon /> {theme.label}</span>
        </motion.section>
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .66 }}>{preceito}</motion.div>
      </div>

      <motion.div className="command-timeline" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .75 }}>{timeline}</motion.div>
    </div>
  );
}
