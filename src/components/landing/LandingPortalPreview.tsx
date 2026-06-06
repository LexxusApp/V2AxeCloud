import { motion } from 'framer-motion';
import { Award, MapPin, Search } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderHouses } from '../../hooks/useFounderHouses';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
} as const;

function FounderHouseCard({
  houseName,
  city,
  state,
  tradition,
  quote,
}: {
  houseName: string;
  city: string;
  state: string;
  tradition: string;
  quote?: string;
}) {
  return (
    <article className="landing-mystic-card flex h-full flex-col p-5 text-left sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
          <Award className="h-3.5 w-3.5" aria-hidden />
          Casa fundadora
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{tradition}</span>
      </div>
      <h3 className="text-base font-bold leading-snug text-white sm:text-lg">{houseName}</h3>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
        <MapPin className="h-4 w-4 shrink-0 text-primary/80" aria-hidden />
        {city} — {state}
      </p>
      {quote ? (
        <blockquote className="mt-4 border-l-2 border-primary/30 pl-3 text-sm italic leading-relaxed text-zinc-400">
          &ldquo;{quote}&rdquo;
        </blockquote>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          Primeira casa validando o AxéCloud no Programa Fundador — organização digital com respeito à tradição.
        </p>
      )}
    </article>
  );
}

export function LandingPortalPreview() {
  const { houses, loading, count } = useFounderHouses();
  const hasHouses = count > 0;

  return (
    <LandingSection id="portal-axe" aria-labelledby="portal-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker="Portal do axé"
            title={hasHouses ? 'Casas fundadoras no AxéCloud' : 'Encontre casas de axé — em construção'}
            titleId="portal-head"
            lead={
              hasHouses
                ? `O diretório público está nascendo com as primeiras casas do Programa Fundador. Já ${count === 1 ? 'há 1 casa fundadora' : `há ${count} casas fundadoras`} usando o sistema — com respeito, opt-in e curadoria.`
                : 'Estamos construindo o diretório público de terreiros e a agenda cultural do axé no Brasil. As primeiras casas aparecerão aqui através do Programa Fundador — com respeito, opt-in e curadoria.'
            }
          />
          {hasHouses ? (
            <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-primary">
              {count} casa{count === 1 ? '' : 's'} fundadora{count === 1 ? '' : 's'} · {FOUNDER_PROGRAM.pilotCity}
            </p>
          ) : null}
        </motion.div>

        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.08 }}
          className={cn('relative z-10 mx-auto mt-10', hasHouses ? 'max-w-4xl' : 'max-w-2xl')}
        >
          {loading ? (
            <div className="landing-device-frame p-10 text-center text-sm text-zinc-500" aria-busy="true">
              Carregando casas fundadoras…
            </div>
          ) : hasHouses ? (
            <div className="space-y-6">
              <div
                className={cn(
                  'grid gap-4',
                  houses.length === 1 ? 'max-w-xl mx-auto' : 'sm:grid-cols-2',
                )}
              >
                {houses.map((house) => (
                  <FounderHouseCard
                    key={house.id}
                    houseName={house.houseName}
                    city={house.city}
                    state={house.state}
                    tradition={house.tradition}
                    quote={house.quote}
                  />
                ))}
              </div>
              <p className="text-center text-sm text-zinc-500">
                Agenda cultural e busca por cidade chegam na próxima fase do portal.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a href={ROUTES.founderProgram} className="landing-btn-primary text-xs uppercase tracking-wider">
                  Quero ser a próxima casa fundadora
                </a>
                <a href={ROUTES.contentHub} className="landing-btn-secondary text-xs">
                  Glossário e artigos
                </a>
              </div>
            </div>
          ) : (
            <div className="landing-device-frame">
              <div className="landing-device-chrome">
                <span className="landing-device-dot bg-red-500/90" aria-hidden />
                <span className="landing-device-dot bg-amber-400/90" aria-hidden />
                <span className="landing-device-dot bg-emerald-500/70" aria-hidden />
                <span className="landing-device-url">portal.axecloud.com.br — diretório</span>
              </div>
              <div className="p-8 text-center sm:p-10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_32px_rgba(251,188,0,0.12)]">
                  <Search className="h-7 w-7" aria-hidden />
                </div>
                <p className="text-base font-semibold text-white">Casas fundadoras em breve</p>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
                  <MapPin className="h-4 w-4 text-primary/80" aria-hidden />
                  Começando pela Grande São Paulo e região
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <a href={ROUTES.founderProgram} className="landing-btn-primary text-xs uppercase tracking-wider">
                    Participar do programa
                  </a>
                  <a href={ROUTES.contentHub} className="landing-btn-secondary text-xs">
                    Glossário e artigos
                  </a>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </LandingSection>
  );
}
