import { motion } from 'framer-motion';
import { Check, LayoutDashboard, Smartphone, Users } from 'lucide-react';
import {
  LANDING_APP_CARDS,
  LANDING_APPS_HEADING,
  LANDING_PWA_STEPS,
} from '../../constants/landingApps';
import { LandingIconBox, landingIconClass } from './landingIconAccents';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const CARD_ICONS = {
  filho: Users,
  zelador: LayoutDashboard,
} as const;

export function ConnectedAccess() {
  return (
    <LandingSection id="apps" variant="alt" aria-labelledby="apps-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_APPS_HEADING.kicker}
            title={LANDING_APPS_HEADING.title}
            titleId="apps-head"
            lead={LANDING_APPS_HEADING.lead}
          />
        </motion.div>

        <div className="relative z-10 mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {LANDING_APP_CARDS.map((card, index) => {
            const Icon = CARD_ICONS[card.id as keyof typeof CARD_ICONS] ?? Users;
            const accent = card.id === 'filho' ? 'sky' : 'gold';

            return (
              <motion.article
                key={card.id}
                initial={fade.initial}
                whileInView={fade.whileInView}
                viewport={fade.viewport}
                transition={{ ...fade.transition, delay: 0.08 * index }}
                className="landing-app-card landing-app-card--text"
              >
                <div className="landing-app-card__body">
                  <div className="flex items-start gap-4">
                    <LandingIconBox accent={accent} size="lg" className="shrink-0">
                      <Icon className={landingIconClass(accent, 'h-6 w-6')} strokeWidth={1.75} aria-hidden />
                    </LandingIconBox>
                    <div className="min-w-0 flex-1">
                      <span className="landing-app-badge">{card.badge}</span>
                      <h3 className="landing-app-card__title">{card.title}</h3>
                      <p className="mt-2 text-xs font-medium text-slate-500">{card.who}</p>
                    </div>
                  </div>

                  <p className="landing-app-card__desc">{card.description}</p>

                  <ul className="landing-app-card__list" role="list">
                    {card.features.map((feature) => (
                      <li key={feature}>
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          className="relative z-10 mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8"
          initial={fade.initial}
          whileInView={fade.whileInView}
          viewport={fade.viewport}
          transition={{ ...fade.transition, delay: 0.15 }}
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <LandingIconBox accent="emerald" className="shrink-0">
                <Smartphone className={landingIconClass('emerald', 'h-5 w-5')} aria-hidden />
              </LandingIconBox>
              <div>
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">Como funciona o PWA</h3>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Progressive Web App — app na tela inicial, sem instalar pela loja.
                </p>
              </div>
            </div>
          </div>

          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6" role="list">
            {LANDING_PWA_STEPS.map((item) => (
              <li
                key={item.step}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4"
              >
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-600">
                  {item.step}
                </span>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.desc}</p>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </LandingSection>
  );
}
