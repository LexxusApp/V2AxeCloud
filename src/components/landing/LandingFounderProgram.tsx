import { motion } from 'framer-motion';
import { ArrowRight, Check, Crown, Sparkles } from 'lucide-react';
import { FOUNDER_BENEFITS, FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { ROUTES } from '../../lib/routes';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
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
    <LandingSection id="programa-fundador" variant="highlight" aria-labelledby="founder-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker="Programa Fundador"
            title={`12 meses gratuitos para as primeiras ${FOUNDER_PROGRAM.maxSlots} casas`}
            titleId="founder-head"
            icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
            lead="Estamos validando o AxéCloud com terreiros reais antes de abrir o portal público. Use o sistema completo, ajude a moldar o produto e apareça como Casa Fundadora quando o diretório estiver no ar."
          />
          {!loading && stats.acceptingApplications ? (
            <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-primary">
              {stats.remainingSlots} vagas restantes · {FOUNDER_PROGRAM.pilotCity}
            </p>
          ) : null}
        </motion.div>

        <motion.ul
          {...fade}
          transition={{ ...fade.transition, delay: 0.08 }}
          className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2"
          role="list"
        >
          {FOUNDER_BENEFITS.slice(0, 4).map((line) => (
            <li key={line} className="landing-mystic-card flex gap-3 p-4 text-sm text-zinc-400">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
              {line}
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

        <p className="relative z-10 mx-auto mt-6 max-w-xl text-center text-[11px] text-zinc-600">
          Depois do período fundador: {FOUNDER_PROGRAM.futurePriceLabel}. Transparência desde o início.
        </p>
      </div>
    </LandingSection>
  );
}
