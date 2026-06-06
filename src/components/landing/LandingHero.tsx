import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ImageIcon,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { HOME_SEO } from '../../constants/seoHome';
import { ROUTES } from '../../lib/routes';
import { AuthScreenBackground } from '../AuthScreenBackground';
import { cn } from '../../lib/utils';

const HERO_SCREENSHOT = '/screenshots/painel-inicio.png';

const ROTATE_MS = 4500;

type HeroFeatureCard = {
  id: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  desc: string;
  accent: 'primary' | 'emerald' | 'sky' | 'violet';
  slot: 'top' | 'bottom';
};

type HeroFeaturePair = [HeroFeatureCard, HeroFeatureCard];

const HERO_FEATURE_PAIRS: HeroFeaturePair[] = [
  [
    {
      id: 'financeiro',
      icon: TrendingUp,
      tag: 'Financeiro',
      title: 'Mensalidades claras',
      desc: 'Pix e histórico para a diretoria',
      accent: 'primary',
      slot: 'top',
    },
    {
      id: 'giras',
      icon: CalendarDays,
      tag: 'Giras',
      title: 'Agenda da casa',
      desc: 'Filhos e zelador no mesmo fluxo',
      accent: 'emerald',
      slot: 'bottom',
    },
  ],
  [
    {
      id: 'filhos',
      icon: Users,
      tag: 'Filhos de santo',
      title: 'Cadastro da casa',
      desc: 'Pessoas, contatos e rotina organizados',
      accent: 'sky',
      slot: 'top',
    },
    {
      id: 'mural',
      icon: Megaphone,
      tag: 'Mural',
      title: 'Avisos da diretoria',
      desc: 'Comunicados visíveis para a comunidade',
      accent: 'violet',
      slot: 'bottom',
    },
  ],
  [
    {
      id: 'galeria',
      icon: ImageIcon,
      tag: 'Galeria',
      title: 'Memória do terreiro',
      desc: 'Fotos e momentos da casa num só lugar',
      accent: 'primary',
      slot: 'top',
    },
    {
      id: 'biblioteca',
      icon: BookOpen,
      tag: 'Biblioteca',
      title: 'Estudos e textos',
      desc: 'Conteúdo sagrado acessível aos filhos',
      accent: 'emerald',
      slot: 'bottom',
    },
  ],
  [
    {
      id: 'portal',
      icon: UserCircle,
      tag: 'Portal do filho',
      title: 'Área da comunidade',
      desc: 'Extrato, giras e avisos no celular',
      accent: 'sky',
      slot: 'top',
    },
    {
      id: 'whatsapp',
      icon: MessageCircle,
      tag: 'WhatsApp',
      title: 'Avisos automáticos',
      desc: 'Lembretes de gira e mensalidade',
      accent: 'emerald',
      slot: 'bottom',
    },
  ],
  [
    {
      id: 'albums',
      icon: ImageIcon,
      tag: 'Galeria',
      title: 'Álbuns por gira',
      desc: 'Fotos organizadas por festa e evento',
      accent: 'violet',
      slot: 'top',
    },
    {
      id: 'loja',
      icon: ShoppingBag,
      tag: 'Loja do axé',
      title: 'Vendas da casa',
      desc: 'Artigos e contribuições integrados',
      accent: 'primary',
      slot: 'bottom',
    },
  ],
  [
    {
      id: 'pix',
      icon: Wallet,
      tag: 'Pix integrado',
      title: 'Cobrança transparente',
      desc: 'EFI Bank com confirmação automática',
      accent: 'primary',
      slot: 'top',
    },
    {
      id: 'seguranca',
      icon: ShieldCheck,
      tag: 'Dados protegidos',
      title: 'Sigilo da casa',
      desc: 'Criptografia e respeito à privacidade',
      accent: 'emerald',
      slot: 'bottom',
    },
  ],
];

const accentStyles = {
  primary: {
    tag: 'text-primary',
    border: 'border-primary/25',
  },
  emerald: {
    tag: 'text-emerald-400/90',
    border: 'border-emerald-500/20',
  },
  sky: {
    tag: 'text-sky-400/90',
    border: 'border-sky-500/20',
  },
  violet: {
    tag: 'text-violet-400/90',
    border: 'border-violet-500/20',
  },
} as const;

function HeroFeatureFloatingCards() {
  const [pairIndex, setPairIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPairIndex((i) => (i + 1) % HERO_FEATURE_PAIRS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const pair = HERO_FEATURE_PAIRS[pairIndex];

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={pairIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {pair.map((card, i) => {
            const Icon = card.icon;
            const accent = accentStyles[card.accent];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, x: card.slot === 'top' ? -16 : 16, y: 8 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'absolute rounded-xl border bg-neutral-950/90 px-2.5 py-2 sm:px-3 sm:py-2.5',
                  'shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md',
                  accent.border,
                  card.slot === 'top'
                    ? 'left-0 top-[12%] max-w-[10.25rem] sm:-left-6 sm:top-[18%] sm:max-w-[12rem]'
                    : 'right-0 bottom-[16%] max-w-[9.75rem] sm:-right-5 sm:bottom-[22%] sm:max-w-[10.5rem]',
                )}
              >
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider',
                    accent.tag,
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {card.tag}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">{card.title}</p>
                <p className="text-[11px] leading-snug text-zinc-500">{card.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"
        aria-hidden
      >
        {HERO_FEATURE_PAIRS.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === pairIndex ? 'w-4 bg-primary' : 'w-1 bg-white/25',
            )}
          />
        ))}
      </div>
    </div>
  );
}

const highlights = [
  { icon: Wallet, label: 'Financeiro + Pix' },
  { icon: CalendarDays, label: 'Calendário de giras' },
  { icon: Users, label: 'Portal do filho' },
  { icon: ShieldCheck, label: 'Dados protegidos' },
] as const;

export function LandingHero() {
  return (
    <section
      className="landing-hero relative overflow-x-hidden pb-20 pt-6 sm:pb-24 lg:pb-28"
      aria-labelledby="hero-title"
    >
      <AuthScreenBackground variant="dark" className="absolute inset-0 landing-hero-photo" />
      <div className="landing-hero-orb landing-hero-orb--a" aria-hidden />
      <div className="landing-hero-orb landing-hero-orb--b" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40 bg-gradient-to-b from-transparent to-neutral-950"
        aria-hidden
      />

      <div className="landing-gutter-x relative z-10 grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-left"
        >
          <h1
            id="hero-title"
            className="text-[2rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem] xl:text-6xl"
          >
            <span className="block">{HOME_SEO.h1}</span>
          </h1>

          <p className="mt-4 text-lg font-semibold text-primary sm:text-xl lg:max-w-xl">
            {HOME_SEO.heroTagline}
          </p>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0 mx-auto">
            O painel que zeladores e diretorias usam para organizar mensalidades, galeria de fotos, giras e a
            comunicação com filhos de santo — com respeito à tradição.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <a
              href={ROUTES.founderProgram}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-amber-400 to-yellow-300 px-7 py-4 text-base font-black text-black shadow-[0_8px_32px_rgba(251,188,0,0.35)] transition hover:shadow-[0_12px_40px_rgba(251,188,0,0.45)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Quero ser casa fundadora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
            <a
              href="#tour"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition hover:border-primary/35 hover:bg-white/[0.07]"
            >
              Ver o sistema em ação
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start" aria-label="Destaques">
            {highlights.map((h) => (
              <li
                key={h.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400 backdrop-blur-md"
              >
                <h.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                {h.label}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-lg overflow-visible px-0.5 sm:px-0 lg:max-w-none"
        >
          <div className="landing-hero-glow pointer-events-none absolute -inset-6 rounded-[2rem] opacity-80" aria-hidden />

          <div className="landing-hero-device relative">
            <div className="flex items-center gap-2 border-b border-white/10 bg-neutral-900/90 px-4 py-2.5 rounded-t-2xl">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 flex-1 truncate text-center text-[10px] font-medium text-zinc-500">
                app.axecloud.com.br
              </span>
            </div>
            <div className="relative overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-neutral-950">
              <img
                src={HERO_SCREENSHOT}
                alt="Painel do AxéCloud com resumo do terreiro, calendário e finanças"
                width={1280}
                height={800}
                className="block w-full object-cover object-top"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent" />
            </div>
          </div>

          <HeroFeatureFloatingCards />
        </motion.div>
      </div>
    </section>
  );
}
