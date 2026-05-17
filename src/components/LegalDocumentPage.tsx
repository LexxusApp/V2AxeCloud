import { ArrowLeft, FileText, Shield } from 'lucide-react';
import { CURRENT_LEGAL_TERMS_VERSION } from '../config/legal';
import type { LegalSection } from '../content/legalTerms';
import { ROUTES } from '../lib/routes';

type LegalDocumentPageProps = {
  title: string;
  summary: string;
  sections: readonly LegalSection[];
  icon: 'terms' | 'privacy';
};

export default function LegalDocumentPage(props: LegalDocumentPageProps) {
  const { title, summary, sections, icon } = props;
  const Icon = icon === 'privacy' ? Shield : FileText;

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-300">
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={ROUTES.home}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </a>
          <a href={ROUTES.home} className="text-sm font-black text-white">
            AxéCloud
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{summary}</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Versão {CURRENT_LEGAL_TERMS_VERSION}</p>
          </div>
        </div>
        <article className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-sm font-black uppercase tracking-wider text-primary/90">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
            </section>
          ))}
        </article>
        <nav className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-8 text-sm sm:flex-row sm:justify-between" aria-label="Links legais">
          <div className="flex gap-4">
            <a href={ROUTES.terms} className="text-zinc-500 hover:text-primary">Termos de Uso</a>
            <a href={ROUTES.privacy} className="text-zinc-500 hover:text-primary">Política de Privacidade</a>
          </div>
          <a href={ROUTES.login} className="font-bold text-primary">Entrar</a>
        </nav>
      </main>
    </div>
  );
}
