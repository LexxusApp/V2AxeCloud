import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import {
  ContentMarketingLayout,
  MatrizSectionTitle,
  matrizPortalCardClass,
} from '../components/marketing/ContentMarketingLayout';
import { RegisterTrialLink } from '../components/marketing/RegisterTrialLink';
import { linkifyAxecloudArticleBody } from '../lib/seoLinkify';
import { getPortalArticleBySlug } from '../content/portalContent';
import { ROUTES } from '../lib/routes';
import { cn } from '../lib/utils';

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
        <div className={cn(matrizPortalCardClass, 'flex flex-wrap gap-3 p-4')}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e8dfd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#1b1813]/65">
            <Clock className="h-4 w-4 text-[#a87400]" aria-hidden />
            {article.readingMinutes} min de leitura
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e8dfd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#1b1813]/65">
            <Calendar className="h-4 w-4 text-[#a87400]" aria-hidden />
            {publishedLabel}
          </span>
        </div>
      }
    >
      <article className="space-y-5">
        {article.sections.map((section, index) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35) }}
            className={cn(matrizPortalCardClass, 'p-5 sm:p-6')}
          >
            <MatrizSectionTitle>{section.title}</MatrizSectionTitle>
            <p
              className="mt-3 text-sm leading-relaxed text-[#1b1813]/65 sm:text-[15px]"
              dangerouslySetInnerHTML={{ __html: linkifyAxecloudArticleBody(section.body) }}
            />
          </motion.section>
        ))}
      </article>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={cn(matrizPortalCardClass, 'border-[#ffc107]/25 bg-[#ffc107]/8 p-6 sm:p-7')}>
          <p className="text-base font-bold text-[#1b1813]">Teste o AxéCloud no seu terreiro</p>
          <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/65">
            30 dias grátis do plano Premium — sem cartão de crédito. Configure financeiro, calendário e portal do filho
            de santo.
          </p>
          <RegisterTrialLink className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#ffc107] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1b1813] transition hover:bg-[#ffcd38]">
            Cadastrar — 30 dias grátis
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </RegisterTrialLink>
        </div>
        <div className={cn(matrizPortalCardClass, 'p-6 sm:p-7')}>
          <p className="text-base font-bold text-[#1b1813]">Compare módulos e preço</p>
          <p className="mt-2 text-sm leading-relaxed text-[#1b1813]/65">
            Tabela explícita: planilha vs AxéCloud vs outros softwares de terreiro — com PWA, WhatsApp Meta e portal
            público.
          </p>
          <a
            href={ROUTES.whyAxeCloud}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-[#e8dfd0] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#1b1813] transition hover:border-[#ffc107]/50 hover:text-[#a87400]"
          >
            Comparativo de gestão
          </a>
        </div>
      </div>

      <p className="text-center text-sm text-[#1b1813]/55">
        <a href={ROUTES.home} className="font-semibold text-[#a87400] hover:text-[#ffc107]">
          Gestão de terreiros
        </a>
        {' · '}
        <a href={ROUTES.contentHub} className="font-semibold text-[#a87400] hover:text-[#ffc107]">
          Mais artigos
        </a>
      </p>
    </ContentMarketingLayout>
  );
}
