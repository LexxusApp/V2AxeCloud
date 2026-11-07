import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  Loader2,
  Plus,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import {
  ObligationScheduleModal,
  type ObligationFormData,
} from '../components/child-profile/ObligationScheduleModal';
import { authFetch } from '../lib/authenticatedFetch';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { showHouseToast } from '../lib/houseToast';
import {
  AxeBadge,
  AxeButton,
  AxeEmptyState,
  AxeFilterBar,
  AxeMetricCard,
  AxeMetricRail,
  AxePageHeader,
} from '../components/shared/AxePageScaffold';

type Member = { id: string; nome: string; user_id?: string | null };

type Obligation = {
  id: string;
  titulo: string;
  data: string;
  hora: string | null;
  descricao: string;
  status: string;
  childId: string;
  childName: string;
  pdfPath: string | null;
};

type Props = {
  user: { id: string };
  tenantData?: { tenant_id?: string | null } | null;
  setActiveTab: (tab: string) => void;
  setSelectedChildId: (id: string | null) => void;
};

const EMPTY_FORM: ObligationFormData = {
  titulo: '',
  data: '',
  hora: '19:00',
  descricao: '',
  notifyChild: true,
};

const FILTER_OPTIONS = [
  { id: 'todas', label: 'Todas' },
  { id: 'proximas', label: 'Próximas' },
  { id: 'atrasadas', label: 'Atrasadas' },
  { id: 'concluidas', label: 'Concluídas' },
];

function childIdFromDescription(value: unknown) {
  return String(value || '').match(/FILHO_ID:([0-9a-f-]{36})/i)?.[1] || '';
}

function cleanDescription(value: unknown) {
  return String(value || '').split('\n\n=== METADADOS ===')[0].trim();
}

function isDone(item: Obligation) {
  return item.status === 'Confirmado' || item.status === 'Concluído';
}

function isOverdue(item: Obligation) {
  return !isDone(item) && item.data < new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Obligations({ user, tenantData, setActiveTab, setSelectedChildId }: Props) {
  const tenantId = String(tenantData?.tenant_id || user.id);
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todas' | 'proximas' | 'atrasadas' | 'concluidas'>('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [form, setForm] = useState<ObligationFormData>(EMPTY_FORM);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch(
        `/api/children?userId=${encodeURIComponent(user.id)}&tenantId=${encodeURIComponent(tenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os membros.');
      const nextMembers = (payload.data || []) as Member[];
      setMembers(nextMembers);
      const names = new Map(nextMembers.map((member) => [member.id, member.nome]));

      const { data, error: calendarError } = await supabase
        .from('calendario_axe')
        .select('id,titulo,data,hora,descricao,status_confirmacao,pdf_storage_path')
        .eq('tenant_id', tenantId)
        .eq('tipo', 'Obrigação')
        .order('data', { ascending: true });

      if (calendarError) throw calendarError;

      setItems(
        (data || []).map((row) => {
          const childId = childIdFromDescription(row.descricao);
          return {
            id: String(row.id),
            titulo: String(row.titulo || 'Obrigação'),
            data: String(row.data || ''),
            hora: row.hora ? String(row.hora) : null,
            descricao: cleanDescription(row.descricao),
            status: String(row.status_confirmacao || 'Pendente'),
            childId,
            childName: names.get(childId) || 'Membro não identificado',
            pdfPath: row.pdf_storage_path ? String(row.pdf_storage_path) : null,
          };
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as obrigações.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      upcoming: items.filter((item) => !isDone(item) && !isOverdue(item)).length,
      overdue: items.filter(isOverdue).length,
      done: items.filter(isDone).length,
      members: new Set(items.map((item) => item.childId).filter(Boolean)).size,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      const textMatch =
        !term ||
        `${item.titulo} ${item.childName} ${item.descricao}`.toLocaleLowerCase('pt-BR').includes(term);
      const filterMatch =
        filter === 'todas' ||
        (filter === 'proximas' && !isDone(item) && !isOverdue(item)) ||
        (filter === 'atrasadas' && isOverdue(item)) ||
        (filter === 'concluidas' && isDone(item));
      return textMatch && filterMatch;
    });
  }, [filter, items, query]);

  function openNew() {
    setForm({ ...EMPTY_FORM, data: new Date().toISOString().slice(0, 10) });
    setSelectedMemberId('');
    setPdfFile(null);
    setModalOpen(true);
  }

  async function uploadPdf(file: File, childId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');

    const response = await authFetch('/api/v1/obrigacao-pdf/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fileName: file.name, contentType: 'application/pdf', tenantId, childId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível preparar o PDF.');

    const { error: uploadError } = await supabase.storage
      .from('biblioteca_estudos')
      .uploadToSignedUrl(payload.path, payload.token, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;
    return String(payload.path);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMemberId) return showHouseToast('Selecione o filho de santo.', 'error');
    setSaving(true);
    showHouseToast('Registrando obrigação…', 'info');

    try {
      const pdfPath = pdfFile ? await uploadPdf(pdfFile, selectedMemberId) : null;
      const insert: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        data: form.data,
        hora: form.hora,
        descricao: `${form.descricao.trim()}\n\n=== METADADOS ===\nFILHO_ID:${selectedMemberId}`,
        tipo: 'Obrigação',
        lider_id: user.id,
        tenant_id: tenantId,
        status_confirmacao: 'Pendente',
      };
      if (pdfPath) insert.pdf_storage_path = pdfPath;

      const { error: insertError } = await supabase.from('calendario_axe').insert(insert);
      if (insertError) throw insertError;

      const member = members.find((entry) => entry.id === selectedMemberId);
      if (form.notifyChild && member?.user_id) {
        await authFetch('/api/push-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: selectedMemberId,
            title: '🌿 Nova obrigação de Axé',
            body: `A obrigação “${form.titulo.trim()}” foi registrada para ${formatDate(form.data)}.`,
            url: '/?tab=obrigacoes',
          }),
        }).catch(() => undefined);
      }

      setModalOpen(false);
      await load();
      showHouseToast('Obrigação registrada com sucesso');
    } catch (saveError) {
      showHouseToast(
        saveError instanceof Error ? saveError.message : 'Não foi possível salvar a obrigação.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function complete(item: Obligation) {
    setBusyId(item.id);
    showHouseToast('Concluindo obrigação…', 'info');
    try {
      const { error: updateError } = await supabase
        .from('calendario_axe')
        .update({ status_confirmacao: 'Concluído' })
        .eq('id', item.id)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, status: 'Concluído' } : entry)),
      );
      showHouseToast('Obrigação marcada como concluída');
    } catch (completeError) {
      showHouseToast(
        completeError instanceof Error ? completeError.message : 'Não foi possível concluir a obrigação.',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openPdf(item: Obligation) {
    if (!item.pdfPath) return;
    setOpeningPdf(item.id);
    try {
      const url = `/api/v1/library/pdf-proxy?tenantId=${encodeURIComponent(tenantId)}&path=${encodeURIComponent(item.pdfPath)}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error('Não foi possível abrir o documento.');
      const objectUrl = URL.createObjectURL(await response.blob());
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (pdfError) {
      showHouseToast(
        pdfError instanceof Error ? pdfError.message : 'Erro ao abrir o documento.',
        'error',
      );
    } finally {
      setOpeningPdf(null);
    }
  }

  function openMember(item: Obligation) {
    if (item.childId) {
      setSelectedChildId(item.childId);
      setActiveTab('profile');
    }
  }

  return (
    <AppPageShell>
      <div className="space-y-5">
        {/* 1. Unified Page Header */}
        <AxePageHeader
          kicker="Casa · Cuidado Litúrgico"
          title="Central de Obrigações"
          description="Acompanhe os compromissos de cada filho, documentos de estudo e ritos importantes sem abrir um perfil por vez."
          actions={
            <AxeButton
              type="button"
              variant="primary"
              onClick={openNew}
              icon={Plus}
            >
              Nova obrigação
            </AxeButton>
          }
        />

        {/* 2. Unified Metric Rail */}
        <AxeMetricRail>
          <AxeMetricCard
            label="Próximas"
            value={totals.upcoming}
            icon={CalendarClock}
            tone="amber"
            subtext="programadas"
          />
          <AxeMetricCard
            label="Atrasadas"
            value={totals.overdue}
            icon={AlertTriangle}
            tone="rose"
            subtext="pedem atenção"
          />
          <AxeMetricCard
            label="Concluídas"
            value={totals.done}
            icon={CheckCircle2}
            tone="emerald"
            subtext="finalizadas"
          />
          <AxeMetricCard
            label="Membros acompanhados"
            value={totals.members}
            icon={Users}
            tone="blue"
            subtext="com registros"
          />
        </AxeMetricRail>

        {/* 3. Unified Filter Bar */}
        <AxeFilterBar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: 'Buscar por obrigação ou membro...',
          }}
          filterTabs={{
            current: filter,
            options: FILTER_OPTIONS,
            onChange: (id) => setFilter(id as typeof filter),
          }}
        />

        {/* 4. Content Area */}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1F5942]" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : visible.length === 0 ? (
          !items.length ? (
            <div className="space-y-5">
              {/* Main Welcome Hero */}
              <div className="relative overflow-hidden rounded-lg border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                    <span>✦</span>
                    <span>Cuidado Espiritual da Corrente</span>
                  </div>
                  <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                    Acompanhamento Litúrgico das Obrigações
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                    Registre os ritos sagrados de cada filho da casa: boris, confirmações, 1 ano, 3 anos e 7 anos. Anexe apostilas de estudo e avise o médium automaticamente via WhatsApp.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <AxeButton
                      onClick={openNew}
                      icon={Plus}
                      variant="primary"
                      size="lg"
                    >
                      Registrar primeira obrigação
                    </AxeButton>
                  </div>
                </div>
              </div>

              {/* 4 Liturgical Guidance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-lg border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                    <Flame className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    1 Ano · Fechamento
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Firmeza de anjo da guarda, banhos de ervas e fechamento de corpo da corrente.
                  </p>
                </div>

                <div className="rounded-lg border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    3 Anos · Confirmação
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Reforço litúrgico dos orixás de cabeça e confirmação de linhagem mediúnica.
                  </p>
                </div>

                <div className="rounded-lg border border-[#DFC2E9] bg-gradient-to-br from-white to-[#FAF6FB] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5EEF9] border border-[#DEC7E6] text-[#6B2F96]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    7 Anos · Decá
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Maioridade sacerdotal, entrega de direitos e coroação litúrgica do filho.
                  </p>
                </div>

                <div className="rounded-lg border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                    Bori & Estudos
                  </strong>
                  <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                    Alimentação da cabeça, documentos e apostilas anexadas em PDF para o filho.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <AxeEmptyState
              icon={Flame}
              title="Nenhuma obrigação neste filtro"
              description="Tente selecionar outro filtro ou limpar a busca acima."
            />
          )
        ) : (
          <div className="space-y-3">
            {visible.map((item) => {
              const done = isDone(item);
              const overdue = isOverdue(item);

              return (
                <article
                  key={item.id}
                  className={cn(
                    'group rounded-lg border bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(28,37,31,0.03)] transition-all duration-200 hover:border-[#D8CDBA] hover:shadow-[0_4px_16px_rgba(28,37,31,0.06)]',
                    overdue
                      ? 'border-red-200 bg-[#FFFDFD]'
                      : done
                      ? 'border-emerald-200/80 bg-[#FAFDFB]'
                      : 'border-[#E6DFD3]',
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                          overdue
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700',
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : overdue ? (
                          <AlertTriangle className="h-5 w-5" />
                        ) : (
                          <Flame className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-black text-[#17251D]">
                            {item.titulo}
                          </h3>
                          <AxeBadge
                            variant={overdue ? 'rose' : done ? 'emerald' : 'amber'}
                          >
                            {overdue ? 'Atrasada' : done ? 'Concluída' : 'Programada'}
                          </AxeBadge>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => openMember(item)}
                            disabled={!item.childId}
                            className="inline-flex items-center gap-1 font-bold text-[#1F5942] hover:underline disabled:text-[#8A958E]"
                          >
                            <UserRound className="h-3.5 w-3.5" />
                            {item.childName}
                          </button>

                          <span className="flex items-center gap-1 font-semibold text-[#59655E]">
                            <Clock3 className="h-3.5 w-3.5 text-[#8A958E]" />
                            {formatDate(item.data)}
                            {item.hora ? ` às ${item.hora.slice(0, 5)}` : ''}
                          </span>
                        </div>

                        {item.descricao && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#59655E]">
                            {item.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0 justify-end">
                      {item.pdfPath && (
                        <AxeButton
                          type="button"
                          variant="secondary"
                          style={{ backgroundColor: '#FFFFFF', color: '#17251D', borderColor: '#D8CDBA' }}
                          size="sm"
                          icon={FileText}
                          onClick={() => void openPdf(item)}
                          disabled={openingPdf === item.id}
                          loading={openingPdf === item.id}
                        >
                          Documento
                        </AxeButton>
                      )}

                      {!done && (
                        <AxeButton
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Check}
                          onClick={() => void complete(item)}
                          disabled={busyId === item.id}
                          loading={busyId === item.id}
                        >
                          Concluir
                        </AxeButton>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ObligationScheduleModal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        onSubmit={save}
        formData={form}
        setFormData={setForm}
        pdfFile={pdfFile}
        setPdfFile={setPdfFile}
        isSubmitting={saving}
        showNotifyCheckbox
        memberOptions={members}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
      />
    </AppPageShell>
  );
}
