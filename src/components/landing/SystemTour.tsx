import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, LayoutDashboard, Megaphone, Users, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type TourStep = {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  src: string;
  desc: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: 'painel',
    label: 'Início (Painel)',
    shortLabel: 'Painel',
    icon: LayoutDashboard,
    src: '/screenshots/painel-inicio.png',
    desc: 'Resumo, números e o que a casa precisa enxergar de primeira.',
  },
  {
    id: 'filhos',
    label: 'Filhos de Santo',
    shortLabel: 'Filhos',
    icon: Users,
    src: '/screenshots/filhos-de-santo.png',
    desc: 'Pessoas do terreiro, cadastros e atalhos para a rotina do dia a dia.',
  },
  {
    id: 'calendario',
    label: 'Calendário de Giras',
    shortLabel: 'Giras',
    icon: CalendarDays,
    src: '/screenshots/calendario-eventos.png',
    desc: 'Giras, compromissos e a agenda alinhada à casa — tudo visível para a diretoria.',
  },
  {
    id: 'mural',
    label: 'Mural de Avisos',
    shortLabel: 'Mural',
    icon: Megaphone,
    src: '/screenshots/mural.png',
    desc: 'Comunicados e avisos visíveis para a comunidade, sem grupos espalhados.',
  },
];

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function SystemTour() {
  const [activeId, setActiveId] = useState(TOUR_STEPS[0].id);
  const active = TOUR_STEPS.find((s) => s.id === activeId) ?? TOUR_STEPS[0];

  return (
    <section
      id="tour"
      className="relative border-t border-white/5 py-16 sm:py-24"
      aria-labelledby="tour-head"
    >
      <motion.div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" {...fade}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">
            Tour do produto
          </p>
          <h2 id="tour-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Veja o painel por dentro
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
            Telas reais capturadas de uma sessão de zelador. Navegue pelos módulos principais — a mesma
            experiência que sua equipe terá após o login.
          </p>
        </div>

        <div
          className="mt-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-2.5 sm:overflow-visible sm:px-0"
          role="tablist"
          aria-label="Módulos do sistema"
        >
          {TOUR_STEPS.map((step) => {
            const isActive = step.id === activeId;
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tour-panel-${step.id}`}
                id={`tour-tab-${step.id}`}
                onClick={() => setActiveId(step.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all duration-200 sm:px-4',
                  isActive
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_24px_-6px_rgba(251,191,36,0.35)]'
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/80 hover:text-neutral-200'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400' : 'text-neutral-500')} />
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div
          id={`tour-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`tour-tab-${active.id}`}
          className="mt-8"
        >
          <div className="relative mx-auto max-w-4xl">
            <motion.div
              className="pointer-events-none absolute -inset-4 rounded-3xl bg-amber-500/8 blur-3xl sm:-inset-8"
              aria-hidden
            />
            <motion.div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-neutral-800',
                'bg-neutral-950 shadow-2xl shadow-black/60',
                'ring-1 ring-white/[0.06]'
              )}
            >
              <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/90 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/90" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" aria-hidden />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" aria-hidden />
                <span className="ml-2 truncate text-[11px] font-mono text-neutral-500">
                  axecloud.com.br — {active.label}
                </span>
              </div>
              <div className="bg-[#0a0a0a] p-2 sm:p-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    <img
                      src={active.src}
                      alt={active.label}
                      className="mx-auto h-auto w-full max-h-[min(70vh,520px)] rounded-lg object-contain object-top shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]"
                      width={1400}
                      height={900}
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="border-t border-neutral-800 bg-neutral-900/60 px-4 py-4 sm:px-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary">{active.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-400">{active.desc}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
