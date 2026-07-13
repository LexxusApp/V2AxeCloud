import { ArrowRight, Building2, HeartHandshake, MapPin, Quote, ShieldCheck } from 'lucide-react';
import { useFounderHouses } from '../../hooks/useFounderHouses';
import { ROUTES } from '../../lib/routes';

export function LandingStoryProof() {
  const { houses, loading } = useFounderHouses();
  const visibleHouses = houses.slice(0, 3);
  const publishedQuotes = houses.filter((house) => house.quote).slice(0, 2);

  return (
    <section id="quem-somos" className="relative z-[1] bg-white py-16 font-display text-[#1b1813] md:py-20" aria-labelledby="story-title">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="rounded-[2rem] bg-[#17130e] p-7 text-white shadow-xl shadow-black/10 md:p-9">
            <span className="inline-flex rounded-full bg-[#ffc107] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">Quem está por trás</span>
            <h2 id="story-title" className="mt-5 text-3xl font-black tracking-tight md:text-4xl">Tecnologia brasileira para a rotina real das casas de axé</h2>
            <p className="mt-5 text-sm leading-relaxed text-white/67 md:text-base">
              O AxéCloud começou com uma pergunta simples: como organizar financeiro, comunicação e memória da casa sem tratar o sagrado como uma planilha comum? A plataforma é construída com escuta, respeito e melhoria contínua ao lado de terreiros parceiros.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-white/75">
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" />Dados de cada casa separados e protegidos.</li>
              <li className="flex gap-3"><HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" />Decisões de produto guiadas por necessidades reais.</li>
              <li className="flex gap-3"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" />Empresa brasileira, suporte humano e evolução transparente.</li>
            </ul>
          </div>

          <div className="rounded-[2rem] border border-[#e8dfd0] bg-[#faf6ef] p-7 md:p-9">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a87400]">Casas reais</p><h3 className="mt-2 text-2xl font-black">Casas que constroem conosco</h3></div>
              <a href={ROUTES.terreiros} className="inline-flex items-center gap-1.5 text-sm font-black text-[#a87400] hover:text-[#1b1813]">Ver diretório <ArrowRight className="h-4 w-4" /></a>
            </div>

            {visibleHouses.length ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {visibleHouses.map((house) => (
                  <article key={house.id} className="rounded-2xl border border-[#e8dfd0] bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffc107]/18 text-[#a87400]"><Building2 className="h-5 w-5" /></span>
                      <div><h4 className="font-black leading-snug">{house.houseName}</h4><p className="mt-1 flex items-center gap-1.5 text-xs text-[#1b1813]/55"><MapPin className="h-3.5 w-3.5" />{house.city}/{house.state} · {house.tradition}</p></div>
                    </div>
                    {house.quote ? <blockquote className="mt-4 border-t border-[#e8dfd0] pt-4 text-sm italic leading-relaxed text-[#1b1813]/65"><Quote className="mb-2 h-4 w-4 text-[#a87400]" />“{house.quote}”</blockquote> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#d8cfc0] bg-white/60 p-6 text-sm text-[#1b1813]/55">
                {loading ? 'Carregando casas participantes…' : 'Novas casas autorizadas aparecerão aqui conforme os perfis forem publicados.'}
              </div>
            )}

            {!publishedQuotes.length ? <p className="mt-4 text-xs leading-relaxed text-[#1b1813]/45">Depoimentos são publicados somente com autorização expressa da casa. Não usamos avaliações genéricas ou inventadas.</p> : null}

            <nav className="mt-6 flex flex-wrap gap-2" aria-label="Explorar o portal público">
              <a href={ROUTES.terreiros} className="rounded-full border border-[#d8cfc0] bg-white px-4 py-2 text-xs font-black hover:border-[#ffc107]">Terreiros no mapa</a>
              <a href={ROUTES.eventosPublicos} className="rounded-full border border-[#d8cfc0] bg-white px-4 py-2 text-xs font-black hover:border-[#ffc107]">Eventos públicos</a>
              <a href={ROUTES.espacoDoFiel} className="rounded-full border border-[#d8cfc0] bg-white px-4 py-2 text-xs font-black hover:border-[#ffc107]">Pedir reza</a>
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}
