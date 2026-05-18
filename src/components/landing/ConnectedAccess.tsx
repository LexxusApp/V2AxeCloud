import { motion } from 'framer-motion';
import { Check, Crown, UserCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

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
      'Gerenciamento do estoque do almoxarifado',
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
        'flex h-full flex-col rounded-2xl border p-6 sm:p-7',
        card.featured
          ? 'border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] via-neutral-900/50 to-neutral-950/90 shadow-[0_0_48px_-18px_rgba(251,191,36,0.35)]'
          : 'border-neutral-800 bg-neutral-900/40 backdrop-blur-sm'
      )}
    >
      <div
        className={cn(
          'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border',
          card.featured
            ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
            : 'border-neutral-700 bg-neutral-950/80 text-primary'
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </div>

      <h3 className="mb-4 text-lg font-bold text-white sm:text-xl">{card.title}</h3>

      <ul className="mt-auto space-y-3" role="list">
        {card.topics.map((topic) => (
          <li key={topic} className="flex items-start gap-2.5 text-sm text-neutral-400">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                card.featured ? 'text-amber-400' : 'text-primary'
              )}
              strokeWidth={2.2}
              aria-hidden
            />
            <span className="leading-relaxed">{topic}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

export function ConnectedAccess() {
  return (
    <section
      id="acessos"
      className="relative border-t border-white/5 bg-neutral-950 py-16 sm:py-24"
      aria-labelledby="acessos-head"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fade} className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/90">Dois mundos, um axé</p>
          <h2 id="acessos-head" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Acessos conectados
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
            O mesmo terreiro, duas experiências: quem administra a casa e quem vive a comunidade — cada um no seu
            lugar, tudo integrado.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {ACCESS_CARDS.map((card, i) => (
            <AccessCardBlock key={card.id} card={card} index={i} />
          ))}
        </div>

        <motion.p
          {...fade}
          transition={{ ...fade.transition, delay: 0.15 }}
          className="mt-10 text-center text-sm font-medium tracking-wide text-neutral-400 sm:text-base"
        >
          Uma comunidade conectada com respeito, organização e axé.
        </motion.p>
      </div>
    </section>
  );
}
