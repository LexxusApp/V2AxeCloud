import { motion } from 'framer-motion';
import { Database, KeyRound, Scale, Server, ShieldCheck } from 'lucide-react';
import { LandingSection } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

const points = [
  {
    icon: ShieldCheck,
    title: 'Dados criptografados em trânsito e em repouso',
    detail: 'TLS 1.3 no canal HTTPS e AES-256 no armazenamento — da navegação ao banco de dados.',
  },
  {
    icon: Server,
    title: 'Hospedagem em servidores seguros e monitorados',
    detail: 'Infraestrutura dedicada com firewall, backups automáticos e vigilância contínua de disponibilidade.',
  },
  {
    icon: Database,
    title: 'Isolamento multi-tenant (RLS)',
    detail: 'Row Level Security no banco: cada terreiro só acessa o próprio ambiente.',
  },
  {
    icon: KeyRound,
    title: 'RBAC e menor privilégio',
    detail: 'Perfis segregados (zelador, filho, diretoria) com permissões granulares por módulo.',
  },
  {
    icon: Scale,
    title: 'LGPD e sigilo da casa',
    detail: 'Tratamento de dados pessoais alinhado à lei, com confidencialidade sobre filhos e finanças.',
  },
] as const;

export function LandingSecurity() {
  return (
    <LandingSection id="seguranca" aria-labelledby="seguranca-head">
      <motion.div className="landing-section-inner" {...fade}>
        <div className="landing-mystic-card relative z-10 flex flex-col gap-8 p-6 sm:flex-row sm:items-start sm:gap-10 sm:p-8 lg:p-10">
          <div className="flex shrink-0 items-center justify-center sm:w-[120px] sm:pt-1">
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
              className="mt-1 text-xl font-extrabold leading-snug text-white sm:text-2xl lg:text-3xl"
            >
              Infraestrutura blindada para o que é sagrado da sua casa
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Tratamos filhos de santo, financeiro e rotina litúrgica como dados sensíveis de missão crítica:
              arquitetura em nuvem com segregação por terreiro, criptografia ponta a ponta, políticas de acesso
              restritivas e monitoramento contínuo — porque zelar da casa também é zelar da privacidade dela.
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/80">
              HSTS · headers hardened · backups · conformidade LGPD
            </p>
            <ul className="mt-6 grid list-none gap-4 sm:grid-cols-2" role="list">
              {points.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold leading-snug text-white">{title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </LandingSection>
  );
}
