import { motion } from 'framer-motion';
import { Check, Crown, UserCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LandingSection, LandingSectionHeader } from './LandingSection';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

type AccessCard = {
  id: string;
  icon: LucideIcon;
  title: string;
  topics: string[];
  featured?: boolean;
};

const ACCESS_CARDS: AccessCard[] = [
  {
    id: 'zelador',
    icon: Crown,
    title: 'Painel do Zelador (Administração)',
    topics: [
      'Controle total do caixa da casa',
      'Galeria de fotos e álbuns da casa',
      'Cadastro de filhos de santo',
      'Chamadas de giras e eventos',
      'Relatórios financeiros da Efí Bank',
    ],
  },
  {
    id: 'filho',
    icon: UserCircle,
    title: 'Portal do Filho de Santo (Comunidade)',
    topics: [
      'Calendário de obrigações e giras',
      'Consulta rápida ao extrato de mensalidades',
      'Geração de Pix automático para contribuições',
      'Acesso ao mural de avisos da casa',
    ],
    featured: true,
  },
];

function AccessCardBlock({ card, index }: { card: AccessCard; index: number }) {
  const Icon = card.icon;

  return (
    <motion.article
      initial={fade.initial}
      whileInView={fade.whileInView}
      viewport={fade.viewport}
      transition={{ ...fade.transition, delay: 0.08 * index }}
      className={cn(
        'landing-mystic-card flex h-full flex-col p-6 sm:p-7',
        card.featured && 'border-primary/30 shadow-[0_0_48px_-18px_rgba(251,188,0,0.28)]'
      )}
    >
      <div
        className={cn(
          'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border',
          card.featured
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-white/10 bg-white/[0.04] text-primary'
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </div>

      <h3 className="mb-4 text-lg font-bold text-white sm:text-xl">{card.title}</h3>

      <ul className="mt-auto space-y-3" role="list">
        {card.topics.map((topic) => (
          <li key={topic} className="flex items-start gap-2.5 text-sm text-zinc-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
            <span className="leading-relaxed">{topic}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

export function ConnectedAccess() {
  return (
    <LandingSection id="acessos" aria-labelledby="acessos-head">
      <div className="landing-section-inner">
        <motion.div {...fade}>
          <LandingSectionHeader
            kicker="Dois mundos, um axé"
            title="Acessos conectados"
            titleId="acessos-head"
            lead="O mesmo terreiro, duas experiências: quem administra a casa e quem vive a comunidade — cada um no seu lugar, tudo integrado."
          />
        </motion.div>

        <div className="relative z-10 mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {ACCESS_CARDS.map((card, i) => (
            <AccessCardBlock key={card.id} card={card} index={i} />
          ))}
        </div>

        <motion.p
          {...fade}
          transition={{ ...fade.transition, delay: 0.15 }}
          className="relative z-10 mt-10 text-center text-sm font-medium tracking-wide text-zinc-400 sm:text-base"
        >
          Uma comunidade conectada com respeito, organização e axé.
        </motion.p>
      </div>
    </LandingSection>
  );
}
