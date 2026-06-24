import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Flame,
  Heart,
  Megaphone,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { DEMO_HOUSE_NAME } from '../../constants/landingDemo';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { DemoFilhosPanel } from './demo/DemoFilhosPanel';
import { DemoFinanceiroPanel } from './demo/DemoFinanceiroPanel';
import { DemoGirasPanel } from './demo/DemoGirasPanel';
import { DemoMuralPanel } from './demo/DemoMuralPanel';
import { DemoRezaPanel } from './demo/DemoRezaPanel';
import { DemoToastBar, type DemoToast } from './demo/demoUi';
import { LandingSection } from './LandingSection';

type DemoTab = 'filhos' | 'financeiro' | 'giras' | 'mural' | 'reza';

const TABS: { id: DemoTab; label: string; icon: LucideIcon }[] = [
  { id: 'filhos', label: 'Filhos de Santo', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'giras', label: 'Giras', icon: CalendarDays },
  { id: 'mural', label: 'Mural', icon: Megaphone },
  { id: 'reza', label: 'Pedidos de Reza', icon: Heart },
];

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

export function LandingInteractiveDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>('filhos');
  const [toast, setToast] = useState<DemoToast>(null);

  const notify = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <LandingSection id="demonstracao" variant="default" aria-labelledby="demo-head">
      <motion.div className="landing-section-inner mx-auto max-w-7xl" {...fade}>
        <div className="relative z-10 mx-auto mb-12 max-w-3xl text-center">
          <span className="landing-mockup-kicker mb-3 inline-flex">
            Simulador interativo
          </span>
          <h2 id="demo-head" className="landing-title font-display font-black tracking-tight text-[#1b1813]">
            Painel de gestão: experimente agora
          </h2>
          <p className="landing-lead mx-auto mt-4 max-w-2xl text-[#1b1813]/70">
            Simulador <strong className="font-semibold text-[#1b1813]">100% funcional no navegador</strong> com
            módulos reais do AxéCloud. Cadastre filhos de santo, lance no financeiro, marque giras e publique avisos —
            sem criar conta. Os dados ficam só nesta página.
          </p>
          <p className="mt-4">
            <a
              href={ROUTES.previewPainel}
              className="landing-mockup-link text-sm font-bold text-[#1b1813] underline decoration-[#FFC107]/50 underline-offset-4 hover:decoration-[#FFC107]"
            >
              Ver preview completo do painel (novo visual)
            </a>
          </p>
        </div>

        <div
          id="demo-dashboard"
          className="landing-mockup-demo-frame relative z-10 overflow-hidden rounded-[1.75rem] border transition-shadow duration-300 hover:shadow-[var(--mockup-card-shadow-hover)]"
        >
          <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-400">
                <Flame className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div className="text-left">
                <p className="flex items-center gap-1.5 text-sm font-bold leading-none text-slate-900">
                  {DEMO_HOUSE_NAME}
                  <span className="rounded border border-amber-500/20 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    Demo ativa
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-amber-600">Ambiente de testes · modo interativo</p>
              </div>
            </div>

            <div
              className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 scrollbar-none sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible"
              role="tablist"
              aria-label="Módulos da demo"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all',
                      isActive
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                role="tabpanel"
              >
                {activeTab === 'filhos' ? <DemoFilhosPanel onNotify={notify} /> : null}
                {activeTab === 'financeiro' ? <DemoFinanceiroPanel onNotify={notify} /> : null}
                {activeTab === 'giras' ? <DemoGirasPanel onNotify={notify} /> : null}
                {activeTab === 'mural' ? <DemoMuralPanel onNotify={notify} /> : null}
                {activeTab === 'reza' ? <DemoRezaPanel notify={notify} /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <DemoToastBar toast={toast} />
    </LandingSection>
  );
}
