import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  Cake,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Fingerprint,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Avatar from '../Avatar';
import { childHasAppAccess, type Child } from '../../views/Children';

type SortMode = 'nome' | 'entrada' | 'aniversario';

type Props = {
  childrenData: Child[];
  filteredChildren: Child[];
  pendingChildIds: Set<string>;
  incompleteChildren: number;
  withoutAccessCount: number;
  birthdaysThisMonth: number;
  searchTerm: string;
  filterStatus: string;
  sortBy: SortMode;
  isLimitReached: boolean;
  childLimit: number;
  planName: string;
  resendingWelcome: boolean;
  openActionsId: string | null;
  deletingId: string | null;
  sendingCredentialsId: string | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: SortMode) => void;
  onAdd: () => void;
  onResendAll: () => void;
  onPreview: (id: string) => void;
  onActionsChange: (id: string | null) => void;
  onSendCredentials: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
};

const STATUS_OPTIONS = ['Todos', 'Ativo', 'Pendente', 'Inativo', 'Sem acesso'];

function formatDate(value?: string | null) {
  if (!value) return 'Não informada';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function childNeedsData(child: Child) {
  return (
    !String(child.whatsapp_phone || child.telefone || '').trim() ||
    !String(child.data_nascimento || '').trim()
  );
}

function isBirthdayThisMonth(child: Child) {
  return Number(String(child.data_nascimento || '').slice(5, 7)) === new Date().getMonth() + 1;
}

function attentionScore(child: Child, pendingChildIds: Set<string>) {
  return (
    (!childHasAppAccess(child) ? 5 : 0) +
    (pendingChildIds.has(child.id) ? 4 : 0) +
    (childNeedsData(child) ? 2 : 0) +
    (isBirthdayThisMonth(child) ? 1 : 0)
  );
}

export default function ChildrenCurrentExperience({
  childrenData,
  filteredChildren,
  pendingChildIds,
  incompleteChildren,
  withoutAccessCount,
  birthdaysThisMonth,
  searchTerm,
  filterStatus,
  sortBy,
  isLimitReached,
  childLimit,
  planName,
  resendingWelcome,
  openActionsId,
  deletingId,
  sendingCredentialsId,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onAdd,
  onResendAll,
  onPreview,
  onActionsChange,
  onSendCredentials,
  onDelete,
}: Props) {
  const activeCount = childrenData.filter((child) => child.status === 'Ativo').length;
  const peopleNeedingAttention = childrenData
    .filter((child) => attentionScore(child, pendingChildIds) > 0)
    .sort((a, b) => attentionScore(b, pendingChildIds) - attentionScore(a, pendingChildIds));
  const orderedMap = [...filteredChildren].sort((a, b) => {
    const scoreDelta = attentionScore(b, pendingChildIds) - attentionScore(a, pendingChildIds);
    return scoreDelta || a.nome.localeCompare(b.nome, 'pt-BR');
  });
  const usage = Math.min(100, Math.round((childrenData.length / Math.max(1, childLimit)) * 100));

  return (
    <div className="current-map">
      <section className="current-map__hero">
        <div className="current-map__watermark" aria-hidden>
          {String(activeCount).padStart(2, '0')}
        </div>
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="current-map__eyebrow">
              <span className="current-map__live-dot" />
              Mapa vivo da corrente
            </div>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-black leading-[0.98] text-white sm:text-5xl">
              Pessoas, vínculos e cuidado em uma só visão.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#9AA6B7]">
              Veja quem forma a casa, quem ainda não entrou no app e entre em cada história sem perder o
              contexto da corrente.
            </p>
          </div>
          <div className="current-map__hero-actions">
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={onResendAll}
                disabled={resendingWelcome || childrenData.length === 0}
                className="current-map__secondary-action"
              >
                {resendingWelcome ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Enviar acessos
              </button>
              <p className="max-w-[16rem] text-[11px] font-semibold leading-snug text-[#8E9AAA] sm:text-right">
                {withoutAccessCount > 0
                  ? `${withoutAccessCount} ainda não entrou · Registro + 6 dígitos do CPF`
                  : 'Entram com Registro + 6 dígitos do CPF'}
              </p>
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={isLimitReached}
              className="current-map__primary-action"
            >
              {isLimitReached ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isLimitReached ? 'Limite atingido' : 'Nova pessoa'}
            </button>
          </div>
        </div>

        <div className="current-map__pulse">
          <div><strong>{activeCount}</strong><span>ativos na corrente</span></div>
          <div><strong>{withoutAccessCount}</strong><span>ainda sem app</span></div>
          <div><strong>{peopleNeedingAttention.length}</strong><span>pedem atenção</span></div>
          <div className="current-map__capacity">
            <span>Plano {planName} · {childrenData.length} de {childLimit}</span>
            <span className="current-map__capacity-track"><span style={{ width: `${usage}%` }} /></span>
          </div>
        </div>
      </section>

      <section className="current-map__command" aria-label="Localizar pessoas na corrente">
        <div className="current-map__search">
          <Search className="h-4 w-4" aria-hidden />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Encontre uma pessoa, cargo ou telefone..."
          />
          {searchTerm ? <button type="button" onClick={() => onSearchChange('')}>Limpar</button> : null}
        </div>
        <div className="current-map__filters">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={cn(filterStatus === status && 'is-active')}
            >
              {status}
            </button>
          ))}
        </div>
        <label className="current-map__sort">
          <span>Ordem</span>
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as SortMode)}>
            <option value="nome">Nome</option>
            <option value="entrada">Entrada na casa</option>
            <option value="aniversario">Aniversário</option>
          </select>
        </label>
      </section>

      <div className="current-map__workspace">
        <section className="current-map__people" aria-labelledby="current-map-title">
          <div className="current-map__section-heading">
            <div>
              <p className="current-map__section-kicker">A corrente</p>
              <h2 id="current-map-title">
                {filteredChildren.length === childrenData.length
                  ? `${childrenData.length} pessoas conectadas`
                  : `${filteredChildren.length} resultados`}
              </h2>
            </div>
            <div className="current-map__legend">
              <span><i className="bg-emerald-400" /> Em dia</span>
              <span><i className="bg-amber-400" /> Sem app</span>
              <span><i className="bg-rose-400" /> Atenção</span>
            </div>
          </div>

          {orderedMap.length ? (
            <motion.div layout className="current-map__grid">
              <AnimatePresence mode="popLayout">
                {orderedMap.map((child, index) => {
                  const pending = pendingChildIds.has(child.id);
                  const incomplete = childNeedsData(child);
                  const birthday = isBirthdayThisMonth(child);
                  const noAccess = !childHasAppAccess(child);
                  const score = attentionScore(child, pendingChildIds);
                  const isBusy = deletingId === child.id || sendingCredentialsId === child.id;
                  const isMenuOpen = openActionsId === child.id;
                  return (
                    <motion.article
                      layout
                      key={child.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: Math.min(index * 0.035, 0.24) }}
                      className={cn('current-person', score > 0 && 'has-signal', index === 0 && score > 0 && 'is-focus')}
                    >
                      <button type="button" className="current-person__main" onClick={() => onPreview(child.id)}>
                        <span className="current-person__index">{String(index + 1).padStart(2, '0')}</span>
                        <span className="current-person__portrait">
                          <Avatar src={child.foto_url} name={child.nome} shape="circle" textSize="text-base" className="h-full w-full" />
                          <i className={cn(child.status === 'Ativo' ? 'is-online' : 'is-away')} />
                        </span>
                        <span className="current-person__identity">
                          <span className="current-person__role">{child.cargo || 'Função não informada'}</span>
                          <strong>{child.nome}</strong>
                          <span className="current-person__lineage">
                            <Sparkles className="h-3 w-3" /> {child.orixa_frente || 'Orixá não informado'}
                          </span>
                        </span>
                        <ArrowUpRight className="current-person__open h-4 w-4" />
                      </button>

                      <div className="current-person__signals">
                        {noAccess ? (
                          <span className="is-access"><Send className="h-3 w-3" /> Ainda não entrou</span>
                        ) : (
                          <span className="is-ok"><UserRoundCheck className="h-3 w-3" /> Já entrou</span>
                        )}
                        {pending ? (
                          <span className="is-critical"><AlertCircle className="h-3 w-3" /> Mensalidade</span>
                        ) : (
                          <span className="is-ok"><Check className="h-3 w-3" /> Financeiro em dia</span>
                        )}
                        {incomplete ? <span className="is-warning"><Fingerprint className="h-3 w-3" /> Completar dados</span> : null}
                        {birthday ? <span className="is-birthday"><Cake className="h-3 w-3" /> Aniversário</span> : null}
                      </div>

                      <div className="current-person__footer">
                        <span><CalendarDays className="h-3.5 w-3.5" /> Na casa desde {formatDate(child.data_entrada)}</span>
                        <div className="relative" data-child-actions-root>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              onActionsChange(isMenuOpen ? null : child.id);
                            }}
                            className="current-person__more"
                            aria-label={`Ações para ${child.nome}`}
                            aria-expanded={isMenuOpen}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                          </button>
                          <AnimatePresence>
                            {isMenuOpen ? (
                              <motion.div
                                initial={{ opacity: 0, y: -5, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                className="current-person__menu"
                                role="menu"
                              >
                                <button type="button" onClick={() => onSendCredentials(child.id, child.nome)} role="menuitem">
                                  <Send className="h-3.5 w-3.5" /> Enviar acesso
                                </button>
                                <p className="current-person__menu-hint" role="note">
                                  Registro + 6 dígitos do CPF
                                </p>
                                <button type="button" onClick={() => onDelete(child.id, child.nome)} role="menuitem" className="is-danger">
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir cadastro
                                </button>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="current-map__empty">
              <span><Users className="h-7 w-7" /></span>
              <h3>{childrenData.length ? 'Ninguém encontrado neste recorte' : 'A corrente começa aqui'}</h3>
              <p>{childrenData.length ? 'Mude os filtros ou pesquise por outro nome.' : 'Cadastre a primeira pessoa para formar o mapa vivo da casa.'}</p>
              {!childrenData.length && !isLimitReached ? (
                <button type="button" onClick={onAdd}><Plus className="h-4 w-4" /> Cadastrar primeira pessoa</button>
              ) : null}
            </div>
          )}
        </section>

        <aside className="current-radar" aria-labelledby="current-radar-title">
          <div className="current-radar__heading">
            <span><CircleDot className="h-4 w-4" /></span>
            <div><p>Radar da casa</p><h2 id="current-radar-title">Sinais que importam agora</h2></div>
          </div>
          <div className="current-radar__summary">
            <div><strong>{withoutAccessCount}</strong><span>sem app</span></div>
            <div><strong>{pendingChildIds.size}</strong><span>financeiro</span></div>
            <div><strong>{incompleteChildren}</strong><span>cadastro</span></div>
          </div>
          <div className="current-radar__stream">
            {peopleNeedingAttention.slice(0, 6).map((child) => {
              const pending = pendingChildIds.has(child.id);
              const incomplete = childNeedsData(child);
              const noAccess = !childHasAppAccess(child);
              const signal = noAccess
                ? 'Ainda não entrou no app'
                : pending
                  ? 'Mensalidade pendente'
                  : incomplete
                    ? 'Cadastro incompleto'
                    : 'Aniversário neste mês';
              return (
                <button type="button" key={child.id} onClick={() => onPreview(child.id)}>
                  <span className={cn('current-radar__node', (pending || noAccess) && 'is-critical')}>
                    <Avatar src={child.foto_url} name={child.nome} shape="circle" textSize="text-[9px]" className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1"><strong>{child.nome}</strong><small>{signal}</small></span>
                  <ChevronRight className="h-4 w-4 text-[#556174]" />
                </button>
              );
            })}
            {!peopleNeedingAttention.length ? (
              <div className="current-radar__clear">
                <span><UserRoundCheck className="h-5 w-5" /></span>
                <strong>Corrente em harmonia</strong>
                <p>Nenhuma pendência importante detectada.</p>
              </div>
            ) : null}
          </div>
          <div className="current-radar__note">
            <Fingerprint className="h-4 w-4" />
            <p>
              O radar prioriza quem ainda não entrou no app, depois financeiro, cadastro e datas.
              Login do membro: Registro + 6 dígitos do CPF.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
