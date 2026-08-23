import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarHeart,
  Clock3,
  ChevronRight,
  ClipboardPlus,
  FileText,
  GraduationCap,
  HandHeart,
  Landmark,
  Loader2,
  FileCheck2,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
  UploadCloud,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import { authFetch } from '../lib/authenticatedFetch';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export type AdvancedSection =
  | 'reports'
  | 'patrimony'
  | 'documents'
  | 'consulentes'
  | 'atendimento-agenda'
  | 'journey'
  | 'liturgical'
  | 'development'
  | 'camarinha';

type RegistryItem = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  filho_id?: string | null;
  valor?: number | null;
  metadata?: Record<string, unknown>;
  updated_at: string;
};
type ChildOption = { id: string; nome: string };
type Report = {
  activeChildren: number;
  upcomingEvents: number;
  upcomingObligations: number;
  lowStock: number;
  receitas: number;
  despesas: number;
  saldo: number;
  mensalidadesPendentes: number;
  moduleCounts: Record<string, number>;
  attention?: {
    upcomingAppointments: number;
    followUps: number;
    documentDeadlines: number;
    maintenanceItems: number;
    activeFormation: number;
  };
};
type MetaField = { key: string; label: string; placeholder: string; type?: 'text' | 'url' | 'tel' };
type ModuleConfig = {
  resource: string;
  title: string;
  singular: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  statuses: string[];
  meta: MetaField[];
  usesMember?: boolean;
  usesValue?: boolean;
  usesEndDate?: boolean;
  nextStatus?: Record<string, string>;
};

const MODULES: Record<AdvancedSection, ModuleConfig> = {
  reports: { resource: 'relatorios', title: 'Visão da casa', singular: 'Indicador', description: 'Pendências, prazos e próximos passos reunidos para a zeladoria agir.', icon: BarChart3, accent: '#24614A', statuses: [], meta: [] },
  patrimony: { resource: 'patrimonio', title: 'Patrimônio sagrado', singular: 'Bem', description: 'Acompanhe localização, responsável, valor e necessidade de manutenção.', icon: Landmark, accent: '#9B7115', statuses: ['ativo', 'manutenção', 'emprestado', 'baixado'], usesValue: true, nextStatus: { manutenção: 'ativo', emprestado: 'ativo' }, meta: [{ key: 'codigo', label: 'Código', placeholder: 'PAT-001' }, { key: 'localizacao', label: 'Localização', placeholder: 'Salão principal' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Nome da pessoa responsável' }] },
  documents: { resource: 'documentos', title: 'Documentos e vencimentos', singular: 'Documento', description: 'Guarde arquivos importantes e acompanhe revisão, validade e responsáveis.', icon: FileText, accent: '#A84D39', statuses: ['vigente', 'em revisão', 'vencido', 'arquivado'], usesEndDate: true, nextStatus: { 'em revisão': 'vigente', vencido: 'em revisão' }, meta: [{ key: 'categoria', label: 'Categoria', placeholder: 'Estatuto, ata ou contrato' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Secretaria' }] },
  consulentes: { resource: 'consulentes', title: 'Pessoas acolhidas', singular: 'Acolhimento', description: 'Mantenha contato e contexto de quem procura orientação na casa.', icon: Users, accent: '#2B7180', statuses: ['ativo', 'acompanhamento', 'inativo'], meta: [{ key: 'telefone', label: 'Telefone', placeholder: '(11) 99999-9999', type: 'tel' }, { key: 'email', label: 'E-mail', placeholder: 'contato@exemplo.com' }, { key: 'origem', label: 'Como conheceu a casa', placeholder: 'Indicação, mapa, evento...' }] },
  'atendimento-agenda': { resource: 'atendimentos', title: 'Agenda e retornos', singular: 'Atendimento', description: 'Confirme horários, registre quem atendeu e não perca retornos combinados.', icon: HandHeart, accent: '#7C4B7C', statuses: ['agendado', 'confirmado', 'realizado', 'retorno', 'cancelado'], usesEndDate: true, nextStatus: { agendado: 'confirmado', confirmado: 'realizado', retorno: 'realizado' }, meta: [{ key: 'consulente', label: 'Pessoa atendida', placeholder: 'Nome da pessoa' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Quem realizará o atendimento' }, { key: 'contato', label: 'Contato', placeholder: 'Telefone ou WhatsApp', type: 'tel' }] },
  journey: { resource: 'caminhada', title: 'Caminhada da corrente', singular: 'Marco', description: 'Registre iniciações, obrigações e responsabilidades no histórico de cada filho.', icon: Route, accent: '#B15B3F', statuses: ['planejado', 'em andamento', 'concluído'], usesMember: true, nextStatus: { planejado: 'em andamento', 'em andamento': 'concluído' }, meta: [{ key: 'categoria', label: 'Tipo de marco', placeholder: 'Iniciação, obrigação, cargo...' }, { key: 'registrado_por', label: 'Registrado por', placeholder: 'Zeladoria' }] },
  liturgical: { resource: 'liturgico', title: 'Calendário litúrgico', singular: 'Marco litúrgico', description: 'Organize datas recorrentes da tradição antes de transformá-las em giras.', icon: CalendarHeart, accent: '#93651B', statuses: ['ativo', 'rascunho', 'inativo'], usesEndDate: true, nextStatus: { rascunho: 'ativo' }, meta: [{ key: 'tradicao', label: 'Tradição ou nação', placeholder: 'Umbanda, Ketu, Angola...' }, { key: 'recorrencia', label: 'Recorrência', placeholder: 'Anual, mensal ou única' }, { key: 'orientacao', label: 'Orientação para a corrente', placeholder: 'Informação breve para a corrente' }] },
  development: { resource: 'desenvolvimento', title: 'Turmas e desenvolvimento', singular: 'Encontro formativo', description: 'Acompanhe turmas, facilitadores, encontros e progresso formativo.', icon: GraduationCap, accent: '#286157', statuses: ['planejado', 'em andamento', 'concluído', 'cancelado'], usesEndDate: true, nextStatus: { planejado: 'em andamento', 'em andamento': 'concluído' }, meta: [{ key: 'facilitador', label: 'Facilitador', placeholder: 'Responsável pela atividade' }, { key: 'turma', label: 'Turma', placeholder: 'Desenvolvimento 2026' }, { key: 'frequencia', label: 'Encontros ou progresso', placeholder: 'Ex.: 8 encontros realizados' }] },
  camarinha: { resource: 'camarinha', title: 'Ciclos de camarinha', singular: 'Ciclo', description: 'Acompanhe etapas, prazos e responsáveis em uma área reservada.', icon: Archive, accent: '#603C68', statuses: ['planejado', 'em recolhimento', 'concluído', 'cancelado'], usesMember: true, usesEndDate: true, nextStatus: { planejado: 'em recolhimento', 'em recolhimento': 'concluído' }, meta: [{ key: 'responsavel', label: 'Responsável', placeholder: 'Responsável pelo acompanhamento' }, { key: 'local', label: 'Local reservado', placeholder: 'Informação interna' }, { key: 'restricoes', label: 'Restrições de acesso', placeholder: 'Somente zeladoria' }] },
};

type WorkflowId = 'overview' | 'care' | 'formation' | 'secretariat';
type WorkflowConfig = { id: WorkflowId; title: string; description: string; entry: AdvancedSection; sections: AdvancedSection[]; icon: LucideIcon };
const WORKFLOWS: WorkflowConfig[] = [
  { id: 'overview', title: 'Visão da casa', description: 'O que precisa da sua decisão agora.', entry: 'reports', sections: ['reports'], icon: BarChart3 },
  { id: 'care', title: 'Atendimentos', description: 'Pessoas, agenda e retornos em um único fluxo.', entry: 'consulentes', sections: ['consulentes', 'atendimento-agenda'], icon: HandHeart },
  { id: 'formation', title: 'Formação da corrente', description: 'Caminhada, turmas e ciclos reservados.', entry: 'journey', sections: ['journey', 'development', 'camarinha'], icon: GraduationCap },
  { id: 'secretariat', title: 'Secretaria da casa', description: 'Documentos, patrimônio e calendário litúrgico.', entry: 'documents', sections: ['documents', 'patrimony', 'liturgical'], icon: FileText },
];
const WORKFLOW_BY_SECTION = Object.fromEntries(WORKFLOWS.flatMap((workflow) => workflow.sections.map((entry) => [entry, workflow]))) as Record<AdvancedSection, WorkflowConfig>;
const EMPTY_COPY: Record<Exclude<AdvancedSection, 'reports'>, { title: string; description: string }> = {
  patrimony: { title: 'Comece pelos bens que não podem se perder.', description: 'Cadastre um atabaque, instrumento, móvel ou equipamento e informe onde está e quem cuida dele.' },
  documents: { title: 'Centralize o primeiro documento importante.', description: 'Envie o arquivo, indique o responsável e use o vencimento para lembrar da próxima revisão.' },
  consulentes: { title: 'Registre a primeira pessoa acolhida.', description: 'O contato e o contexto ficam privados e podem ser usados para organizar atendimentos e retornos.' },
  'atendimento-agenda': { title: 'Agende um atendimento real.', description: 'Defina horário, responsável e contato. Depois avance o atendimento até realizado ou retorno.' },
  journey: { title: 'Inicie uma caminhada com contexto.', description: 'Vincule o marco a um filho de santo para formar uma linha do tempo individual.' },
  liturgical: { title: 'Registre uma data da tradição.', description: 'Organize recorrência e orientação antes de levar a data para a agenda da casa.' },
  development: { title: 'Abra a primeira atividade formativa.', description: 'Informe turma, facilitador e período para acompanhar o desenvolvimento da corrente.' },
  camarinha: { title: 'Organize um ciclo reservado.', description: 'Vincule o filho de santo, o responsável e os prazos sem expor informações fora da zeladoria.' },
};
const EMPTY_FORM = { titulo: '', descricao: '', status: 'ativo', data_inicio: '', data_fim: '', filho_id: '', valor: '', meta: {} as Record<string, string> };

function dateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function safeLink(value: unknown) {
  const raw = String(value || '').trim();
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function documentMime(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return DOCUMENT_MIME_BY_EXTENSION[extension] || file.type.toLowerCase();
}

export default function AdvancedManagement({ section, tenantData, setActiveTab }: { section: AdvancedSection; tenantData?: { tenant_id?: string | null }; setActiveTab: (tab: string) => void }) {
  const tenantId = String(tenantData?.tenant_id || '');
  const config = MODULES[section];
  const Icon = config.icon;
  const workflow = WORKFLOW_BY_SECTION[section];
  const WorkflowIcon = workflow.icon;
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, meta: {} as Record<string, string> });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const response = await authFetch(`/api/v1/gestao/${config.resource}?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar este módulo.');
      if (section === 'reports') setReport(data.report || null);
      else setItems(data.items || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar este módulo.');
    } finally {
      setLoading(false);
    }
  }, [config.resource, section, tenantId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!config.usesMember || !tenantId) return;
    void authFetch(`/api/children?tenantId=${encodeURIComponent(tenantId)}&userRole=admin`)
      .then(async (response) => response.ok ? response.json() : { data: [] })
      .then((data) => setChildren((data.data || []).map((child: ChildOption) => ({ id: child.id, nome: child.nome }))));
  }, [config.usesMember, tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    if (!q) return items;
    return items.filter((item) => `${item.titulo} ${item.descricao || ''} ${item.status}`.toLocaleLowerCase('pt-BR').includes(q));
  }, [items, search]);

  const itemSummary = useMemo(() => {
    const now = Date.now();
    const nextThirtyDays = now + 30 * 86_400_000;
    const completed = new Set(['concluído', 'realizado', 'cancelado', 'arquivado', 'baixado', 'inativo']);
    let upcoming = 0;
    let overdue = 0;
    let attention = 0;
    for (const item of items) {
      const status = item.status.toLocaleLowerCase('pt-BR');
      const start = item.data_inicio ? new Date(item.data_inicio).getTime() : Number.NaN;
      const end = item.data_fim ? new Date(item.data_fim).getTime() : Number.NaN;
      if (!completed.has(status) && Number.isFinite(start) && start >= now && start <= nextThirtyDays) upcoming += 1;
      if (!completed.has(status) && Number.isFinite(end) && end < now) overdue += 1;
      if (['retorno', 'manutenção', 'vencido', 'em revisão'].includes(status)) attention += 1;
    }
    return { total: items.length, upcoming, attention: attention + overdue };
  }, [items]);

  const openCreate = () => {
    setEditingId(null);
    setDocumentFile(null);
    setUploadStage('');
    setForm({ ...EMPTY_FORM, status: config.statuses[0] || 'ativo', meta: {} });
    setFormOpen(true);
  };
  const openEdit = (item: RegistryItem) => {
    const metadata = item.metadata || {};
    setEditingId(item.id);
    setDocumentFile(null);
    setUploadStage('');
    setForm({
      titulo: item.titulo,
      descricao: item.descricao || '',
      status: item.status,
      data_inicio: dateInput(item.data_inicio),
      data_fim: dateInput(item.data_fim),
      filho_id: item.filho_id || '',
      valor: item.valor == null ? '' : String(item.valor),
      meta: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value || '')])),
    });
    setFormOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (section === 'documents' && !editingId && !documentFile) {
      setError('Selecione o arquivo do documento.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let metadata = { ...form.meta };
      if (section === 'documents' && documentFile) {
        setUploadStage('Preparando envio seguro...');
        const prepareResponse = await authFetch('/api/v1/gestao/documentos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            fileName: documentFile.name,
            contentType: documentMime(documentFile),
            fileSize: documentFile.size,
          }),
        });
        const prepared = await prepareResponse.json();
        if (!prepareResponse.ok) throw new Error(prepared.error || 'Não foi possível preparar o envio do arquivo.');

        setUploadStage('Enviando arquivo...');
        const { error: uploadError } = await supabase.storage
          .from(prepared.bucket)
          .uploadToSignedUrl(prepared.path, prepared.token, documentFile, {
            contentType: prepared.contentType,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        metadata = {
          ...metadata,
          storage_path: prepared.path,
          arquivo_nome: documentFile.name,
          arquivo_tipo: prepared.contentType,
          arquivo_tamanho: String(documentFile.size),
        };
        delete metadata.arquivo_url;
      }
      setUploadStage('Salvando registro...');
      const endpoint = editingId ? `/api/v1/gestao/${config.resource}/${editingId}` : `/api/v1/gestao/${config.resource}`;
      const response = await authFetch(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          titulo: form.titulo,
          descricao: form.descricao,
          status: form.status,
          data_inicio: form.data_inicio || null,
          data_fim: form.data_fim || null,
          filho_id: form.filho_id || null,
          valor: form.valor || null,
          metadata,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setFormOpen(false);
      setDocumentFile(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
      setUploadStage('');
    }
  }

  function chooseDocument(file: File | null) {
    if (!file) return setDocumentFile(null);
    const allowed = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(documentMime(file))) {
      setError('Formato não permitido. Envie PDF, Word, JPG, PNG ou WebP.');
      return setDocumentFile(null);
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 20 MB.');
      return setDocumentFile(null);
    }
    setError('');
    setDocumentFile(file);
  }

  async function remove(item: RegistryItem) {
    if (!confirm(`Excluir “${item.titulo}”?`)) return;
    const response = await authFetch(`/api/v1/gestao/${config.resource}/${item.id}?tenantId=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Não foi possível excluir.');
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function advanceStatus(item: RegistryItem) {
    const nextStatus = config.nextStatus?.[item.status.toLocaleLowerCase('pt-BR')];
    if (!nextStatus || updatingId) return;
    setUpdatingId(item.id);
    setError('');
    try {
      const response = await authFetch(`/api/v1/gestao/${config.resource}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a situação.');
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...data.item, status: nextStatus } : entry));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a situação.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AppPageShell fullWidth>
      <div className="overflow-hidden rounded-[1.75rem] border border-[#D7CEBC] bg-[#F7F2E7] text-[#192019] shadow-[0_28px_80px_-58px_rgba(46,35,18,.8)]">
        <header className="relative overflow-hidden border-b border-[#D7CEBC] bg-[#173829] px-5 py-7 text-white sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full border border-[#D9AA2B]/20 shadow-[0_0_0_55px_rgba(217,170,43,.035),0_0_0_110px_rgba(217,170,43,.025)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#E2B63F]">Rotinas da casa · dados privados</p>
              <div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5"><WorkflowIcon className="h-5 w-5 text-[#E2B63F]" /></span><h1 className="text-3xl font-black tracking-[-.045em] sm:text-4xl">{workflow.title}</h1></div>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#C0CBC2]">{workflow.description}</p>
            </div>
          </div>
        </header>

        <nav className="grid gap-2 border-b border-[#DDD3C1] bg-[#EAE1D0] px-4 py-3 sm:grid-cols-2 sm:px-7 lg:grid-cols-4" aria-label="Rotinas da casa">
          {WORKFLOWS.map((entry) => { const EntryIcon = entry.icon; const active = entry.id === workflow.id; return <button key={entry.id} type="button" onClick={() => setActiveTab(entry.entry)} className={cn('flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition', active ? 'border-[#1F5942] bg-[#1F5942] text-white shadow-sm' : 'border-[#CFC3AD] bg-[#F8F3E9] text-[#655E52] hover:border-[#9E8D6F]')}><EntryIcon className="h-4 w-4 shrink-0" /><span><strong className="block text-[11px] font-black">{entry.title}</strong><small className={cn('mt-0.5 block text-[9px] font-semibold', active ? 'text-white/65' : 'text-[#837A6D]')}>{entry.description}</small></span></button>; })}
        </nav>

        <main className="p-5 sm:p-8 lg:p-10">
          {workflow.sections.length > 1 ? <div className="mb-6 overflow-hidden rounded-2xl border border-[#D8CEBC] bg-[#FFFCF6]"><div className="flex gap-1 overflow-x-auto border-b border-[#E3DAC9] p-2 no-scrollbar">{workflow.sections.map((key) => { const EntryIcon = MODULES[key].icon; return <button key={key} type="button" onClick={() => setActiveTab(key)} className={cn('inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[11px] font-black transition', section === key ? 'bg-[#E8DDBF] text-[#5E4510]' : 'text-[#766E61] hover:bg-[#F4EEE3]')}><EntryIcon className="h-3.5 w-3.5" />{MODULES[key].title}</button>; })}</div><div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0E5CF]" style={{ color: config.accent }}><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[#20241D]">{config.title}</h2><p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-[#746C60]">{config.description}</p></div></div>{section !== 'reports' ? <button type="button" onClick={openCreate} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D2C5AF] bg-[#F8F1E3] px-4 text-xs font-black text-[#5E4510]"><Plus className="h-3.5 w-3.5" />Novo {config.singular.toLowerCase()}</button> : null}</div></div> : null}
          {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}
          {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#997116]" /></div> : section === 'reports' ? <Reports report={report} onNavigate={setActiveTab} /> : (
            <>
              <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#D8CEBC] bg-[#F1E9DA]"><SummaryCell label="Registros" value={itemSummary.total} /><SummaryCell label="Próximos 30 dias" value={itemSummary.upcoming} /><SummaryCell label="Pedem atenção" value={itemSummary.attention} attention={itemSummary.attention > 0} /></div>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#D4C9B6] bg-white px-3 sm:max-w-sm"><Search className="h-4 w-4 text-[#8A8173]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar em ${config.title.toLowerCase()}...`} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /></label>
                <p className="text-xs font-bold text-[#81796B]">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</p>
              </div>
              {filtered.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#CFC3AD] bg-[#FBF8F1] p-8 text-center"><div><Icon className="mx-auto h-9 w-9 text-[#B49758]" /><strong className="mt-4 block text-lg font-black">{EMPTY_COPY[section as Exclude<AdvancedSection, 'reports'>].title}</strong><p className="mt-2 max-w-lg text-sm font-semibold leading-relaxed text-[#766F63]">{EMPTY_COPY[section as Exclude<AdvancedSection, 'reports'>].description}</p><button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-[#1F5942] px-5 py-3 text-sm font-black text-white">Começar agora</button></div></div> : <div className="grid gap-3 lg:grid-cols-2">{filtered.map((item) => <RegistryCard key={item.id} item={item} config={config} childName={children.find((child) => child.id === item.filho_id)?.nome} onEdit={() => openEdit(item)} onDelete={() => void remove(item)} onAdvance={config.nextStatus?.[item.status.toLocaleLowerCase('pt-BR')] ? () => void advanceStatus(item) : undefined} advancing={updatingId === item.id} />)}</div>}
            </>
          )}
        </main>
      </div>

      {formOpen ? <div className="fixed inset-0 z-[120] grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-5" role="dialog" aria-modal="true"><form onSubmit={submit} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-[#D8CDBA] bg-[#FBF8F1] p-5 text-[#192019] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#916A12]">{editingId ? 'Atualizar rotina' : workflow.title}</p><h2 className="mt-2 text-2xl font-black">{editingId ? `Editar ${config.singular.toLowerCase()}` : `Novo ${config.singular.toLowerCase()}`}</h2><p className="mt-2 max-w-lg text-xs font-semibold leading-relaxed text-[#746C60]">{config.description}</p></div><button type="button" onClick={() => setFormOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-[#D8CDBA]"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Título" wide><input required maxLength={160} value={form.titulo} onChange={(event) => setForm((old) => ({ ...old, titulo: event.target.value }))} className="field" placeholder={`Nome do ${config.singular.toLowerCase()}`} /></Field><Field label="Situação"><select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))} className="field">{config.statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>{config.usesMember ? <Field label="Filho de santo"><select value={form.filho_id} onChange={(event) => setForm((old) => ({ ...old, filho_id: event.target.value }))} className="field"><option value="">Não vincular</option>{children.map((child) => <option key={child.id} value={child.id}>{child.nome}</option>)}</select></Field> : null}<Field label={config.usesEndDate ? 'Início' : 'Data'}><input type="datetime-local" value={form.data_inicio} onChange={(event) => setForm((old) => ({ ...old, data_inicio: event.target.value }))} className="field" /></Field>{config.usesEndDate ? <Field label="Término ou vencimento"><input type="datetime-local" value={form.data_fim} onChange={(event) => setForm((old) => ({ ...old, data_fim: event.target.value }))} className="field" /></Field> : null}{config.usesValue ? <Field label="Valor estimado"><input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => setForm((old) => ({ ...old, valor: event.target.value }))} className="field" /></Field> : null}{config.meta.map((field) => <Field key={field.key} label={field.label}><input type={field.type || 'text'} value={form.meta[field.key] || ''} onChange={(event) => setForm((old) => ({ ...old, meta: { ...old.meta, [field.key]: event.target.value } }))} className="field" placeholder={field.placeholder} /></Field>)}{section === 'documents' ? <Field label="Arquivo do documento" wide><label className="group flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#BDAF96] bg-white px-4 py-3 transition hover:border-[#916A12] hover:bg-[#FFF9EC]"><input type="file" className="sr-only" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => chooseDocument(event.target.files?.[0] || null)} /><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F1E7D4] text-[#916A12]">{documentFile || form.meta.storage_path ? <FileCheck2 className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}</span><span className="min-w-0"><strong className="block truncate text-sm">{documentFile?.name || form.meta.arquivo_nome || 'Selecionar arquivo'}</strong><small className="mt-1 block font-semibold text-[#7A7266]">PDF, Word ou imagem · máximo de 20 MB{editingId && form.meta.storage_path && !documentFile ? ' · clique para substituir' : ''}</small></span></label></Field> : null}<Field label="Observações" wide><textarea value={form.descricao} onChange={(event) => setForm((old) => ({ ...old, descricao: event.target.value }))} className="field min-h-28 resize-y" maxLength={5000} /></Field></div><button disabled={saving} type="submit" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F5942] px-5 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}{saving && uploadStage ? uploadStage : editingId ? 'Salvar alterações' : `Salvar ${config.singular.toLowerCase()}`}</button></form></div> : null}
      {formOpen && error ? <div className="fixed left-1/2 top-4 z-[140] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 shadow-xl">{error}</div> : null}
      <style>{`.field{min-height:44px;width:100%;border:1px solid #d8cdba;border-radius:12px;background:#fff;padding:10px 12px;font-size:14px;font-weight:650;outline:none}.field:focus{border-color:#9b7115;box-shadow:0 0 0 3px rgba(155,113,21,.10)}`}</style>
    </AppPageShell>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={cn('grid gap-1.5 text-xs font-black text-[#5E574C]', wide && 'sm:col-span-2')}><span>{label}</span>{children}</label>;
}

function SummaryCell({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <div className="min-w-0 border-r border-[#D8CEBC] px-3 py-4 text-center last:border-r-0 sm:px-5"><strong className={cn('block text-2xl font-black', attention ? 'text-[#A84D39]' : 'text-[#20241D]')}>{value}</strong><span className="mt-1 block text-[9px] font-black uppercase tracking-[.08em] text-[#766E61] sm:text-[10px]">{label}</span></div>;
}

function statusActionLabel(status: string) {
  const labels: Record<string, string> = {
    confirmado: 'Confirmar atendimento',
    realizado: 'Marcar como realizado',
    'em andamento': 'Iniciar etapa',
    concluído: 'Concluir etapa',
    'em recolhimento': 'Iniciar recolhimento',
    vigente: 'Marcar como vigente',
    'em revisão': 'Enviar para revisão',
    ativo: 'Marcar como ativo',
  };
  return labels[status] || `Avançar para ${status}`;
}

function RegistryCard({ item, config, childName, onEdit, onDelete, onAdvance, advancing }: { item: RegistryItem; config: ModuleConfig; childName?: string; onEdit: () => void; onDelete: () => void; onAdvance?: () => void; advancing?: boolean }) {
  const link = safeLink(item.metadata?.arquivo_url);
  const metadata = config.meta.map((field) => ({ label: field.label, value: String(item.metadata?.[field.key] || '').trim() })).filter((entry) => entry.value);
  const nextStatus = config.nextStatus?.[item.status.toLocaleLowerCase('pt-BR')];
  return <article className="group rounded-2xl border border-[#D8CEBC] bg-[#FFFCF6] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-34px_rgba(45,34,17,.8)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full border border-[#D8CEBC] bg-[#F1E9DA] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#6D6354]">{item.status}</span><h3 className="mt-3 text-lg font-black leading-tight">{item.titulo}</h3></div><div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-lg border border-[#D8CEBC] text-[#5E574C]" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-700" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button></div></div>{item.descricao ? <p className="mt-3 line-clamp-3 text-xs font-semibold leading-relaxed text-[#746C60]">{item.descricao}</p> : null}{metadata.length ? <dl className="mt-4 grid gap-2 rounded-xl bg-[#F4EEE3] p-3 sm:grid-cols-2">{metadata.map((entry) => <div key={entry.label} className="min-w-0"><dt className="text-[8px] font-black uppercase tracking-[.1em] text-[#948979]">{entry.label}</dt><dd className="mt-1 truncate text-[11px] font-bold text-[#4E493F]">{entry.value}</dd></div>)}</dl> : null}<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#E4DCCC] pt-3 text-[10px] font-bold text-[#7B7367]">{childName ? <span>{childName}</span> : null}{formatDate(item.data_inicio) ? <span>{formatDate(item.data_inicio)}</span> : null}{formatDate(item.data_fim) ? <span>até {formatDate(item.data_fim)}</span> : null}{item.valor != null ? <span>{money(Number(item.valor))}</span> : null}{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-[#17604A]"><FileText className="h-3 w-3 shrink-0" /><span className="truncate">{String(item.metadata?.arquivo_nome || 'Abrir documento')}</span><ChevronRight className="h-3 w-3 shrink-0" /></a> : null}</div>{onAdvance && nextStatus ? <button type="button" disabled={advancing} onClick={onAdvance} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1F5942] px-4 text-xs font-black text-white transition hover:bg-[#184735] disabled:opacity-60">{advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}{statusActionLabel(nextStatus)}</button> : null}</article>;
}

function Reports({ report, onNavigate }: { report: Report | null; onNavigate: (tab: string) => void }) {
  if (!report) return <p className="text-sm font-bold text-[#746C60]">Ainda não foi possível consolidar os indicadores.</p>;
  const attention = report.attention || { upcomingAppointments: 0, followUps: 0, documentDeadlines: 0, maintenanceItems: 0, activeFormation: 0 };
  const decisions = [
    { label: 'Mensalidades pendentes', detail: 'Conferir cobranças e recebimentos', value: report.mensalidadesPendentes, tab: 'financial-mensalidades', icon: FileText },
    { label: 'Estoque crítico', detail: 'Repor materiais antes da próxima gira', value: report.lowStock, tab: 'inventory', icon: Archive },
    { label: 'Obrigações próximas', detail: 'Revisar datas e orientações da corrente', value: report.upcomingObligations, tab: 'calendar', icon: ClipboardPlus },
    { label: 'Atendimentos próximos', detail: 'Confirmar horários dos próximos 30 dias', value: attention.upcomingAppointments, tab: 'atendimento-agenda', icon: Clock3 },
    { label: 'Retornos aguardando', detail: 'Dar continuidade a quem foi acolhido', value: attention.followUps, tab: 'atendimento-agenda', icon: HandHeart },
    { label: 'Documentos no prazo', detail: 'Vencidos ou vencendo nos próximos 30 dias', value: attention.documentDeadlines, tab: 'documents', icon: FileText },
    { label: 'Bens em manutenção', detail: 'Acompanhar reparo e retorno ao uso', value: attention.maintenanceItems, tab: 'patrimony', icon: Landmark },
  ];
  const pendingTotal = decisions.reduce((sum, item) => sum + item.value, 0);
  return <div className="space-y-7"><section className={cn('flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between', pendingTotal ? 'border-[#E1C5B8] bg-[#FFF6EF]' : 'border-[#BFD7C9] bg-[#EFF8F2]')}><div className="flex items-start gap-3">{pendingTotal ? <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#A84D39]" /> : <BookOpenCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#1F694D]" />}<div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8A6518]">Leitura da zeladoria</p><h2 className="mt-1 text-xl font-black">{pendingTotal ? `${pendingTotal} pontos pedem atenção` : 'A rotina está em dia'}</h2><p className="mt-1 text-xs font-semibold text-[#746C60]">Abra uma pendência para resolver diretamente no módulo responsável.</p></div></div><div className="flex gap-6 text-center"><span><strong className="block text-2xl font-black">{report.activeChildren}</strong><small className="text-[9px] font-black uppercase tracking-wide text-[#7A7266]">Filhos ativos</small></span><span><strong className="block text-2xl font-black">{attention.activeFormation}</strong><small className="text-[9px] font-black uppercase tracking-wide text-[#7A7266]">Formações ativas</small></span></div></section><section><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#916A12]">Próximos passos</p><h2 className="mt-1 text-xl font-black">Decida e resolva sem procurar em vários menus.</h2></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{decisions.map((item) => { const CardIcon = item.icon; return <button key={item.label} type="button" onClick={() => onNavigate(item.tab)} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-[#D8CEBC] bg-[#FFFCF6] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#A99877] hover:shadow-sm"><span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', item.value ? 'bg-[#F5DED5] text-[#A84D39]' : 'bg-[#E5F0E9] text-[#1F694D]')}><CardIcon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="text-sm font-black text-[#20241D]">{item.label}</strong><b className="text-2xl font-black text-[#20241D]">{item.value}</b></span><small className="mt-2 block text-[10px] font-semibold leading-relaxed text-[#766F63]">{item.detail}</small><span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-[#1F5942]">Abrir rotina <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span></span></button>; })}</div></section><section className="grid overflow-hidden rounded-2xl border border-[#D8CEBC] bg-[#173829] text-white sm:grid-cols-[1fr_1fr_1fr_auto]"><div className="p-5"><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Entradas</span><strong className="mt-2 block text-xl font-black">{money(report.receitas)}</strong></div><div className="border-y border-white/10 p-5 sm:border-x sm:border-y-0"><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Saídas</span><strong className="mt-2 block text-xl font-black">{money(report.despesas)}</strong></div><div className="p-5"><span className="text-[9px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Saldo</span><strong className="mt-2 block text-xl font-black">{money(report.saldo)}</strong></div><button type="button" onClick={() => onNavigate('financial')} className="flex min-h-16 items-center justify-center gap-2 border-t border-white/10 px-5 text-xs font-black text-[#F2C94C] sm:border-l sm:border-t-0">Abrir financeiro <ArrowRight className="h-4 w-4" /></button></section></div>;
}
