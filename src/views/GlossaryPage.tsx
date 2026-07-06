import { motion } from 'framer-motion';
import {
  ContentMarketingLayout,
  matrizPortalCardClass,
} from '../components/marketing/ContentMarketingLayout';
import { GLOSSARY_TERMS } from '../content/portalContent';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

export default function GlossaryPage() {
  return (
    <ContentMarketingLayout
      kicker="Glossário"
      title="20 termos essenciais do axé"
      summary="Referência rápida com linguagem respeitosa para quem está conhecendo terreiros de Umbanda, Candomblé e vertentes afins."
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
      wide={false}
      heroExtra={
        <div className={cn(matrizPortalCardClass, 'p-5 text-center')}>
          <p className="text-3xl font-black text-[#a87400]">{GLOSSARY_TERMS.length}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#1b1813]/45">Termos explicados</p>
        </div>
      }
    >
      <dl className="space-y-4">
        {GLOSSARY_TERMS.map(({ term, definition }, index) => (
          <motion.div
            key={term}
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.4) }}
            className={cn(matrizPortalCardClass, 'p-5 sm:p-6')}
          >
            <dt className="text-base font-bold text-[#1b1813] sm:text-lg">{term}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[#1b1813]/65">{definition}</dd>
          </motion.div>
        ))}
      </dl>
      <p className={cn(matrizPortalCardClass, 'mt-2 px-4 py-3 text-xs leading-relaxed text-[#1b1813]/65')}>
        Este glossário é introdutório. Tradições, nações e linhas têm variações — consulte sempre a orientação da sua
        casa ou de lideranças da sua região.
      </p>
    </ContentMarketingLayout>
  );
}
