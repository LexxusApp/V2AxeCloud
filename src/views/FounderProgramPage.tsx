import { Check, Crown, Sparkles } from 'lucide-react';
import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { FounderProgramForm } from '../components/founder/FounderProgramForm';
import {
  FOUNDER_BENEFITS,
  FOUNDER_PROGRAM,
  FOUNDER_REQUIREMENTS,
} from '../constants/founderProgram';
import { ROUTES } from '../lib/routes';

export default function FounderProgramPage() {
  return (
    <MarketingPageShell
      kicker="Programa Fundador"
      title="12 meses gratuitos para as primeiras casas de axé"
      summary={`Estamos selecionando até ${FOUNDER_PROGRAM.maxSlots} terreiros para validar o AxéCloud e construir o portal público do axé no Brasil. Prioridade inicial: ${FOUNDER_PROGRAM.pilotCity}.`}
    >
      <div className="space-y-10">
        <section aria-labelledby="fp-benefits">
          <h2 id="fp-benefits" className="text-sm font-black uppercase tracking-wider text-primary/90">
            O que você recebe
          </h2>
          <ul className="mt-4 space-y-3">
            {FOUNDER_BENEFITS.map((line) => (
              <li key={line} className="flex gap-3 text-sm text-zinc-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5"
          aria-labelledby="fp-requirements"
        >
          <h2 id="fp-requirements" className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
            <Crown className="h-4 w-4 text-primary" />
            Quem pode participar
          </h2>
          <ul className="mt-4 space-y-2.5">
            {FOUNDER_REQUIREMENTS.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-zinc-500">
                · {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-zinc-600">{FOUNDER_PROGRAM.pilotRegionNote}</p>
        </section>

        <section aria-labelledby="fp-form">
          <h2 id="fp-form" className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
            <Sparkles className="h-4 w-4 text-primary" />
            Inscreva sua casa
          </h2>
          <div className="mt-4">
            <FounderProgramForm />
          </div>
        </section>

        <nav className="flex flex-wrap gap-4 border-t border-white/5 pt-8 text-sm">
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
      </div>
    </MarketingPageShell>
  );
}
