import { motion } from 'framer-motion';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { FOUNDER_BENEFITS, FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { ROUTES } from '../../lib/routes';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { LandingIconBox, landingIconClass } from './landingIconAccents';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
} as const;

export function LandingFounderProgram() {
  const { stats, loading } = useFounderProgramStats();

  return (
    <LandingSection id="programa-fundador" variant="alt" aria-labelledby="founder-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker="Programa Fundador"
            title={`12 meses gratuitos para as primeiras ${FOUNDER_PROGRAM.maxSlots} casas`}
            titleId="founder-head"
            icon={<Crown className="h-3.5 w-3.5" aria-hidden />}
            lead="Estamos validando o AxéCloud com terreiros reais antes de abrir o portal público. Use o sistema completo, ajude a moldar o produto e apareça como Casa Fundadora quando o diretório estiver no ar."
          />
          {!loading ? (
            <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-amber-600">
              {[
                stats.acceptedHouses > 0
                  ? `${stats.acceptedHouses} casa${stats.acceptedHouses === 1 ? '' : 's'} fundadora${stats.acceptedHouses === 1 ? '' : 's'} ativa${stats.acceptedHouses === 1 ? '' : 's'}`
                  : null,
                stats.acceptingApplications
                  ? `${stats.remainingSlots} vagas restantes · ${FOUNDER_PROGRAM.pilotCity}`
                  : stats.acceptedHouses === 0
                    ? 'Vagas esgotadas no momento'
                    : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
        </motion.div>

        <motion.ul
          {...fade}
          transition={{ ...fade.transition, delay: 0.08 }}
          className="relative z-10 mx-auto mt-10 flex max-w-2xl flex-col gap-2.5"
          role="list"
        >
          {FOUNDER_BENEFITS.slice(0, 4).map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left"
            >
              <LandingIconBox accent="emerald" className="shrink-0 !h-8 !w-8">
                <Check className={landingIconClass('emerald', 'h-4 w-4')} strokeWidth={2.2} aria-hidden />
              </LandingIconBox>
              <p className="pt-0.5 text-sm leading-relaxed text-slate-700 sm:text-base">{line}</p>
            </li>
          ))}
        </motion.ul>

        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.12 }}
          className="relative z-10 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a href={ROUTES.founderProgram} className="landing-btn-primary group w-full sm:w-auto">
            <Crown className="h-4 w-4" aria-hidden />
            Quero ser casa fundadora
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </a>
          <a
            href={FOUNDER_PROGRAM.waComercial}
            target="_blank"
            rel="noreferrer"
            className="landing-btn-secondary w-full sm:w-auto"
          >
            {FOUNDER_PROGRAM.waComercialLabel}
          </a>
        </motion.div>

        <p className="relative z-10 mx-auto mt-6 max-w-xl text-center text-[11px] text-slate-500">
          Depois do período fundador: {FOUNDER_PROGRAM.futurePriceLabel}. Transparência desde o início.
        </p>
      </div>
    </LandingSection>
  );
}
