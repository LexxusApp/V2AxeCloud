import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Loader2,
  MessageCircleQuestion,
  ShieldCheck,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/authenticatedFetch';

type ActiveCycle = {
  id: string;
  titulo: string;
  motivo?: string | null;
  orientacoes: string;
  tipo: 'coletivo' | 'restrito';
  inicio_em: string;
  fim_em: string;
  fundamento_id?: string | null;
  participacao: {
    id: string;
    status: 'pendente' | 'ciente' | 'orientacao_solicitada';
    confirmado_em?: string | null;
  };
};

type Props = {
  tenantId: string;
  onNavigate: (tab: string) => void;
  onStateChange?: (cycle: ActiveCycle | null) => void;
};

function countdown(end: string) {
  const total = Math.max(0, new Date(end).getTime() - Date.now());
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  return days ? `${days} ${days === 1 ? 'dia' : 'dias'} e ${hours}h` : `${hours}h`;
}

function period(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function FilhoPreceitoActive({ tenantId, onNavigate, onStateChange }: Props) {
  const [cycle, setCycle] = useState<ActiveCycle | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const response = await authFetch(`/api/v1/preceitos/current?tenantId=${encodeURIComponent(tenantId)}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      const current = (json.data || [])[0] || null;
      setCycle(current);
      onStateChange?.(current);
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar o preceito.');
    } finally {
      setLoading(false);
    }
  }, [onStateChange, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = async (kind: 'acknowledge' | 'guidance') => {
    if (!cycle || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(`/api/v1/preceitos/${encodeURIComponent(cycle.id)}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      await load();
    } catch (err: any) {
      setError(err.message || 'Não foi possível registrar sua resposta.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !cycle) return null;

  const acknowledged = cycle.participacao?.status === 'ciente';
  const guidance = cycle.participacao?.status === 'orientacao_solicitada';

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-4 overflow-hidden rounded-[24px] border border-[#D7BC4E]/35 bg-[#111A14] p-5 text-white shadow-[0_18px_50px_rgba(19,44,27,.2)] sm:mb-5 sm:p-6"
      >
        <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full border-[30px] border-[#D7BC4E]/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#D7BC4E] text-[#111A14]">
            <Flame className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#D7BC4E]">A casa está em ciclo de preceito</p>
              {acknowledged ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-300"><Check className="h-3 w-3" /> Ciente</span> : null}
              {guidance ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-[8px] font-black uppercase text-amber-300"><MessageCircleQuestion className="h-3 w-3" /> Orientação solicitada</span> : null}
            </div>
            <h2 className="mt-1 truncate font-display text-xl font-black sm:text-2xl">{cycle.titulo}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-[#A9B5AC]"><Clock3 className="h-3.5 w-3.5 text-[#D7BC4E]" /> Termina em {countdown(cycle.fim_em)}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D7BC4E] px-4 text-xs font-black text-[#111A14]">
            Ver orientações <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.section>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[150] flex justify-end bg-black/70 backdrop-blur-sm">
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 35 }} className="flex h-full w-full max-w-2xl flex-col bg-[#FAF7F0]">
              <header className="shrink-0 bg-[#111A14] px-5 py-5 text-white sm:px-8 sm:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-[#D7BC4E]"><ShieldCheck className="h-4 w-4" /> Orientação protegida da sua casa</div>
                    <h1 className="mt-3 font-display text-2xl font-black leading-tight sm:text-3xl">{cycle.titulo}</h1>
                    <p className="mt-2 text-[10px] font-bold text-[#A6B2A9]">{period(cycle.inicio_em)} até {period(cycle.fim_em)}</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
                </div>
              </header>

              <article className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                {cycle.motivo ? <p className="border-l-2 border-[#D7BC4E] pl-4 text-sm font-bold leading-7 text-[#5E594F]">{cycle.motivo}</p> : null}
                <div className="mt-6 whitespace-pre-wrap text-[15px] font-medium leading-8 text-[#302E28]">{cycle.orientacoes}</div>
                {cycle.fundamento_id ? (
                  <button type="button" onClick={() => { setOpen(false); onNavigate('library'); }} className="mt-8 flex w-full items-center gap-3 rounded-2xl border border-[#D9D1C2] bg-white p-4 text-left">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#172019] text-[#D7BC4E]"><BookOpen className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-xs text-[#1B1E19]">Há um fundamento complementar</strong><small className="mt-1 block text-[10px] text-[#7B7468]">Abra o Acervo protegido da Biblioteca</small></span>
                    <ChevronRight className="h-4 w-4 text-[#7B7468]" />
                  </button>
                ) : null}
                {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</p> : null}
              </article>

              <footer className="shrink-0 border-t border-[#DDD6C8] bg-white px-5 py-4 sm:px-8">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={busy || acknowledged} onClick={() => void action('acknowledge')} className="flex items-center justify-center gap-2 rounded-xl bg-[#172019] px-4 py-3 text-xs font-black text-white disabled:bg-emerald-700 disabled:opacity-100">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : acknowledged ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4 text-[#D7BC4E]" />}
                    {acknowledged ? 'Leitura confirmada' : 'Li e estou ciente'}
                  </button>
                  <button type="button" disabled={busy || guidance} onClick={() => void action('guidance')} className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D0C1] bg-[#F5F0E7] px-4 py-3 text-xs font-black text-[#39362F] disabled:opacity-60">
                    <MessageCircleQuestion className="h-4 w-4 text-[#9A8129]" />
                    {guidance ? 'Pedido enviado' : 'Preciso de orientação'}
                  </button>
                </div>
                <p className="mt-3 text-center text-[9px] font-semibold text-[#8A8377]">Sua resposta fica visível apenas para a zeladoria.</p>
              </footer>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
