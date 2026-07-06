import { ArrowLeft, FileText, Shield } from 'lucide-react';
import { CURRENT_LEGAL_TERMS_VERSION } from '../config/legal';
import type { LegalSection } from '../content/legalTerms';
import { ROUTES } from '../lib/routes';
import { MarketingMockupLayout } from './marketing/MarketingMockupLayout';
import { MarketingMockupPageHeader } from './marketing/MarketingMockupPageHeader';
import { landingMockupCardClass, landingMockupShellClass } from './landing/landingMockupUi';
import { cn } from '../lib/utils';

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
    <MarketingMockupLayout>
      <main className={cn('relative z-[1] py-10 sm:py-14', landingMockupShellClass, 'max-w-3xl')}>
        <a
          href={ROUTES.home}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1b1813]/50 transition hover:text-[#FFC107]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao site
        </a>

        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#FFC107]/35 bg-[#FFC107]/15 text-[#1b1813]">
            <Icon className="h-6 w-6" />
          </div>
          <MarketingMockupPageHeader kicker="Legal" title={title} summary={summary} className="min-w-0 flex-1" />
        </div>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className={cn('p-5 sm:p-6', landingMockupCardClass, 'rounded-2xl')}>
              <h2 className="text-base font-bold text-[#1b1813] sm:text-lg">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#1b1813]/70 sm:text-[15px]">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-[#1b1813]/45">
          Versão {CURRENT_LEGAL_TERMS_VERSION} · AxéCloud
        </p>
      </main>
    </MarketingMockupLayout>
  );
}
