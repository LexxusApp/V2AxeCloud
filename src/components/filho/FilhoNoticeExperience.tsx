import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Info,
  Megaphone,
  PartyPopper,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { Notice } from '../../views/NoticeBoard';

type Props = {
  notices: Notice[];
  filteredNotices: Notice[];
  activeCategory: string;
  searchTerm: string;
  selectedNotice: Notice | null;
  categories: readonly string[];
  houseName: string;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelectNotice: (notice: Notice | null) => void;
};

const categoryIdentity = {
  Urgente: { icon: AlertCircle, label: 'Atenção da casa', tone: 'urgent' },
  Festas: { icon: PartyPopper, label: 'Festas e celebrações', tone: 'celebration' },
  Doutrina: { icon: BookOpen, label: 'Orientação e doutrina', tone: 'study' },
  Geral: { icon: Info, label: 'Recado da casa', tone: 'general' },
} as const;

function dateLabel(value: string) {
  const date = new Date(value);
  if (isToday(date)) return `Hoje, ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `Ontem, ${format(date, 'HH:mm')}`;
  return format(date, "dd 'de' MMMM", { locale: ptBR });
}

export default function FilhoNoticeExperience({
  notices,
  filteredNotices,
  activeCategory,
  searchTerm,
  selectedNotice,
  categories,
  houseName,
  onCategoryChange,
  onSearchChange,
  onSelectNotice,
}: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const featured = filteredNotices[0] || null;
  const remaining = featured ? filteredNotices.filter((notice) => notice.id !== featured.id) : [];
  const urgentCount = notices.filter((notice) => notice.categoria === 'Urgente').length;
  const currentMonthCount = useMemo(() => {
    const now = new Date();
    return notices.filter((notice) => {
      const date = new Date(notice.data_publicacao);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [notices]);

  const openNotice = (notice: Notice) => {
    setReadIds((current) => new Set(current).add(notice.id));
    onSelectNotice(notice);
  };

  return (
    <motion.div className="filho-notice-page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header className="filho-notice-hero">
        <div className="filho-notice-hero__mark"><Megaphone /></div>
        <div className="filho-notice-hero__copy">
          <span><Sparkles /> A voz oficial da casa</span>
          <h1>Mural da<br /><em>corrente.</em></h1>
          <p>Recados, orientações e acontecimentos compartilhados por {houseName || 'sua casa'}.</p>
        </div>
        <div className="filho-notice-hero__summary">
          <div><strong>{notices.length}</strong><span>comunicados</span></div>
          <div><strong>{currentMonthCount}</strong><span>neste mês</span></div>
          <div className={urgentCount ? 'has-alert' : ''}><strong>{urgentCount}</strong><span>urgentes</span></div>
        </div>
        <div className="filho-notice-hero__waves" aria-hidden><i /><i /><i /></div>
      </header>

      <section className="filho-notice-tools">
        <label>
          <Search />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar um recado"
          />
          {searchTerm ? <button type="button" onClick={() => onSearchChange('')}>Limpar</button> : null}
        </label>
        <div>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={activeCategory === category ? 'is-active' : ''}
              onClick={() => onCategoryChange(category)}
            >
              {category}
              {category === 'Urgente' && urgentCount ? <span>{urgentCount}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {featured ? (
        <button
          type="button"
          className={`filho-notice-featured is-${categoryIdentity[featured.categoria].tone}`}
          onClick={() => openNotice(featured)}
        >
          <div className="filho-notice-featured__identity">
            {(() => {
              const Icon = categoryIdentity[featured.categoria].icon;
              return <Icon />;
            })()}
            <span>{categoryIdentity[featured.categoria].label}</span>
          </div>
          <div className="filho-notice-featured__copy">
            <span>{dateLabel(featured.data_publicacao)}</span>
            <h2>{featured.titulo}</h2>
            <p>{featured.conteudo}</p>
            <strong>Ler comunicado completo <ArrowRight /></strong>
          </div>
          <div className="filho-notice-featured__stamp">
            <BellRing />
            <span>{featured.categoria === 'Urgente' ? 'Leia agora' : 'Novo recado'}</span>
          </div>
        </button>
      ) : null}

      {remaining.length ? (
        <section className="filho-notice-feed">
          <header>
            <div>
              <span>Histórico da casa</span>
              <h2>Outros comunicados</h2>
            </div>
            <p>{remaining.length} {remaining.length === 1 ? 'recado' : 'recados'}</p>
          </header>
          <div className="filho-notice-list">
            {remaining.map((notice, index) => {
              const identity = categoryIdentity[notice.categoria];
              const Icon = identity.icon;
              const wasRead = readIds.has(notice.id);
              return (
                <motion.button
                  type="button"
                  key={notice.id}
                  onClick={() => openNotice(notice)}
                  className={`is-${identity.tone} ${wasRead ? 'is-read' : ''}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * .035, .22) }}
                >
                  <span className="filho-notice-list__date">
                    <strong>{format(new Date(notice.data_publicacao), 'dd')}</strong>
                    <small>{format(new Date(notice.data_publicacao), 'MMM', { locale: ptBR })}</small>
                  </span>
                  <span className="filho-notice-list__icon"><Icon /></span>
                  <span className="filho-notice-list__copy">
                    <small>{identity.label}</small>
                    <strong>{notice.titulo}</strong>
                    <p>{notice.conteudo}</p>
                  </span>
                  <span className="filho-notice-list__state">
                    {wasRead ? <><Check /> Lido</> : 'Ler'}
                    <ChevronRight />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      ) : filteredNotices.length === 0 ? (
        <section className="filho-notice-empty">
          <div aria-hidden><span /><Megaphone /><span /></div>
          <span>Mural em silêncio</span>
          <h2>{notices.length ? 'Nenhum recado combina com sua busca.' : 'Tudo tranquilo por aqui.'}</h2>
          <p>{notices.length ? 'Tente outro termo ou escolha uma categoria diferente.' : 'Quando a casa publicar um aviso, ele aparecerá neste mural com destaque.'}</p>
          {notices.length ? <button type="button" onClick={() => { onSearchChange(''); onCategoryChange('Todos'); }}>Ver todos os comunicados</button> : null}
        </section>
      ) : null}

      <aside className="filho-notice-footnote">
        <CalendarDays />
        <div>
          <strong>Este é o canal oficial da sua casa.</strong>
          <p>Consulte o mural sempre que quiser confirmar uma orientação recebida.</p>
        </div>
      </aside>

      <AnimatePresence>
        {selectedNotice ? (
          <>
            <motion.button
              type="button"
              aria-label="Fechar comunicado"
              className="filho-notice-dialog__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onSelectNotice(null)}
            />
            <motion.aside
              className={`filho-notice-dialog is-${categoryIdentity[selectedNotice.categoria].tone}`}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, x: 36, scale: .98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 36, scale: .98 }}
            >
              <header>
                <div>
                  <span>{categoryIdentity[selectedNotice.categoria].label}</span>
                  <small>{format(new Date(selectedNotice.data_publicacao), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}</small>
                </div>
                <button type="button" onClick={() => onSelectNotice(null)}><X /></button>
              </header>
              <div className="filho-notice-dialog__body">
                <div className="filho-notice-dialog__icon">
                  {(() => {
                    const Icon = categoryIdentity[selectedNotice.categoria].icon;
                    return <Icon />;
                  })()}
                </div>
                <h2>{selectedNotice.titulo}</h2>
                <div className="filho-notice-dialog__content">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{selectedNotice.conteudo}</ReactMarkdown>
                </div>
                {selectedNotice.expiracao ? (
                  <p className="filho-notice-dialog__expiry">
                    <CalendarDays /> Orientação válida até {format(new Date(`${selectedNotice.expiracao}T12:00:00`), 'dd/MM/yyyy')}
                  </p>
                ) : null}
              </div>
              <footer>
                <span><Check /> Comunicado lido</span>
                <button type="button" onClick={() => onSelectNotice(null)}>Voltar ao mural</button>
              </footer>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
