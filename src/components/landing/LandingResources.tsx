import { motion } from 'framer-motion';
import { LANDING_RESOURCES, LANDING_RESOURCES_HEADING } from '../../constants/landingResources';
import { LandingIconBox, landingIconClass } from './landingIconAccents';
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
      <div className="landing-section-inner mx-auto max-w-7xl">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker={LANDING_RESOURCES_HEADING.kicker}
            title={LANDING_RESOURCES_HEADING.title}
            titleId="recursos-head"
            lead={LANDING_RESOURCES_HEADING.lead}
          />
        </motion.div>

        <ul
          className="relative z-10 mt-14 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
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
                <article className="landing-mockup-card group flex h-full items-start gap-5 p-6 transition duration-200 hover:-translate-y-0.5 sm:p-7">
                  <LandingIconBox accent={item.iconAccent} className="shrink-0">
                    <Icon className={landingIconClass(item.iconAccent, 'h-6 w-6')} strokeWidth={1.5} aria-hidden />
                  </LandingIconBox>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold leading-tight text-[#1b1813] sm:text-lg">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#1b1813]/65">{item.description}</p>
                  </div>
                </article>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </LandingSection>
  );
}
