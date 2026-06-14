import { BookOpen, FileText } from 'lucide-react';
import MarketingPageShell from '../components/marketing/MarketingPageShell';
import { GLOSSARY_TERMS, PORTAL_ARTICLES, contentArticlePath } from '../content/portalContent';
import { ROUTES } from '../lib/routes';

export default function ContentHubPage() {
  return (
    <MarketingPageShell
      kicker="Portal AxéCloud"
      title="Conteúdo para quem busca entender a tradição"
      summary="Artigos e glossário com linguagem respeitosa — base do portal público que estamos construindo junto com as casas fundadoras."
    >
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Artigos</h2>
        <ul className="space-y-4">
          {PORTAL_ARTICLES.map((article) => (
            <li key={article.slug}>
              <a
                href={contentArticlePath(article.slug)}
                className="group flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-primary/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-primary">{article.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{article.summary}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                    {article.readingMinutes} min de leitura
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Referência</h2>
        <ul className="space-y-4">
          <li>
            <a
              href={ROUTES.glossary}
              className="group flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-primary/30"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-primary">Glossário do axé</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {GLOSSARY_TERMS.length} termos essenciais sobre terreiro, filho de santo, gira, orixá e tradições
                  afro-brasileiras.
                </p>
              </div>
            </a>
          </li>
        </ul>
      </section>

      <p className="mt-8 text-center text-sm">
        <a href={ROUTES.founderProgram} className="font-bold text-primary hover:underline">
          Conheça o Programa Fundador →
        </a>
      </p>
    </MarketingPageShell>
  );
}
