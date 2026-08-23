import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  BarChart3,
  BookOpenCheck,
  CalendarHeart,
  ChevronRight,
  ClipboardPlus,
  FileText,
  GraduationCap,
  HandHeart,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import { authFetch } from '../lib/authenticatedFetch';
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
};

const MODULES: Record<AdvancedSection, ModuleConfig> = {
  reports: { resource: 'relatorios', title: 'Central de relatórios', singular: 'Relatório', description: 'Indicadores da casa reunidos para decisões mais claras.', icon: BarChart3, accent: '#24614A', statuses: [], meta: [] },
  patrimony: { resource: 'patrimonio', title: 'Patrimônio sagrado', singular: 'Bem', description: 'Bens permanentes separados do estoque de consumo.', icon: Landmark, accent: '#9B7115', statuses: ['ativo', 'manutenção', 'emprestado', 'baixado'], usesValue: true, meta: [{ key: 'codigo', label: 'Código', placeholder: 'PAT-001' }, { key: 'localizacao', label: 'Localização', placeholder: 'Salão principal' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Nome da pessoa responsável' }] },
  documents: { resource: 'documentos', title: 'Documentos da casa', singular: 'Documento', description: 'Estatutos, atas e comprovantes com contexto e vencimento.', icon: FileText, accent: '#A84D39', statuses: ['vigente', 'em revisão', 'vencido', 'arquivado'], usesEndDate: true, meta: [{ key: 'categoria', label: 'Categoria', placeholder: 'Estatuto, ata ou contrato' }, { key: 'arquivo_url', label: 'Link seguro do arquivo', placeholder: 'https://...' , type: 'url' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Secretaria' }] },
  consulentes: { resource: 'consulentes', title: 'Consulentes', singular: 'Consulente', description: 'Cadastro de acolhimento e histórico de quem procura a casa.', icon: Users, accent: '#2B7180', statuses: ['ativo', 'acompanhamento', 'inativo'], meta: [{ key: 'telefone', label: 'Telefone', placeholder: '(11) 99999-9999', type: 'tel' }, { key: 'email', label: 'E-mail', placeholder: 'contato@exemplo.com' }, { key: 'origem', label: 'Como conheceu a casa', placeholder: 'Indicação, mapa, evento...' }] },
  'atendimento-agenda': { resource: 'atendimentos', title: 'Agenda de atendimentos', singular: 'Atendimento', description: 'Agendamentos, responsáveis, retorno e histórico privado.', icon: HandHeart, accent: '#7C4B7C', statuses: ['agendado', 'confirmado', 'realizado', 'retorno', 'cancelado'], usesEndDate: true, meta: [{ key: 'consulente', label: 'Consulente', placeholder: 'Nome da pessoa' }, { key: 'responsavel', label: 'Responsável', placeholder: 'Quem realizará o atendimento' }, { key: 'contato', label: 'Contato', placeholder: 'Telefone ou WhatsApp', type: 'tel' }] },
  journey: { resource: 'caminhada', title: 'Caminhada mediúnica', singular: 'Marco', description: 'Linha do tempo de iniciações, obrigações e responsabilidades.', icon: Route, accent: '#B15B3F', statuses: ['planejado', 'em andamento', 'concluído'], usesMember: true, meta: [{ key: 'categoria', label: 'Tipo de marco', placeholder: 'Iniciação, obrigação, cargo...' }, { key: 'registrado_por', label: 'Registrado por', placeholder: 'Zeladoria' }] },
  liturgical: { resource: 'liturgico', title: 'Calendário litúrgico', singular: 'Data litúrgica', description: 'Datas sagradas escolhidas pela própria casa e sua tradição.', icon: CalendarHeart, accent: '#93651B', statuses: ['ativo', 'rascunho', 'inativo'], usesEndDate: true, meta: [{ key: 'tradicao', label: 'Tradição ou nação', placeholder: 'Umbanda, Ketu, Angola...' }, { key: 'recorrencia', label: 'Recorrência', placeholder: 'Anual, mensal ou única' }, { key: 'orientacao', label: 'Orientação pública', placeholder: 'Informação breve para a corrente' }] },
  development: { resource: 'desenvolvimento', title: 'Desenvolvimento mediúnico', singular: 'Atividade', description: 'Turmas, aulas e progresso formativo da corrente.', icon: GraduationCap, accent: '#286157', statuses: ['planejado', 'em andamento', 'concluído', 'cancelado'], usesEndDate: true, meta: [{ key: 'facilitador', label: 'Facilitador', placeholder: 'Responsável pela atividade' }, { key: 'turma', label: 'Turma', placeholder: 'Desenvolvimento 2026' }, { key: 'frequencia', label: 'Frequência ou progresso', placeholder: 'Ex.: 8 encontros realizados' }] },
  camarinha: { resource: 'camarinha', title: 'Camarinha', singular: 'Ciclo', description: 'Controle reservado de recolhimentos, prazos e responsáveis.', icon: Archive, accent: '#603C68', statuses: ['planejado', 'em recolhimento', 'concluído', 'cancelado'], usesMember: true, usesEndDate: true, meta: [{ key: 'responsavel', label: 'Responsável', placeholder: 'Responsável pelo acompanhamento' }, { key: 'local', label: 'Local reservado', placeholder: 'Informação interna' }, { key: 'restricoes', label: 'Restrições de acesso', placeholder: 'Somente zeladoria' }] },
};

const NAV_SECTIONS = Object.keys(MODULES) as AdvancedSection[];
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

export default function AdvancedManagement({ section, tenantData, setActiveTab }: { section: AdvancedSection; tenantData?: { tenant_id?: string | null }; setActiveTab: (tab: string) => void }) {
  const tenantId = String(tenantData?.tenant_id || '');
  const config = MODULES[section];
  const Icon = config.icon;
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

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, status: config.statuses[0] || 'ativo', meta: {} });
    setFormOpen(true);
  };
  const openEdit = (item: RegistryItem) => {
    const metadata = item.metadata || {};
    setEditingId(item.id);
    setForm({
      titulo: item.titulo,
      descricao: item.descricao || '',
      status: item.status,
      data_inicio: dateInput(item.data_inicio),
      data_fim: dateInput(item.data_fim),
      filho_id: item.filho_id || '',
      valor: item.valor == null ? '' : String(item.valor),
      meta: Object.fromEntries(config.meta.map((field) => [field.key, String(metadata[field.key] || '')])),
    });
    setFormOpen(true);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
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
          metadata: form.meta,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setFormOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
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

  return (
    <AppPageShell fullWidth>
      <div className="overflow-hidden rounded-[1.75rem] border border-[#D7CEBC] bg-[#F7F2E7] text-[#192019] shadow-[0_28px_80px_-58px_rgba(46,35,18,.8)]">
        <header className="relative overflow-hidden border-b border-[#D7CEBC] bg-[#173829] px-5 py-7 text-white sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full border border-[#D9AA2B]/20 shadow-[0_0_0_55px_rgba(217,170,43,.035),0_0_0_110px_rgba(217,170,43,.025)]" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#E2B63F]">Gestão avançada · dados privados da casa</p>
              <div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5"><Icon className="h-5 w-5 text-[#E2B63F]" /></span><h1 className="text-3xl font-black tracking-[-.045em] sm:text-4xl">{config.title}</h1></div>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#C0CBC2]">{config.description}</p>
            </div>
            {section !== 'reports' ? <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E2B020] px-5 text-sm font-black text-[#171309] transition hover:bg-[#F0C64B]"><Plus className="h-4 w-4" />Adicionar {config.singular.toLowerCase()}</button> : null}
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-[#DDD3C1] bg-[#EAE1D0] px-4 py-3 no-scrollbar sm:px-7" aria-label="Áreas da gestão avançada">
          {NAV_SECTIONS.map((key) => { const EntryIcon = MODULES[key].icon; return <button key={key} type="button" onClick={() => setActiveTab(key)} className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-black transition', section === key ? 'border-[#1F5942] bg-[#1F5942] text-white' : 'border-[#CFC3AD] bg-[#F8F3E9] text-[#655E52] hover:border-[#9E8D6F]')}><EntryIcon className="h-3.5 w-3.5" />{MODULES[key].title}</button>; })}
        </nav>

        <main className="p-5 sm:p-8 lg:p-10">
          {error ? <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}
          {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#997116]" /></div> : section === 'reports' ? <Reports report={report} /> : (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[#D4C9B6] bg-white px-3 sm:max-w-sm"><Search className="h-4 w-4 text-[#8A8173]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar em ${config.title.toLowerCase()}...`} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /></label>
                <p className="text-xs font-bold text-[#81796B]">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</p>
              </div>
              {filtered.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#CFC3AD] bg-[#FBF8F1] p-8 text-center"><div><Icon className="mx-auto h-9 w-9 text-[#B49758]" /><strong className="mt-4 block text-lg font-black">Comece por um registro real.</strong><p className="mt-2 max-w-md text-sm font-semibold text-[#766F63]">Esta área está pronta e isolada para a sua casa. Adicione o primeiro item quando desejar.</p><button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-[#1F5942] px-5 py-3 text-sm font-black text-white">Adicionar agora</button></div></div> : <div className="grid gap-3 lg:grid-cols-2">{filtered.map((item) => <RegistryCard key={item.id} item={item} config={config} childName={children.find((child) => child.id === item.filho_id)?.nome} onEdit={() => openEdit(item)} onDelete={() => void remove(item)} />)}</div>}
            </>
          )}
        </main>
      </div>

      {formOpen ? <div className="fixed inset-0 z-[120] grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-5" role="dialog" aria-modal="true"><form onSubmit={submit} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-[#D8CDBA] bg-[#FBF8F1] p-5 text-[#192019] shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#916A12]">{editingId ? 'Editar registro' : 'Novo registro'}</p><h2 className="mt-2 text-2xl font-black">{config.singular}</h2></div><button type="button" onClick={() => setFormOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-[#D8CDBA]"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Título" wide><input required maxLength={160} value={form.titulo} onChange={(event) => setForm((old) => ({ ...old, titulo: event.target.value }))} className="field" placeholder={`Nome do ${config.singular.toLowerCase()}`} /></Field><Field label="Situação"><select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))} className="field">{config.statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>{config.usesMember ? <Field label="Filho de santo"><select value={form.filho_id} onChange={(event) => setForm((old) => ({ ...old, filho_id: event.target.value }))} className="field"><option value="">Não vincular</option>{children.map((child) => <option key={child.id} value={child.id}>{child.nome}</option>)}</select></Field> : null}<Field label={config.usesEndDate ? 'Início' : 'Data'}><input type="datetime-local" value={form.data_inicio} onChange={(event) => setForm((old) => ({ ...old, data_inicio: event.target.value }))} className="field" /></Field>{config.usesEndDate ? <Field label="Término ou vencimento"><input type="datetime-local" value={form.data_fim} onChange={(event) => setForm((old) => ({ ...old, data_fim: event.target.value }))} className="field" /></Field> : null}{config.usesValue ? <Field label="Valor estimado"><input type="number" min="0" step="0.01" value={form.valor} onChange={(event) => setForm((old) => ({ ...old, valor: event.target.value }))} className="field" /></Field> : null}{config.meta.map((field) => <Field key={field.key} label={field.label}><input type={field.type || 'text'} value={form.meta[field.key] || ''} onChange={(event) => setForm((old) => ({ ...old, meta: { ...old.meta, [field.key]: event.target.value } }))} className="field" placeholder={field.placeholder} /></Field>)}<Field label="Observações" wide><textarea value={form.descricao} onChange={(event) => setForm((old) => ({ ...old, descricao: event.target.value }))} className="field min-h-28 resize-y" maxLength={5000} /></Field></div><button disabled={saving} type="submit" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F5942] px-5 text-sm font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}{editingId ? 'Salvar alterações' : 'Criar registro'}</button></form></div> : null}
      <style>{`.field{min-height:44px;width:100%;border:1px solid #d8cdba;border-radius:12px;background:#fff;padding:10px 12px;font-size:14px;font-weight:650;outline:none}.field:focus{border-color:#9b7115;box-shadow:0 0 0 3px rgba(155,113,21,.10)}`}</style>
    </AppPageShell>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={cn('grid gap-1.5 text-xs font-black text-[#5E574C]', wide && 'sm:col-span-2')}><span>{label}</span>{children}</label>;
}

function RegistryCard({ item, config, childName, onEdit, onDelete }: { item: RegistryItem; config: ModuleConfig; childName?: string; onEdit: () => void; onDelete: () => void }) {
  const link = safeLink(item.metadata?.arquivo_url);
  return <article className="group rounded-2xl border border-[#D8CEBC] bg-[#FFFCF6] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-34px_rgba(45,34,17,.8)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full border border-[#D8CEBC] bg-[#F1E9DA] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#6D6354]">{item.status}</span><h3 className="mt-3 text-lg font-black leading-tight">{item.titulo}</h3></div><div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button type="button" onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-lg border border-[#D8CEBC] text-[#5E574C]" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-700" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button></div></div>{item.descricao ? <p className="mt-3 line-clamp-3 text-xs font-semibold leading-relaxed text-[#746C60]">{item.descricao}</p> : null}<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#E4DCCC] pt-3 text-[10px] font-bold text-[#7B7367]">{childName ? <span>{childName}</span> : null}{formatDate(item.data_inicio) ? <span>{formatDate(item.data_inicio)}</span> : null}{formatDate(item.data_fim) ? <span>até {formatDate(item.data_fim)}</span> : null}{item.valor != null ? <span>{money(Number(item.valor))}</span> : null}{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#17604A]">Abrir documento <ChevronRight className="h-3 w-3" /></a> : null}</div></article>;
}

function Reports({ report }: { report: Report | null }) {
  if (!report) return <p className="text-sm font-bold text-[#746C60]">Ainda não foi possível consolidar os indicadores.</p>;
  const cards = [
    ['Filhos ativos', report.activeChildren, Users],
    ['Próximos eventos', report.upcomingEvents, CalendarHeart],
    ['Obrigações próximas', report.upcomingObligations, ClipboardPlus],
    ['Estoque crítico', report.lowStock, Archive],
    ['Mensalidades pendentes', report.mensalidadesPendentes, FileText],
  ] as const;
  return <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, CardIcon]) => <article key={label} className="rounded-2xl border border-[#D8CEBC] bg-[#FFFCF6] p-5"><CardIcon className="h-5 w-5 text-[#967015]" /><strong className="mt-5 block text-3xl font-black tracking-tight">{value}</strong><span className="mt-1 block text-[11px] font-bold text-[#746C60]">{label}</span></article>)}</div><section className="grid overflow-hidden rounded-2xl border border-[#D8CEBC] bg-[#173829] text-white sm:grid-cols-3"><div className="p-6"><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Entradas registradas</span><strong className="mt-3 block text-2xl font-black">{money(report.receitas)}</strong></div><div className="border-y border-white/10 p-6 sm:border-x sm:border-y-0"><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Saídas registradas</span><strong className="mt-3 block text-2xl font-black">{money(report.despesas)}</strong></div><div className="p-6"><span className="text-[10px] font-black uppercase tracking-[.16em] text-[#DDB33E]">Saldo consolidado</span><strong className="mt-3 block text-2xl font-black">{money(report.saldo)}</strong></div></section><section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#916A12]">Novas áreas</p><h2 className="mt-1 text-xl font-black">O que já está sendo cuidado</h2></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(report.moduleCounts).map(([key, count]) => <div key={key} className="flex items-center justify-between rounded-xl border border-[#D8CEBC] bg-[#F1E9DA] px-4 py-3"><span className="text-xs font-black capitalize">{key}</span><strong className="text-lg">{count}</strong></div>)}</div></section></div>;
}
