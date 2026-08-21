import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { FEATURE_HUB, FEATURE_PAGES, featurePagePath } from '../constants/featurePagesContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { cinematicPortalCardClass, ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
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
      theme="cinematic"
    >
      <ul className="mt-10 grid list-none gap-4 sm:grid-cols-2" role="list">
        {FEATURE_PAGES.map((page, i) => (
          <motion.li key={page.slug} {...fade} transition={{ ...fade.transition, delay: 0.04 * i }}>
            <a
              href={featurePagePath(page.slug)}
              className={cn(
                'group relative flex min-h-56 h-full flex-col overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-[#e5ae12]/45 hover:bg-[#151a12]',
                cinematicPortalCardClass,
              )}
            >
              <span className="mb-8 text-[10px] font-black tracking-[.22em] text-[#e5ae12]/65">0{i + 1}</span>
              <h2 className="max-w-md text-xl font-extrabold leading-tight text-[#f4efe3] group-hover:text-[#f2c03b]">{page.h1}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[#9fa49a]">{page.lead}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#e5ae12]">
                Ver recurso
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
              <i className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full border border-[#e5ae12]/10" aria-hidden />
            </a>
          </motion.li>
        ))}
      </ul>

      <div className={cn('mt-12 border-l-2 border-l-[#e5ae12] p-6 text-center sm:p-8', cinematicPortalCardClass)}>
        <p className="text-sm text-[#a9ada3]">
          Prefere ver tudo lado a lado? Compare com planilha e outros sistemas.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={ROUTES.whyAxeCloud}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-[#f4efe3] transition hover:border-[#e5ae12]/50"
          >
            Por que AxéCloud
          </a>
          <a
            href={appHref(ROUTES.register)}
            className="inline-flex items-center justify-center rounded-full bg-[#e5ae12] px-5 py-2.5 text-xs font-extrabold text-[#17150e] transition hover:bg-[#f2c03b]"
          >
            Teste {TRIAL_DAYS} dias grátis
          </a>
        </div>
      </div>
    </ContentMarketingLayout>
  );
}
