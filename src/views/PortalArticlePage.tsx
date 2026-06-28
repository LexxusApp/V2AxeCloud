import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';
import { ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
import { landingMockupCardClass } from '../components/landing/landingMockupUi';
import { cn } from '../lib/utils';
import { getPortalArticleBySlug } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

type PortalArticlePageProps = {
  slug: string;
};

export default function PortalArticlePage({ slug }: PortalArticlePageProps) {
  const article = getPortalArticleBySlug(slug);

  if (!article) {
    return (
      <ContentMarketingLayout
        kicker="Conteúdo"
        title="Artigo não encontrado"
        summary="Este conteúdo não está disponível."
        backHref={ROUTES.contentHub}
        backLabel="Voltar ao conteúdo"
        wide={false}
      />
    );
  }

  const publishedLabel = new Date(article.publishedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ContentMarketingLayout
      kicker="Artigo"
      title={article.title}
      summary={article.summary}
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
      wide={false}
      heroExtra={
        <div className="flex flex-wrap gap-3">
          <span className={cn('inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#1b1813]/65', landingMockupCardClass, 'rounded-xl')}>
            <Clock className="h-4 w-4 text-[#FFC107]" aria-hidden />
            {article.readingMinutes} min de leitura
          </span>
          <span className={cn('inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#1b1813]/65', landingMockupCardClass, 'rounded-xl')}>
            <Calendar className="h-4 w-4 text-[#FFC107]" aria-hidden />
            {publishedLabel}
          </span>
        </div>
      }
    >
      <article className="space-y-6">
        {article.sections.map((section, index) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
            className="landing-mockup-card p-5 sm:p-6"
          >
            <h2 className="landing-mockup-kicker inline-flex text-[10px]">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#1b1813]/65 sm:text-[15px]">{section.body}</p>
          </motion.section>
        ))}
      </article>

      <div className={cn('mt-8 grid gap-4 sm:grid-cols-2', landingMockupCardClass, 'rounded-2xl border-0 bg-transparent p-0 shadow-none')}>
        <div className={cn('border-amber-300/40 p-6 sm:p-7', landingMockupCardClass, 'rounded-2xl')}>
          <p className="text-base font-bold text-[#1b1813]">Compare módulos e preço</p>
          <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/65">
            Tabela explícita: planilha vs AxéCloud vs outros softwares de terreiro — com PWA, WhatsApp Meta e portal
            público.
          </p>
          <a
            href={ROUTES.whyAxeCloud}
            className="mt-5 inline-flex items-center justify-center rounded-xl border border-[#e8dfd0] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1b1813] transition hover:border-amber-300/50"
          >
            Por que AxéCloud
          </a>
        </div>
        <div className={cn('border-amber-300/40 p-6 sm:p-7', landingMockupCardClass, 'rounded-2xl')}>
          <p className="text-base font-bold text-[#1b1813]">Sua casa quer participar?</p>
          <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/65">
            Inscreva-se no Programa Fundador e use o AxéCloud gratuitamente por 12 meses enquanto construímos o portal.
          </p>
          <a
            href={ROUTES.founderProgram}
            className="landing-btn-primary mt-5 inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            Programa Fundador
          </a>
        </div>
      </div>
    </ContentMarketingLayout>
  );
}
