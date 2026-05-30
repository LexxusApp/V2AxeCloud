import { motion } from 'framer-motion';
import { Crown, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LandingSection, LandingSectionHeader } from './LandingSection';

type AudienceItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  featured?: boolean;
};

const AUDIENCE: AudienceItem[] = [
  {
    id: 'zeladores',
    icon: Users,
    title: 'Zeladores e quem cuida do chão',
    text: 'Rotina, oferenda e pessoas no mesmo lugar. Menos corre-corre, mais clareza para cuidar da casa.',
    featured: true,
  },
  {
    id: 'pais',
    icon: Crown,
    title: 'Pais e mães de santo',
    text: 'Comando com profissionalismo: números e processos alinhados ao axé, não ao improviso burocrático.',
  },
  {
    id: 'crescimento',
    icon: TrendingUp,
    title: 'Terreiro em crescimento',
    text: 'Do pequeno ao que já gira muito: escala a organização sem perder a sensibilidade com a comunidade.',
  },
];

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingAudience() {
  return (
    <LandingSection id="para-quem" variant="highlight" aria-labelledby="quem-head">
      <div className="landing-section-inner">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <motion.div {...fade} className="relative z-10">
            <LandingSectionHeader
              kicker="Para quem"
              title="Quem manda, quem cuida e quem cresce junto"
              titleId="quem-head"
              center={false}
              lead="A mesma promessa do sistema: profissionalismo com respeito. Feito para quem segura a casa — do zelador ao sacerdote — sem transformar a fé em burocracia."
            />
          </motion.div>

          <ul className="relative z-10 space-y-3 sm:space-y-4" role="list">
            {AUDIENCE.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.id}
                  {...fade}
                  transition={{ ...fade.transition, delay: 0.06 * i }}
                  className={cn(
                    'landing-mystic-card flex gap-4 !rounded-2xl p-4 sm:p-5',
                    item.featured && 'border-primary/30'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-xl border',
                      item.featured
                        ? 'border-primary/35 bg-primary/15 text-primary'
                        : 'border-white/10 bg-white/[0.04] text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white sm:text-base">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{item.text}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </LandingSection>
  );
}
