import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';
import { ContentMarketingLayout } from '../components/marketing/ContentMarketingLayout';
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
          <span className="landing-mystic-card inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#94A3B8]">
            <Clock className="h-4 w-4 text-primary" aria-hidden />
            {article.readingMinutes} min de leitura
          </span>
          <span className="landing-mystic-card inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#94A3B8]">
            <Calendar className="h-4 w-4 text-violet-400" aria-hidden />
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
            className="landing-resource-card p-5 sm:p-6"
          >
            <h2 className="text-sm font-black uppercase tracking-wider text-primary">{section.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#94A3B8] sm:text-[15px]">{section.body}</p>
          </motion.section>
        ))}
      </article>

      <div className="landing-mystic-card mt-8 border-primary/25 p-6 sm:p-7">
        <p className="text-base font-bold text-[#F1F5F9]">Sua casa quer participar?</p>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Inscreva-se no Programa Fundador e use o AxéCloud gratuitamente por 12 meses enquanto construímos o portal.
        </p>
        <a
          href={ROUTES.founderProgram}
          className="landing-btn-primary mt-5 inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
        >
          Programa Fundador
        </a>
      </div>
    </ContentMarketingLayout>
  );
}
