import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { FEATURE_HUB, FEATURE_PAGES, featurePagePath } from '../constants/featurePagesContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { ContentMarketingLayout, matrizPortalCardClass } from '../components/marketing/ContentMarketingLayout';
import { cn } from '../lib/utils';

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
} as const;

export default function FeatureHubPage() {
  return (
    <ContentMarketingLayout
      kicker="Recursos"
      title={FEATURE_HUB.h1}
      summary={FEATURE_HUB.lead}
      backHref={ROUTES.home}
      backLabel="Voltar ao início"
    >
      <ul className="mt-10 grid list-none gap-4 sm:grid-cols-2" role="list">
        {FEATURE_PAGES.map((page, i) => (
          <motion.li key={page.slug} {...fade} transition={{ ...fade.transition, delay: 0.04 * i }}>
            <a
              href={featurePagePath(page.slug)}
              className={cn(
                'group flex h-full flex-col p-5 transition hover:border-[#ffc107]/50',
                matrizPortalCardClass,
              )}
            >
              <h2 className="text-lg font-black text-[#1b1813] group-hover:text-[#a87400]">{page.h1}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[#1b1813]/65">{page.lead}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#a87400]">
                Ver recurso
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </a>
          </motion.li>
        ))}
      </ul>

      <div className={cn('mt-12 p-6 text-center sm:p-8', matrizPortalCardClass)}>
        <p className="text-sm text-[#1b1813]/70">
          Prefere ver tudo lado a lado? Compare com planilha e outros sistemas.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ROUTES.whyAxeCloud}
            className="inline-flex items-center justify-center rounded-full border border-[#e8dfd0] px-5 py-2.5 text-xs font-bold text-[#1b1813] transition hover:border-[#ffc107]/50"
          >
            Por que AxéCloud
          </a>
          <a
            href={appHref(ROUTES.register)}
            className="inline-flex items-center justify-center rounded-full bg-[#ffc107] px-5 py-2.5 text-xs font-bold text-[#1b1813] transition hover:bg-[#ffcd38]"
          >
            Teste {TRIAL_DAYS} dias grátis
          </a>
        </div>
      </div>
    </ContentMarketingLayout>
  );
}
