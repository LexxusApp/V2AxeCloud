import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUp, Check, MessageCircle } from 'lucide-react';
import { MatrizLandingExperience } from '../components/landing/MatrizLandingExperience';
import { WhatsAppAutomation } from '../components/landing/WhatsAppAutomation';
import { LandingStoryProof } from '../components/landing/LandingStoryProof';
import { LoginLink } from '../components/marketing/LoginLink';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';
import { landingBrandLogo } from '../constants/landingScreenshots';
import { COMMERCIAL_WHATSAPP_URL } from '../constants/commercialContact';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { trackConversionEvent } from '../lib/trackConversion';

const LandingFaq = lazy(() =>
  import('../components/landing/LandingFaq').then((m) => ({ default: m.LandingFaq }))
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

const CNPJ = '66.335.964/0001-07';

const premiumFeatures = [
  '14 módulos reais: painel, filhos, giras, financeiro, galeria e mais',
  'WhatsApp oficial Meta, loja do axé, almoxarifado e biblioteca',
  'Portal do filho de santo + portal público e diretório de casas',
  'App instalável (PWA) no celular — sem App Store ou Google Play',
  'Mensalidade com Pix e histórico transparente',
  `${TRIAL_DAYS} dias grátis para testar tudo`,
] as const;

function PricingSection({
  landingPrice,
}: {
  landingPrice: ReturnType<typeof usePlansCatalog>['premium'];
}) {
  return (
    <section id="mensalidade" className="relative z-[1] overflow-hidden bg-[#fdf8f0] py-20 font-display text-[#1b1813] md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-72 max-w-4xl rounded-full bg-[#ffc107]/15 blur-3xl" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 32, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
            Mensalidade
          </span>
          <h2 id="mensalidade-head" className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl">
            Um valor. Todo o AxéCloud.
          </h2>
          <p className="mt-4 text-[#1b1813]/60">{landingPrice.description}</p>
        </motion.div>

        <motion.div
          className="relative z-10 mx-auto mt-12 grid max-w-4xl overflow-hidden rounded-[2rem] border border-[#e8dfd0] bg-white shadow-xl shadow-[#ffc107]/10 md:grid-cols-[0.9fr_1.1fr]"
          initial={{ opacity: 0, y: 42, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col justify-between bg-[#0b0906] p-8 text-white sm:p-10">
            <div>
              <span className="inline-flex w-max rounded-full border border-[#ffc107]/35 bg-[#ffc107]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ffc107]">
                Plano Premium
              </span>
              <h3 className="mt-5 text-lg font-bold text-white/80">Mensalidade do terreiro</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-black tracking-tight text-[#ffc107]">{landingPrice.label}</span>
                <span className="text-lg text-white/50">{landingPrice.period}</span>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/70">
                Tudo incluso, sem taxa por filho de santo. Teste grátis por {TRIAL_DAYS} dias, depois mensalidade via PIX.
              </p>
            </div>
            <RegisterTrialLink className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#ffc107] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-[#1b1813] transition hover:bg-[#ffcd38]">
              Cadastrar, {TRIAL_DAYS} dias grátis
            </RegisterTrialLink>
          </div>

          <div className="bg-white p-8 sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1b1813]/62">O que está incluso</p>
            <ul className="mt-5 space-y-3.5 text-left text-sm text-[#1b1813]/75" role="list">
              {premiumFeatures.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#ffc107]/20">
                    <Check className="h-3.5 w-3.5 text-[#1b1813]" strokeWidth={2.5} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-7 border-t border-[#e8dfd0] pt-5 text-[11px] text-[#1b1813]/66">
              Dúvidas?{' '}
              <a
                href={COMMERCIAL_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackConversionEvent('cta_click', {
                  ctaId: 'pricing-commercial-whatsapp',
                  ctaLabel: 'Falar com o comercial',
                })}
                className="font-bold text-[#1b1813] hover:text-[#a87400]"
              >
                Fale com o comercial
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ClosingSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);

  return (
    <section ref={ref} id="cta" className="relative z-[1] px-5 pb-20 font-display text-[#1b1813] md:pb-28">
      <motion.div
        style={{ scale }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-[#e8dfd0] bg-[#0b0906] px-8 py-12 text-center shadow-2xl shadow-black/15 md:px-14 md:py-16"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#ffc107]/12 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#a87400]/10 blur-3xl"
          aria-hidden
        />

        <motion.div
          initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src="/ile-ase-logo.png"
            alt=""
            className="relative z-10 mx-auto h-12 brightness-0 invert opacity-90 md:h-14"
            aria-hidden
          />
          <h2 className="relative z-10 mt-6 text-3xl font-extrabold tracking-tight text-[#fdf8f0] md:text-4xl">
            Organize sua casa de axé com o AxéCloud
          </h2>
          <p className="relative z-10 mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#fdf8f0]/60">
            Teste o sistema real por {TRIAL_DAYS} dias, sem cartão. Financeiro, giras, portal do filho e memória da
            casa — tudo no mesmo lugar.
          </p>
          <div className="relative z-10 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <RegisterTrialLink className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ffc107] px-7 py-3.5 text-sm font-bold text-[#1b1813] shadow-md shadow-[#ffc107]/25 transition hover:bg-[#ffcd38] hover:shadow-lg sm:w-auto">
              Criar conta grátis
              <ArrowRight className="h-4 w-4" aria-hidden />
            </RegisterTrialLink>
            <a
              href={COMMERCIAL_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => void trackConversionEvent('cta_click', {
                ctaId: 'closing-commercial-whatsapp',
                ctaLabel: 'Falar com o comercial',
              })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#fdf8f0]/20 px-7 py-3.5 text-sm font-bold text-[#fdf8f0]/80 transition hover:border-[#ffc107]/50 hover:text-[#ffc107] sm:w-auto"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Falar com o comercial
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function MatrizFooter() {
  const portalLinks = [
    { href: ROUTES.terreiros, label: 'Terreiros' },
    { href: ROUTES.eventosPublicos, label: 'Eventos públicos' },
    { href: ROUTES.espacoDoFiel, label: 'Pedir reza' },
    { href: ROUTES.liturgicalCalendar, label: 'Calendário litúrgico' },
  ];
  const platformLinks = [
    { href: `${ROUTES.home}#recursos`, label: 'Módulos' },
    { href: `${ROUTES.home}#mensalidade`, label: 'Planos' },
    { href: ROUTES.whyAxeCloud, label: 'Por que AxéCloud' },
    { href: ROUTES.register, label: 'Teste grátis', trial: true as const },
  ];
  const accountLinks = [
    { href: ROUTES.login, label: 'Entrar', login: true as const },
    { href: ROUTES.register, label: 'Cadastrar terreiro', trial: true as const },
    { href: ROUTES.contentHub, label: 'Conteúdo' },
    { href: ROUTES.glossary, label: 'Glossário do axé' },
  ];

  return (
    <footer className="relative z-[1] border-t border-[#e8dfd0] bg-white py-12 font-display text-[#1b1813]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <a href={ROUTES.home} className="inline-flex items-center gap-2.5" aria-label="AxéCloud — início">
            <img
              src={landingBrandLogo()}
              alt=""
              className="h-11 w-11 shrink-0 object-contain"
              aria-hidden
            />
            <span className="leading-tight">
              <span className="block text-sm font-black tracking-tight text-[#1b1813]">AxéCloud</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#a87400]">
                Gestão de terreiros
              </span>
            </span>
          </a>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#1b1813]/55">
            Portal e software para terreiros de Umbanda, Candomblé e Jurema, com gestão da casa,
            eventos públicos, pedidos de reza e portal do filho de santo.
          </p>
          <p className="mt-5 text-xs font-semibold text-[#1b1813]/35">CNPJ {CNPJ}</p>
        </div>

        {[
          ['Portal', portalLinks],
          ['Plataforma', platformLinks],
          ['Conta', accountLinks],
        ].map(([title, links]) => (
          <div key={title as string}>
            <h6 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#a87400]">{title as string}</h6>
            <ul className="space-y-2 text-sm">
              {(links as Array<{ href: string; label: string; trial?: true; login?: true }>).map((link) => (
                <li key={link.label}>
                  {link.trial ? (
                    <RegisterTrialLink className="text-[#1b1813]/55 transition hover:text-[#a87400]">
                      {link.label}
                    </RegisterTrialLink>
                  ) : link.login ? (
                    <LoginLink className="text-[#1b1813]/55 transition hover:text-[#a87400]">
                      {link.label}
                    </LoginLink>
                  ) : (
                    <a href={link.href} className="text-[#1b1813]/55 transition hover:text-[#a87400]">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

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

export default function Landing() {
  const { premium: landingPrice } = usePlansCatalog({ defer: true });

  return (
    <>
      <span id="top" className="sr-only" aria-hidden />

      <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] text-[#1b1813]">

      <main className="relative z-[1] animate-fadeIn selection:bg-[#1E293B] selection:text-white">
        <MatrizLandingExperience />

        <LandingStoryProof />

        <WhatsAppAutomation />

        <PricingSection landingPrice={landingPrice} />

        <Suspense fallback={<LandingSectionFallback minHeight="16rem" />}>
          <LandingFaq />
        </Suspense>

      </main>

      <MatrizFooter />

      <ScrollToTopButton />
    </div>
    </>
  );
}
