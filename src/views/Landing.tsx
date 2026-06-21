import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowUp, Check, MessageCircle } from 'lucide-react';
import { MarketingMockupFooter } from '../components/marketing/MarketingMockupFooter';
import { PortalHomeHub } from '../components/landing/PortalHomeHub';
import { LandingReveal } from '../components/landing/LandingReveal';
import { LandingSection, LandingSectionHeader } from '../components/landing/LandingSection';
import { appHref } from '../lib/appHref';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { landingMockupShellClass } from '../components/landing/landingMockupUi';
import { LandingMockupSideRails } from '../components/landing/LandingMockupSideRails';

const LandingPhilosophy = lazy(() =>
  import('../components/landing/LandingPhilosophy').then((m) => ({ default: m.LandingPhilosophy }))
);
const LandingResources = lazy(() =>
  import('../components/landing/LandingResources').then((m) => ({ default: m.LandingResources }))
);
const LandingFounderProgram = lazy(() =>
  import('../components/landing/LandingFounderProgram').then((m) => ({ default: m.LandingFounderProgram }))
);
const LandingPortalPreview = lazy(() =>
  import('../components/landing/LandingPortalPreview').then((m) => ({ default: m.LandingPortalPreview }))
);
const LandingInteractiveDemo = lazy(() =>
  import('../components/landing/LandingInteractiveDemo').then((m) => ({
    default: m.LandingInteractiveDemo,
  }))
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
const LandingTestimonials = lazy(() =>
  import('../components/landing/LandingTestimonials').then((m) => ({ default: m.LandingTestimonials }))
);
const LandingBeforeAfter = lazy(() =>
  import('../components/landing/LandingBeforeAfter').then((m) => ({ default: m.LandingBeforeAfter }))
);

function LandingSectionFallback({
  minHeight = '16rem',
  className,
}: {
  minHeight?: string;
  className?: string;
}) {
  return <div aria-hidden className={cn('w-full', className)} style={{ minHeight }} />;
}

const WA_COMERCIAL = 'https://wa.me/5511912276156';

const premiumFeatures = [
  'Painel completo para zelador e diretoria',
  'Filhos de santo, calendário, mural e biblioteca',
  'Galeria de fotos, financeiro e loja do axé',
  'Mensalidade com Pix e histórico transparente',
  'Ativação do plano via PIX (EFI Bank)',
  'Liberação automática após o pagamento',
] as const;

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
        'fixed bottom-6 right-4 z-[80] grid h-12 w-12 touch-manipulation place-items-center rounded-full bg-[#FFC107] text-[#1b1813] shadow-lg shadow-[#FFC107]/30 transition-opacity duration-300 hover:bg-[#ffcd38] sm:bottom-8 sm:right-6',
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

function LandingSoftwareDivider() {
  return (
    <section className="landing-mockup-divider border-y border-[#e8dfd0] bg-[#fdf8f0] py-10" aria-label="Transição para o software">
      <div className={landingMockupShellClass}>
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#e8dfd0]" aria-hidden />
          <p className="relative bg-[#fdf8f0] px-4 text-center text-[10px] font-black uppercase tracking-[0.22em] text-[#1b1813]/62 sm:text-xs">
            Software de gestão para o seu terreiro
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { premium: landingPrice } = usePlansCatalog({ defer: true });

  return (
    <>
      <span id="top" className="sr-only" aria-hidden />

      <LandingMockupSideRails />

      <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] text-[#1b1813]">

      <main className="relative z-[1] animate-fadeIn selection:bg-[#1E293B] selection:text-white">
        <PortalHomeHub />

        <LandingSoftwareDivider />

        <Suspense
          fallback={
            <LandingSectionFallback
              minHeight="44rem"
              className="landing-section landing-section--alt"
            />
          }
        >
          <LandingPhilosophy />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="18rem" />}>
          <LandingResources />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="32rem" />}>
          <LandingInteractiveDemo />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="20rem" />}>
          <LandingBeforeAfter />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="20rem" />}>
          <LandingFounderProgram />
        </Suspense>

        <Suspense fallback={<LandingSectionFallback minHeight="24rem" />}>
          <LandingPortalPreview />
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

        <Suspense fallback={<LandingSectionFallback minHeight="22rem" />}>
          <LandingTestimonials />
        </Suspense>

        <LandingSection id="mensalidade" variant="alt" aria-labelledby="mensalidade-head">
          <div className="landing-section-inner mx-auto">
            <LandingReveal>
              <LandingSectionHeader
                kicker="Mensalidade"
                title="Um valor. Todo o Ilê Asé."
                titleId="mensalidade-head"
                lead={landingPrice.description}
              />
            </LandingReveal>
            <LandingReveal delayMs={80} className="relative z-10 mx-auto mt-12 max-w-4xl">
              <div className="landing-mockup-card grid overflow-hidden md:grid-cols-[0.9fr_1.1fr]">
                <div className="flex flex-col justify-between bg-black p-8 text-white sm:p-10">
                  <div>
                    <span className="landing-mockup-kicker inline-flex w-max">
                  Plano Premium
                </span>
                    <h3 className="mt-5 text-lg font-bold text-white/80">Mensalidade do terreiro</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-5xl font-black tracking-tight text-[#FFC107]">{landingPrice.label}</span>
                      <span className="text-lg text-white/50">{landingPrice.period}</span>
                    </div>
                    <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/70">
                      Tudo incluso, sem taxa por filho de santo. Ou comece pelo{' '}
                      <a href={ROUTES.founderProgram} className="font-bold text-[#FFC107] underline decoration-[#FFC107]/50 underline-offset-2">
                        Programa Fundador
                      </a>{' '}
                      — 12 meses grátis.
                    </p>
                  </div>
                  <a
                    href={appHref(ROUTES.register)}
                    className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#FFC107] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#1b1813] transition hover:bg-[#ffcd38]"
                  >
                    Cadastrar
                  </a>
                </div>

                <div className="bg-white p-8 sm:p-10">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1b1813]/62">O que está incluso</p>
                  <ul className="mt-5 space-y-3.5 text-left text-sm text-[#1b1813]/75" role="list">
                  {premiumFeatures.map((line) => (
                      <li key={line} className="flex gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FFC107]/20">
                          <Check className="h-3.5 w-3.5 text-[#1b1813]" strokeWidth={2.5} />
                        </span>
                      {line}
                    </li>
                  ))}
                </ul>
                  <p className="mt-7 border-t border-[#e8dfd0] pt-5 text-[11px] text-[#1b1813]/66">
                  Dúvidas?{' '}
                  <a
                    href={WA_COMERCIAL}
                    target="_blank"
                    rel="noreferrer"
                      className="font-bold text-[#1b1813] hover:text-[#FFC107]"
                  >
                    Fale com o comercial
                  </a>
                </p>
                </div>
              </div>
            </LandingReveal>
          </div>
        </LandingSection>

        <Suspense fallback={<LandingSectionFallback minHeight="16rem" />}>
          <LandingFaq />
        </Suspense>

        <LandingSection aria-label="Fechamento">
          <div className="landing-section-inner mx-auto">
            <LandingReveal className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-black p-10 text-center md:rounded-[2.25rem] md:p-16">
              <p className="relative z-10 text-xs font-black uppercase tracking-[0.2em] text-[#FFC107]">Que o axé acompanhe</p>
              <p className="relative z-10 mx-auto mt-4 max-w-2xl font-display text-3xl font-black leading-tight text-white md:text-4xl">
                Paz na casa, luz no caminho e organização no que é sagrado
              </p>
              <p className="relative z-10 mx-auto mt-4 max-w-lg text-base text-white/70">
                Leve transparência financeira, portal do filho de santo e memória da casa para o seu terreiro.
              </p>
              <div className="relative z-10 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={ROUTES.founderProgram}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#FFC107] px-6 py-3.5 text-sm font-black text-[#1b1813] transition hover:bg-[#ffcd38] sm:w-auto"
                >
                  Programa Fundador
                </a>
                <a
                  href={appHref(ROUTES.register)}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  Cadastrar com PIX
              </a>
              <a
                href={WA_COMERCIAL}
                target="_blank"
                rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm font-bold text-white/80 transition hover:text-[#FFC107]"
              >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                Falar com o comercial
              </a>
              </div>
            </LandingReveal>
          </div>
        </LandingSection>
      </main>

      <MarketingMockupFooter />

      <ScrollToTopButton />
    </div>
    </>
  );
}
