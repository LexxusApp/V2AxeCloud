import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Clock3, FileText, Filter, Flame, Loader2, Plus, Search, UserRound, Users } from 'lucide-react';
import { AppPageShell } from '../components/app/AppTopNav';
import { ObligationScheduleModal, type ObligationFormData } from '../components/child-profile/ObligationScheduleModal';
import { authFetch } from '../lib/authenticatedFetch';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

type Member = { id: string; nome: string; user_id?: string | null };
type Obligation = { id: string; titulo: string; data: string; hora: string | null; descricao: string; status: string; childId: string; childName: string; pdfPath: string | null };
type Props = { user: { id: string }; tenantData?: { tenant_id?: string | null } | null; setActiveTab: (tab: string) => void; setSelectedChildId: (id: string | null) => void };
const EMPTY_FORM: ObligationFormData = { titulo: '', data: '', hora: '19:00', descricao: '', notifyChild: true };

function childIdFromDescription(value: unknown) { return String(value || '').match(/FILHO_ID:([0-9a-f-]{36})/i)?.[1] || ''; }
function cleanDescription(value: unknown) { return String(value || '').split('\n\n=== METADADOS ===')[0].trim(); }
function isDone(item: Obligation) { return item.status === 'Confirmado' || item.status === 'Concluído'; }
function isOverdue(item: Obligation) { return !isDone(item) && item.data < new Date().toISOString().slice(0, 10); }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }

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
    setLoading(true); setError('');
    try {
      const response = await authFetch(`/api/children?userId=${encodeURIComponent(user.id)}&tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os membros.');
      const nextMembers = (payload.data || []) as Member[];
      setMembers(nextMembers);
      const names = new Map(nextMembers.map((member) => [member.id, member.nome]));
      const { data, error: calendarError } = await supabase.from('calendario_axe').select('id,titulo,data,hora,descricao,status_confirmacao,pdf_storage_path').eq('tenant_id', tenantId).eq('tipo', 'Obrigação').order('data', { ascending: true });
      if (calendarError) throw calendarError;
      setItems((data || []).map((row) => {
        const childId = childIdFromDescription(row.descricao);
        return { id: String(row.id), titulo: String(row.titulo || 'Obrigação'), data: String(row.data || ''), hora: row.hora ? String(row.hora) : null, descricao: cleanDescription(row.descricao), status: String(row.status_confirmacao || 'Pendente'), childId, childName: names.get(childId) || 'Membro não identificado', pdfPath: row.pdf_storage_path ? String(row.pdf_storage_path) : null };
      }));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as obrigações.'); }
    finally { setLoading(false); }
  }, [tenantId, user.id]);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({ upcoming: items.filter((item) => !isDone(item) && !isOverdue(item)).length, overdue: items.filter(isOverdue).length, done: items.filter(isDone).length, members: new Set(items.map((item) => item.childId).filter(Boolean)).size }), [items]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => {
      const textMatch = !term || `${item.titulo} ${item.childName} ${item.descricao}`.toLocaleLowerCase('pt-BR').includes(term);
      const filterMatch = filter === 'todas' || (filter === 'proximas' && !isDone(item) && !isOverdue(item)) || (filter === 'atrasadas' && isOverdue(item)) || (filter === 'concluidas' && isDone(item));
      return textMatch && filterMatch;
    });
  }, [filter, items, query]);

  function openNew() { setForm({ ...EMPTY_FORM, data: new Date().toISOString().slice(0, 10) }); setSelectedMemberId(''); setPdfFile(null); setModalOpen(true); }
  async function uploadPdf(file: File, childId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada. Faça login novamente.');
    const response = await authFetch('/api/v1/obrigacao-pdf/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ fileName: file.name, contentType: 'application/pdf', tenantId, childId }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível preparar o PDF.');
    const { error: uploadError } = await supabase.storage.from('biblioteca_estudos').uploadToSignedUrl(payload.path, payload.token, file, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;
    return String(payload.path);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMemberId) return alert('Selecione o filho de santo.');
    setSaving(true);
    try {
      const pdfPath = pdfFile ? await uploadPdf(pdfFile, selectedMemberId) : null;
      const insert: Record<string, unknown> = { titulo: form.titulo.trim(), data: form.data, hora: form.hora, descricao: `${form.descricao.trim()}\n\n=== METADADOS ===\nFILHO_ID:${selectedMemberId}`, tipo: 'Obrigação', lider_id: user.id, tenant_id: tenantId, status_confirmacao: 'Pendente' };
      if (pdfPath) insert.pdf_storage_path = pdfPath;
      const { error: insertError } = await supabase.from('calendario_axe').insert(insert);
      if (insertError) throw insertError;
      const member = members.find((entry) => entry.id === selectedMemberId);
      if (form.notifyChild && member?.user_id) await authFetch('/api/push-direct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childId: selectedMemberId, title: '🌿 Nova obrigação de Axé', body: `A obrigação “${form.titulo.trim()}” foi registrada para ${formatDate(form.data)}.`, url: '/?tab=obrigacoes' }) }).catch(() => undefined);
      setModalOpen(false); await load();
    } catch (saveError) { alert(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a obrigação.'); }
    finally { setSaving(false); }
  }
  async function complete(item: Obligation) {
    setBusyId(item.id);
    try {
      const { error: updateError } = await supabase.from('calendario_axe').update({ status_confirmacao: 'Concluído' }).eq('id', item.id).eq('tenant_id', tenantId);
      if (updateError) throw updateError;
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Concluído' } : entry));
    } catch (completeError) { alert(completeError instanceof Error ? completeError.message : 'Não foi possível concluir a obrigação.'); }
    finally { setBusyId(null); }
  }
  async function openPdf(item: Obligation) {
    if (!item.pdfPath) return;
    setOpeningPdf(item.id);
    try {
      const url = `/api/v1/library/pdf-proxy?tenantId=${encodeURIComponent(tenantId)}&path=${encodeURIComponent(item.pdfPath)}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error('Não foi possível abrir o documento.');
      const objectUrl = URL.createObjectURL(await response.blob()); window.open(objectUrl, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (pdfError) { alert(pdfError instanceof Error ? pdfError.message : 'Erro ao abrir o documento.'); }
    finally { setOpeningPdf(null); }
  }
  function openMember(item: Obligation) { if (item.childId) { setSelectedChildId(item.childId); setActiveTab('profile'); } }

  return <AppPageShell><div className="space-y-5">
    <section className="overflow-hidden rounded-[26px] border border-[#25342A] bg-[#142219] text-white shadow-sm"><div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#E2C95A]">Casa · cuidado litúrgico</p><h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">Central de Obrigações</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#C8D1C9]">Acompanhe os compromissos de cada filho, documentos e datas importantes sem abrir um perfil por vez.</p></div><button type="button" onClick={openNew} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E2C95A] px-5 text-sm font-black text-[#142219]"><Plus className="h-4 w-4" />Nova obrigação</button></div></section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={CalendarClock} label="Próximas" value={totals.upcoming} tone="gold" /><Metric icon={AlertTriangle} label="Atrasadas" value={totals.overdue} tone="red" /><Metric icon={CheckCircle2} label="Concluídas" value={totals.done} tone="green" /><Metric icon={Users} label="Membros acompanhados" value={totals.members} tone="blue" /></section>
    <section className="rounded-2xl border border-[#DED8CB] bg-[#F9F6EE] p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[#D8D2C4] bg-white px-3"><Search className="h-4 w-4 text-[#766E62]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por obrigação ou membro" className="w-full bg-transparent text-sm outline-none" /></label><div className="flex items-center gap-2 overflow-x-auto"><Filter className="h-4 w-4 shrink-0 text-[#766E62]" />{(['todas', 'proximas', 'atrasadas', 'concluidas'] as const).map((value) => <button type="button" key={value} onClick={() => setFilter(value)} className={cn('whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold', filter === value ? 'border-[#17251D] bg-[#17251D] text-white' : 'border-[#D8D2C4] bg-white text-[#5F594F]')}>{value === 'todas' ? 'Todas' : value === 'proximas' ? 'Próximas' : value === 'atrasadas' ? 'Atrasadas' : 'Concluídas'}</button>)}</div></div></section>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#8F7724]" /></div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{error}</div> : visible.length === 0 ? <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#D8D2C4] bg-[#F9F6EE] p-8 text-center"><div><Flame className="mx-auto h-8 w-8 text-[#BCA54C]" /><h2 className="mt-3 font-display text-lg font-black text-[#171A16]">Nenhuma obrigação neste filtro</h2><p className="mt-1 text-sm text-[#766E62]">Cadastre a primeira obrigação ou escolha outro filtro.</p></div></div> : <section className="space-y-3">{visible.map((item) => { const done = isDone(item); const overdue = isOverdue(item); return <article key={item.id} className={cn('rounded-2xl border bg-white p-4 shadow-sm sm:p-5', overdue ? 'border-red-200' : done ? 'border-emerald-200' : 'border-[#DED8CB]')}><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', overdue ? 'bg-red-50 text-red-600' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F4ECD6] text-[#8F7724]')}>{done ? <CheckCircle2 className="h-5 w-5" /> : overdue ? <AlertTriangle className="h-5 w-5" /> : <Flame className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-base font-black text-[#171A16]">{item.titulo}</h2><span className={cn('rounded-full px-2 py-1 text-[9px] font-black uppercase', overdue ? 'bg-red-50 text-red-700' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{overdue ? 'Atrasada' : done ? 'Concluída' : 'Programada'}</span></div><button type="button" onClick={() => openMember(item)} disabled={!item.childId} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-[#526A55] disabled:text-[#8F887D]"><UserRound className="h-3.5 w-3.5" />{item.childName}</button><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#766E62]"><Clock3 className="h-3.5 w-3.5" />{formatDate(item.data)}{item.hora ? ` às ${item.hora.slice(0, 5)}` : ''}</p>{item.descricao ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#6F675C]">{item.descricao}</p> : null}</div><div className="flex flex-wrap gap-2 sm:justify-end">{item.pdfPath ? <button type="button" onClick={() => void openPdf(item)} disabled={openingPdf === item.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D8D2C4] px-3 text-xs font-bold text-[#514B42]">{openingPdf === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Documento</button> : null}{!done ? <button type="button" onClick={() => void complete(item)} disabled={busyId === item.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17251D] px-3 text-xs font-black text-white">{busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Concluir</button> : null}</div></div></article>; })}</section>}
  </div><ObligationScheduleModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} onSubmit={save} formData={form} setFormData={setForm} pdfFile={pdfFile} setPdfFile={setPdfFile} isSubmitting={saving} showNotifyCheckbox memberOptions={members} selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId} /></AppPageShell>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: number; tone: 'gold' | 'red' | 'green' | 'blue' }) {
  const colors = { gold: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700', blue: 'bg-sky-50 text-sky-700' };
  return <article className="rounded-2xl border border-[#DED8CB] bg-white p-4 shadow-sm"><div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', colors[tone])}><Icon className="h-4 w-4" /></div><strong className="mt-3 block font-display text-2xl font-black text-[#171A16]">{value}</strong><span className="text-xs font-bold text-[#766E62]">{label}</span></article>;
}
