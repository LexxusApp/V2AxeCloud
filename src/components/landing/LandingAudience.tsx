import { motion } from 'framer-motion';
import { Crown, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

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
    <section
      id="para-quem"
      className="relative border-t border-white/5 bg-black/25 py-16 sm:py-24"
      aria-labelledby="quem-head"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <motion.div {...fade}>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">Para quem</p>
            <h2 id="quem-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
              Quem manda, quem cuida e quem cresce junto
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400 sm:text-base">
              A landing segue a mesma promessa do sistema: profissionalismo com respeito. Feito para quem segura a
              casa — do zelador ao sacerdote — sem transformar a fé em burocracia.
            </p>
          </motion.div>

          <ul className="space-y-3 sm:space-y-4" role="list">
            {AUDIENCE.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.id}
                  {...fade}
                  transition={{ ...fade.transition, delay: 0.06 * i }}
                  className={cn(
                    'flex gap-4 rounded-2xl p-4 sm:p-5 transition-colors',
                    item.featured
                      ? 'border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-neutral-900/50 to-neutral-950/80 shadow-[0_0_48px_-16px_rgba(251,191,36,0.35)] backdrop-blur-md'
                      : 'border border-neutral-800/80 bg-neutral-900/35 backdrop-blur-sm hover:border-neutral-700/80'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-xl border',
                      item.featured
                        ? 'border-amber-500/35 bg-amber-500/15 text-amber-400'
                        : 'border-neutral-700 bg-neutral-950/80 text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white sm:text-base">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.text}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
