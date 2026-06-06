import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  Check,
  Facebook,
  Instagram,
  LogIn,
  MessageCircle,
  Menu,
  Youtube,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { HOME_SEO } from '../constants/seoHome';
import { LandingFounderProgram } from '../components/landing/LandingFounderProgram';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingPortalPreview } from '../components/landing/LandingPortalPreview';
import { LandingResources } from '../components/landing/LandingResources';
import { LandingSection, LandingSectionHeader } from '../components/landing/LandingSection';

const SystemTour = lazy(() =>
  import('../components/landing/SystemTour').then((m) => ({ default: m.SystemTour }))
);
const ConnectedAccess = lazy(() =>
  import('../components/landing/ConnectedAccess').then((m) => ({ default: m.ConnectedAccess }))
);
const WhatsAppAutomation = lazy(() =>
  import('../components/landing/WhatsAppAutomation').then((m) => ({ default: m.WhatsAppAutomation }))
);
const LandingAudience = lazy(() =>
  import('../components/landing/LandingAudience').then((m) => ({ default: m.LandingAudience }))
);
const LandingSecurity = lazy(() =>
  import('../components/landing/LandingSecurity').then((m) => ({ default: m.LandingSecurity }))
);
const LandingFaq = lazy(() =>
  import('../components/landing/LandingFaq').then((m) => ({ default: m.LandingFaq }))
);

function LandingSectionFallback({ minHeight = '16rem' }: { minHeight?: string }) {
  return <div aria-hidden className="w-full" style={{ minHeight }} />;
}

/** Mesmo contato comercial do Login (`Login.tsx`) */
const WA_COMERCIAL = 'https://wa.me/5511912276156';
const CNPJ = '66.335.964/0001-07';

/** Menu enxuto — o resto das secções fica no scroll e no rodapé */
const nav = [
  { href: '#top', label: 'Início' },
  { href: ROUTES.founderProgram, label: 'Fundador' },
  { href: '#tour', label: 'Tour' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#mensalidade', label: 'Planos' },
  { href: '#faq', label: 'FAQ' },
] as const;

const premiumFeatures = [
  'Painel completo para zelador e diretoria',
  'Filhos de santo, calendário, mural e biblioteca',
  'Galeria de fotos, financeiro e loja do axé',
  'Mensalidade com Pix e histórico transparente',
  'Ativação do plano via PIX (EFI Bank)',
  'Liberação automática após o pagamento',
] as const;

function LogoMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-transparent',
        compact ? 'min-w-[176px]' : 'min-w-[214px]',
        className,
      )}
    >
      <div
        className={cn(
          'relative grid shrink-0 place-items-center rounded-full border border-[#c78b00] text-[#d9a11a] shadow-[0_0_18px_rgba(242,185,15,0.16)]',
          compact ? 'h-10 w-10' : 'h-12 w-12',
        )}
      >
        <span className="absolute inset-[6px] rounded-full border border-[#6c4a00]" />
        <span className="absolute h-px w-[82%] bg-[#9d6f05]" />
        <span className="absolute h-[82%] w-px bg-[#9d6f05]" />
        <span className="relative h-2 w-2 rounded-full bg-[#f2b90f] shadow-[0_0_12px_rgba(242,185,15,0.8)]" />
      </div>
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-[3px]">
          <span
            className={cn(
              'font-black uppercase tracking-[0.22em] text-white',
              compact ? 'text-[18px]' : 'text-2xl',
            )}
          >
            AX
          </span>
          <span className={cn('font-black text-[#f2b90f]', compact ? 'text-[18px]' : 'text-2xl')}>É</span>
          <span
            className={cn(
              'font-black uppercase tracking-[0.22em] text-white',
              compact ? 'text-[18px]' : 'text-2xl',
            )}
          >
            CLOUD
          </span>
        </div>
        <p
          className={cn(
            'mt-1 text-center font-black uppercase tracking-[0.28em] text-[#d99c0a]',
            compact ? 'text-[7px]' : 'text-[9px]',
          )}
        >
          Gestão Sagrada
        </p>
      </div>
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const LANDING_HEADER_OFFSET = '4.25rem';

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Voltar ao topo"
      className={cn(
        'fixed bottom-6 right-4 z-[80] grid h-12 w-12 touch-manipulation place-items-center rounded-full border border-primary/50 bg-primary text-black shadow-[0_0_28px_rgba(251,188,0,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 sm:bottom-8 sm:right-6',
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

export default function Landing() {
  const { premium: landingPrice } = usePlansCatalog({ defer: true });
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#050505]">
      <span id="top" className="sr-only" aria-hidden />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#2a2108] bg-[#050505]/95 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#050505]/90">
        <div className="landing-gutter-x grid h-[4.25rem] w-full grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4">
          <a href="#top" className="min-w-0 shrink-0" aria-label="AxéCloud — início">
            <LogoMark compact />
          </a>

          <nav
            className="hidden min-w-0 justify-center lg:flex"
            aria-label="Seções"
          >
            <ul className="flex max-w-full items-center justify-center gap-x-6 px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
              {nav.map((l) => (
                <li key={l.href} className="shrink-0">
                  <a href={l.href} className="whitespace-nowrap transition hover:text-primary">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
            <details className="relative z-[60] lg:hidden" id="landing-nav">
              <summary
                className="list-none cursor-pointer rounded-lg border border-white/10 p-2.5 text-zinc-300 transition hover:border-white/20 hover:text-white [&::-webkit-details-marker]:hidden"
              >
                <span className="sr-only">Abrir menu</span>
                <Menu className="h-5 w-5" aria-hidden />
              </summary>
              <div className="landing-nav-menu absolute right-0 top-full z-[70] mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl p-1.5">
                {nav.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="block rounded-lg px-3 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                    onClick={() => {
                      const el = document.getElementById('landing-nav');
                      if (el instanceof HTMLDetailsElement) el.open = false;
                    }}
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href={ROUTES.login}
                  className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                  onClick={() => {
                    const el = document.getElementById('landing-nav');
                    if (el instanceof HTMLDetailsElement) el.open = false;
                  }}
                >
                  Entrar
                </a>
                <a
                  href={ROUTES.register}
                  className="block rounded-lg px-3 py-2.5 text-sm font-black text-primary transition hover:bg-white/5"
                  onClick={() => {
                    const el = document.getElementById('landing-nav');
                    if (el instanceof HTMLDetailsElement) el.open = false;
                  }}
                >
                  Cadastrar
                </a>
              </div>
            </details>
            <a
              href={ROUTES.login}
              className="hidden items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-200 transition hover:border-primary/30 hover:text-white sm:inline-flex"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">Entrar</span>
            </a>
            <a
              href={ROUTES.register}
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-2.5 text-xs font-black text-black shadow-[0_0_30px_rgba(251,188,0,0.18)] transition hover:scale-[1.02] active:scale-[0.98] sm:px-4"
            >
              Cadastrar
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-[1]" style={{ paddingTop: LANDING_HEADER_OFFSET }}>
        <LandingHero />

        <LandingResources />

        <LandingFounderProgram />

        <LandingPortalPreview />

        <Suspense fallback={<LandingSectionFallback minHeight="28rem" />}>
          <SystemTour />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="20rem" />}>
          <ConnectedAccess />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="20rem" />}>
          <WhatsAppAutomation />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="18rem" />}>
          <LandingAudience />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="18rem" />}>
          <LandingSecurity />
        </Suspense>

        <LandingSection id="mensalidade" variant="highlight" aria-labelledby="mensalidade-head">
          <div className="landing-section-inner">
            <motion.div {...fade}>
              <LandingSectionHeader
                kicker="Mensalidade"
                title="Um valor. Todo o AxéCloud."
                titleId="mensalidade-head"
                lead={landingPrice.description}
              />
            </motion.div>
            <motion.div
              {...fade}
              transition={{ ...fade.transition, delay: 0.08 }}
              className="relative z-10 mx-auto mt-10 max-w-lg"
            >
              <div className="landing-pricing-card relative flex flex-col sm:p-8">
                <span className="relative z-10 mb-3 inline-flex w-max rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                  Plano Premium
                </span>
                <h3 className="relative z-10 text-lg font-bold text-white">Mensalidade do terreiro</h3>
                <p className="relative z-10 mt-1 text-sm text-zinc-500">
                  Ou participe do{' '}
                  <a href={ROUTES.founderProgram} className="font-bold text-primary hover:underline">
                    Programa Fundador
                  </a>{' '}
                  — 12 meses grátis
                </p>
                <div className="relative z-10 mt-6 flex items-baseline gap-2 text-white">
                  <span className="text-4xl font-black tracking-tight sm:text-5xl">{landingPrice.label}</span>
                  <span className="text-lg text-zinc-500">{landingPrice.period}</span>
                </div>
                <ul className="relative z-10 mt-6 space-y-2.5 text-left text-sm text-zinc-400" role="list">
                  {premiumFeatures.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                      {line}
                    </li>
                  ))}
                </ul>
                <a href={ROUTES.register} className="landing-btn-primary relative z-10 mt-8 w-full uppercase tracking-widest">
                  Cadastrar
                </a>
                <p className="relative z-10 mt-4 text-center text-[11px] text-zinc-600">
                  Dúvidas?{' '}
                  <a
                    href={WA_COMERCIAL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-primary hover:text-primary/85"
                  >
                    Fale com o comercial
                  </a>
                </p>
              </div>
            </motion.div>
          </div>
        </LandingSection>

        <Suspense fallback={<LandingSectionFallback minHeight="16rem" />}>
          <LandingFaq />
        </Suspense>

        <LandingSection aria-label="Fechamento">
          <div className="landing-section-inner max-w-3xl">
            <motion.div {...fade} className="landing-cta-band relative z-10">
              <p className="relative z-10 text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">
                Que o axé acompanhe
              </p>
              <p className="relative z-10 mt-3 text-lg text-zinc-300 sm:text-xl">
                Paz na casa, luz no caminho e a organização no que é sagrado. Saravá.
              </p>
              <div className="relative z-10 mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href={ROUTES.founderProgram} className="landing-btn-primary text-sm">
                  Programa Fundador
                </a>
                <a href={ROUTES.register} className="landing-btn-secondary text-sm">
                  Cadastrar com PIX
                </a>
                <a
                  href={WA_COMERCIAL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary transition hover:text-primary/85"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Falar com o comercial
                </a>
              </div>
            </motion.div>
          </div>
        </LandingSection>
      </main>

      <footer className="landing-footer relative z-[1] py-8 sm:py-10" role="contentinfo">
        <div className="landing-gutter-x flex w-full flex-col items-center justify-between gap-5 sm:flex-row sm:items-start">
          <div className="text-center sm:text-left">
            <LogoMark compact />
            <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600 sm:justify-start">
              <a href={ROUTES.founderProgram} className="transition hover:text-primary">
                Programa Fundador
              </a>
              <span aria-hidden>·</span>
              <a href={ROUTES.contentHub} className="transition hover:text-primary">
                Conteúdo
              </a>
              <span aria-hidden>·</span>
              <a href={ROUTES.login} className="transition hover:text-primary">
                Entrar
              </a>
              <span aria-hidden>·</span>
              <a href={ROUTES.register} className="transition hover:text-primary">
                Cadastrar
              </a>
              <span aria-hidden>·</span>
              <a href={ROUTES.terms} className="transition hover:text-primary">
                Termos
              </a>
              <span aria-hidden>·</span>
              <a href={ROUTES.privacy} className="transition hover:text-primary">
                Privacidade
              </a>
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              © {new Date().getFullYear()} AxéCloud — CNPJ: {CNPJ}
            </p>
          </div>
          <ul className="flex items-center gap-2" aria-label="Redes">
            {[
              { href: 'https://instagram.com', label: 'Instagram', Icon: Instagram },
              { href: 'https://facebook.com', label: 'Facebook', Icon: Facebook },
              { href: 'https://youtube.com', label: 'YouTube', Icon: Youtube },
            ].map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-zinc-500 transition hover:border-primary/30 hover:text-primary"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
}
