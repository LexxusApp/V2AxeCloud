import { motion } from 'framer-motion';
import { landingScreenshot } from '../../constants/landingScreenshots';
import { ROUTES } from '../../lib/routes';
import { appHref } from '../../lib/appHref';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const DASHBOARD_SHOT = landingScreenshot('painel-dashboard-landing.webp');

export function LandingInteractiveDemo() {
  return (
    <LandingSection id="demonstracao" variant="default" aria-labelledby="demo-head">
      <motion.div className="landing-section-inner mx-auto max-w-7xl" {...fade}>
        <div className="relative z-10 mx-auto mb-12 max-w-3xl text-center">
          <span className="landing-mockup-kicker mb-3 inline-flex">Painel de gestão</span>
          <h2 id="demo-head" className="landing-title font-display font-black tracking-tight text-[#1b1813]">
            Veja como é gerir o terreiro no dia a dia
          </h2>
          <p className="landing-lead mx-auto mt-4 max-w-2xl text-[#1b1813]/70">
            Tela real do painel do AxéCloud — resumo, atalhos e visão geral da casa. A mesma experiência que sua
            diretoria terá após o login.
          </p>
          <p className="mt-4">
            <a
              href={appHref(ROUTES.login)}
              className="landing-mockup-link text-sm font-bold text-[#1b1813] underline decoration-[#FFC107]/50 underline-offset-4 hover:decoration-[#FFC107]"
            >
              Acessar o painel com sua conta
            </a>
          </p>
        </div>

        <div
          id="demo-dashboard"
          className="landing-mockup-demo-frame relative z-10 overflow-hidden rounded-[1.75rem] border transition-shadow duration-300 hover:shadow-[var(--mockup-card-shadow-hover)]"
        >
          <div className="landing-device-chrome border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="landing-device-dot bg-red-500/90" aria-hidden />
            <span className="landing-device-dot bg-amber-400/90" aria-hidden />
            <span className="landing-device-dot bg-amber-500/70" aria-hidden />
            <span className="landing-device-url text-slate-500">app.axecloud.com.br — Dashboard</span>
          </div>
          <img
            src={DASHBOARD_SHOT}
            alt="Dashboard do AxéCloud — painel de gestão do terreiro com resumo e atalhos"
            className="block h-auto w-full"
            width={2880}
            height={1800}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </div>
      </motion.div>
    </LandingSection>
  );
}
