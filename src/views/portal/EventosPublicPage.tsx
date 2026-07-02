import { useEffect, useState } from 'react';
import { Calendar, CalendarDays, Clock, Loader2, MapPin, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { MarketingMockupLayout } from '../../components/marketing/MarketingMockupLayout';
import { MarketingMockupPageHeader } from '../../components/marketing/MarketingMockupPageHeader';
import { landingMockupCardClass, landingMockupShellClass } from '../../components/landing/landingMockupUi';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { fetchPublicEventos, terreiroProfilePath, type PublicEvento } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';
import { MODAL_PANEL_DONE, MODAL_PANEL_IN, MODAL_PANEL_OUT, MODAL_TW } from '../../lib/modalMotion';

function EventListThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-[#f3ebe0]">
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
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-4xl')}>
        <MarketingMockupPageHeader
          kicker="Agenda cultural"
          title="Eventos públicos"
          summary="Giras e festas que as casas optaram por divulgar no portal — confirme horário e endereço directamente com o terreiro."
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : error ? (
          <p className="py-10 text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <div className={cn('mt-10 px-6 py-12 text-center text-[#1b1813]/70', landingMockupCardClass, 'rounded-2xl border-dashed')}>
            Nenhum evento público agendado no momento.
            <a href={ROUTES.terreiros} className="mt-4 block text-sm font-bold text-[#1b1813] hover:text-[#FFC107]">
              Explorar terreiros
            </a>
          </div>
        ) : (
          <ul className="mx-auto mt-10 flex max-w-2xl flex-col gap-4">
            {items.map((ev) => {
              let dataFmt = ev.data;
              try {
                dataFmt = format(parseISO(ev.data), "EEEE, d 'de' MMMM", { locale: ptBR });
              } catch {
                /* keep raw */
              }
              return (
                <li key={ev.id}>
                  {ev.eventoPageUrl ? (
                    <a
                      href={ev.eventoPageUrl}
                      className={cn(
                        'group flex w-full gap-4 overflow-hidden p-4 text-left transition hover:-translate-y-0.5 sm:gap-5 sm:p-5',
                        landingMockupCardClass,
                        'rounded-2xl',
                      )}
                    >
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[#f3ebe0] sm:h-28 sm:w-32">
                      <EventListThumb url={ev.bannerUrl} alt={ev.titulo} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC107]">{ev.tipo}</span>
                      <h2 className="mt-1 text-base font-bold leading-snug text-[#1b1813] group-hover:text-[#FFC107] sm:text-lg">
                        {ev.titulo}
                      </h2>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-[#1b1813]/65">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {dataFmt} · {ev.hora}
                      </p>
                      <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-[#1b1813]/75 group-hover:text-[#FFC107]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {ev.terreiro.nome}
                          {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
                        </span>
                      </span>
                      {ev.descricao ? (
                        <p className="mt-2 line-clamp-2 text-sm text-[#1b1813]/68">{ev.descricao}</p>
                      ) : null}
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#1b1813]/40">
                        {ev.senhasAtivas ? 'Receber senha' : 'Ver evento'}
                      </p>
                    </div>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDetail(ev)}
                      className={cn(
                        'group flex w-full cursor-pointer gap-4 overflow-hidden p-4 text-left transition hover:-translate-y-0.5 sm:gap-5 sm:p-5',
                        landingMockupCardClass,
                        'rounded-2xl',
                      )}
                    >
                      <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[#f3ebe0] sm:h-28 sm:w-32">
                        <EventListThumb url={ev.bannerUrl} alt={ev.titulo} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC107]">{ev.tipo}</span>
                        <h2 className="mt-1 text-base font-bold leading-snug text-[#1b1813] group-hover:text-[#FFC107] sm:text-lg">
                          {ev.titulo}
                        </h2>
                        <p className="mt-1.5 flex items-center gap-2 text-sm text-[#1b1813]/65">
                          <Calendar className="h-4 w-4 shrink-0" />
                          {dataFmt} · {ev.hora}
                        </p>
                        <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-[#1b1813]/75 group-hover:text-[#FFC107]">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {ev.terreiro.nome}
                            {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
                          </span>
                        </span>
                        {ev.descricao ? (
                          <p className="mt-2 line-clamp-2 text-sm text-[#1b1813]/68">{ev.descricao}</p>
                        ) : null}
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#1b1813]/40">
                          Toque para ver detalhes
                        </p>
                      </div>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <section className={cn('mt-16 p-6', landingMockupCardClass, 'rounded-2xl')}>
          <h2 className="font-bold text-[#1b1813]">Receber a agenda por e-mail</h2>
          <div className="mt-4">
            <PortalNewsletterForm />
          </div>
        </section>
      </main>

      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
              className={cn(
                'relative z-10 w-full overflow-hidden rounded-3xl bg-white shadow-2xl',
                landingMockupCardClass,
                detail.bannerUrl ? 'max-w-[min(96vw,42rem)]' : 'max-w-lg',
              )}
            >
              <div
                className={cn(
                  'flex max-h-[min(92dvh,32rem)] w-full overflow-hidden',
                  detail.bannerUrl ? 'flex-row' : 'flex-col',
                )}
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
                  <div className="flex aspect-[16/9] shrink-0 items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-transparent">
                    <CalendarDays className="h-12 w-12 text-[#1b1813]/15" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#FFC107]">{detail.tipo}</p>
                      <h3 className="text-lg font-black leading-snug text-[#1b1813] sm:text-xl">{detail.titulo}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetail(null)}
                      className="shrink-0 rounded-lg p-2 text-[#1b1813]/68 hover:bg-[#1b1813]/5"
                      aria-label="Fechar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3 overflow-hidden">
                    <div className="space-y-2 text-sm text-[#1b1813]">
                      <p className="flex items-start gap-2 font-bold leading-snug">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC107]" />
                        {(() => {
                          try {
                            return format(parseISO(detail.data), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
                          } catch {
                            return detail.data;
                          }
                        })()}
                      </p>
                      <p className="flex items-center gap-2 font-bold">
                        <Clock className="h-4 w-4 shrink-0 text-[#FFC107]" />
                        {detail.hora}
                      </p>
                    </div>
                    <a
                      href={terreiroProfilePath(detail.terreiro.slug)}
                      className="inline-flex items-start gap-2 text-sm font-semibold leading-snug text-[#1b1813]/75 hover:text-[#FFC107]"
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
                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#FFC107] px-4 py-3 text-sm font-black text-[#1b1813] hover:bg-[#e6ac00]"
                      >
                        {detail.senhasAtivas ? 'Ver evento e receber senha' : 'Ver página do evento'}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MarketingMockupLayout>
  );
}
