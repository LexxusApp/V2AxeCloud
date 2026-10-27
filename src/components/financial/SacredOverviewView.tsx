import React, { useState } from 'react';
import {
  WalletCards,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  Flame,
  Leaf,
  Heart,
  DollarSign,
  X,
  Filter,
  Trash2,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { parseFinanceiroDataRef } from '../../lib/financeiroSaldo';
import { AxeMetricRail, AxeMetricCard } from '../shared/AxePageScaffold';

interface SacredOverviewViewProps {
  saldo: number;
  stats: { entradas: number; saidas: number };
  pendingMonthlyTotal: number;
  mensalidadesPendentes: any[];
  cashTransactions: any[];
  filteredCashTransactions: any[];
  financeSearch: string;
  setFinanceSearch: (v: string) => void;
  financeTypeFilter: 'todos' | 'entrada' | 'saida';
  setFinanceTypeFilter: (v: 'todos' | 'entrada' | 'saida') => void;
  formData: {
    descricao: string;
    valor: string;
    tipo: 'entrada' | 'saida';
    categoria: string;
    data: string;
    filho_id: string;
    status?: 'pago' | 'pendente';
    jurosTipo?: 'nenhum' | 'valor' | 'porcentagem';
    jurosValor?: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleSubmit: (e: React.FormEvent) => Promise<boolean>;
  submitError?: string | null;
  isSubmitting: boolean;
  children: Array<{ id: string; nome: string }>;
  isAdmin: boolean;
  renderTransactionActions: (t: any) => React.ReactNode;
  formatBRL: (v: number) => string;
}

export const SacredOverviewView: React.FC<SacredOverviewViewProps> = ({
  saldo,
  stats,
  pendingMonthlyTotal,
  mensalidadesPendentes,
  cashTransactions,
  filteredCashTransactions,
  financeSearch,
  setFinanceSearch,
  financeTypeFilter,
  setFinanceTypeFilter,
  formData,
  setFormData,
  handleSubmit,
  submitError,
  isSubmitting,
  children,
  isAdmin,
  renderTransactionActions,
  formatBRL,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalMovimentado = stats.entradas + stats.saidas;
  const percEntradas = totalMovimentado > 0 ? Math.round((stats.entradas / totalMovimentado) * 100) : 50;
  const percSaidas = totalMovimentado > 0 ? 100 - percEntradas : 50;

  const quickOpenWithCategory = (tipo: 'entrada' | 'saida', categoria: string, descricao = '') => {
    setFormData(prev => ({
      ...prev,
      tipo,
      categoria,
      descricao: descricao || prev.descricao,
    }));
    setIsModalOpen(true);
  };

  return (
    <div className="sacred-overview-container space-y-6">
      {/* 1. Métricas Principais em Trilho Litúrgico */}
      <AxeMetricRail>
        <AxeMetricCard
          label="Saldo em Caixa"
          value={formatBRL(saldo)}
          icon={WalletCards}
          tone={saldo >= 0 ? 'emerald' : 'rose'}
          subtext="Saldo real disponível na casa"
        />
        <AxeMetricCard
          label="Entradas no Mês"
          value={formatBRL(stats.entradas)}
          icon={ArrowUpRight}
          tone="emerald"
          subtext="Receitas confirmadas"
        />
        <AxeMetricCard
          label="Saídas no Mês"
          value={formatBRL(stats.saidas)}
          icon={ArrowDownRight}
          tone="rose"
          subtext="Despesas registradas"
        />
        <AxeMetricCard
          label="A Receber"
          value={formatBRL(pendingMonthlyTotal)}
          icon={Clock3}
          tone="amber"
          subtext={`${mensalidadesPendentes.length} mensalidade(s) pendente(s)`}
        />
      </AxeMetricRail>

      {/* 2. Cockpit de Balanço & Ações Rápidas da Casa */}
      <div className="relative overflow-hidden rounded-lg border border-[#E3DC CE] bg-gradient-to-br from-[#FAF7F0] via-[#F4EFE6] to-[#EBE4D8] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#735A10]">
                <Sparkles className="h-3 w-3" /> Balanço do Livro de Caixa
              </span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                saldo >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              )}>
                {saldo >= 0 ? "Caixa Positivo" : "Atenção no Saldo"}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-black text-[#1A251D]">
              Saúde Financeira do Terreiro
            </h3>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-[#5F685E]">
              Distribuição proporcional das movimentações do mês. Lance entradas e despesas com clareza litúrgica.
            </p>
          </div>

          {/* Botão de Novo Lançamento em Destaque Dourado */}
          {isAdmin && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2.5 rounded-lg bg-[#17251D] px-5 py-3 text-xs sm:text-sm font-black text-[#F4EFE6] shadow-md transition-all hover:bg-[#243B2E] hover:shadow-lg active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 text-[#D4AF37]" />
                Registrar Lançamento
              </button>
            </div>
          )}
        </div>

        {/* Barra Proporcional de Entradas vs Saídas */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#3E493F]">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <ArrowUpRight className="h-3.5 w-3.5" /> Entradas ({percEntradas}%)
            </span>
            <span className="flex items-center gap-1.5 text-rose-800">
              Saídas ({percSaidas}%) <ArrowDownRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#DCD4C5] p-0.5 shadow-inner">
            <div className="flex h-full w-full overflow-hidden rounded-full">
              <div
                style={{ width: `${percEntradas}%` }}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
              />
              <div
                style={{ width: `${percSaidas}%` }}
                className="bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-500"
              />
            </div>
          </div>
        </div>

        {/* Chips de Lançamento Rápido Litúrgico */}
        {isAdmin && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#DCD4C5]/70 pt-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#6A5A30]">
              Lançamento Rápido:
            </span>
            <button
              type="button"
              onClick={() => quickOpenWithCategory('saida', 'Insumos', 'Compra de Velas e Defumações')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CBB8] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2A342B] shadow-xs transition hover:border-[#17251D] hover:bg-white"
            >
              <Flame className="h-3.5 w-3.5 text-amber-600" /> Velas & Defumação
            </button>
            <button
              type="button"
              onClick={() => quickOpenWithCategory('saida', 'Insumos', 'Compra de Ervas Sagradas')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CBB8] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2A342B] shadow-xs transition hover:border-[#17251D] hover:bg-white"
            >
              <Leaf className="h-3.5 w-3.5 text-emerald-600" /> Ervas da Macaia
            </button>
            <button
              type="button"
              onClick={() => quickOpenWithCategory('entrada', 'Doação', 'Doação Espontânea da Assistência')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CBB8] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2A342B] shadow-xs transition hover:border-[#17251D] hover:bg-white"
            >
              <Heart className="h-3.5 w-3.5 text-rose-600" /> Doação da Assistência
            </button>
            <button
              type="button"
              onClick={() => quickOpenWithCategory('saida', 'Contas', 'Conta de Energia Elétrica / Água')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CBB8] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#2A342B] shadow-xs transition hover:border-[#17251D] hover:bg-white"
            >
              <Building2 className="h-3.5 w-3.5 text-sky-600" /> Contas da Casa
            </button>
          </div>
        )}
      </div>

      {/* 3. Três Cofres Sagrados (Caixas & Reservas) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="group rounded-lg border border-[#E0D7C6] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#796F5E]">Cofre 01</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <h4 className="mt-2 font-display text-base font-black text-[#17251D]">Caixa Operacional</h4>
          <p className="mt-1 text-xs text-[#6F675C]">Manutenção mensal, contas fixas e insumos do terreiro.</p>
          <div className="mt-3 flex items-baseline justify-between border-t border-[#F0ECE1] pt-2">
            <span className="text-xs font-semibold text-[#8B8374]">Status da Casa</span>
            <span className="text-sm font-black text-emerald-700">{formatBRL(saldo)}</span>
          </div>
        </div>

        <div className="group rounded-lg border border-[#E0D7C6] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#796F5E]">Cofre 02</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <h4 className="mt-2 font-display text-base font-black text-[#17251D]">Caixinha dos Orixás</h4>
          <p className="mt-1 text-xs text-[#6F675C]">Festas anuais, obrigações coletivas e toques solenes.</p>
          <div className="mt-3 flex items-baseline justify-between border-t border-[#F0ECE1] pt-2">
            <span className="text-xs font-semibold text-[#8B8374]">Reserva Litúrgica</span>
            <span className="text-sm font-black text-amber-700">Integrado ao Caixa</span>
          </div>
        </div>

        <div className="group rounded-lg border border-[#E0D7C6] bg-white p-4 sm:p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#796F5E]">Cofre 03</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <h4 className="mt-2 font-display text-base font-black text-[#17251D]">Fundo de Obras & Camarinha</h4>
          <p className="mt-1 text-xs text-[#6F675C]">Reformas do barracão, ampliações e melhorias estruturais.</p>
          <div className="mt-3 flex items-baseline justify-between border-t border-[#F0ECE1] pt-2">
            <span className="text-xs font-semibold text-[#8B8374]">Projetos Futuros</span>
            <span className="text-sm font-black text-sky-700">Ativo</span>
          </div>
        </div>
      </div>

      {/* 4. Extrato Sagrado & Movimentações Financeiras */}
      <div className="rounded-lg border border-[#E0D7C6] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 border-b border-[#EAE3D5] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-display text-lg font-black text-[#17251D]">
              Livro de Registro & Movimentações
            </h4>
            <p className="text-xs text-[#6F675C]">
              {filteredCashTransactions.length} de {cashTransactions.length} registro{cashTransactions.length === 1 ? '' : 's'} no período.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Campo de Busca Elegante */}
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F8778]" />
              <input
                type="search"
                value={financeSearch}
                onChange={(e) => setFinanceSearch(e.target.value)}
                placeholder="Buscar por descrição ou categoria…"
                className="w-full rounded-xl border border-[#D5CBB8] bg-[#FAF7F2] pl-9 pr-3 py-2 text-xs font-semibold text-[#17251D] placeholder:text-[#9A9182] focus:border-[#17251D] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Filtros em Pílulas */}
            <div className="flex items-center rounded-xl border border-[#D5CBB8] bg-[#FAF7F2] p-1">
              <button
                type="button"
                onClick={() => setFinanceTypeFilter('todos')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-bold transition",
                  financeTypeFilter === 'todos' ? "bg-[#17251D] text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFinanceTypeFilter('entrada')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-bold transition",
                  financeTypeFilter === 'entrada' ? "bg-emerald-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                )}
              >
                Entradas
              </button>
              <button
                type="button"
                onClick={() => setFinanceTypeFilter('saida')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-bold transition",
                  financeTypeFilter === 'saida' ? "bg-rose-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                )}
              >
                Saídas
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Transações ou Guia Visual quando vazio */}
        <div className="mt-4">
          {filteredCashTransactions.length > 0 ? (
            <div className="divide-y divide-[#F0ECE1]">
              {filteredCashTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-[#FAF8F4] px-2 rounded-xl"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                      t.tipo === 'entrada'
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    )}>
                      {t.tipo === 'entrada' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-[#17251D] truncate">
                        {t.descricao}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#796F5E]">
                        <span className="rounded-md bg-[#F0EBE1] px-2 py-0.5 font-bold text-[#4B4436]">
                          {t.categoria || 'Geral'}
                        </span>
                        <span>•</span>
                        <span>{parseFinanceiroDataRef({ data: t.data })?.toLocaleDateString('pt-BR') || 'Data não informada'}</span>
                        {t.filho_id && (
                          <>
                            <span>•</span>
                            <span className="text-[#17251D] font-bold">
                              Filho: {children.find(c => c.id === t.filho_id)?.nome || 'Vinculado'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className={cn(
                      "font-display text-base font-black",
                      t.tipo === 'entrada' ? "text-emerald-700" : "text-rose-700"
                    )}>
                      {t.tipo === 'entrada' ? '+' : '−'} {formatBRL(t.valor)}
                    </span>
                    {renderTransactionActions(t)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Guia Visual do Tesoureiro quando não há movimentações */
            <div className="space-y-6 py-6">
              <div className="rounded-lg border border-dashed border-[#D5CBB8] bg-[#FAF8F3] p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#8F741C]">
                  <Receipt className="h-6 w-6" />
                </div>
                <h4 className="mt-3 font-display text-base font-black text-[#17251D]">
                  {financeSearch ? 'Nenhuma movimentação corresponde à busca' : 'O Livro Caixa da Casa Começa Aqui'}
                </h4>
                <p className="mx-auto mt-1 max-w-md text-xs font-medium text-[#6F675C]">
                  {financeSearch
                    ? 'Tente buscar por outro termo ou limpe os filtros de fluxo.'
                    : 'Registre a primeira entrada ou despesa do terreiro para acompanhar o saldo e emitir balancetes.'}
                </p>
                {isAdmin && !financeSearch && (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#17251D] px-4 py-2.5 text-xs font-black text-[#F4EFE6] shadow-sm transition hover:bg-[#233B2E]"
                  >
                    <Plus className="h-4 w-4 text-[#D4AF37]" />
                    Fazer Primeiro Lançamento
                  </button>
                )}
              </div>

              {/* Dicas Práticas de Gestão Financeira Sagrada */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-[#E5DFD1] bg-[#FAF7F2] p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#8F741C]">✦ Dica 01</span>
                  <h5 className="mt-1 font-display text-sm font-bold text-[#17251D]">Transparência com a Corrente</h5>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#686053]">
                    Manter entradas e saídas registradas permite gerar relatórios em PDF para assembleias do terreiro.
                  </p>
                </div>
                <div className="rounded-lg border border-[#E5DFD1] bg-[#FAF7F2] p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#8F741C]">✦ Dica 02</span>
                  <h5 className="mt-1 font-display text-sm font-bold text-[#17251D]">Separação Litúrgica</h5>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#686053]">
                    Nunca misture a conta pessoal do líder com o caixa do barracão. O terreiro ganha autonomia e axé.
                  </p>
                </div>
                <div className="rounded-lg border border-[#E5DFD1] bg-[#FAF7F2] p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#8F741C]">✦ Dica 03</span>
                  <h5 className="mt-1 font-display text-sm font-bold text-[#17251D]">Gasto por Cerimônia</h5>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#686053]">
                    Lance as notas de velas e ervas logo após o encerramento da gira para manter o saldo sempre real.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal / Dialog de Novo Lançamento com Estilo Sagrado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-[#E0D7C6] bg-[#FAF8F4] p-6 shadow-2xl text-[#17251D]">
            <div className="flex items-center justify-between border-b border-[#E7DFD1] pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#17251D] text-[#D4AF37]">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-display text-base font-black text-[#17251D]">Novo Lançamento</h4>
                  <p className="text-xs text-[#6F675C]">Entrada ou despesa no Livro Caixa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#5C5547] shadow-xs hover:bg-[#EAE3D5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={async (e) => { if (await handleSubmit(e)) setIsModalOpen(false); }} className="mt-5 space-y-4">
              {/* Seletor de Fluxo (Entrada / Saída) */}
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#DCD4C5] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipo: 'entrada' }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition",
                    formData.tipo === 'entrada' ? "bg-emerald-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                  )}
                >
                  <ArrowUpRight className="h-4 w-4" /> Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tipo: 'saida' }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition",
                    formData.tipo === 'saida' ? "bg-rose-700 text-white shadow-xs" : "text-[#5C5547] hover:text-[#17251D]"
                  )}
                >
                  <ArrowDownRight className="h-4 w-4" /> Saída (Despesa)
                </button>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  required
                  type="text"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Compra de velas palito brancas para gira"
                  className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#17251D] placeholder:text-[#9A9182] focus:border-[#17251D] focus:outline-none"
                />
              </div>

              {/* Categoria e Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    Categoria *
                  </label>
                  <select
                    required
                    aria-label="Categoria"
                    value={formData.categoria}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        categoria: cat,
                        ...(cat === 'Mensalidade' ? { status: prev.status || 'pendente' } : {})
                      }));
                    }}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2.5 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  >
                    <option value="">Selecione…</option>
                    <option value="Mensalidade">Mensalidade</option>
                    <option value="Doação">Doação</option>
                    <option value="Insumos">Insumos (Velas/Ervas)</option>
                    <option value="Contas">Contas (Água/Luz)</option>
                    <option value="Manutenção">Manutenção & Obras</option>
                    <option value="Evento">Festa / Cerimônia</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Valor Base (R$) *' : 'Valor (R$) *'}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    aria-label="Valor base"
                    value={formData.valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3.5 py-2.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Opções Avançadas de Mensalidade: Situação + Juros / Multa */}
              {formData.categoria === 'Mensalidade' && (
                <div className="rounded-xl border border-amber-300/70 bg-[#FAF4E6] p-3.5 space-y-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#735A10] mb-1.5">
                      Situação da Mensalidade *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'pendente' }))}
                        className={cn(
                          "rounded-lg py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5",
                          formData.status === 'pendente'
                            ? "bg-amber-600 text-white shadow-xs font-black"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                        )}
                      >
                        <Clock3 className="h-3.5 w-3.5" /> Pendente (Cobrar Filho)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: 'pago' }))}
                        className={cn(
                          "rounded-lg py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5",
                          formData.status === 'pago'
                            ? "bg-emerald-700 text-white shadow-xs font-black"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547] hover:border-emerald-400"
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Quitado (Já Pago)
                      </button>
                    </div>
                  </div>

                  {/* Campo de Juros / Multa por Atraso */}
                  <div className="border-t border-[#E7DFD1] pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#735A10]">
                        Juros / Multa por Atraso (Opcional)
                      </label>
                      <span className="text-[10px] text-[#8C7A52] font-semibold">Calculado automaticamente</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'nenhum', jurosValor: '' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          (!formData.jurosTipo || formData.jurosTipo === 'nenhum')
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Sem juros
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'valor' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          formData.jurosTipo === 'valor'
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Valor fixo (R$)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jurosTipo: 'porcentagem' }))}
                        className={cn(
                          "rounded-lg py-1.5 px-2 text-[11px] font-bold transition text-center",
                          formData.jurosTipo === 'porcentagem'
                            ? "bg-[#17251D] text-white"
                            : "bg-white border border-[#D5CBB8] text-[#5C5547]"
                        )}
                      >
                        Porcentagem (%)
                      </button>
                    </div>

                    {formData.jurosTipo === 'valor' && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#635A4B] mb-1">
                          Valor adicional de juros/multa (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7A52]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.jurosValor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, jurosValor: e.target.value }))}
                            placeholder="5.00"
                            className="w-full rounded-lg border border-[#D5CBB8] bg-white pl-8 pr-3 py-1.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {formData.jurosTipo === 'porcentagem' && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#635A4B] mb-1">
                          Taxa percentual de juros/multa (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={formData.jurosValor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, jurosValor: e.target.value }))}
                            placeholder="2"
                            className="w-full rounded-lg border border-[#D5CBB8] bg-white pl-3 pr-8 py-1.5 text-xs font-black text-[#17251D] focus:border-[#17251D] focus:outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#8C7A52]">%</span>
                        </div>
                      </div>
                    )}

                    {/* Resumo do cálculo dinâmico */}
                    {(() => {
                      const base = parseFloat(formData.valor) || 0;
                      const jVal = parseFloat(formData.jurosValor || '0') || 0;
                      if (base <= 0 || jVal <= 0 || !formData.jurosTipo || formData.jurosTipo === 'nenhum') return null;
                      let extra = 0;
                      if (formData.jurosTipo === 'valor') extra = jVal;
                      if (formData.jurosTipo === 'porcentagem') extra = (base * jVal) / 100;
                      const total = base + extra;
                      return (
                        <div className="mt-2.5 rounded-lg bg-amber-100/90 border border-amber-300 p-2.5 text-xs flex items-center justify-between font-medium text-amber-950">
                          <span>
                            Base: <strong>R$ {base.toFixed(2)}</strong> + Juros: <strong>R$ {extra.toFixed(2)}</strong>
                            {formData.jurosTipo === 'porcentagem' ? ` (${jVal}%)` : ''}
                          </span>
                          <span className="font-black text-emerald-800 text-sm">
                            Total: R$ {total.toFixed(2)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Data e Vínculo a Filho */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Data de Vencimento da Mensalidade *' : 'Data do Lançamento *'}
                  </label>
                  <input
                    required
                    type="date"
                    aria-label="Data do lançamento ou vencimento"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  />
                  {formData.categoria === 'Mensalidade' && (
                    <div className="mt-1 space-y-1">
                      <p className="text-[10px] text-amber-800 font-medium leading-tight">
                        Para cobrar mês atrasado, informe a data em que ela venceu (ex: 10/09 ou 10/10). O sistema identifica o mês no portal do filho por esta data.
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(() => {
                          const now = new Date();
                          const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 10);
                          const prevYmd = prevM.toISOString().split('T')[0];
                          const prevShort = prevM.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                          const currM = new Date(now.getFullYear(), now.getMonth(), 10);
                          const currYmd = currM.toISOString().split('T')[0];
                          const currShort = currM.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, data: prevYmd }))}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded font-bold transition border",
                                  formData.data === prevYmd
                                    ? "bg-amber-600 border-amber-700 text-white"
                                    : "bg-white border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                                )}
                              >
                                Mês anterior ({prevShort}/10)
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, data: currYmd }))}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded font-bold transition border",
                                  formData.data === currYmd
                                    ? "bg-amber-600 border-amber-700 text-white"
                                    : "bg-white border-[#D5CBB8] text-[#5C5547] hover:border-amber-400"
                                )}
                              >
                                Mês atual ({currShort}/10)
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#635A4B] mb-1">
                    {formData.categoria === 'Mensalidade' ? 'Filho de santo *' : 'Vincular a filho (opcional)'}
                  </label>
                  <select
                    required={formData.categoria === 'Mensalidade'}
                    aria-label="Filho de santo"
                    value={formData.filho_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, filho_id: e.target.value }))}
                    className="w-full rounded-xl border border-[#D5CBB8] bg-white px-3 py-2 text-xs font-semibold text-[#17251D] focus:border-[#17251D] focus:outline-none"
                  >
                    <option value="">Nenhum filho</option>
                    {children.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {submitError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{submitError}</p>}
              {/* Botão de Conclusão */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#17251D] py-3 text-xs sm:text-sm font-black text-[#F4EFE6] shadow-md transition hover:bg-[#243B2E] disabled:opacity-60"
                >
                  {isSubmitting ? 'Gravando no Caixa…' : 'Salvar Lançamento no Livro Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
