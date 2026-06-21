import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Heart,
  Home,
  Images,
  Megaphone,
  Menu,
  Package,
  PieChart,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { LandingMockupSideRails } from '../landing/LandingMockupSideRails';
import { landingMockupShellClass } from '../landing/landingMockupUi';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { DEMO_HOUSE_NAME } from '../../constants/landingDemo';
import { BRAND_NAME, BRAND_TAGLINE } from '../../constants/seoBrandKeywords';

export type PainelPreviewTab =
  | 'dashboard'
  | 'filhos'
  | 'financeiro'
  | 'giras'
  | 'mural'
  | 'reza';

const TABS: { id: PainelPreviewTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'filhos', label: 'Membros', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: PieChart },
  { id: 'giras', label: 'Giras', icon: CalendarDays },
  { id: 'mural', label: 'Comunicados', icon: Megaphone },
  { id: 'reza', label: 'Pedidos de Reza', icon: Heart },
];

const LOGO_SRC = '/ile-ase-logo.png';

type PainelPreviewShellProps = {
  activeTab: PainelPreviewTab;
  onTabChange: (tab: PainelPreviewTab) => void;
  children: ReactNode;
};

export function PainelPreviewShell({ activeTab, onTabChange, children }: PainelPreviewShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-hidden bg-[#fdf8f0] font-sans text-[#1b1813] antialiased">
      <LandingMockupSideRails />

      <div
        className="sticky top-0 z-50 border-b border-[#cfc0a8]/80 bg-[#fdf8f0]/95 backdrop-blur-md"
        role="banner"
      >
        <div className="border-b border-[#FFC107]/25 bg-[#FFC107]/12 px-4 py-2 text-center sm:px-6">
          <p className="text-[11px] font-bold text-[#1b1813]">
            Preview visual do painel — dados fictícios, sem login.{' '}
            <a href={ROUTES.home} className="underline decoration-[#1b1813]/30 underline-offset-2 hover:text-[#FFC107]">
              Voltar ao site
            </a>
          </p>
        </div>

        <div className={cn(landingMockupShellClass, 'flex items-center justify-between gap-3 py-3 sm:py-4')}>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#dccfb8] bg-white lg:hidden"
              aria-label={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <img
              src={LOGO_SRC}
              alt="Ilê Asé"
              width={200}
              height={65}
              className="hidden h-9 w-auto object-contain sm:block sm:h-10"
              decoding="async"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-[#1b1813] sm:text-base">{DEMO_HOUSE_NAME}</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#FFC107]/35 bg-[#FFC107]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#1b1813]">
                Preview · Plano Ouro
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#dccfb8] bg-white text-[#1b1813]/70"
              aria-label="Notificações (preview)"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FFC107]" />
            </button>
            <a
              href={appHref(ROUTES.login)}
              className="hidden rounded-lg bg-[#FFC107] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#1b1813] shadow-sm transition hover:bg-[#e6ad00] sm:inline-flex"
            >
              Entrar
            </a>
          </div>
        </div>

        <div className={cn(landingMockupShellClass, 'hidden pb-3 lg:block')}>
          <div
            className="inline-flex flex-wrap gap-1 rounded-xl border border-[#dccfb8] bg-[#faf6ef] p-1"
            role="tablist"
            aria-label="Módulos do painel"
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
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all',
                    isActive
                      ? 'bg-[#FFC107] text-[#1b1813] shadow-sm'
                      : 'text-[#1b1813]/55 hover:bg-white hover:text-[#1b1813]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-[#1b1813]/40 lg:hidden"
              aria-label="Fechar menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 top-0 z-[70] flex w-[min(18rem,88vw)] flex-col border-r border-[#cfc0a8] bg-[#fdf8f0] p-4 lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <img src={LOGO_SRC} alt="" className="h-8 w-auto" decoding="async" />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[#dccfb8] bg-white"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onTabChange(tab.id);
                        setMobileNavOpen(false);
                      }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold',
                        isActive ? 'bg-[#FFC107] text-[#1b1813]' : 'text-[#1b1813]/70 hover:bg-[#faf6ef]',
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      {tab.label}
                    </button>
                  );
                })}
                <div className="my-2 h-px bg-[#dccfb8]" />
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#1b1813]/35"
                >
                  <Package className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Almoxarifado
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#1b1813]/35"
                >
                  <Images className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Galeria
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#1b1813]/35"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Configurações
                </button>
              </nav>
              <a
                href={appHref(ROUTES.login)}
                className="mt-4 flex h-10 items-center justify-center rounded-lg bg-[#FFC107] text-xs font-black uppercase tracking-wider text-[#1b1813]"
              >
                Entrar no painel real
              </a>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <main className={cn(landingMockupShellClass, 'relative z-10 py-5 sm:py-8')}>
        <a
          href={ROUTES.home}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b1813]/55 transition hover:text-[#1b1813]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Site Ilê Asé
        </a>

        <div className="landing-mockup-demo-frame overflow-hidden rounded-[1.75rem]">
          <div className="border-b border-[#dccfb8] bg-white px-4 py-3 sm:hidden">
            <div className="-mx-1 flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                      isActive ? 'bg-[#FFC107] text-[#1b1813]' : 'bg-[#faf6ef] text-[#1b1813]/60',
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {tab.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 md:p-8">{children}</div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#cfc0a8]/60 px-4 py-6 text-center text-[10px] font-medium text-[#1b1813]/45">
        Preview de interface · {BRAND_NAME} {BRAND_TAGLINE} · não substitui o painel autenticado
      </footer>
    </div>
  );
}
