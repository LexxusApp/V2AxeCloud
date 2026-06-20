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

function EventBanner({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center bg-white">
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
                    className={cn(
                      'group w-full cursor-pointer overflow-hidden text-left transition hover:-translate-y-0.5',
                      landingMockupCardClass,
                      'rounded-2xl',
                    )}
                  >
                    {ev.bannerUrl ? (
                      <div className="overflow-hidden bg-white">
                        <EventBanner url={ev.bannerUrl} alt={ev.titulo} />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-transparent">
                        <CalendarDays className="h-10 w-10 text-white/15" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 p-5">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#FFC107]">{ev.tipo}</span>
                      <h2 className="text-lg font-bold text-[#1b1813]">{ev.titulo}</h2>
                      <p className="flex items-center gap-2 text-sm text-[#1b1813]/65">
                        <Calendar className="h-4 w-4 shrink-0" />
                        {dataFmt} · {ev.hora}
                      </p>
                      <span className="flex items-center gap-1 text-sm font-semibold text-[#1b1813]/75 group-hover:text-[#FFC107]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {ev.terreiro.nome}
                        {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
                      </span>
                      {ev.descricao ? (
                        <p className="line-clamp-2 text-sm text-[#1b1813]/68">{ev.descricao}</p>
                      ) : null}
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1b1813]/40">
                        Toque para ver detalhes
                      </p>
                    </div>
                  </button>
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
              className={cn(
                'relative z-10 flex max-h-[92dvh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl',
                landingMockupCardClass,
                detail.bannerUrl ? 'w-max max-w-[min(96vw,440px)]' : 'w-full max-w-lg',
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--mockup-card-border,#cfc0a8)] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#FFC107]">{detail.tipo}</p>
                  <h3 className="truncate text-lg font-black text-[#1b1813]">{detail.titulo}</h3>
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
              <div className="min-h-0 flex-1 overflow-y-auto">
                {detail.bannerUrl ? (
                  <img
                    src={detail.bannerUrl}
                    alt={detail.titulo}
                    className="block h-auto max-h-[min(70dvh,560px)] w-auto max-w-[min(96vw,440px)]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-[#FBBC00]/10 to-transparent">
                    <CalendarDays className="h-12 w-12 text-white/15" />
                  </div>
                )}
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-3 text-sm text-[#1b1813]">
                    <span className="flex items-center gap-2 font-bold">
                      <Calendar className="h-4 w-4 text-[#FFC107]" />
                      {(() => {
                        try {
                          return format(parseISO(detail.data), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
                        } catch {
                          return detail.data;
                        }
                      })()}
                    </span>
                    <span className="flex items-center gap-2 font-bold">
                      <Clock className="h-4 w-4 text-[#FFC107]" />
                      {detail.hora}
                    </span>
                  </div>
                  <a
                    href={terreiroProfilePath(detail.terreiro.slug)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b1813]/75 hover:text-[#FFC107]"
                  >
                    <MapPin className="h-4 w-4" />
                    {detail.terreiro.nome}
                    {detail.terreiro.cidade ? ` — ${detail.terreiro.cidade}` : ''}
                  </a>
                  {detail.descricao ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1b1813]/65">{detail.descricao}</p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MarketingMockupLayout>
  );
}
