import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { HOME_FAQ } from '../../constants/seoHome';
import { LandingSection, LandingSectionHeader } from './LandingSection';

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <article className="landing-v3-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[#1E242B]/50 sm:px-5 sm:py-4"
      >
        <span className="text-sm font-bold leading-snug text-[#F1F5F9]">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-[#1E242B] px-4 pb-4 pt-0 text-sm leading-relaxed text-[#94A3B8] sm:px-5 sm:pb-5">
          <p className="pt-4">{a}</p>
        </div>
      ) : null}
    </article>
  );
}

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number>(-1);

  return (
    <LandingSection id="faq" aria-labelledby="faq-head">
      <div className="landing-section-inner">
        <div className="landing-faq-inner">
          <LandingSectionHeader
            kicker="Dúvidas frequentes"
            title="Perguntas sobre gestão de terreiros"
            titleId="faq-head"
            lead="Umbanda, Candomblé, Jurema e casas de axé — tire suas dúvidas sobre o AxéCloud."
          />

          <div className="relative z-10 mt-8 space-y-3 sm:mt-10">
          {HOME_FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
