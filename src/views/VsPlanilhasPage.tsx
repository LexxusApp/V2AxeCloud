import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { VS_PLANILHAS } from '../constants/comparisonContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { cinematicPortalCardClass, ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
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
      theme="cinematic"
    >
      <div className="mt-10 space-y-6">
        <h2 className="text-sm font-black uppercase tracking-[.18em] text-[#e5ae12]">Sinais de que a planilha não basta</h2>
        <ul className="grid list-none gap-4 sm:grid-cols-3" role="list">
          {VS_PLANILHAS.signals.map((signal) => (
            <motion.li key={signal.heading} {...fade} className={cn('border-t-2 border-t-[#a54a39] p-5', cinematicPortalCardClass)}>
              <h3 className="text-sm font-bold text-[#f4efe3]">{signal.heading}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9fa49a]">{signal.body}</p>
            </motion.li>
          ))}
        </ul>

        <motion.section {...fade} className={cn('grid gap-4 sm:grid-cols-2', 'mt-4')}>
          <article className={cn('p-5', cinematicPortalCardClass)}>
            <p className="text-[10px] font-black tracking-[.2em] text-[#7e8479]">ANTES</p>
            <h3 className="mt-4 text-lg font-bold text-[#f4efe3]">Quando a planilha ainda serve</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#9fa49a]">{VS_PLANILHAS.whenStay}</p>
          </article>
          <article className={cn('border-[#e5ae12]/45 bg-[#172017] p-5', cinematicPortalCardClass)}>
            <p className="text-[10px] font-black tracking-[.2em] text-[#e5ae12]">PRÓXIMO PASSO</p>
            <h3 className="mt-4 text-lg font-bold text-[#f4efe3]">Quando migrar</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#b2b6ad]">{VS_PLANILHAS.whenMigrate}</p>
          </article>
        </motion.section>

        <motion.div {...fade} className={cn('p-6 text-center', cinematicPortalCardClass)}>
          <ul className="mx-auto mb-5 max-w-md space-y-3 text-left text-sm text-[#b2b6ad]" role="list">
            {[
              'Tabela completa planilha vs AxéCloud vs outros',
              'Artigo: quando migrar a gestão',
              `${TRIAL_DAYS} dias grátis sem cartão`,
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#56d9a3]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={ROUTES.whyAxeCloud}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-[#f4efe3] hover:border-[#e5ae12]/50"
            >
              Ver tabela comparativa
            </a>
            <a
              href="/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-[#f4efe3] hover:border-[#e5ae12]/50"
            >
              Ler o guia de migração
            </a>
            <a
              href={appHref(ROUTES.register)}
              className="inline-flex items-center justify-center rounded-full bg-[#e5ae12] px-5 py-2.5 text-xs font-extrabold text-[#17150e] hover:bg-[#f2c03b]"
            >
              Teste grátis
            </a>
          </div>
        </motion.div>
      </div>
    </ContentMarketingLayout>
  );
}
