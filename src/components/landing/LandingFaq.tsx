import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { HOME_FAQ } from '../../constants/seoHome';
import { cn } from '../../lib/utils';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[#2a2108] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 py-4 text-left sm:py-5"
      >
        <span className="text-sm font-semibold text-white sm:text-base">{q}</span>
        <ChevronDown
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 text-primary/80 transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm leading-relaxed text-zinc-400 sm:pb-5">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <LandingSection id="faq" aria-labelledby="faq-head">
      <motion.div className="landing-section-inner mx-auto max-w-4xl" {...fade}>
        <LandingSectionHeader
          kicker="Dúvidas frequentes"
          title="Perguntas sobre gestão de terreiros"
          titleId="faq-head"
          lead="Umbanda, Candomblé, Jurema e casas de axé — tire suas dúvidas sobre o AxéCloud."
        />

        <div className="landing-mystic-card relative z-10 mt-8 px-4 sm:px-6">
          {HOME_FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </motion.div>
    </LandingSection>
  );
}
