import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BookMarked,
  ChevronRight,
  Droplets,
  Eye,
  FileLock2,
  Flame,
  Flower2,
  KeyRound,
  Leaf,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';
import { cn } from '../../lib/utils';

type AccessLevel = 'corrente' | 'cargo' | 'individual' | 'zeladoria';
type ItemStatus = 'rascunho' | 'publicado' | 'arquivado';

type Foundation = {
  id: string;
  titulo: string;
  resumo?: string | null;
  conteudo?: string;
  categoria: string;
  tradicao: string;
  nivel_acesso: AccessLevel;
  cargos_permitidos: string[];
  filhos_permitidos?: string[];
  status: ItemStatus;
  updated_at: string;
};

type ChildOption = {
  id: string;
  nome: string;
  cargo?: string | null;
  status?: string | null;
  foto_url?: string | null;
};

type Props = {
  tenantId: string;
  isAdmin: boolean;
  onBack: () => void;
};

const categories = [
  { id: 'banhos', label: 'Banhos', icon: Droplets, color: '#39BCEB' },
  { id: 'ervas', label: 'Ervas', icon: Leaf, color: '#45C48B' },
  { id: 'rituais', label: 'Rituais', icon: Flame, color: '#F5B942' },
  { id: 'defumacoes', label: 'Defumações', icon: Sparkles, color: '#A78BFA' },
  { id: 'firmezas', label: 'Firmezas', icon: Flower2, color: '#FB7185' },
  { id: 'fundamentos', label: 'Fundamentos', icon: BookMarked, color: '#E9C84A' },
  { id: 'outros', label: 'Outros', icon: FileLock2, color: '#94A3B8' },
] as const;

const accessLabels: Record<AccessLevel, string> = {
  corrente: 'Toda a corrente',
  cargo: 'Por função',
  individual: 'Pessoas escolhidas',
  zeladoria: 'Somente zeladoria',
};

const blankForm = {
  titulo: '',
  resumo: '',
  conteudo: '',
  categoria: 'banhos',
  tradicao: 'todas',
  nivel_acesso: 'corrente' as AccessLevel,
  cargos: '',
  filhos_permitidos: [] as string[],
  status: 'rascunho' as ItemStatus,
};

function categoryMeta(id: string) {
  return categories.find((category) => category.id === id) || categories[categories.length - 1];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}

export function FundamentosAcervo({ tenantId, isAdmin, onBack }: Props) {
  const [items, setItems] = useState<Foundation[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [houseTradition, setHouseTradition] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todos');
  const [selected, setSelected] = useState<Foundation | null>(null);
  const [editing, setEditing] = useState<Foundation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const requests = [
        authFetch(`/api/v1/fundamentos?tenantId=${encodeURIComponent(tenantId)}`),
        ...(isAdmin ? [authFetch(`/api/v1/fundamentos/options?tenantId=${encodeURIComponent(tenantId)}`)] : []),
      ];
      const responses = await Promise.all(requests);
      const listJson = await responses[0].json();
      if (!responses[0].ok) throw new Error(listJson.error || 'Não foi possível carregar o acervo.');
      setItems(listJson.data || []);
      if (isAdmin && responses[1]) {
        const optionsJson = await responses[1].json();
        if (responses[1].ok) {
          setChildren(optionsJson.children || []);
          setHouseTradition(optionsJson.tradition || 'todas');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar o acervo.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatch = category === 'todos' || item.categoria === category;
      const textMatch = !term || `${item.titulo} ${item.resumo || ''}`.toLowerCase().includes(term);
      return categoryMatch && textMatch;
    });
  }, [category, items, query]);

  const publishedCount = items.filter((item) => item.status === 'publicado').length;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm, tradicao: houseTradition || 'todas' });
    setFormOpen(true);
  };

  const openEdit = async (item: Foundation) => {
    setError('');
    try {
      const response = await authFetch(
        `/api/v1/fundamentos/${encodeURIComponent(item.id)}?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      const full = { ...item, ...json.data };
      setEditing(full);
      setForm({
        titulo: full.titulo,
        resumo: full.resumo || '',
        conteudo: full.conteudo || '',
        categoria: full.categoria,
        tradicao: full.tradicao || 'todas',
        nivel_acesso: full.nivel_acesso,
        cargos: (full.cargos_permitidos || []).join(', '),
        filhos_permitidos: full.filhos_permitidos || [],
        status: full.status,
      });
      setFormOpen(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível editar este fundamento.');
    }
  };

  const openRead = async (item: Foundation) => {
    setError('');
    try {
      const response = await authFetch(
        `/api/v1/fundamentos/${encodeURIComponent(item.id)}?tenantId=${encodeURIComponent(tenantId)}`,
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setSelected(json.data);
    } catch (err: any) {
      setError(err.message || 'Não foi possível abrir este fundamento.');
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        tenantId,
        titulo: form.titulo,
        resumo: form.resumo,
        conteudo: form.conteudo,
        categoria: form.categoria,
        tradicao: form.tradicao,
        nivel_acesso: form.nivel_acesso,
        cargos_permitidos: form.cargos.split(',').map((value) => value.trim()).filter(Boolean),
        filhos_permitidos: form.filhos_permitidos,
        status: form.status,
      };
      const response = await authFetch(
        editing ? `/api/v1/fundamentos/${encodeURIComponent(editing.id)}` : '/api/v1/fundamentos',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Não foi possível salvar.');
      setFormOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="foundation-vault min-h-full pb-16">
      <section className="relative overflow-hidden rounded-[28px] bg-[#101713] px-5 py-6 text-white shadow-[0_24px_70px_rgba(20,44,31,.2)] sm:px-7 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border-[44px] border-[#E3C64B]/10" />
        <div className="pointer-events-none absolute bottom-0 right-[18%] h-28 w-px bg-gradient-to-t from-[#E3C64B]/60 to-transparent" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <button
              type="button"
              onClick={onBack}
              className="mb-7 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-[#A7B4AA] transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Biblioteca
            </button>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E3C64B] text-[#101713] shadow-lg shadow-black/20">
                <KeyRound className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#E3C64B]">Memória protegida da casa</p>
                <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">Acervo de fundamentos</h1>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-[#B7C2BA] sm:text-base">
              O conhecimento certo chega à pessoa certa. Banhos, ervas e rituais organizados pela tradição, função e confiança da casa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#829087]">Liberados</p>
              <p className="mt-1 text-xl font-black">{publishedCount}<span className="ml-1 text-xs text-[#829087]">/ {items.length}</span></p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-[58px] items-center gap-2 rounded-2xl bg-[#E3C64B] px-5 text-sm font-black text-[#101713] transition hover:-translate-y-0.5 hover:bg-[#F1D95E]"
              >
                <Plus className="h-5 w-5" /> Novo fundamento
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[24px] border border-[#DCD7CA] bg-[#F8F4EA] p-3 lg:sticky lg:top-4">
          <p className="px-3 pb-3 pt-2 text-[9px] font-black uppercase tracking-[.22em] text-[#8B8170]">Caminhos do acervo</p>
          <button
            type="button"
            onClick={() => setCategory('todos')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-black transition',
              category === 'todos' ? 'bg-[#101713] text-white' : 'text-[#4C493F] hover:bg-white',
            )}
          >
            <ShieldCheck className="h-4 w-4" /> Tudo que posso acessar
          </button>
          {categories.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => setCategory(entry.id)}
                className={cn(
                  'mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition',
                  category === entry.id ? 'bg-white text-[#101713] shadow-sm' : 'text-[#716B5E] hover:bg-white/70',
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" style={{ color: entry.color }} /> {entry.label}
                </span>
                <span className="text-[9px] text-[#A59C8A]">{items.filter((item) => item.categoria === entry.id).length}</span>
              </button>
            );
          })}
          <div className="mt-4 rounded-2xl bg-[#EDE7D9] p-3">
            <div className="flex items-center gap-2 text-[#786727]">
              <FileLock2 className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-[.15em]">Acesso protegido</span>
            </div>
            <p className="mt-2 text-[10px] font-medium leading-4 text-[#756E61]">Cada abertura fica registrada para preservar a memória e a responsabilidade da casa.</p>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="flex flex-col gap-3 rounded-[20px] border border-[#DDD8CD] bg-white p-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#F4F0E8] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[#8D8678]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar banho, erva ou fundamento..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#181A17] outline-none placeholder:text-[#9D978B]"
              />
            </label>
            <div className="flex items-center gap-2 px-1 text-[10px] font-bold text-[#7B756A]">
              <Eye className="h-4 w-4 text-[#4FA277]" />
              {isAdmin ? 'Visão da zeladoria' : 'Somente conteúdos liberados para você'}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
          ) : null}

          {loading ? (
            <div className="grid min-h-[300px] place-items-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#85711F]" />
            </div>
          ) : filtered.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item, index) => {
                const meta = categoryMeta(item.categoria);
                const Icon = meta.icon;
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.035, 0.25) }}
                    className="group relative flex min-h-[230px] flex-col overflow-hidden rounded-[22px] border border-[#DED9CE] bg-[#FFFCF7] p-5 transition hover:-translate-y-1 hover:border-[#BEB5A1] hover:shadow-[0_18px_40px_rgba(35,32,24,.1)]"
                  >
                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[72px] opacity-[.08]" style={{ background: meta.color }} />
                    <div className="relative flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-black/5 bg-white shadow-sm" style={{ color: meta.color }}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isAdmin ? (
                          <span className={cn(
                            'rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider',
                            item.status === 'publicado' ? 'bg-emerald-100 text-emerald-700' : item.status === 'rascunho' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600',
                          )}>{item.status}</span>
                        ) : null}
                        {isAdmin ? (
                          <button type="button" onClick={() => void openEdit(item)} className="rounded-lg p-2 text-[#777064] hover:bg-[#EEE9DF] hover:text-[#161913]" aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="relative mt-5 text-[9px] font-black uppercase tracking-[.18em]" style={{ color: meta.color }}>{meta.label}</p>
                    <h2 className="relative mt-1 line-clamp-2 font-display text-xl font-black leading-tight text-[#171914]">{item.titulo}</h2>
                    <p className="relative mt-2 line-clamp-2 text-xs font-medium leading-5 text-[#746E63]">{item.resumo || 'Conhecimento preservado pela casa.'}</p>
                    <div className="relative mt-auto flex items-end justify-between gap-3 pt-5">
                      <div>
                        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-[#676156]">
                          {item.nivel_acesso === 'individual' ? <Users className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                          {accessLabels[item.nivel_acesso]}
                        </p>
                        <p className="mt-1 text-[9px] text-[#A09889]">Revisto em {formatDate(item.updated_at)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openRead(item)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#101713] text-white transition group-hover:bg-[#E3C64B] group-hover:text-[#101713]"
                        aria-label="Abrir fundamento"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-dashed border-[#CBC3B2] bg-[#F8F4EA] p-8 text-center sm:p-12">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#101713] text-[#E3C64B]">
                <BookMarked className="h-7 w-7" />
              </div>
              <h2 className="mt-4 font-display text-xl font-black text-[#191B17]">{query ? 'Nenhum conhecimento encontrado' : 'O primeiro registro começa a memória'}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#756F64]">
                {isAdmin ? 'Publique o primeiro banho, erva ou ritual e escolha exatamente quem poderá consultá-lo.' : 'Quando a zeladoria liberar um conteúdo para sua função, ele aparecerá aqui.'}
              </p>
              {isAdmin && !query ? (
                <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E3C64B] px-4 py-3 text-xs font-black text-[#101713]">
                  <Plus className="h-4 w-4" /> Criar primeiro fundamento
                </button>
              ) : null}
            </div>
          )}
        </main>
      </section>

      <AnimatePresence>
        {selected ? (
          <div className="fixed inset-0 z-[120] flex justify-end bg-black/55 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="flex h-full w-full max-w-2xl flex-col bg-[#FAF7F0] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#DDD6C8] px-5 py-4 sm:px-7">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-[#8B772B]">
                  <ShieldCheck className="h-4 w-4" /> Leitura protegida
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-[#ECE6DA] p-2 text-[#373A34]"><X className="h-5 w-5" /></button>
              </div>
              <article className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-9 sm:py-10">
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9A8125]">{categoryMeta(selected.categoria).label} · {selected.tradicao}</p>
                <h1 className="mt-3 font-display text-3xl font-black leading-tight text-[#161A15] sm:text-4xl">{selected.titulo}</h1>
                {selected.resumo ? <p className="mt-5 border-l-2 border-[#E3C64B] pl-4 text-base font-semibold leading-7 text-[#615C52]">{selected.resumo}</p> : null}
                <div className="mt-8 whitespace-pre-wrap text-[15px] font-medium leading-8 text-[#312F2A]">{selected.conteudo}</div>
              </article>
              <div className="shrink-0 border-t border-[#DDD6C8] bg-[#F2EDE3] px-5 py-3 text-center text-[9px] font-bold text-[#756E62]">
                Esta consulta foi registrada. Preserve os fundamentos e as orientações da sua casa.
              </div>
            </motion.div>
          </div>
        ) : null}

        {formOpen ? (
          <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-[#FAF7F0] shadow-2xl sm:rounded-[26px]"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CA] px-5 py-4 sm:px-7">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#967E25]">Curadoria da zeladoria</p>
                  <h2 className="mt-1 font-display text-xl font-black text-[#171A15]">{editing ? 'Editar fundamento' : 'Novo fundamento'}</h2>
                </div>
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-full bg-[#EDE7DB] p-2"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={save} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Título</span>
                    <input required minLength={3} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#191B17] outline-none focus:border-[#A58C2C]" placeholder="Ex.: Banho de ervas para equilíbrio" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Resumo de orientação</span>
                    <input value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-semibold text-[#191B17] outline-none focus:border-[#A58C2C]" placeholder="Uma frase para explicar quando consultar este conteúdo" />
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Categoria</span>
                    <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#191B17]">
                      {categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Tradição</span>
                    <input value={form.tradicao} onChange={(e) => setForm({ ...form, tradicao: e.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#191B17]" placeholder="todas" />
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Quem pode acessar</span>
                    <select value={form.nivel_acesso} onChange={(e) => setForm({ ...form, nivel_acesso: e.target.value as AccessLevel })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#191B17]">
                      {Object.entries(accessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Publicação</span>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ItemStatus })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-bold text-[#191B17]">
                      <option value="rascunho">Salvar como rascunho</option>
                      <option value="publicado">Publicar agora</option>
                      <option value="arquivado">Arquivar</option>
                    </select>
                  </label>
                </div>

                {form.nivel_acesso === 'cargo' ? (
                  <label className="block rounded-2xl border border-[#DDD5C6] bg-[#F1ECE2] p-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Funções permitidas</span>
                    <input value={form.cargos} onChange={(e) => setForm({ ...form, cargos: e.target.value })} className="mt-2 w-full rounded-xl border border-[#D8D0C1] bg-white px-4 py-3 text-sm font-semibold text-[#191B17]" placeholder="Ex.: Ogã, Ekedi, Cambone" />
                    <span className="mt-2 block text-[10px] text-[#81796C]">Separe as funções por vírgula. O nome deve corresponder ao cadastro.</span>
                  </label>
                ) : null}

                {form.nivel_acesso === 'individual' ? (
                  <div className="rounded-2xl border border-[#DDD5C6] bg-[#F1ECE2] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Escolha as pessoas</p>
                    <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                      {children.map((child) => {
                        const checked = form.filhos_permitidos.includes(child.id);
                        return (
                          <label key={child.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3', checked ? 'border-[#B49A37] bg-[#FFF9DD]' : 'border-[#DDD5C6] bg-white')}>
                            <input type="checkbox" checked={checked} onChange={() => setForm({ ...form, filhos_permitidos: checked ? form.filhos_permitidos.filter((id) => id !== child.id) : [...form.filhos_permitidos, child.id] })} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-black text-[#1B1E19]">{child.nome}</span>
                              <span className="block truncate text-[9px] text-[#797266]">{child.cargo || 'Função não informada'}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#655F54]">Conteúdo do fundamento</span>
                  <textarea required minLength={3} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} className="mt-2 min-h-[230px] w-full resize-y rounded-2xl border border-[#D8D0C1] bg-white px-4 py-4 text-sm font-medium leading-7 text-[#242620] outline-none focus:border-[#A58C2C]" placeholder={'Orientação\n\nMateriais necessários\n\nModo de preparo\n\nCuidados e restrições'} />
                </label>

                <button disabled={saving} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101713] px-5 py-4 text-sm font-black text-white transition hover:bg-[#1D2A21] disabled:opacity-60">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5 text-[#E3C64B]" />}
                  {saving ? 'Protegendo conteúdo...' : form.status === 'publicado' ? 'Salvar e publicar com acesso controlado' : 'Salvar no acervo'}
                </button>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
