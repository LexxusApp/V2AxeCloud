import { motion } from 'framer-motion';
import type { FeaturePageContent } from '../constants/featurePagesContent';
import { TRIAL_DAYS } from '../../lib/planPricing';
import { appHref } from '../lib/appHref';
import { ROUTES } from '../lib/routes';
import { linkifyAxecloudArticleBody } from '../lib/seoLinkify';
import { cinematicPortalCardClass, ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
import { cn } from '../lib/utils';

const fade = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.4 },
} as const;

export default function FeaturePage({ page }: { page: FeaturePageContent }) {
  return (
    <ContentMarketingLayout
      kicker="Recurso"
      title={page.h1}
      summary={page.lead}
      backHref={ROUTES.recursos}
      backLabel="Todos os recursos"
      wide={false}
      theme="cinematic"
    >
      <div className="mt-10 space-y-8">
        {page.sections.map((section) => (
          <motion.section key={section.heading} {...fade} className={cn('border-l-2 border-l-[#e5ae12]/70 p-5 sm:p-6', cinematicPortalCardClass)}>
            <h2 className="text-base font-black text-[#f4efe3]">{section.heading}</h2>
            <p
              className="mt-3 text-sm leading-relaxed text-[#a9ada3] [&_a]:font-bold [&_a]:text-[#e5ae12] [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: linkifyAxecloudArticleBody(section.body) }}
            />
          </motion.section>
        ))}

        <motion.section {...fade} aria-labelledby="feature-faq" className={cn('p-5 sm:p-6', cinematicPortalCardClass)}>
          <h2 id="feature-faq" className="text-base font-black text-[#f4efe3]">
            Perguntas frequentes
          </h2>
          <dl className="mt-4 space-y-4">
            {page.faq.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-bold text-[#f4efe3]">{item.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#9fa49a]">{item.a}</dd>
              </div>
            ))}
          </dl>
        </motion.section>

        <motion.div {...fade} className={cn('p-6 text-center', cinematicPortalCardClass)}>
          <p className="text-sm text-[#a9ada3]">
            Veja o comparativo completo ou teste o plano Premium por {TRIAL_DAYS} dias.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={ROUTES.whyAxeCloud}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-[#f4efe3]"
            >
              Comparativo
            </a>
            <a
              href={appHref(ROUTES.register)}
              className="inline-flex items-center justify-center rounded-full bg-[#e5ae12] px-5 py-2.5 text-xs font-extrabold text-[#17150e]"
            >
              Teste grátis
            </a>
          </div>
        </motion.div>
      </div>
    </ContentMarketingLayout>
  );
}
