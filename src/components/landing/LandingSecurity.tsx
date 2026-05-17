import { motion } from 'framer-motion';
import { Lock, Server, ShieldCheck } from 'lucide-react';

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
    <section
      id="seguranca"
      className="relative border-t border-white/5 py-16 sm:py-20"
      aria-labelledby="seguranca-head"
    >
      <motion.div
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
        {...fade}
      >
        <div className="flex flex-col gap-8 rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900/80 via-neutral-950/90 to-neutral-900/80 p-6 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-10 sm:p-8 lg:p-10">
          <div className="flex shrink-0 items-center justify-center sm:w-[120px]">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-2xl" aria-hidden />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 sm:h-20 sm:w-20">
                <ShieldCheck className="h-9 w-9 text-amber-400 sm:h-10 sm:w-10" strokeWidth={1.5} aria-hidden />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="seguranca-head"
              className="text-xl font-extrabold leading-snug text-white sm:text-2xl"
            >
              Seus dados protegidos com absoluto respeito e sigilo
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
              Os dados de filhos de santo, registros financeiros e rotinas da casa são criptografados,
              protegidos em servidores seguros e tratados com total confidencialidade — como manda a tradição de
              cuidar do que é sagrado.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6" role="list">
              {points.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[13px] text-neutral-400">
                  <Icon className="h-4 w-4 shrink-0 text-amber-500/80" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
