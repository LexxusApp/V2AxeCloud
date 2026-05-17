import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  Coins,
  Facebook,
  Instagram,
  LogIn,
  MessageCircle,
  Menu,
  Image as ImageIcon,
  ShieldCheck,
  Wallet,
  Warehouse,
  Youtube,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ROUTES } from '../lib/routes';
import { LANDING_PRICE } from '../constants/landingFeatures';
import { LANDING_HERO_IMAGE } from '../constants/landingBackground';
import { AuthScreenBackground } from '../components/AuthScreenBackground';
import { SystemTour } from '../components/landing/SystemTour';
import { LandingAudience } from '../components/landing/LandingAudience';
import { LandingSecurity } from '../components/landing/LandingSecurity';
import { LandingFaq } from '../components/landing/LandingFaq';

/** Mesmo contato comercial do Login (`Login.tsx`) */
const WA_COMERCIAL = 'https://wa.me/5511912276156';
const CNPJ = '66.335.964/0001-07';

const nav = [
  { href: '#tour', label: 'Tour' },
  { href: '#funcionalidades', label: 'Módulos' },
  { href: '#para-quem', label: 'Para quem' },
  { href: '#mensalidade', label: 'Mensalidade' },
  { href: '#faq', label: 'FAQ' },
] as const;

const features = [
  {
    icon: ImageIcon,
    title: 'Galeria de fotos',
    description:
      'Álbuns com fotos e vídeos da casa: giras, momentos da comunidade e memória do terreiro reunidos num só lugar.',
  },
  {
    icon: Wallet,
    title: 'Financeiro transparente',
    description:
      'Mensalidades e doações com Pix, histórico e leitura clara para a diretoria. Menos dúvida, mais confiança.',
  },
  {
    icon: BookOpen,
    title: 'Portal do filho de santo',
    description:
      'Biblioteca de estudos, mural e acesso ao que importa. Calendário e presença nas giras, no mesmo fluxo do app.',
    extra: (
      <p className="mt-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary/90">
        <CalendarDays className="h-4 w-4 text-primary" />
        Agenda e giras integradas
      </p>
    ),
  },
] as const;

const premiumFeatures = [
  'Painel completo para zelador e diretoria',
  'Filhos de santo, calendário, mural e biblioteca',
  'Galeria de fotos, financeiro e loja do axé',
  'Mensalidade com Pix e histórico transparente',
  'Assinatura recorrente por cartão (EFI Bank)',
  'Liberação automática após o pagamento',
] as const;

function LogoMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-baseline gap-0.5">
        <span className={cn('font-black tracking-tighter text-white', compact ? 'text-2xl' : 'text-3xl sm:text-4xl')}>
          AX
        </span>
        <span className={cn('text-primary font-black', compact ? 'text-2xl' : 'text-3xl sm:text-4xl')}>É</span>
      </div>
      <span
        className={cn(
          'font-black text-white/55 tracking-[0.28em] -mt-0.5',
          compact ? 'text-base ml-0.5' : 'text-lg sm:text-xl ml-1',
        )}
      >
        CLOUD
      </span>
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
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <span id="top" className="sr-only" aria-hidden />
      <AuthScreenBackground fixed className="-z-20" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <a href="#top" className="shrink-0" aria-label="AxéCloud — início">
              <LogoMark compact />
            </a>
            <nav
              className="hidden items-center gap-7 text-[11px] font-black uppercase tracking-widest text-zinc-500 md:flex"
              aria-label="Seções"
            >
              {nav.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="transition hover:text-primary"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1.5">
              <details className="relative z-[60] md:hidden" id="landing-nav">
                <summary
                  className="list-none cursor-pointer rounded-lg border border-white/10 p-2.5 text-zinc-300 transition hover:border-white/20 hover:text-white [&::-webkit-details-marker]:hidden"
                >
                  <span className="sr-only">Menu</span>
                  <Menu className="h-5 w-5" />
                </summary>
                <div className="landing-glass absolute right-0 mt-2 w-56 overflow-hidden rounded-xl p-1.5">
                  {nav.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="block rounded-lg px-3 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                      onClick={() => document.getElementById('landing-nav')?.removeAttribute('open')}
                    >
                      {l.label}
                    </a>
                  ))}
                  <a
                    href={ROUTES.login}
                    className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
                  >
                    Entrar
                  </a>
                  <a
                    href={ROUTES.register}
                    className="block rounded-lg px-3 py-2.5 text-sm font-black text-primary transition hover:bg-white/5"
                  >
                    Cadastrar
                  </a>
                </div>
              </details>
              <a
                href={ROUTES.login}
                className="hidden items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-200 transition hover:border-primary/30 hover:text-white sm:inline-flex"
              >
                <LogIn className="h-4 w-4" />
                Entrar
              </a>
              <a
                href={ROUTES.register}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2.5 text-xs font-black text-black shadow-[0_0_30px_rgba(251,188,0,0.18)] transition hover:scale-[1.02] active:scale-[0.98] sm:px-4"
              >
                Cadastrar
              </a>
            </div>
        </div>
      </header>

      <main style={{ paddingTop: LANDING_HEADER_OFFSET }}>
        <section
          className="relative -mx-4 flex min-h-[min(90vh,52rem)] items-center justify-center overflow-hidden bg-gradient-to-b from-black/80 via-black/50 to-neutral-950 px-4 pb-16 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          aria-labelledby="hero-title"
        >
          <div
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-25 mix-blend-luminosity"
            style={{ backgroundImage: `url('${LANDING_HERO_IMAGE}')` }}
            aria-hidden
          />
          <div
            className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,10,10,0.9)_70%)]"
            aria-hidden
          />

          <div className="container relative z-10 mx-auto max-w-5xl px-0 text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium tracking-wide text-primary"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              O primeiro software de gestão feito para Comunidades de Axé
            </motion.div>

            <h1
              id="hero-title"
              className="mx-auto mb-6 max-w-4xl text-4xl leading-tight font-extrabold tracking-tight text-white md:text-6xl"
            >
              Tecnologia a serviço do{' '}
              <span className="bg-gradient-to-r from-primary via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                sagrado.
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-neutral-400 md:text-xl">
              Transforme a organização do seu terreiro. Controle mensalidades, organize o almoxarifado de guias e
              velas, e aproxime os filhos de santo com segurança e respeito à tradição.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <a
                href={ROUTES.register}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-yellow-400 px-8 py-4 text-base font-bold text-black shadow-lg shadow-primary/10 transition-all duration-200 hover:from-amber-500 hover:to-yellow-500 hover:shadow-primary/20 sm:w-auto"
              >
                Cadastrar meu terreiro
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </a>
              <a
                href="#funcionalidades"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-8 py-4 text-center text-base font-medium text-white transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-800 sm:w-auto"
              >
                Conhecer o sistema
              </a>
            </motion.div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 text-left md:grid-cols-3">
              {[
                {
                  icon: Warehouse,
                  title: 'Almoxarifado Inteligente',
                  desc: 'Estoque de velas, ervas e saídas de materiais de chão sem planilhas.',
                  delay: 0.12,
                },
                {
                  icon: Coins,
                  title: 'Financeiro Transparente',
                  desc: 'Histórico claro de mensalidades de filhos de santo e arrecadações Pix.',
                  delay: 0.16,
                },
                {
                  icon: BookOpen,
                  title: 'Portal do Filho de Santo',
                  desc: 'Mural de avisos virtuais, chamadas de giras e biblioteca de estudos integrada.',
                  delay: 0.2,
                },
              ].map((card) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: card.delay }}
                  className="flex items-start gap-3 rounded-xl border border-neutral-900 bg-neutral-900/40 p-4 backdrop-blur-sm"
                >
                  <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                    <card.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </div>
                  <div>
                    <h3 className="mb-0.5 text-sm font-semibold text-white">{card.title}</h3>
                    <p className="text-xs leading-relaxed text-neutral-500">{card.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <SystemTour />

        <section
          id="funcionalidades"
          className="relative border-t border-white/5 py-16 sm:py-24"
          aria-labelledby="feat-head"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div {...fade} className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">Dentro do app</p>
              <h2 id="feat-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                Tudo o que a casa gira, organizado
              </h2>
              <p className="mt-3 text-sm text-neutral-400 sm:text-base">
                Mesma linguagem do app real: módulos que a diretoria já conhece ao abrir o painel.
              </p>
            </motion.div>
            <ul className="mt-10 grid list-none gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" role="list">
              {features.map((f, i) => (
                <motion.li
                  key={f.title}
                  {...fade}
                  transition={{ ...fade.transition, delay: 0.06 * i }}
                >
                  <div className="landing-mystic-card h-full p-6 sm:p-7">
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <f.icon className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-bold text-white">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{f.description}</p>
                    {'extra' in f && f.extra}
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        <LandingAudience />

        <LandingSecurity />

        <section
          id="mensalidade"
          className="relative border-t border-white/5 py-16 sm:py-20"
          aria-labelledby="mensalidade-head"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div {...fade} className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">Mensalidade</p>
              <h2 id="mensalidade-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
                Um valor. Todo o AxéCloud.
              </h2>
              <p className="mt-2 text-sm text-zinc-500 sm:text-base">{LANDING_PRICE.description}</p>
            </motion.div>
            <motion.div
              {...fade}
              transition={{ ...fade.transition, delay: 0.08 }}
              className="mx-auto mt-10 max-w-lg"
            >
              <motion.div className="relative flex flex-col rounded-2xl border border-primary/50 bg-gradient-to-b from-elevated to-card p-6 shadow-[0_0_0_1px_rgba(250,204,21,0.2),0_20px_50px_-20px_rgba(0,0,0,0.9)] sm:p-8">
                <span className="mb-3 inline-flex w-max rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                  Plano Premium
                </span>
                <h3 className="text-lg font-bold text-white">Mensalidade do terreiro</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Cadastro online · Pix na hora ou cartão recorrente
                </p>
                <div className="mt-6 flex items-baseline gap-2 text-white">
                  <span className="text-4xl font-black tracking-tight sm:text-5xl">{LANDING_PRICE.label}</span>
                  <span className="text-lg text-zinc-500">{LANDING_PRICE.period}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-left text-sm text-zinc-400" role="list">
                  {premiumFeatures.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                      {line}
                    </li>
                  ))}
                </ul>
                <a
                  href={ROUTES.register}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-primary py-3.5 text-xs font-black uppercase tracking-widest text-black shadow-[0_0_24px_rgba(251,188,0,0.2)] transition hover:scale-[1.02]"
                >
                  Cadastrar e pagar
                </a>
                <p className="mt-4 text-center text-[11px] text-zinc-600">
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
              </motion.div>
            </motion.div>
          </div>
        </section>

        <LandingFaq />

        <section
          className="relative border-t border-white/5 py-12 sm:py-14"
          aria-label="Fechamento"
        >
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">Que o axé acompanhe</p>
            <p className="mt-3 text-lg text-zinc-300 sm:text-xl">
              Paz na casa, luz no caminho e a organização no que é sagrado. Saravá.
            </p>
            <motion.div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={ROUTES.register}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-black text-black"
              >
                Cadastrar terreiro
              </a>
              <a
                href={WA_COMERCIAL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-primary transition hover:text-primary/85"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com o comercial
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <footer
        className="relative border-t border-white/5 py-8 sm:py-10"
        role="contentinfo"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 sm:flex-row sm:px-6 sm:items-start">
          <div className="text-center sm:text-left">
            <LogoMark compact />
            <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600 sm:justify-start">
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
