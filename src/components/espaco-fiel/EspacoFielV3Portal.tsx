import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VELA_OPTIONS, type VelaCor } from './espacoFielV3Data';
import { useEspacoFielPedidos } from '../../hooks/useEspacoFielPedidos';

type PublicPrayerForm = {
  solicitante: string;
  casa: string;
  slug: string;
  categoria: string;
  linha: string;
  vela: VelaCor;
  intencao: string;
  whatsapp: string;
};

const INITIAL_FORM: PublicPrayerForm = {
  solicitante: '', casa: '', slug: '', categoria: 'Proteção / Defesa Espiritual',
  linha: 'Caboclos', vela: 'Branca', intencao: '', whatsapp: '',
};

const fieldClass = 'w-full rounded-xl border border-[#d8cfc0] bg-white px-3.5 py-3 text-sm text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/35 focus:border-[#d49a00] focus:ring-4 focus:ring-[#ffc107]/15';
const labelClass = 'mb-1.5 block text-xs font-extrabold text-[#1b1813]/75';

function formatWhatsappInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidWhatsapp(value: string) {
  const size = value.replace(/\D/g, '').length;
  return size >= 10 && size <= 13;
}

function statusTone(status: string) {
  if (status === 'Aceito') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Em Oração') return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function EspacoFielV3Portal() {
  const { terreiros, terreirosLoading, pedidos, submitPedido } = useEspacoFielPedidos();
  const [form, setForm] = useState<PublicPrayerForm>(INITIAL_FORM);
  const [selectedCity, setSelectedCity] = useState('Todas');
  const [houseSearch, setHouseSearch] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const cities = useMemo(() => {
    const names = [...new Set(terreiros.map((item) => item.cidade).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todas', ...names];
  }, [terreiros]);
  const filteredHouses = useMemo(() => {
    const query = houseSearch.trim().toLocaleLowerCase('pt-BR');
    return terreiros.filter((house) => {
      const cityMatches = selectedCity === 'Todas' || house.cidade === selectedCity;
      const searchMatches = !query || `${house.nome} ${house.cidade} ${house.estado}`.toLocaleLowerCase('pt-BR').includes(query);
      return cityMatches && searchMatches;
    });
  }, [houseSearch, selectedCity, terreiros]);
  const selectedRequest = pedidos.find((item) => item.id === selectedRequestId) || pedidos[0] || null;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  useEffect(() => {
    if (pedidos.length) setSelectedRequestId((current) => current || pedidos[0].id);
  }, [pedidos]);

  useEffect(() => {
    if (terreirosLoading || !terreiros.length) return;
    const params = new URLSearchParams(window.location.search);
    const slug = (params.get('casa') || params.get('slug') || '').trim().toLowerCase();
    const match = terreiros.find((house) => house.slug.toLowerCase() === slug);
    if (!match) return;
    setForm((current) => ({ ...current, casa: match.nome, slug: match.slug }));
    setSelectedCity(match.cidade || 'Todas');
  }, [terreiros, terreirosLoading]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.slug) return showNotice('Selecione uma casa para receber o pedido.');
    if (!form.solicitante.trim() || !form.intencao.trim()) return showNotice('Preencha seu nome e a intenção do pedido.');
    if (!isValidWhatsapp(form.whatsapp)) return showNotice('Informe um WhatsApp válido com DDD.');

    setSubmitting(true);
    try {
      const created = await submitPedido({
        slug: form.slug,
        nome: form.solicitante.trim(),
        mensagem: form.intencao.trim(),
        categoria: form.categoria,
        linha: form.linha,
        vela: form.vela,
        whatsapp: form.whatsapp.replace(/\D/g, ''),
      });
      if (created.id) setSelectedRequestId(created.id);
      setForm((current) => ({ ...INITIAL_FORM, casa: current.casa, slug: current.slug }));
      showNotice('Pedido enviado. A casa avisará pelo WhatsApp quando houver uma atualização.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative z-[1] mx-auto w-full max-w-7xl px-5 pb-24 pt-32 font-display text-[#1b1813] md:px-8 md:pt-36">
      {notice ? (
        <div className="fixed right-4 top-24 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-[#3c3429] bg-[#1b1813] px-5 py-4 text-sm text-white shadow-2xl sm:right-6" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#ffc107]" aria-hidden />
          {notice}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/85 shadow-xl shadow-black/5 backdrop-blur-sm">
        <div className="grid gap-8 px-6 py-9 md:px-10 md:py-12 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <span className="inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]">Pedir reza</span>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Envie um pedido de reza a uma casa de axé
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#1b1813]/65 md:text-lg">
              Escolha uma casa participante, escreva sua intenção com respeito e acompanhe o retorno neste dispositivo.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <h2 className="font-black text-emerald-950">Privacidade em primeiro lugar</h2>
                <p className="mt-1 text-sm leading-relaxed text-emerald-900/70">O conteúdo é enviado somente para a casa escolhida. Seu WhatsApp é usado para avisos sobre o pedido.</p>
              </div>
            </div>
          </div>
        </div>
        <ol className="grid border-t border-[#e8dfd0] bg-[#faf6ef] md:grid-cols-3">
          {[
            ['1', 'Escolha a casa', 'Filtre por cidade e selecione o terreiro.'],
            ['2', 'Escreva o pedido', 'Informe sua intenção e um contato válido.'],
            ['3', 'Acompanhe', 'Veja quando a casa aceitar ou atualizar o pedido.'],
          ].map(([number, title, text]) => (
            <li key={number} className="flex gap-3 border-b border-[#e8dfd0] px-6 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1b1813] text-xs font-black text-[#ffc107]">{number}</span>
              <div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm text-[#1b1813]/55">{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <section className="rounded-[2rem] border border-[#e8dfd0] bg-white/88 p-6 shadow-xl shadow-black/5 md:p-8" aria-labelledby="prayer-form-title">
          <div className="flex items-start gap-3 border-b border-[#e8dfd0] pb-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffc107]/18 text-[#a87400]"><HeartHandshake className="h-5 w-5" /></span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a87400]">Novo pedido</p><h2 id="prayer-form-title" className="mt-1 text-xl font-black">Casa e informações do pedido</h2></div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor="prayer-city">Cidade</label><select id="prayer-city" className={fieldClass} value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>{cities.map((city) => <option key={city}>{city}</option>)}</select></div>
            <div><label className={labelClass} htmlFor="prayer-search">Buscar casa</label><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/35" /><input id="prayer-search" className={cn(fieldClass, 'pl-10')} value={houseSearch} onChange={(event) => setHouseSearch(event.target.value)} placeholder="Nome da casa" /></div></div>
          </div>

          <div className="mt-4">
            <label className={labelClass} htmlFor="prayer-house">Casa que receberá o pedido</label>
            <select
              id="prayer-house"
              className={fieldClass}
              value={form.slug}
              disabled={terreirosLoading}
              onChange={(event) => {
                const house = terreiros.find((item) => item.slug === event.target.value);
                setForm((current) => ({ ...current, slug: house?.slug || '', casa: house?.nome || '' }));
              }}
            >
              <option value="">{terreirosLoading ? 'Carregando casas…' : 'Selecione uma casa'}</option>
              {filteredHouses.map((house) => <option key={house.id} value={house.slug}>{house.nome} · {house.cidade}/{house.estado}</option>)}
            </select>
            {!terreirosLoading && filteredHouses.length === 0 ? <p className="mt-2 text-sm text-[#1b1813]/55">Nenhuma casa participante encontrada com esses filtros.</p> : null}
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5 border-t border-[#e8dfd0] pt-6">
            <div><label className={labelClass} htmlFor="prayer-name">Seu nome ou iniciais</label><input id="prayer-name" className={fieldClass} value={form.solicitante} onChange={(event) => setForm({ ...form, solicitante: event.target.value })} placeholder="Como deseja se identificar" autoComplete="name" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass} htmlFor="prayer-category">Tipo do pedido</label><select id="prayer-category" className={fieldClass} value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}><option>Proteção / Defesa Espiritual</option><option>Saúde / Restabelecimento</option><option>Abertura de Caminhos / Prosperidade</option><option>Limpeza Espiritual / Descarrego</option><option>Equilíbrio Emocional / Clamor por Paz</option></select></div>
              <div><label className={labelClass} htmlFor="prayer-line">Linha de trabalho</label><select id="prayer-line" className={fieldClass} value={form.linha} onChange={(event) => setForm({ ...form, linha: event.target.value })}><option>Caboclos</option><option>Pretos Velhos / Almas</option><option>Baianos e Boiadeiros</option><option>Exu / Caminhos</option><option>Marinheiros / Iemanjá</option></select></div>
            </div>
            <fieldset><legend className={labelClass}>Cor simbólica da vela</legend><div className="flex flex-wrap gap-2">{VELA_OPTIONS.map((option) => { const selected = form.vela === option.color; return <button key={option.color} type="button" onClick={() => setForm({ ...form, vela: option.color })} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition', selected ? 'border-[#d49a00] bg-[#fff4c7] text-[#6f4c00]' : 'border-[#ded4c5] bg-white text-[#1b1813]/65 hover:border-[#ffc107]')}><span className={cn('h-3 w-3 rounded-full border border-black/15', option.bg)} />{option.color}{selected ? <Check className="h-3.5 w-3.5" /> : null}</button>; })}</div></fieldset>
            <div><label className={labelClass} htmlFor="prayer-whatsapp">WhatsApp para receber o retorno</label><input id="prayer-whatsapp" className={fieldClass} value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: formatWhatsappInput(event.target.value) })} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel" /></div>
            <div><label className={labelClass} htmlFor="prayer-intention">Sua intenção</label><textarea id="prayer-intention" className={cn(fieldClass, 'min-h-32 resize-y leading-relaxed')} value={form.intencao} onChange={(event) => setForm({ ...form, intencao: event.target.value })} placeholder="Escreva o pedido com suas próprias palavras." /></div>
            <button type="submit" disabled={submitting || !form.slug} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1b1813] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#a87400] disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-[#ffc107]" />}Enviar pedido de reza</button>
            <p className="flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-[#1b1813]/50"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />Ao enviar, o pedido fica disponível para a equipe autorizada da casa escolhida.</p>
          </form>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-28" aria-labelledby="prayer-status-title">
          <section className="rounded-[2rem] border border-[#2e281f] bg-[#17130e] p-6 text-white shadow-2xl shadow-black/15 md:p-8">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffc107]">Neste dispositivo</p><h2 id="prayer-status-title" className="mt-2 text-xl font-black">Acompanhar pedidos</h2></div><MessageCircle className="h-6 w-6 text-[#ffc107]" /></div>
            {pedidos.length ? (
              <div className="mt-6 space-y-3">
                <label className="sr-only" htmlFor="request-select">Selecionar pedido</label>
                <select id="request-select" value={selectedRequest?.id || ''} onChange={(event) => setSelectedRequestId(event.target.value)} className="w-full rounded-xl border border-white/15 bg-white/8 px-3.5 py-3 text-sm text-white outline-none focus:border-[#ffc107]"><option value="">Selecione um pedido</option>{pedidos.map((request) => <option className="text-[#1b1813]" key={request.id} value={request.id}>{request.casa} · {request.data}</option>)}</select>
                {selectedRequest ? <div className="rounded-2xl border border-white/12 bg-white/6 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{selectedRequest.casa}</strong><span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide', statusTone(selectedRequest.status))}>{selectedRequest.status}</span></div><p className="mt-3 text-sm italic leading-relaxed text-white/65">“{selectedRequest.intencao}”</p><div className="mt-5 space-y-3 border-t border-white/10 pt-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" /><div><p className="text-sm font-bold">Pedido enviado</p><p className="text-xs text-white/45">{selectedRequest.data}</p></div></div><div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" /><div><p className="text-sm font-bold">Aguardando a casa</p><p className="text-xs leading-relaxed text-white/45">Você receberá o retorno no WhatsApp informado.</p></div></div></div></div> : null}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-white/30" /><p className="mt-3 text-sm font-bold">Nenhum pedido neste dispositivo</p><p className="mt-1 text-xs leading-relaxed text-white/45">Depois do primeiro envio, o acompanhamento aparecerá aqui.</p></div>
            )}
          </section>
          <section className="rounded-[2rem] border border-[#e8dfd0] bg-white/88 p-6 shadow-lg shadow-black/5"><div className="flex gap-3"><Building2 className="h-5 w-5 shrink-0 text-[#a87400]" /><div><h2 className="font-black">Para casas de axé</h2><p className="mt-2 text-sm leading-relaxed text-[#1b1813]/60">Os pedidos chegam no painel do AxéCloud. A casa decide quando aceitar e como conduzir o acolhimento, conforme sua tradição.</p><a href="/register" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#a87400] hover:text-[#1b1813]">Cadastrar minha casa <MapPin className="h-4 w-4" /></a></div></div></section>
        </aside>
      </div>
    </main>
  );
}
