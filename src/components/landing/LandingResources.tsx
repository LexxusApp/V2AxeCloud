import { motion } from 'framer-motion';
import { LANDING_RESOURCES, LANDING_RESOURCES_HEADING } from '../../constants/landingResources';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingResources() {
  return (
    <LandingSection id="recursos" variant="alt" aria-labelledby="recursos-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_RESOURCES_HEADING.kicker}
            title={LANDING_RESOURCES_HEADING.title}
            titleId="recursos-head"
            lead={LANDING_RESOURCES_HEADING.lead}
          />
        </motion.div>

        <ul
          className="relative z-10 mt-10 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6"
          role="list"
        >
          {LANDING_RESOURCES.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.id}
                {...fade}
                transition={{ ...fade.transition, delay: 0.05 * i }}
                className="h-full"
              >
                <article className="landing-resource-card group h-full">
                  <div className="landing-resource-card__icon" aria-hidden>
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="landing-resource-card__title">{item.title}</h3>
                  <p className="landing-resource-card__desc">{item.description}</p>
                </article>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </LandingSection>
  );
}
