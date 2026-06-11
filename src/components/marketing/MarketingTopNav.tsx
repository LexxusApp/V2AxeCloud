import { Heart, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { appHref } from '../../lib/appHref';
import { ROUTES } from '../../lib/routes';

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
  { id: 'seguranca', label: 'Segurança' },
  { id: 'faq', label: 'FAQ' },
  { id: 'founder', label: 'Fundador', path: ROUTES.founderProgram },
];

function sectionHref(sectionBase: string, id: string) {
  return sectionBase ? `${sectionBase}#${id}` : `#${id}`;
}

const LOGO_SRC = '/logo-axecloud.png?v=4';

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={LOGO_SRC}
      alt="AxéCloud"
      width={950}
      height={316}
      decoding="async"
      className={cn(
        'block w-auto shrink-0 object-contain object-left',
        compact ? 'h-14 sm:h-16 md:h-[4.25rem]' : 'h-16 sm:h-[4.5rem]',
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
    <nav className="sticky top-0 z-50 border-b border-[#1E242B] bg-[#0B0D11]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a
          href={logoHref}
          className="mr-1 flex shrink-0 items-center sm:mr-3"
          aria-label="AxéCloud — início"
        >
          <LogoMark compact />
        </a>

        <div className="hidden flex-1 items-center justify-center gap-x-3 lg:flex xl:gap-x-5">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <a
              key={item.id}
              href={item.path ?? sectionHref(sectionBase, item.id)}
              className="inline-flex h-9 shrink-0 items-center whitespace-nowrap px-1 text-sm font-medium leading-none text-[#94A3B8] transition-colors hover:text-[#F1F5F9]"
            >
              {item.label}
            </a>
          ))}

          <a
            href={ROUTES.espacoDoFiel}
            aria-current={active === 'fiel' ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold leading-none transition-all',
              active === 'fiel'
                ? 'border-rose-500 bg-rose-600 text-white shadow-md shadow-rose-950/40'
                : 'animate-pulse border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-sm shadow-rose-950/20 hover:text-rose-300',
            )}
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5 shrink-0 fill-current',
                active === 'fiel' ? 'text-rose-500' : 'animate-pulse text-rose-500',
              )}
              aria-hidden
            />
            Pedir Reza
          </a>

          {NAV_ITEMS.slice(2).map((item) =>
            item.highlight ? (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-[#2F3643] bg-[#1E242B]/80 px-3 text-sm font-semibold leading-none text-[#F1F5F9] transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap px-1 text-sm font-medium leading-none text-[#94A3B8] transition-colors hover:text-[#F1F5F9]"
              >
                {item.label}
              </a>
            ),
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-l border-[#1E242B] pl-6 lg:flex lg:pl-8">
          <a
            href={appHref(ROUTES.login)}
            className="inline-flex h-9 items-center whitespace-nowrap px-3 text-sm font-semibold leading-none text-[#94A3B8] transition-colors hover:text-primary"
          >
            Entrar
          </a>
          <a
            href={appHref(ROUTES.register)}
            className="inline-flex h-9 items-center whitespace-nowrap rounded-xl border border-primary/20 bg-primary px-4 text-xs font-bold uppercase leading-none tracking-wider text-[#080A0D] shadow-md shadow-black/20 transition-colors hover:bg-[#FDE047]"
          >
            Cadastrar
          </a>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-[#F1F5F9] transition-colors hover:text-primary lg:hidden"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[#1E242B] bg-[#0B0D11] lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {NAV_ITEMS.slice(0, 2).map((item) => (
              <a
                key={item.id}
                href={item.path ?? sectionHref(sectionBase, item.id)}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-base font-medium text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9]"
              >
                {item.label}
              </a>
            ))}
            <a
              href={ROUTES.espacoDoFiel}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg bg-[#e11d48] px-3 py-2.5 text-base font-semibold text-white"
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
                    ? 'bg-[#1E242B]/80 font-semibold text-primary'
                    : 'text-[#94A3B8] hover:bg-[#12161A] hover:text-[#F1F5F9]',
                )}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-4 space-y-2 border-t border-[#1E242B] pt-4">
              <a
                href={appHref(ROUTES.login)}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[#94A3B8]"
              >
                Entrar
              </a>
              <a
                href={appHref(ROUTES.register)}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-[#080A0D]"
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

export function LandingTopNav() {
  return <MarketingTopNav logoHref="#top" sectionBase="" />;
}

export function MarketingSubpageTopNav({ active }: { active?: 'fiel' }) {
  return <MarketingTopNav logoHref={ROUTES.home} sectionBase={ROUTES.home} active={active} />;
}
