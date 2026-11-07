import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Flame,
  Loader2,
  QrCode,
  Search,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { AppPageShell, AppPanelLoading } from '../components/app/AppTopNav';
import { fetchFrequenciaReport } from '../lib/giraOperations';
import { cn } from '../lib/utils';
import Avatar from '../components/Avatar';
import {
  AxeBadge,
  AxeButton,
  AxeEmptyState,
  AxeFilterBar,
  AxeMetricCard,
  AxeMetricRail,
  AxePageHeader,
} from '../components/shared/AxePageScaffold';

type Props = {
  tenantData?: { tenant_id?: string | null; plan?: string; is_admin_global?: boolean };
  setActiveTab: (tab: string) => void;
};

type SortMode = 'assiduidade' | 'presentes' | 'nome';

const FILTER_TABS = [
  { id: 'todos', label: 'Todos os membros' },
  { id: 'alta', label: 'Alta assiduidade (≥80%)' },
  { id: 'atencao', label: 'Precisam de atenção (<80%)' },
];

export default function Frequencia({ tenantData, setActiveTab }: Props) {
  const tenantId = tenantData?.tenant_id || '';
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchFrequenciaReport>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [sortBy, setSortBy] = useState<SortMode>('assiduidade');

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    void fetchFrequenciaReport(tenantId)
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao carregar relatório'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    if (!rows.length) return { mediaAssiduidade: 0, totalPresencas: 0, totalFaltas: 0, avaliados: 0 };
    const totalPresencas = rows.reduce((acc, r) => acc + (r.presentes || 0), 0);
    const totalFaltas = rows.reduce((acc, r) => acc + (r.faltas || 0), 0);
    const mediaAssiduidade = Math.round(
      rows.reduce((acc, r) => acc + (r.assiduidade_pct || 0), 0) / rows.length,
    );
    return {
      mediaAssiduidade,
      totalPresencas,
      totalFaltas,
      avaliados: rows.length,
    };
  }, [rows]);

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const matchesSearch =
          !term ||
          r.nome.toLowerCase().includes(term) ||
          String(r.cargo || '').toLowerCase().includes(term);

        const matchesFilter =
          filter === 'todos' ||
          (filter === 'alta' && r.assiduidade_pct >= 80) ||
          (filter === 'atencao' && r.assiduidade_pct < 80);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR');
        if (sortBy === 'presentes') return b.presentes - a.presentes;
        return b.assiduidade_pct - a.assiduidade_pct;
      });
  }, [rows, search, filter, sortBy]);

  if (loading) {
    return (
      <AppPageShell>
        <AppPanelLoading />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <div className="space-y-5">
        {/* 1. Unified Page Header */}
        <AxePageHeader
          kicker="Corrente · Assiduidade Litúrgica"
          title="Frequência da Corrente"
          description="Acompanhe a assiduidade dos filhos de santo nas giras com presença confirmada por QR Code, chamada ou aplicativo."
          actions={
            <AxeButton
              type="button"
              variant="primary"
              onClick={() => setActiveTab('calendar')}
              icon={CalendarDays}
            >
              Ver giras da casa
            </AxeButton>
          }
        />

        {/* 2. Unified Metric Rail */}
        <AxeMetricRail>
          <AxeMetricCard
            label="Assiduidade média"
            value={`${stats.mediaAssiduidade}%`}
            icon={TrendingUp}
            tone={stats.mediaAssiduidade >= 75 ? 'emerald' : 'amber'}
            subtext="geral da casa"
          />
          <AxeMetricCard
            label="Total de presenças"
            value={stats.totalPresencas}
            icon={UserCheck}
            tone="blue"
            subtext="em todas as giras"
          />
          <AxeMetricCard
            label="Faltas registradas"
            value={stats.totalFaltas}
            icon={UserX}
            tone={stats.totalFaltas > 0 ? 'rose' : 'neutral'}
            subtext="ausências computadas"
          />
          <AxeMetricCard
            label="Membros avaliados"
            value={stats.avaliados}
            icon={Users}
            tone="purple"
            subtext="na corrente"
          />
        </AxeMetricRail>

        {/* 3. Unified Filter Bar */}
        <AxeFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Buscar por nome ou cargo...',
          }}
          filterTabs={{
            current: filter,
            options: FILTER_TABS,
            onChange: setFilter,
          }}
          sort={{
            value: sortBy,
            options: [
              { id: 'assiduidade', label: 'Maior assiduidade' },
              { id: 'presentes', label: 'Mais presenças' },
              { id: 'nome', label: 'Nome' },
            ],
            onChange: (id) => setSortBy(id as SortMode),
            label: 'Ordem',
          }}
        />

        {/* 4. Content List */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : filteredRows.length === 0 ? (
          !rows.length ? (
            <div className="space-y-5">
              {/* Main Welcome Hero */}
              <div className="relative overflow-hidden rounded-lg border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                    <span>✦</span>
                    <span>Disciplina Sagrada & Firmeza</span>
                  </div>
                  <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                    Assiduidade & Presença da Corrente
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                    Acompanhe quem sustenta a gira da casa. O AxéCloud unifica confirmações prévias no app do filho, bip na porteira por QR Code e chamada rápida da zeladoria.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <AxeButton
                      onClick={() => setActiveTab('calendar')}
                      icon={CalendarDays}
                      variant="primary"
                      size="lg"
                    >
                      Abrir calendário de giras
                    </AxeButton>
                  </div>
                </div>
              </div>

              {/* 3 Methods Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-lg border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    1. QR Code na Porteira
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Coloque o totem com QR Code na entrada para os médiuns biparem ao chegar.
                  </p>
                </div>

                <div className="rounded-lg border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    2. Confirmação no App
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    O médium confirma presença antes dos trabalhos para dimensionar a corrente.
                  </p>
                </div>

                <div className="rounded-lg border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    3. Chamada da Zeladoria
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Lançamento de presenças ou faltas justificadas pelo painel com 1 toque.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AxeEmptyState
              icon={Users}
              title="Nenhum membro encontrado neste filtro"
              description="Tente selecionar outro filtro ou limpar o campo de busca acima."
            />
          )
        ) : (
          <div className="space-y-3">
            {filteredRows.map((r, idx) => {
              const isHigh = r.assiduidade_pct >= 80;
              const isMid = r.assiduidade_pct >= 50 && r.assiduidade_pct < 80;

              return (
                <article
                  key={r.filho_id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[#E6DFD3] bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(28,37,31,0.03)] transition-all hover:border-[#D8CDBA] hover:shadow-[0_4px_16px_rgba(28,37,31,0.06)]"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Rank Circle */}
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-xs font-black tabular-nums border',
                        idx < 3
                          ? 'border-[#B88728]/30 bg-[#FEF7E6] text-[#8F630E]'
                          : 'border-[#E6DFD3] bg-[#FAF7F2] text-[#59655E]',
                      )}
                    >
                      {idx + 1}
                    </span>

                    {/* Member Avatar */}
                    <Avatar
                      src={r.foto_url}
                      name={r.nome}
                      shape="circle"
                      textSize="text-xs"
                      className="h-11 w-11 shrink-0 border border-[#E6DFD3]"
                    />

                    {/* Identity */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-black text-[#17251D] group-hover:text-[#1F5942] transition-colors">
                        {r.nome}
                      </h3>
                      <p className="truncate text-xs font-bold text-[#59655E]">
                        {r.cargo || 'Filho de santo'}
                      </p>
                    </div>
                  </div>

                  {/* Attendance Stats & Progress */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 justify-between sm:justify-end border-t sm:border-t-0 border-[#F0EBE1] pt-3 sm:pt-0">
                    <div className="flex items-center gap-4 text-center">
                      <div>
                        <strong className="block font-display text-base font-black text-[#1F5942] tabular-nums">
                          {r.presentes}
                        </strong>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A958E]">
                          Presentes
                        </span>
                      </div>
                      <div className="border-x border-[#E6DFD3] px-3">
                        <strong className="block font-display text-base font-black text-[#17251D] tabular-nums">
                          {r.confirmados}
                        </strong>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A958E]">
                          Confirmados
                        </span>
                      </div>
                      <div>
                        <strong className="block font-display text-base font-black text-[#9E2A1C] tabular-nums">
                          {r.faltas}
                        </strong>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A958E]">
                          Faltas
                        </span>
                      </div>
                    </div>

                    {/* Assiduidade Badge & Mini Track */}
                    <div className="flex items-center gap-2.5 sm:min-w-[130px] justify-end">
                      <AxeBadge
                        variant={isHigh ? 'emerald' : isMid ? 'amber' : 'rose'}
                        icon={TrendingUp}
                      >
                        {r.assiduidade_pct}%
                      </AxeBadge>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
