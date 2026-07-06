import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import {
  MatrizKicker,
  MatrizSectionTitle,
  matrizPortalCardClass,
} from '../../components/marketing/ContentMarketingLayout';
import { MatrizPageBackground } from '../../components/marketing/MatrizPageBackground';
import { LITURGICAL_CALENDAR_MONTHS } from '../../content/portalLiturgical';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

export default function LiturgicalCalendarPage() {
  return (
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main className="relative z-[1] mx-auto w-full max-w-4xl px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <a
          href={ROUTES.contentHub}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#e8dfd0] bg-white/70 px-4 py-2 text-xs font-bold text-[#1b1813]/55 transition hover:border-[#ffc107]/40 hover:text-[#a87400]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao conteúdo
        </a>

        <motion.div
          initial={{ opacity: 0, y: 34, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <MatrizKicker>Cultura & tradição</MatrizKicker>
          <h1 className="mt-6 max-w-5xl text-balance text-4xl font-black leading-[1.05] tracking-tight text-[#1b1813] md:text-5xl">
            Calendário litúrgico de referência
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#1b1813]/66 md:text-lg">
            Datas culturais frequentemente celebradas em casas de axé no Brasil. Cada terreiro tem seu calendário
            próprio — confirme sempre com a diretoria da casa que você frequenta.
          </p>
        </motion.div>

        <div className="mt-12 space-y-10">
          {LITURGICAL_CALENDAR_MONTHS.map((month, monthIndex) => (
            <motion.section
              key={month.month}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(monthIndex * 0.04, 0.35) }}
            >
              <MatrizSectionTitle>{month.month}</MatrizSectionTitle>
              <ul className="mt-4 space-y-3">
                {month.dates.map((d) => (
                  <li
                    key={`${month.month}-${d.day}-${d.title}`}
                    className={cn(matrizPortalCardClass, 'px-4 py-3 transition hover:border-[#ffc107]/40')}
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-[#a87400]">{d.day}</p>
                    <p className="mt-1 font-semibold text-[#1b1813]">{d.title}</p>
                    {d.note ? <p className="mt-1 text-sm text-[#1b1813]/65">{d.note}</p> : null}
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>
      </main>
    </div>
  );
}
