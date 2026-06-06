import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { LANDING_TRADITION_CARDS, LANDING_TRADITIONS_HEADING } from '../../constants/landingTraditions';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingTraditions() {
  return (
    <LandingSection id="tradicao" variant="alt" aria-labelledby="tradicao-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_TRADITIONS_HEADING.kicker}
            title={LANDING_TRADITIONS_HEADING.title}
            titleId="tradicao-head"
            lead={LANDING_TRADITIONS_HEADING.lead}
          />
        </motion.div>

        <div className="relative z-10 mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {LANDING_TRADITION_CARDS.map((card, index) => (
            <motion.article
              key={card.id}
              initial={fade.initial}
              whileInView={fade.whileInView}
              viewport={fade.viewport}
              transition={{ ...fade.transition, delay: 0.08 * index }}
              className="landing-tradition-card"
            >
              <p className="landing-tradition-card__kicker">{card.title}</p>
              <h3 className="landing-tradition-card__title">{card.subtitle}</h3>
              <ul className="landing-tradition-card__list" role="list">
                {card.features.map((feature) => (
                  <li key={feature}>
                    <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
