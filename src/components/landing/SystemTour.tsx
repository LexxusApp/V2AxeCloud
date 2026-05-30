import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Images, LayoutDashboard, Megaphone, Package, Users, Wallet, BookOpen, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LandingSection, LandingSectionHeader } from './LandingSection';

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
  {
    id: 'galeria',
    label: 'Galeria',
    shortLabel: 'Galeria',
    icon: Images,
    src: '/screenshots/galeria.png',
    desc: 'Álbuns de fotos e vídeos do terreiro, organizados por evento ou tema.',
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    icon: Wallet,
    src: '/screenshots/financeiro.png',
    desc: 'Entradas, saídas, Pix e histórico com transparência para a diretoria.',
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca de Estudo',
    shortLabel: 'Biblioteca',
    icon: BookOpen,
    src: '/screenshots/biblioteca-estudo.png',
    desc: 'Materiais e estudos acessíveis a quem precisa aprender na casa.',
  },
  {
    id: 'loja',
    label: 'Loja do Axé',
    shortLabel: 'Loja',
    icon: Package,
    src: '/screenshots/loja-axe.png',
    desc: 'Ofertas e itens vinculados à casa, com pedidos e estoque integrados.',
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
    <LandingSection id="tour" variant="alt" aria-labelledby="tour-head">
      <motion.div className="landing-section-inner" {...fade}>
        <LandingSectionHeader
          kicker="Tour do produto"
          title="Veja o painel por dentro"
          titleId="tour-head"
          lead="Telas reais capturadas de uma sessão de zelador. Navegue pelos módulos principais — a mesma experiência que sua equipe terá após o login."
        />

        <div
          className="relative z-10 mt-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-2.5 sm:overflow-visible sm:px-0"
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
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_-6px_rgba(251,188,0,0.35)]'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-200'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-zinc-600')} />
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
          className="relative z-10 mt-8"
        >
          <div className="relative mx-auto max-w-4xl">
            <div className="landing-hero-orb landing-hero-orb--a !top-auto !bottom-0 !left-1/4 opacity-60" aria-hidden />
            <div className="landing-device-frame landing-hero-device">
              <div className="landing-device-chrome">
                <span className="landing-device-dot bg-red-500/90" aria-hidden />
                <span className="landing-device-dot bg-amber-400/90" aria-hidden />
                <span className="landing-device-dot bg-emerald-500/70" aria-hidden />
                <span className="landing-device-url">app.axecloud.com.br — {active.label}</span>
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
                      alt={`${active.label} — gestão de terreiro AxéCloud`}
                      className="mx-auto h-auto w-full max-h-[min(70vh,520px)] rounded-lg object-contain object-top"
                      width={1400}
                      height={900}
                      loading="lazy"
                      decoding="async"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="border-t border-[#2a2108] bg-[#0d0d0d]/90 px-4 py-4 sm:px-5">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary">{active.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{active.desc}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </LandingSection>
  );
}
