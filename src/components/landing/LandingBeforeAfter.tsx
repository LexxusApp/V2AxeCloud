import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import {
  LANDING_AFTER_ITEMS,
  LANDING_BEFORE_AFTER_HEADING,
  LANDING_BEFORE_ITEMS,
} from '../../constants/landingBeforeAfter';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingBeforeAfter() {
  return (
    <LandingSection id="antes-depois" aria-labelledby="antes-depois-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_BEFORE_AFTER_HEADING.kicker}
            title={LANDING_BEFORE_AFTER_HEADING.title}
            titleId="antes-depois-head"
            lead={LANDING_BEFORE_AFTER_HEADING.lead}
          />
        </motion.div>

        <div className="relative z-10 mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          <motion.div
            {...fade}
            transition={{ ...fade.transition, delay: 0.05 }}
            className="landing-before-after-card landing-before-after-card--before"
          >
            <p className="landing-before-after-card__label">Antes do AxéCloud</p>
            <h3 className="landing-before-after-card__title">Gestão espalhada</h3>
            <ul className="landing-before-after-card__list" role="list">
              {LANDING_BEFORE_ITEMS.map((item) => (
                <li key={item}>
                  <X className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={2.5} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            {...fade}
            transition={{ ...fade.transition, delay: 0.12 }}
            className="landing-before-after-card landing-before-after-card--after"
          >
            <p className="landing-before-after-card__label">Com o AxéCloud</p>
            <h3 className="landing-before-after-card__title">Gestão centralizada</h3>
            <ul className="landing-before-after-card__list" role="list">
              {LANDING_AFTER_ITEMS.map((item) => (
                <li key={item}>
                  <Check className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2.5} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </LandingSection>
  );
}
