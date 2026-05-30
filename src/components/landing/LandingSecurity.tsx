import { motion } from 'framer-motion';
import { Lock, Server, ShieldCheck } from 'lucide-react';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const points = [
  { icon: Lock, label: 'Dados criptografados em trânsito e em repouso' },
  { icon: Server, label: 'Hospedagem em servidores seguros e monitorados' },
  { icon: ShieldCheck, label: 'Sigilo total sobre filhos de santo e finanças da casa' },
] as const;

export function LandingSecurity() {
  return (
    <LandingSection id="seguranca" aria-labelledby="seguranca-head">
      <motion.div className="landing-section-inner" {...fade}>
        <div className="landing-mystic-card relative z-10 flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8 lg:p-10">
          <div className="flex shrink-0 items-center justify-center sm:w-[120px]">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl" aria-hidden />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 sm:h-20 sm:w-20">
                <ShieldCheck className="h-9 w-9 text-primary sm:h-10 sm:w-10" strokeWidth={1.5} aria-hidden />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="landing-kicker !justify-start">Segurança</p>
            <h2
              id="seguranca-head"
              className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl"
            >
              Seus dados protegidos com absoluto respeito e sigilo
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Os dados de filhos de santo, registros financeiros e rotinas da casa são criptografados,
              protegidos em servidores seguros e tratados com total confidencialidade — como manda a tradição de
              cuidar do que é sagrado.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6" role="list">
              {points.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[13px] text-zinc-400">
                  <Icon className="h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </LandingSection>
  );
}
