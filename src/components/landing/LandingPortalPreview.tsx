import { motion } from 'framer-motion';
import { MapPin, Search } from 'lucide-react';
import { ROUTES } from '../../lib/routes';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
} as const;

export function LandingPortalPreview() {
  return (
    <LandingSection id="portal-axe" aria-labelledby="portal-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker="Portal do axé"
            title="Encontre casas de axé — em construção"
            titleId="portal-head"
            lead="Estamos construindo o diretório público de terreiros e a agenda cultural do axé no Brasil. As primeiras casas aparecerão aqui através do Programa Fundador — com respeito, opt-in e curadoria."
          />
        </motion.div>

        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.08 }}
          className="relative z-10 mx-auto mt-10 max-w-2xl"
        >
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
        </motion.div>
      </div>
    </LandingSection>
  );
}
