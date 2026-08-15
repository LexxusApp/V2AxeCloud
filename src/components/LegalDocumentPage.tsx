import { ArrowLeft, FileText, Shield } from 'lucide-react';
import { CURRENT_LEGAL_TERMS_VERSION } from '../config/legal';
import type { LegalSection } from '../content/legalTerms';
import { ROUTES } from '../lib/routes';
import { MatrizEditorialLayout } from './marketing/MatrizEditorialLayout';

type LegalDocumentPageProps = {
  title: string;
  summary: string;
  sections: readonly LegalSection[];
  icon: 'terms' | 'privacy';
};

function sectionId(title: string, index: number) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `secao-${index + 1}-${slug}`;
}

export default function LegalDocumentPage({ title, summary, sections, icon }: LegalDocumentPageProps) {
  const Icon = icon === 'privacy' ? Shield : FileText;
  const eyebrow = icon === 'privacy' ? 'Privacidade e proteção' : 'Acordos de uso';

  return (
    <MatrizEditorialLayout>
      <main className="relative z-[1] mx-auto w-full max-w-[1180px] px-5 pb-24 pt-32 sm:px-7 md:pt-36 lg:px-8">
        <a
          href={ROUTES.home}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#181a16]/60 transition hover:text-[#9b6a00]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao site
        </a>

        <header className="relative mt-6 overflow-hidden rounded-[1.75rem] bg-[#0d140f] px-6 py-8 text-[#f7f1e5] shadow-[0_28px_80px_rgba(20,25,18,.18)] sm:px-10 sm:py-11 lg:px-14 lg:py-14">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(229,174,18,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.16)_1px,transparent_1px)] [background-size:74px_74px]" aria-hidden />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#e5ae12]/25" aria-hidden />
          <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full border border-[#e5ae12]/20" aria-hidden />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-3 text-[#e5ae12]">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[#e5ae12]/35 bg-[#e5ae12]/10">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]">{eyebrow}</span>
            </div>
            <h1 className="mt-8 text-balance text-[clamp(2.4rem,7vw,5rem)] font-extrabold leading-[0.94] tracking-[-0.055em]">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#f7f1e5]/67 sm:text-lg">{summary}</p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 pt-5 text-xs font-bold text-white/48">
              <span>Versão {CURRENT_LEGAL_TERMS_VERSION}</span>
              <span>{sections.length} seções</span>
              <span>Documento oficial AxéCloud</span>
            </div>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
          <aside className="rounded-2xl border border-[#cfc4b1]/60 bg-[#fffaf1]/80 p-5 backdrop-blur-sm lg:sticky lg:top-28" aria-label="Índice do documento">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9b6a00]">Neste documento</p>
            <nav className="mt-4">
              <ol className="space-y-1">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#${sectionId(section.title, index)}`}
                      className="group flex gap-3 rounded-xl px-2 py-2 text-xs font-bold leading-5 text-[#181a16]/58 transition hover:bg-[#e5ae12]/10 hover:text-[#181a16]"
                    >
                      <span className="text-[#9b6a00]/65">{String(index + 1).padStart(2, '0')}</span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="overflow-hidden rounded-[1.75rem] border border-[#cfc4b1]/60 bg-[#fffaf1]/92 shadow-[0_24px_70px_rgba(63,49,27,.09)]">
            {sections.map((section, index) => (
              <section
                id={sectionId(section.title, index)}
                key={section.title}
                className="grid scroll-mt-32 gap-4 border-b border-[#cfc4b1]/55 px-6 py-8 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:px-9 sm:py-10"
              >
                <span className="text-xs font-extrabold tracking-[0.16em] text-[#b07800]">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="text-xl font-extrabold tracking-[-0.025em] text-[#181a16] sm:text-2xl">{section.title}</h2>
                  <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[#181a16]/68 sm:text-base">{section.body}</p>
                </div>
              </section>
            ))}
          </article>
        </div>
      </main>
    </MatrizEditorialLayout>
  );
}
