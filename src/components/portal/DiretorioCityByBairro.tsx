import { DiretorioTerreiroCard } from './DiretorioTerreiroCard';
import type { DiretorioBairroGroup } from '../../lib/diretorioPublic';
import { cn } from '../../lib/utils';

type Props = {
  bairros: DiretorioBairroGroup[];
  className?: string;
};

export function DiretorioCityByBairro({ bairros, className }: Props) {
  return (
    <div className={cn('mt-8 space-y-12', className)}>
      <nav
        aria-label="Bairros"
        className="sticky top-2 z-10 -mx-1 flex flex-wrap gap-2 rounded-2xl border border-[#ece4d2] bg-white/90 p-3 backdrop-blur-sm"
      >
        {bairros.map((b) => (
          <a
            key={b.slug}
            href={`#bairro-${b.slug}`}
            className="rounded-full border border-[#ece4d2] bg-white px-3 py-1.5 text-xs font-bold text-[#1b1813]/75 transition hover:border-[#FFC107]/60 hover:text-[#1b1813]"
          >
            {b.nome}
            <span className="ml-1.5 font-normal text-[#1b1813]/45">({b.total})</span>
          </a>
        ))}
      </nav>

      {bairros.map((b) => (
        <section key={b.slug} id={`bairro-${b.slug}`} className="scroll-mt-24">
          <header className="mb-5 border-b border-[#ece4d2]/80 pb-3">
            <h2 className="font-display text-xl font-black text-[#1b1813] sm:text-2xl">{b.nome}</h2>
            <p className="mt-1 text-sm text-[#1b1813]/55">
              {b.total} terreiro{b.total === 1 ? '' : 's'} neste bairro
            </p>
          </header>
          <ul className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {b.items.map((t) => (
              <DiretorioTerreiroCard key={t.slug} terreiro={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
