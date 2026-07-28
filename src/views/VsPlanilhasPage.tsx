import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { VS_PLANILHAS } from '../constants/comparisonContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { ContentMarketingLayout, matrizPortalCardClass } from '../components/marketing/ContentMarketingLayout';
import { cn } from '../lib/utils';

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.4 },
} as const;

export default function VsPlanilhasPage() {
  return (
    <ContentMarketingLayout
      kicker="Comparativo"
      title={VS_PLANILHAS.h1}
      summary={VS_PLANILHAS.lead}
      backHref={ROUTES.whyAxeCloud}
      backLabel="Voltar ao comparativo"
      wide={false}
    >
      <div className="mt-10 space-y-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-[#a87400]">Sinais de que a planilha não basta</h2>
        <ul className="grid list-none gap-4 sm:grid-cols-3" role="list">
          {VS_PLANILHAS.signals.map((signal) => (
            <motion.li key={signal.heading} {...fade} className={cn('p-5', matrizPortalCardClass)}>
              <h3 className="text-sm font-bold text-[#1b1813]">{signal.heading}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#1b1813]/65">{signal.body}</p>
            </motion.li>
          ))}
        </ul>

        <motion.section {...fade} className={cn('grid gap-4 sm:grid-cols-2', 'mt-4')}>
          <article className={cn('p-5', matrizPortalCardClass)}>
            <h3 className="text-sm font-bold">Quando a planilha ainda serve</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/70">{VS_PLANILHAS.whenStay}</p>
          </article>
          <article className={cn('p-5 border-[#ffc107]/40', matrizPortalCardClass)}>
            <h3 className="text-sm font-bold text-[#a87400]">Quando migrar</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/70">{VS_PLANILHAS.whenMigrate}</p>
          </article>
        </motion.section>

        <motion.div {...fade} className={cn('p-6 text-center', matrizPortalCardClass)}>
          <ul className="mx-auto mb-4 max-w-md space-y-2 text-left text-sm text-[#1b1813]/75" role="list">
            {[
              'Tabela completa planilha vs AxéCloud vs outros',
              'Artigo: quando migrar a gestão',
              `${TRIAL_DAYS} dias grátis sem cartão`,
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc107]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={ROUTES.whyAxeCloud}
              className="inline-flex items-center justify-center rounded-full border border-[#e8dfd0] px-5 py-2.5 text-xs font-bold"
            >
              Ver tabela comparativa
            </a>
            <a
              href="/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro"
              className="inline-flex items-center justify-center rounded-full border border-[#e8dfd0] px-5 py-2.5 text-xs font-bold"
            >
              Ler o guia de migração
            </a>
            <a
              href={appHref(ROUTES.register)}
              className="inline-flex items-center justify-center rounded-full bg-[#ffc107] px-5 py-2.5 text-xs font-bold text-[#1b1813]"
            >
              Teste grátis
            </a>
          </div>
        </motion.div>
      </div>
    </ContentMarketingLayout>
  );
}
