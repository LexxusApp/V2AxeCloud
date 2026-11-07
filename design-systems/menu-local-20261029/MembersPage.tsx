import PageLoading from '../shared/PageLoading';
import { supabase } from '../../src/lib/supabase';
import { previewSession } from './remote/session';
const PILOT_COADMIN_TENANT_ID = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed';
import { financialToday } from './billing';
import { useCreateRequest } from './useCreateRequest';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, ChevronRight, CircleAlert, Clock3, FileText, Mail, MessageCircle, MoreVertical, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, StickyNote, Trash2, UserPlus, Users, Wallet, X } from 'lucide-react';
import './members.css';
import { financialMoney } from './finance';
import { type MonthlyCharge } from './billing';
import { LocalPdfLink } from './LocalAttachments';
import { houseDate, obligationStatus, type HouseObligation } from './house';
import { formatGiraDate, type DemoGira } from './giras';

type Seed = { name: string; role: string; initials: string; color: string; paid: boolean };
type Note = { id: string; text: string; date: string };
export type DemoMember = Seed & {
  id: string; registration: string; joined: string; birthday: string; email: string;
  phone: string; city: string; orixa: string; adjunto: string; feitura: string;
  cpf?: string; status?: 'Ativo' | 'Pendente' | 'Inativo'; restrictions: string; hasApp: boolean; hasInvoice: boolean; notes: Note[];
};
export function createDemoMembers(seed: Seed[]): DemoMember[] {
  return seed.map((m, i) => ({ ...m, id: `demo-${i + 1}`, registration: `DEMO-${String(i + 1).padStart(4, '0')}`,
    joined: ['2022-03-12', '2024-06-08', '2021-08-21', '2026-09-05'][i % 4],
    birthday: i === 0 ? '1994-10-30' : '', email: i === 0 ? 'mariana@example.invalid' : '',
    phone: '', city: '', orixa: '', adjunto: '', feitura: '', restrictions: '',
    cpf: '', status: 'Ativo', hasApp: i !== 1 && i !== 3, hasInvoice: true, notes: [],
  }));
}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCpf = (v: string) => {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};
const date = (s: string) => s ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${s}T12:00:00Z`)) : 'Não informado';
const blankMember = (): DemoMember => ({ id: `local-${Date.now()}`, name: '', role: 'Filho de Santo', initials: '', color: 'sage', paid: false, registration: 'Prévia de cadastro', cpf: '', status: 'Ativo', joined: financialToday(), birthday: '', email: '', phone: '', city: '', orixa: '', adjunto: '', feitura: '', restrictions: '', hasApp: false, hasInvoice: false, notes: [] });
type Props = { obligations: HouseObligation[]; nextMeeting?: DemoGira; members: DemoMember[]; paid: string[]; charges: MonthlyCharge[]; renderFinance: (member: DemoMember) => ReactNode; createRequest: number; onCreateHandled: () => void; onChange: (members: DemoMember[], previousName?: string, nextName?: string) => void; onSendAccess:(id:string)=>Promise<void>; onNavigate: (id: string) => void };
type Mode = 'ready' | 'empty' | 'loading' | 'error';
type ProfileTab = 'info' | 'history' | 'finance' | 'notes';

function Portrait({ member, large = false }: { member: DemoMember; large?: boolean }) {
  return <span className={`avatar ${member.color} ${large ? 'm-portrait-large' : ''}`} aria-hidden="true">{member.initials}</span>;
}
function State({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="m-empty"><Users size={27} aria-hidden="true" /><h3>{title}</h3><p>{text}</p>{action && <button className="m-button secondary" onClick={onAction}>{action}<ArrowRight size={16} /></button>}</div>;
}
function Field({ label, value }: { label: string; value?: string }) {
  return <div><dt>{label}</dt><dd className={!value ? 'm-unfilled' : ''}>{value || 'Não informado'}</dd></div>;
}

export default function MembersPage({ obligations, members, nextMeeting, paid, charges, renderFinance, createRequest, onCreateHandled, onChange, onSendAccess, onNavigate }: Props) {
  const [deleting,setDeleting]=useState(false),[memberActionBusy,setMemberActionBusy]=useState(false),[memberActionError,setMemberActionError]=useState('');
  const [coAdmins, setCoAdmins] = useState<{ id: string; filho_id: string; nome: string; email: string; ativo: boolean }[]>([]);
  const [coAdminBusy, setCoAdminBusy] = useState(false);
  const [cardFeedback, setCardFeedback] = useState('');
  const [cardError, setCardError] = useState('');
  const session = (() => { try { return previewSession(); } catch { return null; } })();
  const isPilotTenant = session?.tenantId === PILOT_COADMIN_TENANT_ID;
  const isDelegatedCoAdmin = session?.profile?.is_co_admin === true || session?.profile?.cargo === 'Co-Administrador';
  const canManageCoAdmins = isPilotTenant && !isDelegatedCoAdmin;

  const parseCoAdminList = (res: any) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  const loadCoAdmins = async () => {
    if (!canManageCoAdmins) return;
    try {
      const { data, error } = await supabase.rpc('piloto_listar_coadministradores', { p_tenant: PILOT_COADMIN_TENANT_ID });
      if (!error && data) {
        const list = parseCoAdminList(data);
        setCoAdmins(list.filter((r: any) => r.ativo));
      }
    } catch (err) {
      console.warn('[MembersPage] Falha ao carregar coadministradores:', err);
    }
  };

  useEffect(() => {
    if (canManageCoAdmins) void loadCoAdmins();
  }, [canManageCoAdmins]);

  const handleToggleCoAdmin = async (filhoId: string, makeCoAdmin: boolean) => {
    if (!canManageCoAdmins) return;
    setCoAdminBusy(true);
    setCardError('');
    setCardFeedback('');

    // Atualização otimista imediata para resposta instantânea ao clique
    if (makeCoAdmin) {
      setCoAdmins(prev => [...prev.filter(c => c.filho_id !== filhoId), { id: filhoId, filho_id: filhoId, nome: '', email: '', ativo: true }]);
    } else {
      setCoAdmins(prev => prev.filter(c => c.filho_id !== filhoId));
    }

    try {
      const { data, error } = await supabase.rpc('piloto_definir_coadministrador', {
        p_tenant: PILOT_COADMIN_TENANT_ID,
        p_filho_id: filhoId,
        p_ativo: makeCoAdmin,
      });
      if (error) throw error;
      const msg = makeCoAdmin ? 'Membro definido como Co-Administrador do sistema!' : 'Co-administração revogada com sucesso.';
      setFeedback(msg);
      setCardFeedback(msg);
      await loadCoAdmins();
    } catch (err) {
      await loadCoAdmins();
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar co-administrador.';
      setFeedback(msg);
      setCardError(msg);
    } finally {
      setCoAdminBusy(false);
    }
  };
  const [targetMember, setTargetMember] = useState<DemoMember | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [selected, setSelected] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('info');
  const [mode, setMode] = useState<Mode>('ready');
  const [editor, setEditor] = useState<DemoMember | null>(null);
  const [editorError, setEditorError] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const profileHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const previousRequest = useRef(createRequest);
  const returnFocusId = useRef<string | null>(null);
  const isEmpty = mode === 'empty';
  const records = isEmpty ? [] : members;
  const member = records.find(m => m.id === selected);
  const isPaid = (m: DemoMember) => m.paid || paid.includes(m.name);
  const hasDebt = (m: DemoMember) => m.hasInvoice && !isPaid(m);
  const missing = (m: DemoMember) => !m.phone || !m.birthday;
  const withoutApp = records.filter(m => !m.hasApp);
  const debtors = records.filter(hasDebt);
  const birthdays = records.filter(m => m.birthday.slice(5, 7) === financialToday().slice(5,7));
  const shown = records.filter(m => normalize(`${m.name} ${m.registration} ${m.role}`).includes(normalize(query)) && (filter === 'all' || filter === 'active' && (!m.status || m.status === 'Ativo') || filter === 'inactive' && m.status === 'Inativo' || filter === 'status-pending' && m.status === 'Pendente' || filter === 'debt' && hasDebt(m) || filter === 'app' && !m.hasApp || filter === 'data' && missing(m) || filter === 'birthday' && m.birthday.slice(5, 7) === financialToday().slice(5,7)))
    .sort((a, b) => sort === 'recent' ? b.joined.localeCompare(a.joined) || a.name.localeCompare(b.name, 'pt-BR') : sort === 'attention' ? Number(!b.hasApp) + Number(hasDebt(b)) - Number(!a.hasApp) - Number(hasDebt(a)) || a.name.localeCompare(b.name, 'pt-BR') : a.name.localeCompare(b.name, 'pt-BR'));

  useCreateRequest(createRequest, onCreateHandled, () => { setEditor(blankMember()); setEditorError(''); opener.current = document.activeElement as HTMLElement; });
  useEffect(() => {
    if (selected) profileHeading.current?.focus({ preventScroll: true });
    else if (returnFocusId.current) {
      const target = document.getElementById(`m-row-${returnFocusId.current}`);
      if (target) target.focus({ preventScroll: true }); else listHeading.current?.focus({ preventScroll: true });
      returnFocusId.current = null;
    }
  }, [selected]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 5000); return () => clearTimeout(timer); }, [feedback]);
  useEffect(() => {
    if (!menuOpenId) return;
    const onDismiss = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') { setMenuOpenId(null); return; }
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.m-row-actions')) { setMenuOpenId(null); }
    };
    document.addEventListener('click', onDismiss);
    document.addEventListener('keydown', onDismiss);
    return () => {
      document.removeEventListener('click', onDismiss);
      document.removeEventListener('keydown', onDismiss);
    };
  }, [menuOpenId]);

  const openProfile = (m: DemoMember) => { setSelected(m.id); setProfileTab('info'); setNote(''); setFeedback(''); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const back = () => { returnFocusId.current = selected; setSelected(null); setNote(''); setFeedback(''); };
  const edit = (m: DemoMember) => { opener.current = document.activeElement as HTMLElement; setEditor({ ...m, cpf: m.cpf ? formatCpf(m.cpf) : '' }); setEditorError(''); };
  const filterList = (next: string) => { setFilter(next); setQuery(''); searchRef.current?.focus(); };
  const add = () => { opener.current = document.activeElement as HTMLElement; setEditor(blankMember()); setEditorError(''); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const name = editor.name.trim().replace(/\s+/g, ' ');
    if (name.length < 3) { setEditorError('Informe um nome com pelo menos 3 caracteres.'); return; }
    if (members.some(m => m.id !== editor.id && normalize(m.name) === normalize(name))) { setEditorError('Já existe um membro com esse nome nesta casa.'); return; }
    const cleanCpf = (editor.cpf || '').replace(/\D/g, '');
    if (!cleanCpf) { setEditorError('Informe o CPF completo do membro (obrigatório para geração de acesso e login).'); return; }
    if (cleanCpf.length !== 11) { setEditorError('O CPF deve ter exatamente 11 dígitos.'); return; }
    if (members.some(m => m.id !== editor.id && (m.cpf || '').replace(/\D/g, '') === cleanCpf)) { setEditorError('Já existe um membro cadastrado com este CPF nesta casa.'); return; }

    const email = (editor.email || '').trim().toLowerCase();
    if (!email) { setEditorError('Informe o e-mail do membro (obrigatório para o login de acesso).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEditorError('Informe um e-mail válido (ex.: membro@exemplo.com).'); return; }
    if (members.some(m => m.id !== editor.id && (m.email || '').trim().toLowerCase() === email)) { setEditorError('Já existe um membro cadastrado com este e-mail nesta casa.'); return; }

    const old = members.find(m => m.id === editor.id);
    const saved = { ...editor, name, cpf: formatCpf(cleanCpf), email, initials: name.split(' ').slice(0, 2).map(s => s[0]).join('').toLocaleUpperCase('pt-BR'), registration: old?.registration || '' };
    try { await onChange(old ? members.map(m => m.id === saved.id ? saved : m) : [...members, saved], old?.name, saved.name); } catch (error) { setEditorError(error instanceof Error ? error.message : 'Não foi possível salvar.'); return; }
    setMode('ready'); setEditor(null); setSelected(saved.id); setProfileTab('info');
    setFeedback(old ? 'Perfil confirmado pelo servidor.' : 'Membro cadastrado no sistema. Consulte o acesso no perfil.');
  };
  const saveNote = async (event: FormEvent) => {
    event.preventDefault(); if (!member || !note.trim()) return;
    const item = { id: `note-${Date.now()}`, text: note.trim(), date: new Date().toISOString() };
    try { await onChange(members.map(m => m.id === member.id ? { ...m, notes: [item, ...m.notes] } : m)); } catch(error) {setFeedback(error instanceof Error?error.message:'Não foi possível salvar.');return;}
    setNote(''); setFeedback('Anotação confirmada pelo servidor.');
  };
  const dialogFocus = { onCloseAutoFocus: (event: Event) => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); else (selected ? profileHeading : listHeading).current?.focus({ preventScroll: true }); } };

  return <div className="members-stage">
    {feedback && <div className="m-feedback" role="status"><Check size={17} />{feedback}</div>}
    {mode === 'loading' ? <PageLoading route="children"/> : mode === 'error' ? <section className="hs-state" role="alert"><h2>Não foi possível carregar a corrente.</h2><p>Tente novamente para consultar as informações.</p><button className="button secondary" onClick={() => setMode('ready')}>Tentar novamente</button></section> : member ? <>
      <button className="m-back" onClick={back}><ArrowLeft size={17} />Voltar à corrente</button>
      <section className="m-profile" aria-labelledby="m-profile-name">
        <div className="m-identity"><Portrait member={member} large /><div><span className="m-status"><span />{member.status || 'Ativo'} na corrente</span><h2 ref={profileHeading} tabIndex={-1} id="m-profile-name">{member.name}</h2><p>{member.role}{coAdmins.some(c => c.filho_id === member.id) && <span className="m-tag amber" style={{ marginLeft: 10, padding: '3px 10px', fontSize: 12, fontWeight: 600, verticalAlign: 'middle' }}>👑 Co-Administrador do Sistema</span>}</p></div></div>
        <div className="m-profile-actions"><button className="m-button secondary" onClick={() => { opener.current = document.activeElement as HTMLElement; setTargetMember(member); setMemberActionError(''); setAccessOpen(true); }}><MessageCircle size={17} />Enviar dados de acesso</button><button className="m-button" onClick={() => edit(member)}><Pencil size={16} />Editar perfil</button><button className="m-button secondary" onClick={()=>{setTargetMember(member); setMemberActionError('');setDeleting(true);}}><Trash2 size={16}/>Excluir membro</button></div>
        <dl className="m-identity-details"><Field label="Registro" value={member.registration} /><Field label="Na casa desde" value={date(member.joined)} /><Field label="Orixá de frente" value={member.orixa} /><Field label="Acesso ao app" value={member.hasApp ? 'Acesso disponível' : 'Ainda sem acesso'} /></dl>
      </section>
      <div className="m-summary" aria-label="Resumo do membro">
        <div><ShieldCheck size={19} /><span>Dados cadastrais<strong>{missing(member) ? 'Completar cadastro' : 'Dados preenchidos'}</strong><small>{missing(member) ? 'Revise contato e nascimento' : 'Informações essenciais presentes'}</small></span></div>
        <div><Wallet size={19} /><span>Mensalidade<strong>{!member.hasInvoice ? 'Sem lançamento' : hasDebt(member) ? 'Em aberto' : 'Em dia'}</strong><small>{member.hasInvoice ? `${financialMoney(charges.filter(charge => charge.memberId === member.id && charge.status === 'pending').reduce((sum, charge) => sum + charge.totalCents, 0))} em aberto` : 'Nenhuma cobrança criada'}</small></span></div>
        <div><CalendarDays size={19} /><span>Próxima gira<strong>{nextMeeting ? formatGiraDate(nextMeeting, { day: 'numeric', month: 'long' }) : 'Sem agendamento'}</strong><small>{nextMeeting ? `${nextMeeting.title} · ${nextMeeting.time}` : 'Nenhum encontro na agenda'}</small></span></div>
      </div>
      <div className="m-profile-nav" role="group" aria-label="Seções do perfil">{([{ id: 'info', name: 'Dados cadastrais', icon: Users }, { id: 'history', name: 'Evolução espiritual', icon: BookOpen }, { id: 'finance', name: 'Financeiro', icon: Wallet }, { id: 'notes', name: 'Anotações', icon: StickyNote }] as const).map(t => <button key={t.id} aria-pressed={profileTab === t.id} onClick={() => { setProfileTab(t.id); setFeedback(''); }}><t.icon size={17} />{t.name}</button>)}</div>
      {profileTab === 'info' && <div className="m-profile-grid">
        {canManageCoAdmins && (
          <section className="m-panel" style={{ gridColumn: 'span 2', padding: 0, overflow: 'hidden', borderColor: '#d8d0c4', background: '#fffdf8' }}>
            <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg,#173323,#214b35)', display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(244,196,48,.12)', border: '1px solid rgba(244,196,48,.22)', color: '#f4c430', flexShrink: 0 }}>
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: '#f4c430' }}>Acesso de gestão</p>
                  <h3 style={{ margin: '3px 0 0', color: '#fff', fontSize: 16, fontWeight: 800 }}>Responsável pelo sistema</h3>
                  <p style={{ margin: '5px 0 0', color: '#d5e2d8', fontSize: 12, lineHeight: 1.55 }}>
                    Autorize um membro de confiança a operar as rotinas da casa sem transferir a titularidade.
                  </p>
                </div>
              </div>
              <span style={{ background: coAdmins.some(c => c.filho_id === member.id) ? '#eff7f1' : 'rgba(255,255,255,.1)', color: coAdmins.some(c => c.filho_id === member.id) ? '#17633b' : '#e5ede7', border: coAdmins.some(c => c.filho_id === member.id) ? '1px solid #c7ddcd' : '1px solid rgba(255,255,255,.14)', padding: '5px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {coAdmins.some(c => c.filho_id === member.id) ? 'Acesso ativo' : 'Acesso comum'}
              </span>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: 0, color: '#706658', fontSize: 12, lineHeight: 1.6, fontWeight: 600 }}>
                {coAdmins.some(c => c.filho_id === member.id)
                  ? `${member.name} pode administrar cadastros, giras, presença, cantina e avisos. Assinatura e exclusão da casa continuam exclusivas da zeladoria titular.`
                  : `Conceda a ${member.name} acesso operacional ao painel. Assinatura, cobrança do AxéCloud e exclusão da casa permanecem protegidas para o titular.`}
              </p>
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #e0d5be', background: '#fff9ed', color: '#66552a', fontSize: 11, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <ShieldCheck size={15} style={{ color: '#17633b', marginTop: 1, flexShrink: 0 }} />
                O acesso pode ser revogado a qualquer momento sem remover o cadastro do membro.
              </div>
              <button
                type="button"
                className="m-button"
                style={{ marginTop: 14, width: '100%', justifyContent: 'center', minHeight: 42, background: coAdmins.some(c => c.filho_id === member.id) ? '#fff6f4' : '#173323', color: coAdmins.some(c => c.filho_id === member.id) ? '#a54434' : '#fff', border: coAdmins.some(c => c.filho_id === member.id) ? '1px solid #e6c9c3' : '1px solid #173323' }}
                disabled={coAdminBusy}
                onClick={() => handleToggleCoAdmin(member.id, !coAdmins.some(c => c.filho_id === member.id))}
              >
                {coAdminBusy ? 'Atualizando…' : coAdmins.some(c => c.filho_id === member.id) ? 'Revogar acesso de gestão' : 'Conceder acesso de gestão'}
              </button>
              {cardFeedback && <div style={{ marginTop: 12, padding: '9px 12px', background: '#eff7f1', color: '#17633b', border: '1px solid #c7ddcd', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={16} /> {cardFeedback}</div>}
              {cardError && <div style={{ marginTop: 12, padding: '9px 12px', background: '#fff6f4', color: '#991b1b', border: '1px solid #e6c9c3', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><CircleAlert size={16} /> {cardError}</div>}
            </div>
          </section>
        )}
        <section className="m-panel"><div className="m-section-head"><h3>Informações pessoais</h3><Pencil size={17} aria-hidden="true" /></div><dl className="m-fields"><Field label="Nome completo" value={member.name} /><Field label="Nascimento" value={member.birthday ? date(member.birthday) : ''} /><Field label="E-mail" value={member.email} /><Field label="Telefone / WhatsApp" value={member.phone} /><Field label="Endereço" value={member.city} /><Field label="CPF" value={member.cpf || ''} /></dl><p className="m-help">Dados do cadastro da casa. Campos ausentes permanecem identificados.</p></section>
        <section className="m-panel"><h3>Vínculo com a casa</h3><dl className="m-fields"><Field label="Cargo / função" value={member.role} /><Field label="Data de entrada" value={date(member.joined)} /><Field label="Orixá de frente" value={member.orixa} /><Field label="Orixá adjuntó" value={member.adjunto} /><Field label="Data de feitura" value={member.feitura ? date(member.feitura) : ''} /><Field label="Quizilas e cuidados" value={member.restrictions} /></dl></section>
      </div>}
      {profileTab === 'history' && <section className="m-panel"><h3>Evolução espiritual</h3><p className="m-section-description">Obrigações, documentos e a trajetória do membro na casa.</p>{obligations.some(i => i.memberId === member.id) ? <><ol className="m-obligation-list">{obligations.filter(i => i.memberId === member.id).sort((a, b) => a.date.localeCompare(b.date)).map(item => <li key={item.id}><span><strong>{item.title}</strong><small>{houseDate(item.date, item.time)} · Brasília</small>{item.attachment && <LocalPdfLink file={item.attachment} />}</span><span className={`m-tag ${obligationStatus(item) === 'late' ? 'amber' : ''}`}>{item.done ? 'Concluído' : obligationStatus(item) === 'late' ? 'Em atraso' : 'Programado'}</span></li>)}</ol><p className="m-help">Compromissos vinculados a este membro. Nenhum fundamento religioso foi preenchido automaticamente.</p><button className="m-button secondary" onClick={() => onNavigate('obligations')}>Abrir central de obrigações<ArrowRight size={16} /></button></> : <State title="Nenhuma obrigação registrada." text="As datas e os fundamentos devem ser definidos pela zeladoria. Nenhuma informação religiosa foi preenchida automaticamente." action="Ver central de obrigações" onAction={() => onNavigate('obligations')} />}</section>}
      {profileTab === 'finance' && <section className="m-panel"><div className="m-section-head"><div><h3>Mensalidades e consumo</h3><p className="m-section-description">Consulte as contribuições vinculadas a {member.name.split(' ')[0]}.</p></div><span className={`m-tag ${hasDebt(member) ? 'amber' : ''}`}>{member.hasInvoice ? hasDebt(member) ? 'Em aberto' : 'Em dia' : 'Sem lançamento'}</span></div>{renderFinance(member)}<div className="m-inline-actions"><button className="m-button secondary" onClick={() => onNavigate('financial-mensalidades')}>Abrir mensalidades<ArrowUpRight size={16} /></button><button className="m-button secondary" onClick={() => onNavigate('financial-cantina')}>Ver cantina<ArrowUpRight size={16} /></button></div></section>}
      {profileTab === 'notes' && <section className="m-panel"><div className="m-section-head"><div><h3>Anotações da zeladoria</h3><p className="m-section-description">Espaço reservado da gestão no sistema. As anotações são reservadas à zeladoria.</p></div><StickyNote size={20} /></div><form className="m-note-form" onSubmit={saveNote}><label htmlFor="m-note">Nova anotação</label><textarea id="m-note" rows={3} maxLength={1200} value={note} onChange={e => setNote(e.target.value)} placeholder="Escreva uma anotação da zeladoria…" /><div><small>{note.length}/1200 caracteres</small><button className="m-button" disabled={!note.trim()} type="submit"><Plus size={16} />Salvar no sistema</button></div></form><ol className="m-notes">{member.notes.map(n => <li key={n.id}><time dateTime={n.date}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(n.date))} · Brasília</time><p>{n.text}</p></li>)}</ol>{!member.notes.length && <p className="m-help">Ainda não há anotações neste perfil.</p>}</section>}
    </> : <>
      <section className="m-overview" aria-label="Resumo da corrente">
        <button onClick={() => filterList('active')}><Users size={21} /><span>Ativos na corrente<strong>{records.filter(member => !member.status || member.status === 'Ativo').length}</strong></span><ArrowUpRight size={16} /></button>
        <button onClick={() => filterList('app')}><MessageCircle size={21} /><span>Ainda sem app<strong>{withoutApp.length}</strong></span><ArrowUpRight size={16} /></button>
        <button onClick={() => filterList('debt')}><Wallet size={21} /><span>Mensalidades em aberto<strong>{debtors.length}</strong></span><ArrowUpRight size={16} /></button>
        <button onClick={() => filterList('birthday')}><CalendarDays size={21} /><span>Aniversários deste mês<strong>{birthdays.length}</strong></span><ArrowUpRight size={16} /></button>
      </section>
      <div className="m-list-layout"><section className="m-panel m-list-panel" aria-labelledby="m-list-title"><div className="m-section-head"><div><h2 id="m-list-title" tabIndex={-1} ref={listHeading}>Corrente da casa</h2><p className="m-section-description">{shown.length} de {records.length} {records.length === 1 ? 'pessoa' : 'pessoas'} · Dados do sistema</p></div><span className="m-tag">{records.filter(member => !member.status || member.status === 'Ativo').length} ativos</span></div>
        <div className="m-controls"><label className="m-search"><Search size={18} /><input ref={searchRef} aria-label="Buscar membro" placeholder="Nome, registro ou função…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Limpar busca de membros" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={16} /></button>}</label><label className="m-sort"><span className="sr-only">Ordenar membros</span><select aria-label="Ordenar membros" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Nome A–Z</option><option value="recent">Mais recentes</option><option value="attention">Pedem atenção</option></select></label></div>
        <div className="m-filters" role="group" aria-label="Filtrar membros">{[{ id: 'all', label: 'Todos' }, { id: 'active', label: 'Ativos' }, { id: 'inactive', label: 'Inativos' }, { id: 'status-pending', label: 'Cadastro pendente' }, { id: 'debt', label: 'Mensalidade pendente' }, { id: 'app', label: 'Sem app' }, { id: 'data', label: 'Cadastro incompleto' }, ...(filter === 'birthday' ? [{ id: 'birthday', label: 'Aniversários' }] : [])].map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
        {shown.length ? <><div className="m-table-head" aria-hidden="true"><div className="m-table-head-cols"><span>Membro</span><span>Acesso ao app</span><span>Mensalidade</span></div><span /></div><ul className="m-rows">{shown.map((m, index) => {
          const isMenuOpen = menuOpenId === m.id;
          const isLastFew = index >= shown.length - 2 && shown.length > 2;
          return <li key={m.id} className="m-row-item">
            <button id={`m-row-${m.id}`} className="m-person-row" onClick={() => openProfile(m)} aria-label={`Abrir perfil de ${m.name}`}>
              <span className="m-person-name"><Portrait member={m} /><span><strong>{m.name}{coAdmins.some(c => c.filho_id === m.id) && <span className="m-tag amber" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, verticalAlign: 'middle' }} title="Responsável pelo Sistema">👑 Co-Admin</span>}</strong><small>{m.role} · {m.registration}</small></span></span>
              <span className={`m-access ${!m.hasApp ? 'pending' : ''}`}><span />{m.hasApp ? 'Com acesso' : 'Sem app'}</span>
              <span className={`m-tag ${hasDebt(m) ? 'amber' : !m.hasInvoice ? 'neutral' : ''}`}>{!m.hasInvoice ? 'Sem lançamento' : hasDebt(m) ? 'Em aberto' : 'Em dia'}</span>
            </button>
            <div className="m-row-actions">
              <button
                type="button"
                className="m-action-trigger"
                aria-label={`Ações para ${m.name}`}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpenId(prev => prev === m.id ? null : m.id);
                }}
              >
                <MoreVertical size={18} aria-hidden="true" />
              </button>
              {isMenuOpen && (
                <div role="menu" className={`m-action-menu ${isLastFew ? 'drop-up' : ''}`} onClick={(e) => e.stopPropagation()}>
                  {isPilotTenant && (
                    <button
                      type="button"
                      role="menuitem"
                      className="m-action-item"
                      disabled={coAdminBusy}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setMenuOpenId(null);
                        const isCo = coAdmins.some(c => c.filho_id === m.id);
                        await handleToggleCoAdmin(m.id, !isCo);
                      }}
                    >
                      <ShieldCheck size={15} aria-hidden="true" />
                      <span>{coAdmins.some(c => c.filho_id === m.id) ? 'Revogar Co-Admin' : 'Tornar Co-Admin'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="m-action-item access"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      opener.current = e.currentTarget as HTMLElement;
                      setTargetMember(m);
                      setMemberActionError('');
                      setAccessOpen(true);
                    }}
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                    <span>Enviar acesso</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="m-action-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      edit(m);
                    }}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    <span>Editar perfil</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="m-action-item danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      opener.current = e.currentTarget as HTMLElement;
                      setTargetMember(m);
                      setMemberActionError('');
                      setDeleting(true);
                    }}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>Excluir</span>
                  </button>
                </div>
              )}
            </div>
          </li>;
        })}</ul></> : <State title={records.length ? 'Nenhum membro encontrado.' : 'A corrente começa com o primeiro cadastro.'} text={records.length ? 'Tente outro nome ou limpe os filtros para ver toda a corrente.' : 'Organize os vínculos, os acessos e o cuidado de cada pessoa da casa.'} action={records.length ? 'Limpar filtros' : 'Cadastrar primeiro membro'} onAction={records.length ? () => { setQuery(''); setFilter('all'); searchRef.current?.focus(); } : add} />}
      </section>
      <aside className="m-side"><section className="m-panel"><span className="m-side-icon"><CircleAlert size={21} /></span><h3>Um cuidado por vez</h3><p>Confira o que ainda precisa de atenção na corrente.</p><button className="m-task" onClick={() => filterList('app')}><span><strong>{withoutApp.length} sem acesso ao app</strong><small>Revise os dados antes de enviar o convite.</small></span><ChevronRight size={17} /></button><button className="m-task" onClick={() => filterList('data')}><span><strong>{records.filter(missing).length} cadastros incompletos</strong><small>Contato e data de nascimento.</small></span><ChevronRight size={17} /></button><button className="m-task" onClick={() => filterList('debt')}><span><strong>{debtors.length} {debtors.length === 1 ? 'mensalidade em aberto' : 'mensalidades em aberto'}</strong><small>Acompanhe as contribuições da casa.</small></span><ChevronRight size={17} /></button></section>
        <section className="m-birthday"><CalendarDays size={21} /><h3>Aniversários deste mês</h3>{birthdays.length ? birthdays.map(m => <button key={m.id} onClick={() => openProfile(m)}><Portrait member={m} /><span><strong>{m.name}</strong><small>{m.birthday.slice(8, 10)} de outubro</small></span><ArrowUpRight size={16} /></button>) : <p>Nenhum aniversário informado neste mês.</p>}</section>
      </aside></div>
    </>}

    <Dialog.Root open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content {...dialogFocus} className="dialog m-editor"><div className="dialog-heading"><Dialog.Title>{members.some(m => m.id === editor?.id) ? 'Editar perfil' : 'Novo membro'}</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Fechar cadastro"><X size={21} /></button></Dialog.Close></div><Dialog.Description>Os dados serão salvos no cadastro da casa e usados para gerar as credenciais de acesso do membro.</Dialog.Description>{editor && <form onSubmit={save} className="m-editor-form">
      <label className="m-form-wide">Nome completo *<input required minLength={3} maxLength={80} aria-invalid={!!editorError} aria-describedby={editorError ? 'm-name-error' : undefined} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} autoComplete="off" /></label>
      <label>CPF *<input required inputMode="numeric" maxLength={14} value={editor.cpf || ''} onChange={e => setEditor({ ...editor, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" /></label><label>Situação do membro<select value={editor.status || 'Ativo'} onChange={e => setEditor({ ...editor, status: e.target.value as DemoMember['status'] })}><option>Ativo</option><option>Pendente</option><option>Inativo</option></select></label><label>Cargo / função<input maxLength={60} value={editor.role} onChange={e => setEditor({ ...editor, role: e.target.value })} /></label><label>Data de entrada<input type="date" required value={editor.joined} onInput={e => setEditor({ ...editor, joined: e.currentTarget.value })} onChange={e => setEditor({ ...editor, joined: e.target.value })} /></label>
      <label>Nascimento<input type="date" max={financialToday()} value={editor.birthday} onInput={e => setEditor({ ...editor, birthday: e.currentTarget.value })} onChange={e => setEditor({ ...editor, birthday: e.target.value })} /></label><label>E-mail (para login) *<input type="email" required value={editor.email} onChange={e => setEditor({ ...editor, email: e.target.value.trim().toLowerCase() })} autoComplete="off" placeholder="membro@exemplo.com" /></label>
      <label>Telefone / WhatsApp<input type="tel" maxLength={25} value={editor.phone} onChange={e => setEditor({ ...editor, phone: e.target.value })} autoComplete="off" /></label><label>Endereço<input maxLength={80} value={editor.city} onChange={e => setEditor({ ...editor, city: e.target.value })} /></label>
      <label>Orixá de frente<input maxLength={60} value={editor.orixa} onChange={e => setEditor({ ...editor, orixa: e.target.value })} /></label><label>Orixá adjuntó<input maxLength={60} value={editor.adjunto} onChange={e => setEditor({ ...editor, adjunto: e.target.value })} /></label>
      <label>Data de feitura<input type="date" value={editor.feitura} onInput={e => setEditor({ ...editor, feitura: e.currentTarget.value })} onChange={e => setEditor({ ...editor, feitura: e.target.value })} /></label><label>Quizilas e cuidados<input maxLength={160} value={editor.restrictions} onChange={e => setEditor({ ...editor, restrictions: e.target.value })} /></label>
      {editorError && <p id="m-name-error" className="m-form-error m-form-wide" role="alert">{editorError}</p>}<div className="m-form-footer m-form-wide"><p>O servidor confirma o cadastro. Mensalidades são lançadas separadamente no financeiro.</p><button type="submit" className="m-button"><Check size={17} />Salvar no sistema</button></div>
    </form>}</Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={accessOpen} onOpenChange={open=>{if(!memberActionBusy){setAccessOpen(open);if(!open)setTargetMember(null);}}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content {...dialogFocus} className="dialog"><div className="dialog-heading"><Dialog.Title>Enviar dados de acesso</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Fechar acesso"><X size={20}/></button></Dialog.Close></div><Dialog.Description>O modelo oficial com o Registro e as instruções de entrada será enviado somente ao WhatsApp deste membro. O sistema usa as regras atuais de acesso; nenhuma senha é solicitada aqui.</Dialog.Description><div className="m-access-detail"><ShieldCheck size={27}/><strong>{(targetMember||member)?.name}</strong><p>{(targetMember||member)?.phone||'Cadastre o WhatsApp antes de enviar.'}</p>{memberActionError&&<p role="alert" className="m-form-error">{memberActionError}</p>}<button className="m-button" disabled={memberActionBusy||!(targetMember||member)?.phone} onClick={async()=>{const active=targetMember||member;if(!active||memberActionBusy)return;setMemberActionBusy(true);setMemberActionError('');try{await onSendAccess(active.id);setAccessOpen(false);setTargetMember(null);setFeedback('Envio dos dados de acesso aceito. Acompanhe a entrega no histórico do WhatsApp.');}catch(error){setMemberActionError(error instanceof Error?error.message:'Não foi possível enviar.');}finally{setMemberActionBusy(false);}}}><MessageCircle size={17}/>{memberActionBusy?'Enviando…':'Enviar para este membro'}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
    <Dialog.Root open={deleting} onOpenChange={open=>{if(!memberActionBusy){setDeleting(open);if(!open)setTargetMember(null);}}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content {...dialogFocus} className="dialog"><div className="dialog-heading"><Dialog.Title>Excluir filho de santo?</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Fechar exclusão"><X size={20}/></button></Dialog.Close></div><Dialog.Description>Você vai excluir o cadastro de {(targetMember||member)?.name} usando a mesma operação do sistema atual. A exclusão é definitiva. Se houver vínculos que impeçam a remoção, o servidor preservará o cadastro e mostrará o erro.</Dialog.Description>{memberActionError&&<p role="alert" className="m-form-error">{memberActionError}</p>}<div className="m-profile-actions"><button className="m-button secondary" disabled={memberActionBusy} onClick={()=>{setDeleting(false);setTargetMember(null);}}>Manter membro</button><button className="m-button" disabled={memberActionBusy} onClick={async()=>{const active=targetMember||member;if(!active||memberActionBusy)return;setMemberActionBusy(true);setMemberActionError('');try{await onChange(members.filter(row=>row.id!==active.id));setDeleting(false);setTargetMember(null);if(selected===active.id)setSelected(null);setFeedback('Cadastro excluído pelo servidor.');}catch(error){setMemberActionError(error instanceof Error?error.message:'Não foi possível excluir.');}finally{setMemberActionBusy(false);}}}><Trash2 size={16}/>{memberActionBusy?'Excluindo…':'Excluir definitivamente'}</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
