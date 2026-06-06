import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { LANDING_APP_CARDS, LANDING_APPS_HEADING } from '../../constants/landingApps';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
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
          {LANDING_APP_CARDS.map((card, index) => (
            <motion.article
              key={card.id}
              initial={fade.initial}
              whileInView={fade.whileInView}
              viewport={fade.viewport}
              transition={{ ...fade.transition, delay: 0.08 * index }}
              className="landing-app-card"
            >
              <div className="landing-app-card__body">
                <span className="landing-app-badge">{card.badge}</span>
                <h3 className="landing-app-card__title">{card.title}</h3>
                <p className="landing-app-card__desc">{card.description}</p>
                <ul className="landing-app-card__list" role="list">
                  {card.features.map((feature) => (
                    <li key={feature}>
                      <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="landing-app-card__device" aria-hidden={false}>
                <div className="landing-phone-mockup">
                  <div className="landing-phone-mockup__bezel">
                    <img
                      src={card.screenshot}
                      alt={card.screenshotAlt}
                      width={390}
                      height={844}
                      className="landing-phone-mockup__screen"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
