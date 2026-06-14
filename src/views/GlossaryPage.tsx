import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { GLOSSARY_TERMS } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

export default function GlossaryPage() {
  return (
    <MarketingPageShell
      kicker="Glossário"
      title="Glossário do axé — 20 termos essenciais"
      summary="Referência rápida com linguagem respeitosa para quem está conhecendo terreiros de Umbanda, Candomblé e vertentes afins."
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
    >
      <dl className="space-y-6">
        {GLOSSARY_TERMS.map(({ term, definition }) => (
          <div key={term} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
            <dt className="text-base font-bold text-primary">{term}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-zinc-400">{definition}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        Este glossário é introdutório. Tradições, nações e linhas têm variações — consulte sempre a orientação da sua
        casa ou de lideranças da sua região.
      </p>
    </MarketingPageShell>
  );
}
