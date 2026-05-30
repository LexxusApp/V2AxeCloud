import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { HOME_SEO } from '../../constants/seoHome';
import { ROUTES } from '../../lib/routes';
import { AuthScreenBackground } from '../AuthScreenBackground';
import { cn } from '../../lib/utils';

const HERO_SCREENSHOT = '/screenshots/painel-inicio.png';

const highlights = [
  { icon: Wallet, label: 'Financeiro + Pix' },
  { icon: CalendarDays, label: 'Calendário de giras' },
  { icon: Users, label: 'Portal do filho' },
  { icon: ShieldCheck, label: 'Dados protegidos' },
] as const;

export function LandingHero() {
  return (
    <section
      className="landing-hero relative -mx-4 overflow-hidden px-4 pb-20 pt-6 sm:-mx-6 sm:px-6 sm:pb-24 lg:-mx-8 lg:px-8 lg:pb-28"
      aria-labelledby="hero-title"
    >
      <AuthScreenBackground variant="dark" className="absolute inset-0 landing-hero-photo" />
      <div className="landing-hero-orb landing-hero-orb--a" aria-hidden />
      <div className="landing-hero-orb landing-hero-orb--b" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40 bg-gradient-to-b from-transparent to-neutral-950"
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-left"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary shadow-[0_0_24px_rgba(251,188,0,0.12)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {HOME_SEO.heroBadge}
          </div>

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
            O painel que zeladores e diretorias usam para organizar mensalidades, estoque sagrado, giras e a
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
          className="relative mx-auto w-full max-w-lg lg:max-w-none"
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

          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className={cn(
              'absolute -left-2 top-[18%] z-20 max-w-[11rem] rounded-xl border border-primary/25',
              'bg-neutral-950/90 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md sm:-left-6 sm:max-w-[12rem]',
            )}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              Financeiro
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">Mensalidades claras</p>
            <p className="text-[11px] text-zinc-500">Pix e histórico para a diretoria</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className={cn(
              'absolute -right-1 bottom-[22%] z-20 max-w-[10.5rem] rounded-xl border border-white/10',
              'bg-neutral-950/90 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md sm:-right-5',
            )}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400/90">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Giras
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">Agenda da casa</p>
            <p className="text-[11px] text-zinc-500">Filhos e zelador no mesmo fluxo</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
