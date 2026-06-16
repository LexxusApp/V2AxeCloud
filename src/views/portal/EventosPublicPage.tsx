import { useEffect, useState } from 'react';
import { Calendar, Loader2, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingSubpageTopNav } from '../../components/marketing/MarketingTopNav';
import { PortalNewsletterForm } from '../../components/portal/PortalNewsletterForm';
import { fetchPublicEventos, terreiroProfilePath, type PublicEvento } from '../../lib/portalPublic';
import { ROUTES } from '../../lib/routes';

export default function EventosPublicPage() {
  const [items, setItems] = useState<PublicEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <li
                  key={ev.id}
                  className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#0B0D11] sm:flex"
                >
                  {ev.bannerUrl ? (
                    <div className="aspect-video w-full shrink-0 bg-[#12161A] sm:aspect-auto sm:w-48">
                      <img src={ev.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#FBBC00]">{ev.tipo}</span>
                    <h2 className="text-lg font-bold">{ev.titulo}</h2>
                    <p className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      <Calendar className="h-4 w-4" />
                      {dataFmt} · {ev.hora}
                    </p>
                    <a
                      href={terreiroProfilePath(ev.terreiro.slug)}
                      className="flex items-center gap-1 text-sm font-semibold text-[#CBD5E1] hover:text-[#FBBC00]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {ev.terreiro.nome}
                      {ev.terreiro.cidade ? ` — ${ev.terreiro.cidade}` : ''}
                    </a>
                    {ev.descricao ? <p className="text-sm text-[#64748B]">{ev.descricao}</p> : null}
                  </div>
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
    </div>
  );
}
