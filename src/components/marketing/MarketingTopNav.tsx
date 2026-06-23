import { Heart, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';
import { BRAND_LOGO_ALT, BRAND_LOGO_HEIGHT, BRAND_LOGO_LOGIN_CLASS, BRAND_LOGO_NAV_CLASS, BRAND_LOGO_NAV_FOOTER_CLASS, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH } from '../../constants/brandLogo';

type NavItem = {
  id: string;
  label: string;
  path?: string;
  highlight?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'plataforma', label: 'Plataforma' },
  { id: 'recursos', label: 'Recursos' },
  { id: 'demonstracao', label: 'Demo', highlight: true },
  { id: 'mensalidade', label: 'Planos' },
];

function sectionHref(sectionBase: string, id: string) {
  return sectionBase ? `${sectionBase}#${id}` : `#${id}`;
}

const LOGO_SRC = BRAND_LOGO_SRC;

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      width={BRAND_LOGO_WIDTH}
      height={BRAND_LOGO_HEIGHT}
      decoding="async"
      className={cn(
        'block w-auto shrink-0 object-contain object-left',
        compact ? 'h-[3.5rem] sm:h-[4.25rem] md:h-[5rem]' : 'h-[3.75rem] sm:h-[4.5rem] md:h-[5.25rem]',
      )}
    />
  );
}

type MarketingTopNavProps = {
  logoHref?: string;
  sectionBase?: string;
  active?: 'fiel';
};

export function MarketingTopNav({
  logoHref = ROUTES.home,
  sectionBase = ROUTES.home,
  active,
}: MarketingTopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="marketing-top-nav sticky top-0 z-50 border-b border-white/10 bg-[#161310]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a
          href={logoHref}
          className="mr-1 flex shrink-0 items-center sm:mr-3"
          aria-label="Ilê Asé — início"
        >
          <LogoMark compact />
        </a>

        <div className="hidden flex-1 items-center justify-center gap-x-3 lg:flex xl:gap-x-5">
          {NAV_ITEMS.slice(0, 2).map((item) => (
                <a
                  key={item.id}
                  href={item.path ?? sectionHref(sectionBase, item.id)}
                  className="inline-flex h-9 shrink-0 touch-manipulation items-center whitespace-nowrap px-1 text-sm font-medium leading-none text-neutral-200 transition-colors hover:text-amber-400"
                >
                  {item.label}
                </a>
              ))}

          <a
            href={ROUTES.espacoDoFiel}
            aria-current={active === 'fiel' ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold leading-none transition-colors',
              active === 'fiel'
                ? 'border-amber-300 bg-amber-400 text-neutral-900'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20',
            )}
          >
            <Heart
              className={cn('h-3.5 w-3.5 shrink-0 fill-current', active === 'fiel' ? 'text-neutral-900' : 'text-amber-400')}
              aria-hidden
            />
            Pedir Reza
          </a>

          {NAV_ITEMS.slice(2).map((item) =>
            item.highlight ? (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                className="inline-flex h-9 shrink-0 touch-manipulation items-center whitespace-nowrap rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold leading-none text-white transition-colors hover:border-amber-400/40 hover:text-amber-400"
              >
                {item.label}
              </a>
            ) : (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                className="inline-flex h-9 shrink-0 touch-manipulation items-center whitespace-nowrap px-1 text-sm font-medium leading-none text-neutral-200 transition-colors hover:text-amber-400"
              >
                {item.label}
              </a>
            ),
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-l border-white/10 pl-6 lg:flex lg:pl-8">
          <a
            href={appHref(ROUTES.login)}
            className="inline-flex h-9 touch-manipulation items-center whitespace-nowrap px-3 text-sm font-semibold leading-none text-neutral-200 transition-colors hover:text-amber-400"
          >
            Entrar
          </a>
          <a
            href={appHref(ROUTES.register)}
            className="inline-flex h-9 touch-manipulation items-center whitespace-nowrap rounded-xl bg-amber-400 px-4 text-xs font-bold uppercase leading-none tracking-wider text-neutral-900 shadow-md shadow-amber-500/25 transition-colors hover:bg-amber-300"
          >
            Cadastrar
          </a>
        </div>

        <button
          type="button"
          className="touch-manipulation rounded-lg p-2 text-neutral-200 transition-colors hover:text-amber-400 lg:hidden"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-white/10 bg-[#161310] lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {NAV_ITEMS.slice(0, 2).map((item) => (
                  <a
                    key={item.id}
                    href={item.path ?? sectionHref(sectionBase, item.id)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block touch-manipulation rounded-lg px-3 py-2.5 text-base font-medium text-neutral-200 hover:bg-white/5 hover:text-amber-400"
                  >
                    {item.label}
                  </a>
                ))}
            <a
              href={ROUTES.espacoDoFiel}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg bg-amber-400 px-3 py-2.5 text-base font-semibold text-neutral-900"
            >
              Pedir Reza
            </a>
            {NAV_ITEMS.slice(2).map((item) => (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                  item.highlight
                    ? 'bg-white/5 font-semibold text-amber-400'
                    : 'text-neutral-200 hover:bg-white/5 hover:text-amber-400',
                )}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <a
                href={appHref(ROUTES.login)}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-neutral-200"
              >
                Entrar
              </a>
              <a
                href={appHref(ROUTES.register)}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl bg-amber-400 py-2.5 text-center text-sm font-bold text-neutral-900"
              >
                Cadastrar
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

const LANDING_MOCKUP_SECTION_IDS = ['recursos', 'mensalidade', 'plataforma'] as const;

function useLandingMockupNavActive() {
  const [activeHash, setActiveHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '',
  );

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash.replace(/^#/, ''));
    syncHash();
    window.addEventListener('hashchange', syncHash);

    const observers: IntersectionObserver[] = [];

    for (const id of LANDING_MOCKUP_SECTION_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) setActiveHash(id);
          }
        },
        { rootMargin: '-42% 0px -48% 0px', threshold: 0 },
      );

      observer.observe(el);
      observers.push(observer);
    }

    return () => {
      window.removeEventListener('hashchange', syncHash);
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return activeHash;
}

function isLandingMockupNavItemActive(href: string, activeHash: string) {
  if (href === ROUTES.home || href === `${ROUTES.home}#top`) {
    if (typeof window === 'undefined') return false;
    const onHome = window.location.pathname.replace(/\/+$/, '') === '' || window.location.pathname === '/';
    return onHome && !activeHash;
  }

  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return false;
  return activeHash === href.slice(hashIndex + 1);
}

const LANDING_MOCKUP_NAV = [
  { label: 'Início', href: ROUTES.home, desktop: 'always' as const },
  { label: 'Recursos', href: `${ROUTES.home}#recursos`, desktop: 'always' as const },
  { label: 'Terreiros', href: ROUTES.terreiros, desktop: 'always' as const },
  { label: 'Agenda', href: ROUTES.eventosPublicos, desktop: 'always' as const },
  { label: 'Conteúdos', href: ROUTES.contentHub, desktop: 'wide' as const },
  { label: 'Planos', href: `${ROUTES.home}#mensalidade`, desktop: 'always' as const },
  { label: 'Sobre', href: `${ROUTES.home}#plataforma`, desktop: 'wide' as const },
] as const;

function landingMockupNavLinkClass(desktop: 'always' | 'wide') {
  if (desktop === 'wide') return 'hidden 2xl:inline-flex';
  return 'inline-flex';
}

export function LandingMockupLogo({ variant = 'nav' }: { variant?: 'nav' | 'footer' }) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      width={BRAND_LOGO_WIDTH}
      height={BRAND_LOGO_HEIGHT}
      decoding="async"
      className={variant === 'footer' ? BRAND_LOGO_NAV_FOOTER_CLASS : BRAND_LOGO_NAV_CLASS}
    />
  );
}

export function LandingTopNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeHash = useLandingMockupNavActive();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="landing-mockup-nav sticky top-0 z-50 min-h-[var(--landing-mockup-nav-height,4.5rem)] bg-black">
      <div className="landing-mockup-nav__bar landing-mockup-nav__inner grid min-h-[var(--landing-mockup-nav-height,4.5rem)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1 md:py-1.5 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-8">
        <a href={ROUTES.home} className="block shrink-0 leading-none xl:col-start-1" aria-label="AXÉCLOUD — início">
          <LandingMockupLogo />
        </a>

        <div className="landing-mockup-nav__links hidden min-w-0 items-center justify-center gap-x-2 xl:flex 2xl:gap-x-3">
          {LANDING_MOCKUP_NAV.map((item) => {
            const isActive = isLandingMockupNavItemActive(item.href, activeHash);
            return (
              <a
                key={item.label}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'landing-mockup-nav__link text-[15px] font-semibold tracking-wide 2xl:text-base',
                  landingMockupNavLinkClass(item.desktop),
                  isActive && 'landing-mockup-nav__link--active',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="landing-mockup-nav__actions flex shrink-0 items-center justify-end gap-2 xl:col-start-3 xl:gap-3">
          <a
            href={appHref(ROUTES.login)}
            className="landing-mockup-nav__ghost hidden rounded-lg px-3.5 py-2 text-sm font-semibold xl:inline-flex"
          >
            Entrar
          </a>
          <a
            href={appHref(ROUTES.register)}
            className="landing-mockup-nav__cta hidden rounded-xl bg-[#FFC107] px-4 py-2 text-sm font-bold text-[#1b1813] xl:inline-flex"
          >
            Comece agora
          </a>

          <button
            type="button"
            className="rounded-lg p-2 text-white transition-colors hover:text-[#FFC107] xl:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="max-h-[calc(100dvh-var(--landing-mockup-nav-height))] overflow-y-auto border-t border-white/10 bg-black xl:hidden">
          <div className="space-y-1 px-4 py-4">
            {LANDING_MOCKUP_NAV.map((item) => {
              const isActive = isLandingMockupNavItemActive(item.href, activeHash);
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'landing-mockup-nav__link block rounded-lg px-3 py-3 text-lg font-semibold',
                    isActive && 'landing-mockup-nav__link--active',
                  )}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href={appHref(ROUTES.login)}
              onClick={() => setMobileMenuOpen(false)}
              className="mt-3 block rounded-lg px-3 py-3 text-center text-lg font-semibold text-white hover:bg-white/5 hover:text-[#FFC107]"
            >
              Entrar
            </a>
            <a
              href={appHref(ROUTES.register)}
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 block rounded-xl bg-[#FFC107] py-3 text-center text-base font-bold text-[#1b1813]"
            >
              Comece agora
            </a>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

export function MarketingSubpageTopNav({ active }: { active?: 'fiel' }) {
  void active;
  return null;
}
