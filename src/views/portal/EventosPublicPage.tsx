import { useEffect, useState } from 'react';
import { Calendar, CalendarDays, Clock, Loader2, MapPin, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { fetchPublicEventos, terreiroProfilePath, type PublicEvento } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';

function EventBanner({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center bg-[#12161A]">
        <CalendarDays className="h-10 w-10 text-white/15" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="aspect-[16/9] w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function EventosPublicPage() {
  const [items, setItems] = useState<PublicEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PublicEvento | null>(null);

  useEffect(() => {
    void fetchPublicEventos()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#080A0D] text-[#F1F5F9]">
      <MarketingSubpageTopNav />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FBBC00]">Agenda cultural</p>
          <h1 className="mt-2 text-3xl font-black">Eventos públicos</h1>
          <p className="mt-3 text-[#94A3B8]">
            Giras e festas que as casas optaram por divulgar no portal — confirme horário e endereço directamente com o
            terreiro.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#FBBC00]" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#1E242B] px-6 py-12 text-center text-[#94A3B8]">
            Nenhum evento público agendado no momento.
            <a href={ROUTES.terreiros} className="mt-4 block text-sm font-bold text-[#FBBC00] hover:underline">
              Explorar terreiros
            </a>
          </div>
        ) : (
          <ul className="mt-10 space-y-4">
            {items.map((ev) => {
              let dataFmt = ev.data;
              try {
                dataFmt = format(parseISO(ev.data), "EEEE, d 'de' MMMM", { locale: ptBR });
              } catch {
                /* keep raw */
              }
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(ev)}
                    className="group w-full cursor-pointer overflow-hidden rounded-2xl border border-[#1E242B] bg-[#0B0D11] text-left transition hover:border-[#2F3643]"
                  >
                    {ev.bannerUrl ? (
                      <div className="overflow-hidden bg-[#12161A]">
                        <EventBanner url={ev.bannerUrl} alt={ev.titulo} />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-transparent">
                        <CalendarDays className="h-10 w-10 text-white/15" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 p-5">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#FBBC00]">{ev.tipo}</span>
                      <h2 className="text-lg font-bold">{ev.titulo}</h2>
                      <p className="flex items-center gap-2 text-sm text-[#94A3B8]">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {dataFmt} · {ev.hora}
                      </p>
                      <span className="flex items-center gap-1 text-sm font-semibold text-[#CBD5E1] group-hover:text-[#FBBC00]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {ev.terreiro.nome}
                        {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
                      </span>
                      {ev.descricao ? (
                        <p className="line-clamp-2 text-sm text-[#64748B]">{ev.descricao}</p>
                      ) : null}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#FBBC00]/70">
                        Toque para ver detalhes
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section className="mt-16 rounded-2xl border border-[#1E242B] bg-[#0B0D11] p-6">
          <h2 className="font-bold">Receber a agenda por e-mail</h2>
          <div className="mt-4">
            <PortalNewsletterForm />
          </div>
        </section>
      </main>

      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={MODAL_PANEL_IN}
              animate={MODAL_PANEL_DONE}
              exit={MODAL_PANEL_OUT}
              transition={MODAL_TW}
              className="relative z-10 flex w-full max-h-[92dvh] max-w-lg flex-col overflow-hidden rounded-3xl border border-[#1E242B] bg-[#0B0D11] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#1E242B] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#FBBC00]">{detail.tipo}</p>
                  <h3 className="truncate text-lg font-black">{detail.titulo}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="shrink-0 rounded-lg p-2 text-[#94A3B8] hover:bg-white/5"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {detail.bannerUrl ? (
                  <EventBanner url={detail.bannerUrl} alt={detail.titulo} />
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-transparent">
                    <CalendarDays className="h-12 w-12 text-white/15" />
                  </div>
                )}
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="flex items-center gap-2 font-bold">
                      <Calendar className="h-4 w-4 text-[#FBBC00]" />
                      {(() => {
                        try {
                          return format(parseISO(detail.data), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
                        } catch {
                          return detail.data;
                        }
                      })()}
                    </span>
                    <span className="flex items-center gap-2 font-bold">
                      <Clock className="h-4 w-4 text-[#FBBC00]" />
                      {detail.hora}
                    </span>
                  </div>
                  <a
                    href={terreiroProfilePath(detail.terreiro.slug)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#CBD5E1] hover:text-[#FBBC00]"
                  >
                    <MapPin className="h-4 w-4" />
                    {detail.terreiro.nome}
                    {detail.terreiro.cidade ? ` — ${detail.terreiro.cidade}` : ''}
                  </a>
                  {detail.descricao ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#94A3B8]">{detail.descricao}</p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
