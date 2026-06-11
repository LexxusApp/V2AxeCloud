import { motion } from 'framer-motion';
import { Leaf, Lock, Users } from 'lucide-react';
import { HOME_PLATAFORMA, HOME_STATIC_SECTIONS } from '../../constants/seoHome';
import { LandingIconBox, landingIconClass, type LandingIconAccent } from './landingIconAccents';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const PHILOSOPHY_ICONS: { icon: typeof Lock; accent: LandingIconAccent }[] = [
  { icon: Lock, accent: 'gold' },
  { icon: Leaf, accent: 'emerald' },
  { icon: Users, accent: 'amber' },
];

export function LandingPhilosophy() {
  return (
    <LandingSection id="plataforma" variant="alt" aria-labelledby="plataforma-head">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0E1116]"
        aria-hidden
      />
      <div className="landing-section-inner mx-auto max-w-7xl">
        <motion.div {...fade} className="relative z-10 mx-auto mb-14 max-w-3xl text-center md:mb-16">
          <h2
            id="plataforma-head"
            className="landing-title font-display font-extrabold tracking-tight text-[#F1F5F9]"
          >
            {HOME_PLATAFORMA.titleBefore}{' '}
            <span className="text-primary">{HOME_PLATAFORMA.titleHighlight}</span>
          </h2>
          <p className="landing-lead mx-auto mt-4 max-w-3xl text-base md:text-lg">
            {HOME_PLATAFORMA.lead}
          </p>
        </motion.div>

        <ul className="relative z-10 grid list-none gap-8 md:grid-cols-3 md:gap-10 lg:gap-12" role="list">
          {HOME_STATIC_SECTIONS.map((section, i) => {
            const { icon: Icon, accent } = PHILOSOPHY_ICONS[i] ?? PHILOSOPHY_ICONS[0];
            return (
              <motion.li key={section.heading} {...fade} transition={{ ...fade.transition, delay: 0.06 * i }}>
                <article className="landing-v3-card group h-full rounded-2xl p-8">
                  <LandingIconBox accent={accent} className="mb-6">
                    <Icon className={landingIconClass(accent, 'h-5 w-5')} aria-hidden />
                  </LandingIconBox>
                  <h3 className="text-lg font-bold text-[#F1F5F9]">{section.heading}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{section.body}</p>
                </article>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </LandingSection>
  );
}
