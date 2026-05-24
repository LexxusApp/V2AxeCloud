import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { HOME_FAQ } from '../../constants/seoHome';
import { cn } from '../../lib/utils';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-800 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 py-4 text-left sm:py-5"
      >
        <span className="text-sm font-semibold text-white sm:text-base">{q}</span>
        <ChevronDown
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 text-amber-500/80 transition-transform duration-200',
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
            <p className="pb-4 text-sm leading-relaxed text-neutral-400 sm:pb-5">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative border-t border-white/5 py-16 sm:py-20"
      aria-labelledby="faq-head"
    >
      <motion.div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8" {...fade}>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">
            Dúvidas frequentes
          </p>
          <h2 id="faq-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            Perguntas sobre gestão de terreiros
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Umbanda, Candomblé, Jurema e casas de axé — tire suas dúvidas sobre o AxéCloud.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 backdrop-blur-sm sm:px-6">
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
    </section>
  );
}
