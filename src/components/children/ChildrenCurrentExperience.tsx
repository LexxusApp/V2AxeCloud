import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  Cake,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Crown,
  Fingerprint,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Avatar from '../Avatar';
import { childHasAppAccess, type Child } from '../../views/Children';
import {
  AxeBadge,
  AxeButton,
  AxeEmptyState,
  AxeFilterBar,
  AxeMetricCard,
  AxeMetricRail,
  AxePageHeader,
} from '../shared/AxePageScaffold';

type SortMode = 'nome' | 'entrada' | 'aniversario';

type Props = {
  childrenData: Child[];
  filteredChildren: Child[];
  pendingChildIds: Set<string>;
  financialState: 'loading' | 'error' | 'ready';
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

const STATUS_OPTIONS = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Ativo', label: 'Ativos' },
  { id: 'Pendente', label: 'Pendentes' },
  { id: 'Inativo', label: 'Inativos' },
  { id: 'Sem acesso', label: 'Sem app' },
];

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
  financialState,
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
  const cargosCount = childrenData.filter(
    (child) => child.cargo && child.cargo !== 'Filho de Santo' && child.cargo !== 'Membro'
  ).length;

  return (
    <div className="space-y-6">
      {/* 1. Unified Header */}
      <AxePageHeader
        kicker="Corrente · Mapa de Membros"
        title="Filhos de Santo"
        description="Pessoas, vínculos e cuidado em uma só visão. Acompanhe a corrente viva da casa e envie dados de acesso com um clique."
        actions={
          <>
            {childrenData.length > 0 && (
              <AxeButton
                type="button"
                variant="secondary"
                onClick={onResendAll}
                disabled={resendingWelcome}
                icon={MessageCircle}
                loading={resendingWelcome}
              >
                {resendingWelcome ? 'Enviando acessos…' : 'Enviar acessos'}
              </AxeButton>
            )}
            <AxeButton
              type="button"
              variant="primary"
              onClick={onAdd}
              disabled={isLimitReached}
              icon={isLimitReached ? Lock : Plus}
            >
              {isLimitReached
                ? 'Limite atingido'
                : childrenData.length === 0
                ? 'Cadastrar primeiro filho'
                : 'Cadastrar filho'}
            </AxeButton>
          </>
        }
      />

      {/* 2. Unified KPI Rail */}
      <AxeMetricRail>
        <AxeMetricCard
          label="Ativos na corrente"
          value={activeCount}
          icon={Users}
          tone="emerald"
          subtext={`${childrenData.length} no total`}
        />
        <AxeMetricCard
          label="Ainda sem app"
          value={withoutAccessCount}
          icon={Send}
          tone="amber"
          subtext="precisam de acesso"
        />
        <AxeMetricCard
          label="Pedem atenção"
          value={financialState === 'ready' ? peopleNeedingAttention.length : financialState === 'loading' ? '…' : '—'}
          icon={AlertCircle}
          tone="rose"
          subtext={financialState === 'ready' ? `${pendingChildIds.size} financeiro` : financialState === 'loading' ? 'Carregando financeiro…' : 'Financeiro indisponível'}
        />
        <AxeMetricCard
          label="Hierarquia & Cargos"
          value={cargosCount}
          icon={Crown}
          tone="purple"
          subtext="Ogãs, Ekedis e Linhagem"
        />
      </AxeMetricRail>

      {/* 3. Unified Filter & Search Bar */}
      <AxeFilterBar
        search={{
          value: searchTerm,
          onChange: onSearchChange,
          placeholder: 'Buscar por nome, cargo ou telefone...',
        }}
        filterTabs={{
          current: filterStatus,
          options: STATUS_OPTIONS,
          onChange: onStatusChange,
        }}
        sort={{
          value: sortBy,
          options: [
            { id: 'nome', label: 'Nome' },
            { id: 'entrada', label: 'Entrada na casa' },
            { id: 'aniversario', label: 'Aniversário' },
          ],
          onChange: (val) => onSortChange(val as SortMode),
          label: 'Ordem',
        }}
      />

      {/* 4. Workspace: Grid of Members + Attention Radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Members Column */}
        <section className="lg:col-span-8 xl:col-span-8 min-w-0" aria-label="Lista de membros">
          {orderedMap.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {orderedMap.map((child, index) => {
                  const pending = pendingChildIds.has(child.id);
                  const incomplete = childNeedsData(child);
                  const birthday = isBirthdayThisMonth(child);
                  const noAccess = !childHasAppAccess(child);
                  const isBusy = deletingId === child.id || sendingCredentialsId === child.id;
                  const isMenuOpen = openActionsId === child.id;

                  return (
                    <motion.article
                      layout
                      key={child.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                      className={cn(
                        'group relative flex flex-col justify-between rounded-2xl border border-[#E6DFD3] bg-white p-4 shadow-[0_2px_8px_rgba(28,37,31,0.03)] transition-all duration-200 hover:border-[#D8CDBA] hover:shadow-[0_4px_16px_rgba(28,37,31,0.06)]',
                        noAccess && 'border-amber-200/80 bg-[#FFFDF8]',
                      )}
                    >
                      {/* Top row: Avatar + Identity + Action Trigger */}
                      <div className="flex items-start gap-3">
                        <div
                          className="relative cursor-pointer shrink-0"
                          onClick={() => onPreview(child.id)}
                        >
                          <Avatar
                            src={child.foto_url}
                            name={child.nome}
                            shape="circle"
                            textSize="text-sm"
                            className="h-12 w-12 border-2 border-white shadow-xs"
                          />
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white',
                              child.status === 'Ativo' ? 'bg-emerald-500' : 'bg-stone-400',
                            )}
                          />
                        </div>

                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => onPreview(child.id)}
                        >
                          <h3 className="truncate font-display text-base font-black text-[#17251D] group-hover:text-[#1F5942] transition-colors">
                            {child.nome}
                          </h3>
                          <p className="mt-0.5 truncate text-xs font-bold text-[#59655E]">
                            {child.cargo || 'Função não informada'}
                          </p>
                          {child.orixa_frente && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#B88728] truncate">
                              <Sparkles className="h-3 w-3 shrink-0" />
                              {child.orixa_frente}
                            </p>
                          )}
                        </div>

                        {/* Dropdown Menu */}
                        <div className="relative shrink-0" data-child-actions-root>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              onActionsChange(isMenuOpen ? null : child.id);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6DFD3] bg-white text-[#59655E] hover:border-[#D8CDBA] hover:text-[#17251D] transition-colors"
                            aria-label={`Ações para ${child.nome}`}
                            aria-expanded={isMenuOpen}
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#1F5942]" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </button>

                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-xl border border-[#E6DFD3] bg-white py-1 shadow-lg"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    onActionsChange(null);
                                    onSendCredentials(child.id, child.nome);
                                  }}
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-[#1F5942] hover:bg-[#E8F5EE] transition-colors"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Enviar acesso WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onActionsChange(null);
                                    onPreview(child.id);
                                  }}
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-[#17251D] hover:bg-[#FAF7F2] transition-colors"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                  Ver perfil completo
                                </button>
                                <div className="my-1 border-t border-[#E6DFD3]" />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    onActionsChange(null);
                                    onDelete(child.id, child.nome);
                                  }}
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir cadastro
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Signals / Badges */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                        {noAccess ? (
                          <AxeBadge variant="amber" icon={Send}>
                            Sem app
                          </AxeBadge>
                        ) : (
                          <AxeBadge variant="emerald" icon={UserRoundCheck}>
                            No app
                          </AxeBadge>
                        )}

                        {pending ? (
                          <AxeBadge variant="rose" icon={AlertCircle}>
                            Mensalidade
                          </AxeBadge>
                        ) : (
                          <AxeBadge variant="stone" icon={Check}>
                            Em dia
                          </AxeBadge>
                        )}

                        {incomplete && (
                          <AxeBadge variant="amber" icon={Fingerprint}>
                            Completar dados
                          </AxeBadge>
                        )}

                        {birthday && (
                          <AxeBadge variant="purple" icon={Cake}>
                            Aniversário
                          </AxeBadge>
                        )}
                      </div>

                      {/* Footer: Date & Preview link */}
                      <div className="mt-3.5 flex items-center justify-between border-t border-[#F0EBE1] pt-2.5 text-[11px] font-semibold text-[#8A958E]">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-[#59655E]" />
                          Desde {formatDate(child.data_entrada)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPreview(child.id)}
                          className="font-bold text-[#1F5942] hover:underline"
                        >
                          Ver perfil →
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : !childrenData.length ? (
            <div className="space-y-5">
              {/* Main Welcome Hero */}
              <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                    <span>✦</span>
                    <span>Fundação da Casa & Linhagem</span>
                  </div>
                  <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                    Inicie o Mapa Vivo da sua Corrente
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                    Cadastre cada médium da casa com orixás de cabeça, cargos litúrgicos, obrigações de santo e envie credenciais automáticas no WhatsApp com 1 clique.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <AxeButton
                      onClick={onAdd}
                      icon={Plus}
                      variant="primary"
                      size="lg"
                    >
                      Cadastrar primeiro filho
                    </AxeButton>
                    <AxeButton
                      onClick={onAdd}
                      icon={Sparkles}
                      variant="gold"
                      size="lg"
                    >
                      Conhecer recursos litúrgicos
                    </AxeButton>
                  </div>
                </div>
              </div>

              {/* 3 Steps Ritual Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    1. Cadastro & Orixás
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Nome civil, nome de santo, orixás de frente/juntó e iniciação.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                    <Crown className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    2. Hierarquia & Cargos
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Ogãs, Ekedis, Padrinhos espirituais e Médiuns de Coroa.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                    <Send className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    3. Acesso WhatsApp
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Dispare o acesso do filho no WhatsApp sem senhas complexas.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AxeEmptyState
              icon={Users}
              title="Nenhum filho encontrado neste filtro"
              description="Tente ajustar os filtros ou pesquise por outro nome na barra de busca acima."
            />
          )}
        </section>

        {/* Radar Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-4 space-y-4" aria-label="Radar da casa">
          <div className="rounded-2xl border border-[#E6DFD3] bg-white p-5 shadow-[0_2px_8px_rgba(28,37,31,0.03)]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1F5942]/10 text-[#1F5942]">
                <CircleDot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B88728]">
                  Radar da casa
                </p>
                <h2 className="font-display text-base font-black text-[#17251D]">
                  Sinais que importam agora
                </h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#FAF7F2] p-2.5 text-center">
              <div>
                <strong className="block font-display text-lg font-black text-[#8F630E] tabular-nums">
                  {withoutAccessCount}
                </strong>
                <span className="text-[10px] font-bold text-[#59655E]">Sem app</span>
              </div>
              <div className="border-x border-[#E6DFD3]">
                <strong className="block font-display text-lg font-black text-[#9E2A1C] tabular-nums">
                  {financialState === 'ready' ? pendingChildIds.size : financialState === 'loading' ? '…' : '—'}
                </strong>
                <span className="text-[10px] font-bold text-[#59655E]">Financeiro</span>
              </div>
              <div>
                <strong className="block font-display text-lg font-black text-[#1F5942] tabular-nums">
                  {incompleteChildren}
                </strong>
                <span className="text-[10px] font-bold text-[#59655E]">Cadastro</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
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
                  <button
                    type="button"
                    key={child.id}
                    onClick={() => onPreview(child.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-[#F0EBE1] bg-[#FAF7F2]/50 p-2.5 text-left transition-all hover:border-[#D8CDBA] hover:bg-white"
                  >
                    <Avatar
                      src={child.foto_url}
                      name={child.nome}
                      shape="circle"
                      textSize="text-[10px]"
                      className="h-8 w-8 shrink-0 border border-white"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-[#17251D]">{child.nome}</p>
                      <p
                        className={cn(
                          'truncate text-[10px] font-bold',
                          noAccess
                            ? 'text-[#8F630E]'
                            : pending
                            ? 'text-[#9E2A1C]'
                            : 'text-[#59655E]',
                        )}
                      >
                        {signal}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#8A958E]" />
                  </button>
                );
              })}

              {financialState === 'ready' && !peopleNeedingAttention.length && (
                <div className="rounded-xl border border-[#C6E7D5] bg-[#E8F5EE]/60 p-4 text-center">
                  <UserRoundCheck className="mx-auto h-6 w-6 text-[#1F5942]" />
                  <strong className="mt-2 block font-display text-sm font-black text-[#17251D]">
                    Corrente em harmonia
                  </strong>
                  <p className="mt-1 text-xs text-[#59655E]">
                    Nenhuma pendência importante detectada.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FAF7F2] p-3 text-[11px] leading-relaxed text-[#59655E]">
              <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[#1F5942]" />
              <span>
                Login do membro: <strong>WhatsApp, E-mail ou Registro + 6 dígitos do CPF</strong>.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
