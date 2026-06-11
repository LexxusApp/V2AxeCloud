import {
  ArrowRight,
  CalendarDays,
  Flame,
  Heart,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { HOME_SEO } from '../../constants/seoHome';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

const highlights = [
  { icon: Wallet, label: 'Financeiro + Pix', accent: 'text-emerald-400' },
  { icon: CalendarDays, label: 'Calendário de giras', accent: 'text-rose-400' },
  { icon: Users, label: 'Portal do filho', accent: 'text-sky-400' },
  { icon: ShieldCheck, label: 'Dados protegidos', accent: 'text-emerald-400' },
] as const;

export function LandingHero() {
  return (
    <section
      className="landing-hero relative overflow-x-hidden pb-20 pt-12 text-center sm:pb-24 md:py-28"
      aria-labelledby="hero-title"
    >
      <div className="landing-section-inner relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="landing-hero-copy mx-auto max-w-4xl">
          <div className="mb-6 inline-flex animate-pulse items-center gap-2 rounded-full border border-primary/30 bg-[#13171D] px-3 py-1.5">
            <Flame className="h-3.5 w-3.5 shrink-0 fill-primary/15 text-primary" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F1F5F9] md:text-xs">
              {HOME_SEO.heroTagline}
            </span>
          </div>

          <h1
            id="hero-title"
            className="font-display text-4xl font-black leading-[1.08] tracking-tight text-[#F1F5F9] sm:text-5xl md:text-6xl"
          >
            Sistema de gestão para terreiros de{' '}
            <span className="bg-gradient-to-r from-primary via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Umbanda e Candomblé
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-lg font-light leading-relaxed text-[#94A3B8] md:text-xl">
            {HOME_SEO.description}
          </p>

          <div className="mx-auto mt-12 flex max-w-lg flex-col items-center justify-center gap-4 sm:max-w-none sm:flex-row">
            <a href={ROUTES.founderProgram} className="landing-btn-primary w-full px-8 py-4 text-base sm:w-auto">
              Programa Fundador
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href="#demonstracao" className="landing-btn-secondary w-full px-8 py-4 text-base sm:w-auto">
              Experimentar demo ao vivo
            </a>
          </div>

          <ul
            className="mt-14 flex flex-wrap items-center justify-center gap-8"
            aria-label="Destaques"
          >
            {highlights.map((h) => (
              <li key={h.label} className="flex items-center gap-2 text-sm font-semibold text-[#94A3B8]">
                <h.icon className={cn('h-5 w-5', h.accent)} aria-hidden />
                {h.label}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm font-semibold text-[#94A3B8]">
              <Heart className="h-5 w-5 text-rose-400" aria-hidden />
              Foco na comunidade
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
