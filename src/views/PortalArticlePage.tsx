import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { PORTAL_ARTICLE } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

export default function PortalArticlePage() {
  return (
    <MarketingPageShell
      kicker="Conteúdo"
      title={PORTAL_ARTICLE.title}
      summary={PORTAL_ARTICLE.summary}
      backHref={ROUTES.contentHub}
      backLabel="Voltar ao conteúdo"
    >
      <p className="mb-8 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
        {PORTAL_ARTICLE.readingMinutes} min de leitura ·{' '}
        {new Date(PORTAL_ARTICLE.publishedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <article className="space-y-8">
        {PORTAL_ARTICLE.sections.map((section) => (
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
