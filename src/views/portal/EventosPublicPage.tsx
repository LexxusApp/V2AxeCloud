import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';
import { fetchPublicEventos, terreiroProfilePath, type PublicEvento } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { applyCustomPageSeo } from '../../lib/seo';
import { PORTAL_BRAND } from '../../constants/seoBrandKeywords';
import { commercialWhatsAppUrl } from '../../constants/commercialContact';
import { appHref } from '../../lib/appHref';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function MatrizKicker({ children }: { children: ReactNode }) {
  return (
    <span className="matriz-kicker-pulse inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
      {children}
    </span>
  );
}

function EventListThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffc107]/10 to-[#f3ebe0]">
        <CalendarDays className="h-8 w-8 text-[#1b1813]/15" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover object-center"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function formatEventDate(data: string) {
  try {
    return format(parseISO(data), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return data;
  }
}

function EventCardContent({ ev, dataFmt }: { ev: PublicEvento; dataFmt: string }) {
  return (
    <>
      <div className="h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-[#f3ebe0] sm:h-40">
        <EventListThumb url={ev.bannerUrl} alt={ev.titulo} />
      </div>
      <div className="mt-4 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a87400]">{ev.tipo}</span>
          <span className="rounded-full bg-[#ffc107]/14 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#a87400]">
            {ev.senhasAtivas ? 'Receber senha' : 'Ver evento'}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-black leading-snug text-[#1b1813] group-hover:text-[#a87400]">
          {ev.titulo}
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-[#1b1813]/65">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          <span className="capitalize">{dataFmt}</span>
          <span className="text-[#1b1813]/30">·</span>
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ev.hora}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-[#1b1813]/75">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">
            {ev.terreiro.nome}
            {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
          </span>
        </p>
        {ev.descricao ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#1b1813]/58">{ev.descricao}</p>
        ) : null}
      </div>
    </>
  );
}

const cardMotionProps = (index: number) => ({
  className:
    'group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-[#e8dfd0] bg-white/80 p-5 text-left shadow-sm shadow-black/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-[#ffc107]/50 hover:shadow-xl hover:shadow-[#ffc107]/10',
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  whileHover: { y: -8, scale: 1.018 },
  whileTap: { scale: 0.985 },
  transition: { delay: Math.min(index * 0.025, 0.28), duration: 0.5 },
});

export default function EventosPublicPage() {
  const [items, setItems] = useState<PublicEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicEvento | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    applyCustomPageSeo({
      title: `Eventos públicos | ${PORTAL_BRAND}`,
      description:
        'Giras e festas divulgadas pelas casas de axé — confirme horário e endereço diretamente com o terreiro.',
      canonicalPath: ROUTES.eventosPublicos,
    });
  }, []);

  useEffect(() => {
    void fetchPublicEventos()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    const term = normalizeSearch(q);
    if (!term) return items;
    return items.filter((ev) =>
      normalizeSearch(`${ev.titulo} ${ev.terreiro.nome} ${ev.terreiro.cidade || ''}`).includes(term),
    );
  }, [items, q]);

  const stats = useMemo(() => {
    const comSenha = items.filter((ev) => ev.senhasAtivas).length;
    const cidades = new Set(
      items.map((ev) => ev.terreiro.cidade).filter((cidade): cidade is string => Boolean(cidade)),
    ).size;
    return { total: items.length, comSenha, cidades };
  }, [items]);

  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main className="relative z-[1] mx-auto w-full max-w-7xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10 lg:items-start">
          <motion.div
            className="contents"
            initial={{ opacity: 0, y: 34, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <MatrizKicker>Agenda cultural</MatrizKicker>
            </div>
            <h1 className="lg:col-start-1 lg:row-start-2 mt-6 max-w-none text-balance text-3xl font-black leading-[1.05] tracking-tight text-[#1b1813] sm:text-4xl md:text-6xl">
              Eventos públicos
            </h1>
            <p className="lg:col-start-1 lg:row-start-3 mt-4 w-full max-w-none text-base leading-relaxed text-[#1b1813]/66 md:text-lg">
              Giras e festas que as casas optaram por divulgar no portal — confirme horário e endereço
              diretamente com o terreiro.
            </p>
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-end w-full lg:w-auto lg:min-w-[18rem] lg:max-w-md">
              <div className="rounded-[2rem] border border-[#e8dfd0] bg-white/78 p-5 shadow-xl shadow-black/5 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{stats.total}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">
                    Eventos
                  </p>
                </div>
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{stats.comSenha}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">
                    Com senha
                  </p>
                </div>
                <div className="rounded-2xl bg-[#ffc107]/14 p-4">
                  <p className="text-2xl font-black text-[#a87400]">{stats.cidades}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">
                    Cidades
                  </p>
                </div>
              </div>
              <label className="relative mt-5 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b1813]/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por evento, terreiro ou cidade..."
                  className="w-full rounded-full border border-[#e8dfd0] bg-white py-3 pl-11 pr-4 text-sm font-semibold text-[#1b1813] outline-none transition placeholder:text-[#1b1813]/35 focus:border-[#ffc107]/60 focus:ring-4 focus:ring-[#ffc107]/15"
                />
              </label>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-14">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-[#e8dfd0] bg-white/70 py-20 shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-[#a87400]" />
              <p className="mt-4 text-sm font-bold text-[#1b1813]/55">Carregando eventos públicos...</p>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-red-200 bg-white/80 p-8 text-center text-red-600">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white/78 p-6 shadow-xl shadow-black/5 md:p-9">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ffc107]/18 text-[#a87400]">
                  <CalendarDays className="h-7 w-7" aria-hidden />
                </span>
                <h2 className="mt-5 text-2xl font-black text-[#1b1813]">
                  {items.length === 0 ? 'A próxima gira pode aparecer aqui' : 'Nenhum resultado encontrado'}
                </h2>
                <p className="mt-3 leading-relaxed text-[#1b1813]/62">
                {items.length === 0
                  ? 'A agenda é publicada pelas próprias casas. Enquanto não há um evento aberto, explore o calendário de referência, conheça os terreiros mapeados ou cadastre sua casa para divulgar a próxima atividade pública.'
                  : 'Tente buscar por outro evento, terreiro ou cidade.'}
                </p>
              </div>
              {items.length === 0 ? (
                <>
                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    <a href={ROUTES.liturgicalCalendar} className="group rounded-2xl border border-[#e8dfd0] bg-[#fdf8f0] p-5 text-left transition hover:-translate-y-1 hover:border-[#ffc107]/55">
                      <BookOpen className="h-5 w-5 text-violet-600" aria-hidden />
                      <h3 className="mt-4 font-black text-[#1b1813]">Calendário litúrgico</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/58">Consulte datas culturais e observâncias de referência.</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#a87400]">Abrir <ArrowRight className="h-3.5 w-3.5" /></span>
                    </a>
                    <a href={ROUTES.terreiros} className="group rounded-2xl border border-[#e8dfd0] bg-[#fdf8f0] p-5 text-left transition hover:-translate-y-1 hover:border-[#ffc107]/55">
                      <Building2 className="h-5 w-5 text-sky-600" aria-hidden />
                      <h3 className="mt-4 font-black text-[#1b1813]">Encontrar uma casa</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/58">Veja terreiros por cidade, bairro e localização.</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#a87400]">Explorar <ArrowRight className="h-3.5 w-3.5" /></span>
                    </a>
                    <a href={appHref(ROUTES.register)} className="group rounded-2xl border border-[#ffc107]/45 bg-[#ffc107]/12 p-5 text-left transition hover:-translate-y-1 hover:bg-[#ffc107]/20">
                      <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden />
                      <h3 className="mt-4 font-black text-[#1b1813]">Publicar um evento</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/58">Cadastre sua casa e ative a divulgação pública pelo painel.</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#a87400]">Começar grátis <ArrowRight className="h-3.5 w-3.5" /></span>
                    </a>
                  </div>
                  <p className="mt-6 text-center text-sm text-[#1b1813]/55">
                    Precisa de ajuda?{' '}
                    <a
                      href={commercialWhatsAppUrl('Olá! Quero saber como publicar eventos da minha casa no portal AxéCloud.')}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-black text-emerald-700 hover:text-emerald-800"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Fale com o comercial
                    </a>
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((ev, index) => {
                const dataFmt = formatEventDate(ev.data);
                const motionProps = cardMotionProps(index);

                if (ev.eventoPageUrl) {
                  return (
                    <motion.a key={ev.id} href={ev.eventoPageUrl} {...motionProps}>
                      <motion.div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ffc107]/70 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3.2, repeat: Infinity, delay: index * 0.08, ease: 'easeInOut' }}
                        aria-hidden
                      />
                      <EventCardContent ev={ev} dataFmt={dataFmt} />
                    </motion.a>
                  );
                }

                return (
                  <motion.button
                    key={ev.id}
                    type="button"
                    onClick={() => setDetail(ev)}
                    {...motionProps}
                  >
                    <motion.div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ffc107]/70 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 3.2, repeat: Infinity, delay: index * 0.08, ease: 'easeInOut' }}
                      aria-hidden
                    />
                    <EventCardContent ev={ev} dataFmt={dataFmt} />
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-16 rounded-[2rem] border border-[#e8dfd0] bg-white/78 p-6 shadow-xl shadow-black/5 backdrop-blur-sm md:p-8">
          <h2 className="text-xl font-black text-[#1b1813]">Receber a agenda por e-mail</h2>
          <p className="mt-2 text-sm text-[#1b1813]/58">
            Cadastre-se para ser avisado quando novas giras e festas forem publicadas.
          </p>
          <div className="mt-5">
            <PortalNewsletterForm />
          </div>
        </section>
      </main>

      <AnimatePresence>
        {detail ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              className="absolute inset-0 bg-[#1b1813]/60 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className={`relative z-10 w-full overflow-hidden rounded-3xl border border-[#e8dfd0] bg-white shadow-2xl shadow-black/10 ${
                detail.bannerUrl ? 'max-w-[min(96vw,42rem)]' : 'max-w-lg'
              }`}
            >
              <div
                className={`flex max-h-[min(92dvh,32rem)] w-full overflow-hidden ${
                  detail.bannerUrl ? 'flex-row' : 'flex-col'
                }`}
              >
                {detail.bannerUrl ? (
                  <div className="w-[38%] min-w-[8.5rem] max-w-[15rem] shrink-0 self-stretch bg-[#f3ebe0]">
                    <img
                      src={detail.bannerUrl}
                      alt={detail.titulo}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] shrink-0 items-center justify-center bg-gradient-to-br from-[#ffc107]/10 to-transparent">
                    <CalendarDays className="h-12 w-12 text-[#1b1813]/15" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a87400]">
                        {detail.tipo}
                      </p>
                      <h3 className="mt-1 text-lg font-black leading-snug text-[#1b1813] sm:text-xl">
                        {detail.titulo}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetail(null)}
                      className="shrink-0 rounded-full border border-[#e8dfd0] p-2 text-[#1b1813]/68 transition hover:bg-[#ffc107]/10"
                      aria-label="Fechar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 overflow-y-auto">
                    <div className="space-y-2 text-sm text-[#1b1813]">
                      <p className="flex items-start gap-2 font-bold leading-snug">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#a87400]" />
                        <span className="capitalize">
                          {(() => {
                            try {
                              return format(parseISO(detail.data), "EEEE, dd 'de' MMMM yyyy", {
                                locale: ptBR,
                              });
                            } catch {
                              return detail.data;
                            }
                          })()}
                        </span>
                      </p>
                      <p className="flex items-center gap-2 font-bold">
                        <Clock className="h-4 w-4 shrink-0 text-[#a87400]" />
                        {detail.hora}
                      </p>
                    </div>
                    <a
                      href={terreiroProfilePath(detail.terreiro.slug)}
                      className="inline-flex items-start gap-2 text-sm font-semibold leading-snug text-[#1b1813]/75 hover:text-[#a87400]"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {detail.terreiro.nome}
                        {detail.terreiro.cidade ? ` — ${detail.terreiro.cidade}` : ''}
                      </span>
                    </a>
                    {detail.descricao ? (
                      <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-[#1b1813]/65">
                        {detail.descricao}
                      </p>
                    ) : null}
                    {detail.eventoPageUrl ? (
                      <a
                        href={detail.eventoPageUrl}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#ffc107] px-4 py-3 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38]"
                      >
                        {detail.senhasAtivas ? 'Ver evento e receber senha' : 'Ver página do evento'}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
