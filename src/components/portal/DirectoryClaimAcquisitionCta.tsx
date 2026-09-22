import { BadgeCheck, Search } from 'lucide-react';
import { useId } from 'react';
import { trackConversionEvent } from '../../lib/trackConversion';

export function DirectoryClaimAcquisitionCta({ cidade, total }: { cidade: string; total: number }) {
  const titleId = useId();

  return (
    <aside
      className="rounded-2xl border border-[#c8ad55] bg-[#f4e7b9] p-5 text-[#172019] shadow-[0_12px_36px_rgba(80,60,10,.08)]"
      aria-labelledby={titleId}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#172019] text-[#efba18]">
        <BadgeCheck className="h-5 w-5" aria-hidden />
      </span>
      <h2 id={titleId} className="mt-5 text-xl font-extrabold leading-tight tracking-[-0.025em]">
        Sua casa está na lista?
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#243127]/70">
        Entre os {total} perfis de {cidade}, encontre o seu e solicite a atualização dos dados.
      </p>
      <a
        href="#city-results"
        onClick={() => void trackConversionEvent('directory_action', {
          ctaId: 'directory-city-find-claim',
          ctaLabel: 'Encontrar minha casa',
          metadata: { cidade },
        })}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#172019] px-4 text-sm font-extrabold text-white transition-[background-color,color,transform] duration-200 hover:bg-[#efba18] hover:text-[#172019] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d6800] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4e7b9]"
      >
        <Search className="h-4 w-4" aria-hidden />
        Encontrar minha casa
      </a>
      <p className="mt-3 text-center text-xs font-semibold text-[#243127]/58">
        Reivindicação gratuita com análise humana.
      </p>
    </aside>
  );
}
