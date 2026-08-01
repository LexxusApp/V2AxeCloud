import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  Hourglass,
  KeyRound,
  Loader2,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import BodyPortal from '../BodyPortal';
import { cn } from '../../lib/utils';

type ChildOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  status?: string | null;
  foto_url?: string | null;
};

type FoundationOption = { id: string; titulo: string; categoria: string };

type Cycle = {
  id: string;
  titulo: string;
  motivo?: string | null;
  tipo: 'coletivo' | 'restrito';
  publico_alvo: 'corrente' | 'cargo' | 'individual';
  cargos_alvo: string[];
  inicio_em: string;
  fim_em: string;
  status: 'rascunho' | 'ativo' | 'encerrado' | 'cancelado';
  counts: {
    total: number;
    pendentes: number;
    cientes: number;
    dispensados: number;
    orientacao: number;
  };
};

type Participant = {
  id: string;
  filho_id: string;
  status: 'pendente' | 'ciente' | 'dispensado' | 'orientacao_solicitada';
  filho?: ChildOption | null;
};

type CycleDetail = Cycle & {
  orientacoes: string;
  participantes: Participant[];
};

type Props = { tenantId: string };

const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const futureLocalInput = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const initialForm = () => ({
  titulo: '',
  motivo: '',
  orientacoes: '',
  tipo: 'coletivo' as 'coletivo' | 'restrito',
  publico_alvo: 'corrente' as 'corrente' | 'cargo' | 'individual',
  cargos_alvo: [] as string[],
  filhos_alvo: [] as string[],
  filhos_excluidos: [] as string[],
  fundamento_id: '',
  inicio_em: nowLocalInput(),
  fim_em: futureLocalInput(3),
});

function formatPeriod(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${format.format(startDate)} até ${format.format(endDate)}`;
}

function daysLeft(end: string) {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000));
}

export default function PreceitoCommandCenter({ tenantId }: Props) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [foundations, setFoundations] = useState<FoundationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CycleDetail | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const [cyclesResponse, optionsResponse] = await Promise.all([
        authFetch(`/api/v1/preceitos?tenantId=${encodeURIComponent(tenantId)}`),
        authFetch(`/api/v1/preceitos/options?tenantId=${encodeURIComponent(tenantId)}`),
      ]);
      const [cyclesJson, optionsJson] = await Promise.all([cyclesResponse.json(), optionsResponse.json()]);
      if (!cyclesResponse.ok) throw new Error(cyclesJson.error || 'Não foi possível carregar os ciclos.');
      if (!optionsResponse.ok) throw new Error(optionsJson.error || 'Não foi possível carregar a corrente.');
      setCycles(cyclesJson.data || []);
      setChildren(optionsJson.children || []);
      setRoles(optionsJson.cargos || []);
      setFoundations(optionsJson.fundamentos || []);
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar os ciclos.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = cycles.find((cycle) => cycle.status === 'ativo') || null;
  const audienceCount = useMemo(() => {
    const activeChildren = children.filter((child) => {
      const status = String(child.status || '').toLowerCase();
      return !status || status === 'ativo' || status === 'active';
    });
    if (form.publico_alvo === 'individual') return form.filhos_alvo.length;
    if (form.publico_alvo === 'cargo') {
      const selected = new Set(form.cargos_alvo.map((role) => role.toLowerCase()));
      return activeChildren.filter((child) => selected.has(String(child.cargo || '').toLowerCase())).length;
    }
    const excluded = new Set(form.filhos_excluidos);
    return activeChildren.filter((child) => !excluded.has(child.id)).length;
  }, [children, form.cargos_alvo, form.filhos_alvo, form.filhos_excluidos, form.publico_alvo]);

  const openWizard = () => {
    setForm(initialForm());
    setStep(1);
    setError('');
    setWizardOpen(true);
  };

  const openDetail = async (cycle: Cycle) => {
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(`/api/v1/preceitos/${encodeURIComponent(cycle.id)}?tenantId=${encodeURIComponent(tenantId)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setDetail(json.data);
      setDetailOpen(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível abrir o ciclo.');
    } finally {
      setBusy(false);
    }
  };

  const createCycle = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await authFetch('/api/v1/preceitos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tenantId,
          status: 'ativo',
          inicio_em: new Date(form.inicio_em).toISOString(),
          fim_em: new Date(form.fim_em).toISOString(),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Não foi possível iniciar o ciclo.');
      setWizardOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Não foi possível iniciar o ciclo.');
    } finally {
      setBusy(false);
    }
  };

  const endCycle = async (cycle: Cycle) => {
    if (!confirm(`Encerrar o ciclo “${cycle.titulo}”? As orientações deixarão de aparecer para os participantes.`)) return;
    setBusy(true);
    try {
      const response = await authFetch(`/api/v1/preceitos/${encodeURIComponent(cycle.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, status: 'encerrado' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setDetailOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Não foi possível encerrar o ciclo.');
    } finally {
      setBusy(false);
    }
  };

  const updateParticipant = async (participant: Participant, status: 'dispensado' | 'pendente') => {
    if (!detail) return;
    const reason = status === 'dispensado' ? prompt('Motivo da dispensa (opcional):') || '' : '';
    setBusy(true);
    try {
      const response = await authFetch(
        `/api/v1/preceitos/${encodeURIComponent(detail.id)}/participantes/${encodeURIComponent(participant.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, status, motivo: reason }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      await openDetail(detail);
      await load();
    } catch (err: any) {
      setError(err.message || 'Não foi possível atualizar a pessoa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={cn(
        'preceito-command relative mb-6 overflow-hidden rounded-[26px] border px-5 py-5 sm:px-7',
        active
          ? 'border-[#D4B94C]/35 bg-[#121A15] text-white shadow-[0_18px_50px_rgba(26,48,34,.15)]'
          : 'border-[#DCD6CA] bg-[#FBF8F1] text-[#171A16]',
      )}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[32px] border-[#D8BE52]/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-2xl',
              active ? 'bg-[#D8BE52] text-[#121A15]' : 'bg-[#172019] text-[#E2C95A]',
            )}>
              <Flame className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className={cn('text-[9px] font-black uppercase tracking-[.22em]', active ? 'text-[#D8BE52]' : 'text-[#8A7322]')}>
                Estado litúrgico da casa
              </p>
              {loading ? (
                <div className="mt-2 flex items-center gap-2 text-sm font-bold opacity-60"><Loader2 className="h-4 w-4 animate-spin" /> Consultando a corrente</div>
              ) : active ? (
                <>
                  <h2 className="mt-1 font-display text-xl font-black sm:text-2xl">{active.titulo}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#AEB9B0]">{formatPeriod(active.inicio_em, active.fim_em)} · {daysLeft(active.fim_em)} dias restantes</p>
                </>
              ) : (
                <>
                  <h2 className="mt-1 font-display text-xl font-black sm:text-2xl">A casa não está em ciclo de preceito</h2>
                  <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-[#777166]">Inicie quando a corrente precisar receber orientações, confirmar leitura e se preparar em conjunto.</p>
                </>
              )}
            </div>
          </div>

          {active ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-2xl border border-white/10 bg-white/[.045] p-1">
                <span className="px-3 py-2 text-center"><strong className="block text-base">{active.counts.cientes}</strong><small className="text-[8px] font-black uppercase tracking-wider text-[#8E9B91]">Cientes</small></span>
                <span className="border-l border-white/10 px-3 py-2 text-center"><strong className="block text-base">{active.counts.pendentes}</strong><small className="text-[8px] font-black uppercase tracking-wider text-[#8E9B91]">Pendentes</small></span>
                <span className="border-l border-white/10 px-3 py-2 text-center"><strong className="block text-base text-[#E7CC5A]">{active.counts.orientacao}</strong><small className="text-[8px] font-black uppercase tracking-wider text-[#8E9B91]">Orientação</small></span>
              </div>
              <button type="button" onClick={() => void openDetail(active)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#D8BE52] px-4 text-xs font-black text-[#111713] transition hover:-translate-y-0.5">
                Acompanhar ciclo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={openWizard} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#172019] px-5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#243128] disabled:opacity-50">
              <Sparkles className="h-4 w-4 text-[#E2C95A]" /> Iniciar ciclo de preceito
            </button>
          )}
        </div>
        {error && !wizardOpen && !detailOpen ? <p className="relative mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500">{error}</p> : null}
      </section>

      {/* Portal no body: ancestrais com transform (animações do dashboard) fariam
          o fixed ancorar na seção e o modal abrir fora da tela. */}
      <BodyPortal>
      <AnimatePresence>
        {wizardOpen ? (
          <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-[#F9F6EE] shadow-2xl sm:rounded-[28px]">
              <header className="flex items-center justify-between border-b border-[#DED8CB] px-5 py-4 sm:px-7">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#8F7724]">Central de preparação</p>
                  <h2 className="mt-1 font-display text-xl font-black text-[#171A16]">Iniciar ciclo de preceito</h2>
                </div>
                <button type="button" onClick={() => setWizardOpen(false)} className="rounded-full bg-[#EBE5D9] p-2"><X className="h-5 w-5" /></button>
              </header>

              <div className="flex border-b border-[#DED8CB] bg-white/60 px-5 sm:px-7">
                {['Orientação', 'Pessoas', 'Revisão'].map((label, index) => (
                  <div key={label} className={cn('flex flex-1 items-center gap-2 border-b-2 py-3 text-[10px] font-black uppercase tracking-wider', step === index + 1 ? 'border-[#9D8326] text-[#302A19]' : 'border-transparent text-[#A29A8C]')}>
                    <span className={cn('grid h-5 w-5 place-items-center rounded-full text-[9px]', step > index + 1 ? 'bg-[#1C2A20] text-white' : step === index + 1 ? 'bg-[#D8BE52] text-[#171A16]' : 'bg-[#E9E3D7]')}>{step > index + 1 ? <Check className="h-3 w-3" /> : index + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div> : null}

                {step === 1 ? (
                  <div className="grid gap-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Nome do ciclo</span>
                        <input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#171A16] outline-none focus:border-[#9D8326]" placeholder="Ex.: Preceito para a Gira de Xangô" />
                      </label>
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Início</span>
                        <input type="datetime-local" value={form.inicio_em} onChange={(event) => setForm({ ...form, inicio_em: event.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#171A16]" />
                      </label>
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Término</span>
                        <input type="datetime-local" value={form.fim_em} onChange={(event) => setForm({ ...form, fim_em: event.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#171A16]" />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Motivo ou contexto</span>
                        <input value={form.motivo} onChange={(event) => setForm({ ...form, motivo: event.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-semibold text-[#171A16]" placeholder="Ex.: preparação da corrente para o próximo movimento" />
                      </label>
                    </div>
                    <label>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Orientações do preceito</span>
                      <textarea value={form.orientacoes} onChange={(event) => setForm({ ...form, orientacoes: event.target.value })} className="mt-2 min-h-[180px] w-full rounded-2xl border border-[#D8D0C1] bg-white px-4 py-4 text-sm font-medium leading-7 text-[#252720] outline-none focus:border-[#9D8326]" placeholder={'Descreva as orientações, cuidados e restrições.\n\nEsse texto ficará disponível somente para as pessoas incluídas.'} />
                    </label>
                    {foundations.length ? (
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Conteúdo complementar do Acervo (opcional)</span>
                        <select value={form.fundamento_id} onChange={(event) => setForm({ ...form, fundamento_id: event.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#171A16]">
                          <option value="">Nenhum conteúdo vinculado</option>
                          {foundations.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {step === 2 ? (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Quem receberá este ciclo?</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {[
                        { value: 'corrente', title: 'Toda a corrente', detail: 'Todos os membros ativos', icon: Users },
                        { value: 'cargo', title: 'Por função', detail: 'Ogãs, ekedis, cambones…', icon: KeyRound },
                        { value: 'individual', title: 'Pessoas escolhidas', detail: 'Obrigação ou grupo restrito', icon: ShieldCheck },
                      ].map((option) => {
                        const Icon = option.icon;
                        return (
                          <button key={option.value} type="button" onClick={() => setForm({ ...form, publico_alvo: option.value as typeof form.publico_alvo, tipo: option.value === 'corrente' ? 'coletivo' : 'restrito' })} className={cn('rounded-2xl border p-4 text-left transition', form.publico_alvo === option.value ? 'border-[#A78C2C] bg-[#FFF7D6] shadow-sm' : 'border-[#DDD5C6] bg-white hover:border-[#BDB3A1]')}>
                            <Icon className={cn('h-5 w-5', form.publico_alvo === option.value ? 'text-[#8D741F]' : 'text-[#7D776C]')} />
                            <strong className="mt-3 block text-sm text-[#1D201B]">{option.title}</strong>
                            <small className="mt-1 block text-[10px] text-[#80796D]">{option.detail}</small>
                          </button>
                        );
                      })}
                    </div>

                    {form.publico_alvo === 'cargo' ? (
                      <div className="mt-5 rounded-2xl border border-[#DDD5C6] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Selecione as funções</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {roles.map((role) => {
                            const selected = form.cargos_alvo.includes(role);
                            return <button key={role} type="button" onClick={() => setForm({ ...form, cargos_alvo: selected ? form.cargos_alvo.filter((item) => item !== role) : [...form.cargos_alvo, role] })} className={cn('rounded-full border px-3 py-2 text-xs font-bold', selected ? 'border-[#A78C2C] bg-[#FFF2B8] text-[#554711]' : 'border-[#DDD5C6] text-[#6E685D]')}>{selected ? '✓ ' : ''}{role}</button>;
                          })}
                        </div>
                      </div>
                    ) : null}

                    {form.publico_alvo === 'individual' ? (
                      <div className="mt-5 rounded-2xl border border-[#DDD5C6] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Pessoas incluídas</p>
                        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                          {children.map((child) => {
                            const selected = form.filhos_alvo.includes(child.id);
                            return (
                              <button key={child.id} type="button" onClick={() => setForm({ ...form, filhos_alvo: selected ? form.filhos_alvo.filter((id) => id !== child.id) : [...form.filhos_alvo, child.id] })} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left', selected ? 'border-[#A78C2C] bg-[#FFF7D6]' : 'border-[#E4DED2]')}>
                                <span className={cn('grid h-5 w-5 place-items-center rounded-md border', selected ? 'border-[#A78C2C] bg-[#A78C2C] text-white' : 'border-[#C9C1B3]')}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                                <span className="min-w-0"><strong className="block truncate text-xs text-[#1D201B]">{child.nome}</strong><small className="block truncate text-[9px] text-[#817A6E]">{child.cargo || 'Função não informada'}</small></span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {form.publico_alvo === 'corrente' ? (
                      <div className="mt-5 rounded-2xl border border-[#DDD5C6] bg-white p-4">
                        <div className="flex items-center gap-2"><UserMinus className="h-4 w-4 text-[#8D741F]" /><p className="text-[10px] font-black uppercase tracking-wider text-[#635D52]">Dispensar antes de iniciar (opcional)</p></div>
                        <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                          {children.map((child) => {
                            const excluded = form.filhos_excluidos.includes(child.id);
                            return <button key={child.id} type="button" onClick={() => setForm({ ...form, filhos_excluidos: excluded ? form.filhos_excluidos.filter((id) => id !== child.id) : [...form.filhos_excluidos, child.id] })} className={cn('rounded-full border px-3 py-2 text-[10px] font-bold', excluded ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-[#DDD5C6] text-[#716A5F]')}>{excluded ? 'Dispensado · ' : ''}{child.nome}</button>;
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="rounded-[22px] bg-[#141C17] p-5 text-white sm:p-6">
                      <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#D8BE52]">Revisão antes de ativar</p>
                      <h3 className="mt-2 font-display text-2xl font-black">{form.titulo || 'Ciclo sem título'}</h3>
                      <p className="mt-2 text-xs font-semibold text-[#A9B4AB]">{formatPeriod(form.inicio_em, form.fim_em)}</p>
                      {form.motivo ? <p className="mt-4 border-l-2 border-[#D8BE52] pl-3 text-sm leading-6 text-[#D5DDD6]">{form.motivo}</p> : null}
                      <div className="mt-5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[.04] p-4 text-xs leading-6 text-[#C7D0C9]">{form.orientacoes || 'Nenhuma orientação informada.'}</div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-[#DDD5C6] bg-white p-4"><Users className="h-5 w-5 text-[#8D741F]" /><strong className="mt-3 block text-2xl text-[#1A1D18]">{audienceCount}</strong><span className="text-[10px] font-bold text-[#756F64]">pessoas receberão o ciclo</span></div>
                      <div className="rounded-2xl border border-[#DDD5C6] bg-white p-4"><Bell className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-xs font-bold leading-5 text-[#4F4B43]">A notificação não mostrará as orientações. O conteúdo só aparece após o login.</p></div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><CircleAlert className="h-5 w-5 text-amber-700" /><p className="mt-3 text-[10px] font-bold leading-5 text-amber-900">Depois de ativado, inclusões e confirmações ficam registradas historicamente.</p></div>
                    </div>
                  </div>
                ) : null}
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-[#DED8CB] bg-white/70 px-5 py-4 sm:px-7">
                <button type="button" onClick={() => step === 1 ? setWizardOpen(false) : setStep(step - 1)} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-[#625C51]"><ArrowLeft className="h-4 w-4" /> {step === 1 ? 'Cancelar' : 'Voltar'}</button>
                {step < 3 ? (
                  <button type="button" onClick={() => { setError(''); if (step === 1 && (!form.titulo.trim() || !form.orientacoes.trim())) return setError('Informe o nome e as orientações antes de continuar.'); if (step === 2 && audienceCount === 0) return setError('Selecione ao menos uma pessoa para este ciclo.'); setStep(step + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-[#172019] px-5 py-3 text-xs font-black text-white">Continuar <ArrowRight className="h-4 w-4" /></button>
                ) : (
                  <button type="button" disabled={busy || audienceCount === 0} onClick={() => void createCycle()} className="inline-flex items-center gap-2 rounded-xl bg-[#D8BE52] px-5 py-3 text-xs font-black text-[#141A15] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />} Ativar para {audienceCount} pessoas</button>
                )}
              </footer>
            </motion.div>
          </div>
        ) : null}

        {detailOpen && detail ? (
          <div className="fixed inset-0 z-[140] flex justify-end bg-black/65 backdrop-blur-sm">
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 35 }} className="flex h-full w-full max-w-xl flex-col bg-[#F9F6EE]">
              <header className="shrink-0 bg-[#141C17] px-5 py-5 text-white sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#D8BE52]">Ciclo em andamento</p><h2 className="mt-2 font-display text-2xl font-black">{detail.titulo}</h2><p className="mt-2 text-xs text-[#A9B4AB]">{formatPeriod(detail.inicio_em, detail.fim_em)}</p></div>
                  <button type="button" onClick={() => setDetailOpen(false)} className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[['Cientes', detail.counts.cientes], ['Pendentes', detail.counts.pendentes], ['Orientação', detail.counts.orientacao], ['Dispensados', detail.counts.dispensados]].map(([label, count]) => <div key={String(label)} className="rounded-xl bg-white/[.055] p-2 text-center"><strong className="block text-lg">{count}</strong><small className="text-[7px] font-black uppercase tracking-wider text-[#8F9B91]">{label}</small></div>)}
                </div>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-[#4F4A41]">Acompanhamento da corrente</h3><span className="text-[10px] font-bold text-[#8A8377]">{detail.participantes.length} pessoas</span></div>
                <div className="space-y-2">
                  {detail.participantes.map((participant) => {
                    const statusMeta = participant.status === 'ciente'
                      ? { label: 'Ciente', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' }
                      : participant.status === 'orientacao_solicitada'
                        ? { label: 'Pediu orientação', icon: MessageCircleQuestion, color: 'text-amber-800 bg-amber-50' }
                        : participant.status === 'dispensado'
                          ? { label: 'Dispensado', icon: UserMinus, color: 'text-slate-600 bg-slate-100' }
                          : { label: 'Aguardando leitura', icon: Hourglass, color: 'text-[#766528] bg-[#FFF8D9]' };
                    const StatusIcon = statusMeta.icon;
                    return (
                      <div key={participant.id} className="flex items-center gap-3 rounded-2xl border border-[#E0D9CC] bg-white p-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE8DE] text-xs font-black text-[#48443C]">{String(participant.filho?.nome || '?').charAt(0)}</span>
                        <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#1D201B]">{participant.filho?.nome || 'Membro da corrente'}</strong><small className="block truncate text-[9px] text-[#827B70]">{participant.filho?.cargo || 'Função não informada'}</small></span>
                        <span className={cn('hidden items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase sm:flex', statusMeta.color)}><StatusIcon className="h-3 w-3" />{statusMeta.label}</span>
                        <button type="button" disabled={busy} onClick={() => void updateParticipant(participant, participant.status === 'dispensado' ? 'pendente' : 'dispensado')} className="rounded-lg border border-[#DDD5C6] px-2 py-1.5 text-[8px] font-black uppercase text-[#756E62] hover:bg-[#F0EBE2]">{participant.status === 'dispensado' ? 'Reincluir' : 'Dispensar'}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <footer className="shrink-0 border-t border-[#DED8CB] bg-white px-5 py-4 sm:px-7">
                <button type="button" disabled={busy} onClick={() => void endCycle(detail)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700"><Clock3 className="h-4 w-4" /> Encerrar ciclo de preceito</button>
              </footer>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
      </BodyPortal>
    </>
  );
}
