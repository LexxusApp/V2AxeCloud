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
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-[#1E242B]/50 md:p-6"
      >
        <span className="text-sm font-bold text-[#F1F5F9] md:text-base">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-[#1E242B] px-5 pb-5 pt-0 text-sm leading-relaxed text-[#94A3B8] md:px-6 md:pb-6">
          <p className="pt-4">{a}</p>
        </div>
      ) : null}
    </article>
  );
}

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <LandingSection id="faq" aria-labelledby="faq-head">
      <div className="landing-section-inner mx-auto max-w-4xl">
        <LandingSectionHeader
          kicker="Dúvidas frequentes"
          title="Perguntas sobre gestão de terreiros"
          titleId="faq-head"
          lead="Umbanda, Candomblé, Jurema e casas de axé — tire suas dúvidas sobre o AxéCloud."
        />

        <div className="relative z-10 mt-10 space-y-3.5">
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
    </LandingSection>
  );
}
