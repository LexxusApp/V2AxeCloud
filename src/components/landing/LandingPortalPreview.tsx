import { motion } from 'framer-motion';
import { Award, HandHeart, MapPin, Search } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderHouses } from '../../hooks/useFounderHouses';
import { ROUTES, consulentePortalPath } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { LandingIconBox, landingIconClass } from './landingIconAccents';
import { LandingSection, LandingSectionHeader } from './LandingSection';
import { landingMockupCardClass } from './landingMockupUi';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
} as const;

function FounderHouseAvatar({ houseName, fotoUrl }: { houseName: string; fotoUrl?: string }) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover sm:h-14 sm:w-14"
      />
    );
  }

  const initial = houseName.trim().charAt(0).toUpperCase() || 'A';
  return (
    <span
      aria-hidden
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-violet-50 text-sm font-black text-violet-600 sm:h-14 sm:w-14 sm:text-base"
    >
      {initial}
    </span>
  );
}

function FounderHouseCard({
  houseName,
  city,
  state,
  tradition,
  quote,
  portalSlug,
  fotoUrl,
}: {
  houseName: string;
  city: string;
  state: string;
  tradition: string;
  quote?: string;
  portalSlug?: string;
  fotoUrl?: string;
}) {
  return (
    <article className={cn('flex h-full flex-col p-5 text-left sm:p-6', landingMockupCardClass, 'rounded-2xl')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
          <Award className="h-3.5 w-3.5" aria-hidden />
          Casa fundadora
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tradition}</span>
      </div>
      <div className="flex items-center gap-3">
        <FounderHouseAvatar houseName={houseName} fotoUrl={fotoUrl} />
        <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-slate-900 sm:text-lg">{houseName}</h3>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
        <MapPin className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
        {city} — {state}
      </p>
      {quote ? (
        <blockquote className="mt-4 border-l-2 border-amber-300 pl-3 text-sm italic leading-relaxed text-slate-600">
          &ldquo;{quote}&rdquo;
        </blockquote>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Primeira casa validando o Ilê Asé no Programa Fundador — organização digital com respeito à tradição.
        </p>
      )}
      {portalSlug ? (
        <a
          href={consulentePortalPath(portalSlug)}
          className="landing-btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 text-xs uppercase tracking-wider"
        >
          <HandHeart className="h-4 w-4 shrink-0" aria-hidden />
          Pedir reza nesta casa
        </a>
      ) : (
        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
          Pedidos de reza online quando a casa activar o portal do consulente.
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
            title={hasHouses ? 'Casas fundadoras no Ilê Asé' : 'Encontre casas de axé — em construção'}
            titleId="portal-head"
            lead={
              hasHouses
                ? `O diretório público está nascendo com as primeiras casas do Programa Fundador. Consulentes podem enviar pedidos de reza pelo portal de cada casa — sem precisar entrar no sistema.`
                : 'Estamos construindo o diretório público de terreiros e a agenda cultural do axé no Brasil. As primeiras casas aparecerão aqui através do Programa Fundador — com respeito, opt-in e curadoria.'
            }
          />
          {hasHouses ? (
            <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-amber-600">
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
            <div className="landing-device-frame p-10 text-center text-sm text-slate-500" aria-busy="true">
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
                    portalSlug={house.portalSlug}
                    fotoUrl={house.fotoUrl}
                  />
                ))}
              </div>
              <p className="text-center text-sm leading-relaxed text-slate-600">
                Cada casa com portal activo recebe pedidos em{' '}
                <span className="font-mono text-xs text-slate-500">axecloud.com.br/consulente/nome-da-casa</span>.
                O zelador acompanha em Atendimentos, dentro do terreiro.
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
                <span className="landing-device-dot bg-amber-500/70" aria-hidden />
                <span className="landing-device-url">portal.axecloud.com.br — diretório</span>
              </div>
              <div className="p-8 text-center sm:p-10">
                <LandingIconBox accent="sky" size="lg" className="mx-auto mb-5">
                  <Search className={landingIconClass('sky', 'h-7 w-7')} aria-hidden />
                </LandingIconBox>
                <p className="text-base font-semibold text-slate-900">Casas fundadoras em breve</p>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-4 w-4 text-rose-500" aria-hidden />
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
