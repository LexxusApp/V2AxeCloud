import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { getPortalArticleBySlug } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

type PortalArticlePageProps = {
  slug: string;
};

export default function PortalArticlePage({ slug }: PortalArticlePageProps) {
  const article = getPortalArticleBySlug(slug);

  if (!article) {
    return (
      <MarketingPageShell
        kicker="Conteúdo"
        title="Artigo não encontrado"
        summary="Este conteúdo não está disponível."
        backHref={ROUTES.contentHub}
        backLabel="Voltar ao conteúdo"
      />
    );
  }

  return (
    <MarketingPageShell
      kicker="Conteúdo"
      title={article.title}
      summary={article.summary}
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
    >
      <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
        {article.readingMinutes} min de leitura ·{' '}
        {new Date(article.publishedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <article className="space-y-8">
        {article.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-black uppercase tracking-wider text-primary/90">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{section.body}</p>
          </section>
        ))}
      </article>
      <div className="mt-10 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm text-zinc-300">
        <p className="font-semibold text-white">Sua casa quer participar?</p>
        <p className="mt-2 text-zinc-400">
          Inscreva-se no Programa Fundador e use o AxéCloud gratuitamente por 12 meses enquanto construímos o portal.
        </p>
        <a
          href={ROUTES.founderProgram}
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-black"
        >
          Programa Fundador
        </a>
      </div>
    </MarketingPageShell>
  );
}
