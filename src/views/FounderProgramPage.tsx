import {
  Check,
  Crown,
  Gift,
  MapPin,
  MessageCircle,
  PenLine,
  Users,
  type LucideIcon,
} from 'lucide-react';
import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { FounderProgramForm } from '../components/founder/FounderProgramForm';
import {
  FOUNDER_BENEFITS,
  FOUNDER_PROGRAM,
  FOUNDER_REQUIREMENTS,
} from '../constants/founderProgram';
import { ROUTES } from '../lib/routes';
import { useFounderProgramStats } from '../hooks/useFounderProgramStats';
import { cn } from '../lib/utils';

const FOUNDER_STEPS = [
  { n: '1', title: 'Inscreva a casa', desc: 'Formulário rápido — leva cerca de 2 minutos.' },
  { n: '2', title: 'Conversamos', desc: 'Entramos em contato pelo WhatsApp para alinhar expectativas.' },
  { n: '3', title: 'Comece grátis', desc: '12 meses Premium + onboarding personalizado com a equipe.' },
] as const;

const BENEFIT_ICONS: LucideIcon[] = [Gift, Users, MapPin, Crown, MessageCircle];

function FounderHeroStats() {
  const { stats, loading } = useFounderProgramStats();

  return (
    <div className="grid gap-3 sm:flex sm:flex-wrap">
      <div className="landing-mystic-card flex w-full items-center gap-3 px-4 py-3 sm:w-auto sm:min-w-[11rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Grátis</p>
          <p className="text-base font-bold text-white">{FOUNDER_PROGRAM.freeMonths} meses Premium</p>
        </div>
      </div>
      <div className="landing-mystic-card flex w-full items-center gap-3 px-4 py-3 sm:w-auto sm:min-w-[11rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
          <Users className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Vagas</p>
          <p className="text-base font-bold text-white">
            {loading ? '…' : `${stats.remainingSlots} de ${stats.maxSlots}`}
          </p>
        </div>
      </div>
      <div className="landing-mystic-card flex w-full items-center gap-3 px-4 py-3 sm:w-auto sm:min-w-[11rem]">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Prioridade</p>
          <p className="text-base font-bold text-white">{FOUNDER_PROGRAM.pilotCity}</p>
        </div>
      </div>
    </div>
  );
}

export default function FounderProgramPage() {
  return (
    <MarketingPageShell
      variant="founder"
      kicker="Programa Fundador"
      title="12 meses gratuitos para as primeiras casas de axé"
      summary={`Estamos selecionando até ${FOUNDER_PROGRAM.maxSlots} terreiros para validar o AxéCloud e construir o portal público do axé no Brasil. Você usa o sistema completo, ajuda a moldar o produto e entra como Casa Fundadora quando o diretório estiver no ar.`}
      heroExtra={<FounderHeroStats />}
    >
      <section aria-labelledby="fp-steps" className="mb-10 sm:mb-12">
        <h2 id="fp-steps" className="landing-kicker !justify-start !text-xs">
          Como funciona
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {FOUNDER_STEPS.map((step) => (
            <li
              key={step.n}
              className="landing-mystic-card flex gap-3 p-4 sm:p-5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-sm font-black text-primary">
                {step.n}
              </span>
              <div>
                <p className="text-base font-bold text-white">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
        <div className="space-y-8">
          <section aria-labelledby="fp-benefits">
            <h2 id="fp-benefits" className="text-sm font-black uppercase tracking-wider text-primary sm:text-base">
              O que você recebe
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {FOUNDER_BENEFITS.map((line, i) => {
                const Icon = BENEFIT_ICONS[i] ?? Gift;
                return (
                  <li
                    key={line}
                    className="landing-mystic-card flex gap-3 p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="text-sm leading-relaxed text-zinc-300 sm:text-[15px]">{line}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="landing-mystic-card border-primary/20 p-5 sm:p-6"
            aria-labelledby="fp-requirements"
          >
            <h2
              id="fp-requirements"
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white sm:text-base"
            >
              <Crown className="h-5 w-5 text-primary" aria-hidden />
              Quem pode participar
            </h2>
            <ul className="mt-4 space-y-3">
              {FOUNDER_REQUIREMENTS.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-lg border border-white/5 bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-zinc-500">
              {FOUNDER_PROGRAM.pilotRegionNote}
            </p>
          </section>

          <p className="text-sm text-zinc-500 sm:text-[15px]">
            Depois do período fundador:{' '}
            <strong className="text-zinc-300">{FOUNDER_PROGRAM.futurePriceLabel}</strong>. Transparência
            desde o início — sem cartão nesta inscrição.
          </p>
        </div>

        <section
          aria-labelledby="fp-form"
          className="lg:sticky lg:top-6"
        >
          <div className="landing-mystic-card border-primary/25 p-5 sm:p-6 lg:p-7">
            <h2
              id="fp-form"
              className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-white sm:text-lg"
            >
              <PenLine className="h-5 w-5 text-primary" aria-hidden />
              Inscreva sua casa
            </h2>
            <p className="mt-2 text-sm text-zinc-400 sm:text-[15px]">
              Preencha abaixo. Respondemos pelo WhatsApp em até alguns dias úteis.
            </p>
            <div className="mt-5">
              <FounderProgramForm showSlotsBanner={false} />
            </div>
          </div>

          <a
            href={FOUNDER_PROGRAM.waComercial}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10',
              'bg-white/[0.03] px-4 py-3.5 text-sm font-bold text-zinc-300 transition hover:border-primary/30 hover:text-white',
            )}
          >
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
            {FOUNDER_PROGRAM.waComercialLabel}
          </a>
        </section>
      </div>

      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#2a2108] pt-8 text-sm sm:text-[15px]">
        <a href={ROUTES.contentHub} className="text-zinc-500 transition hover:text-primary">
          Conteúdo e glossário
        </a>
        <a href={ROUTES.register} className="text-zinc-500 transition hover:text-primary">
          Cadastro com pagamento
        </a>
        <a href={ROUTES.home} className="font-bold text-primary">
          Página inicial
        </a>
      </nav>
    </MarketingPageShell>
  );
}
