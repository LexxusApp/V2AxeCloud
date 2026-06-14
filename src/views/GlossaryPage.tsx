import { motion } from 'framer-motion';
import { ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
import { GLOSSARY_TERMS } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

export default function GlossaryPage() {
  return (
    <ContentMarketingLayout
      kicker="Glossário"
      title="20 termos essenciais do axé"
      summary="Referência rápida com linguagem respeitosa para quem está conhecendo terreiros de Umbanda, Candomblé e vertentes afins."
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
      wide={false}
    >
      <dl className="space-y-4">
        {GLOSSARY_TERMS.map(({ term, definition }, index) => (
          <motion.div
            key={term}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.45) }}
            className="landing-resource-card p-5 sm:p-6"
          >
            <dt className="text-base font-bold text-primary sm:text-lg">{term}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{definition}</dd>
          </motion.div>
        ))}
      </dl>
      <p className="mt-8 rounded-xl border border-[#1E242B] bg-[#12161A] px-4 py-3 text-xs leading-relaxed text-[#64748B]">
        Este glossário é introdutório. Tradições, nações e linhas têm variações — consulte sempre a orientação da sua
        casa ou de lideranças da sua região.
      </p>
    </ContentMarketingLayout>
  );
}
