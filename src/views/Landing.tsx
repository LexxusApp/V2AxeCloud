import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  ArrowUp,
  Check,
  Instagram,
  MessageCircle,
} from 'lucide-react';
import { TikTokIcon } from '../components/icons/TikTokIcon';
import { LandingTopNav, LogoMark } from '../components/marketing/MarketingTopNav';
import { SOCIAL_LINKS } from '../constants/socialLinks';
import { cn } from '../lib/utils';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { usePlansCatalog } from '../hooks/usePlansCatalog';
import { LandingHero } from '../components/landing/LandingHero';
import { LandingReveal } from '../components/landing/LandingReveal';
import { LandingSection, LandingSectionHeader } from '../components/landing/LandingSection';

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

function LandingSectionFallback({ minHeight = '16rem' }: { minHeight?: string }) {
  return <div aria-hidden className="w-full" style={{ minHeight }} />;
}

const WA_COMERCIAL = 'https://wa.me/5511912276156';
const CNPJ = '66.335.964/0001-07';

const premiumFeatures = [
  'Painel completo para zelador e diretoria',
  'Filhos de santo, calendário, mural e biblioteca',
  'Galeria de fotos, financeiro e loja do axé',
  'Mensalidade com Pix e histórico transparente',
  'Ativação do plano via PIX (EFI Bank)',
  'Liberação automática após o pagamento',
] as const;

const LANDING_HEADER_OFFSET = '4rem';

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
        'fixed bottom-6 right-4 z-[80] grid h-12 w-12 touch-manipulation place-items-center rounded-full border border-primary/50 bg-primary text-[#080A0D] shadow-[0_0_28px_rgba(250,204,21,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 sm:bottom-8 sm:right-6',
        visible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

export default function Landing() {
  const { premium: landingPrice } = usePlansCatalog({ defer: true });

  useEffect(() => {
    document.getElementById('axecloud-seo-static')?.remove();
    document.getElementById('axecloud-boot')?.remove();
  }, []);

  return (
    <div className="landing-v3 axecloud-landing-enter relative min-h-dvh overflow-x-hidden bg-[#080A0D] text-[#F1F5F9]">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 -z-10 h-[650px] bg-gradient-to-b from-[#0D0F12] to-[#080A0D]"
        aria-hidden
      />

      <span id="top" className="sr-only" aria-hidden />

      <LandingTopNav />

      <main className="relative z-[1] selection:bg-[#1E293B] selection:text-white" style={{ paddingTop: 0 }}>
        <LandingHero />

        <Suspense fallback={<LandingSectionFallback minHeight="18rem" />}>
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
          <div className="landing-section-inner mx-auto max-w-7xl">
            <LandingReveal>
              <LandingSectionHeader
                kicker="Mensalidade"
                title="Um valor. Todo o AxéCloud."
                titleId="mensalidade-head"
                lead={landingPrice.description}
              />
            </LandingReveal>
            <LandingReveal delayMs={80} className="relative z-10 mx-auto mt-10 max-w-lg">
              <div className="landing-v3-card landing-pricing-card relative flex flex-col p-6 sm:p-8">
                <span className="relative z-10 mb-3 inline-flex w-max rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Plano Premium
                </span>
                <h3 className="relative z-10 text-lg font-bold text-[#F1F5F9]">Mensalidade do terreiro</h3>
                <p className="relative z-10 mt-1 text-sm text-[#94A3B8]">
                  Ou participe do{' '}
                  <a href={ROUTES.founderProgram} className="font-bold text-primary hover:underline">
                    Programa Fundador
                  </a>{' '}
                  — 12 meses grátis
                </p>
                <div className="relative z-10 mt-6 flex items-baseline gap-2 text-[#F1F5F9]">
                  <span className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                    {landingPrice.label}
                  </span>
                  <span className="text-lg text-[#94A3B8]">{landingPrice.period}</span>
                </div>
                <ul className="relative z-10 mt-6 space-y-2.5 text-left text-sm text-[#94A3B8]" role="list">
                  {premiumFeatures.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                      {line}
                    </li>
                  ))}
                </ul>
                <a href={appHref(ROUTES.register)} className="landing-btn-primary relative z-10 mt-8 w-full uppercase tracking-widest">
                  Cadastrar
                </a>
                <p className="relative z-10 mt-4 text-center text-[11px] text-[#64748B]">
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
            </LandingReveal>
          </div>
        </LandingSection>

        <Suspense fallback={<LandingSectionFallback minHeight="16rem" />}>
          <LandingFaq />
        </Suspense>

        <LandingSection aria-label="Fechamento">
          <div className="landing-section-inner mx-auto max-w-7xl">
            <LandingReveal className="landing-v3-cta relative z-10 mx-auto max-w-3xl overflow-hidden rounded-[2.5rem] border border-primary/30 p-8 text-center md:p-12">
              <p className="relative z-10 text-xs font-bold uppercase tracking-[0.2em] text-primary">Que o axé acompanhe</p>
              <p className="relative z-10 mt-3 font-display text-2xl font-black text-[#F1F5F9] md:text-3xl">
                Paz na casa, luz no caminho e organização no que é sagrado
              </p>
              <p className="relative z-10 mx-auto mt-3 max-w-lg text-sm font-light text-[#94A3B8]">
                Leve transparência financeira, portal do filho de santo e memória da casa para o seu terreiro.
              </p>
              <div className="relative z-10 mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href={ROUTES.founderProgram} className="landing-btn-primary text-sm">
                  Programa Fundador
                </a>
                <a href={appHref(ROUTES.register)} className="landing-btn-secondary text-sm">
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
            </LandingReveal>
          </div>
        </LandingSection>
      </main>

      <footer className="relative z-[1] border-t border-[#13171D] bg-[#07090C] py-16 text-[#94A3B8]" role="contentinfo">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:px-8">
          <div className="space-y-4">
            <LogoMark compact />
            <p className="text-xs leading-relaxed">
              Gestão inteligente e segura para terreiros de Umbanda, Candomblé e Jurema no Brasil.
            </p>
            <ul className="flex items-center gap-2" aria-label="Redes sociais oficiais">
              {SOCIAL_LINKS.map(({ id, href, label, rel }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel={rel}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[#1E242B] text-[#94A3B8] transition hover:border-primary/30 hover:text-primary"
                    aria-label={`${label} @axecloudoficial`}
                  >
                    {id === 'instagram' ? <Instagram className="h-4 w-4" /> : <TikTokIcon className="h-4 w-4" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Plataforma</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#recursos" className="hover:text-[#F1F5F9]">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#demonstracao" className="hover:text-[#F1F5F9]">
                  Demo interativa
                </a>
              </li>
              <li>
                <a href={ROUTES.founderProgram} className="hover:text-[#F1F5F9]">
                  Programa Fundador
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Conta</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href={appHref(ROUTES.login)} className="hover:text-[#F1F5F9]">
                  Entrar
                </a>
              </li>
              <li>
                <a href={appHref(ROUTES.register)} className="hover:text-[#F1F5F9]">
                  Cadastrar
                </a>
              </li>
              <li>
                <a href={ROUTES.contentHub} className="hover:text-[#F1F5F9]">
                  Conteúdo
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Segurança</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#seguranca" className="hover:text-[#F1F5F9]">
                  Privacidade de Dados LGPD
                </a>
              </li>
              <li>
                <a href="#seguranca" className="hover:text-[#F1F5F9]">
                  Protocolo Religioso de Criptografia
                </a>
              </li>
              <li>
                <a href="#seguranca" className="hover:text-[#F1F5F9]">
                  Backup em Nuvem Redundante
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">Legal</h6>
            <ul className="space-y-2 text-xs">
              <li>
                <a href={ROUTES.terms} className="hover:text-[#F1F5F9]">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href={ROUTES.privacy} className="hover:text-[#F1F5F9]">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-[#13171D] px-4 pt-6 text-center text-xs sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} AxéCloud — CNPJ: {CNPJ}</p>
          <p className="italic">Axé — com respeito às tradições de matriz africana.</p>
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
}
