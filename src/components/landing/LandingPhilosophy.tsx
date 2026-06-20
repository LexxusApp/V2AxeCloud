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
      <div className="landing-section-inner mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <motion.div {...fade} className="relative z-10 lg:sticky lg:top-28 lg:self-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Nossa filosofia
            </span>
            <h2
              id="plataforma-head"
              className="landing-title mt-4 font-display font-extrabold tracking-tight text-slate-900"
            >
              {HOME_PLATAFORMA.titleBefore}{' '}
              <span className="text-emerald-600">{HOME_PLATAFORMA.titleHighlight}</span>
            </h2>
            <span className="mt-4 block h-1 w-12 rounded-full bg-emerald-500/70" aria-hidden />
            <p className="landing-lead mt-5 max-w-md text-base md:text-lg">{HOME_PLATAFORMA.lead}</p>
          </motion.div>

          <ul className="relative z-10 space-y-4" role="list">
            {HOME_STATIC_SECTIONS.map((section, i) => {
              const { icon: Icon, accent } = PHILOSOPHY_ICONS[i] ?? PHILOSOPHY_ICONS[0];
              return (
                <motion.li key={section.heading} {...fade} transition={{ ...fade.transition, delay: 0.06 * i }}>
                  <article className="group flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/60 sm:p-7">
                    <div className="flex shrink-0 flex-col items-center gap-3">
                      <LandingIconBox accent={accent}>
                        <Icon className={landingIconClass(accent, 'h-5 w-5')} aria-hidden />
                      </LandingIconBox>
                      <span className="font-display text-xs font-black text-slate-300">
                        0{i + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900">{section.heading}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
                    </div>
                  </article>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </LandingSection>
  );
}
