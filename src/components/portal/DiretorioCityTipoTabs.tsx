import type { DiretorioEstabelecimentoTipo } from '../../lib/diretorioPublic';
import { cn } from '../../lib/utils';

type Props = {
  value: DiretorioEstabelecimentoTipo;
  onChange: (tipo: DiretorioEstabelecimentoTipo) => void;
  totalTerreiros: number;
  totalLojas: number;
  className?: string;
};

export function DiretorioCityTipoTabs({
  value,
  onChange,
  totalTerreiros,
  totalLojas,
  className,
}: Props) {
  const tabs: { id: DiretorioEstabelecimentoTipo; label: string; count: number }[] = [
    { id: 'terreiro', label: 'Terreiros', count: totalTerreiros },
    { id: 'loja', label: 'Lojas', count: totalLojas },
  ];

  return (
    <div
      className={cn(
        'mt-6 inline-flex rounded-xl border border-[#ece4d2] bg-white/80 p-1 shadow-sm',
        className,
      )}
      role="tablist"
      aria-label="Tipo de estabelecimento"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-bold transition',
              active
                ? 'bg-[#FFC107] text-[#1b1813] shadow-sm'
                : 'text-[#1b1813]/60 hover:text-[#1b1813]',
            )}
          >
            {tab.label}
            <span className={cn('ml-1.5 tabular-nums', active ? 'text-[#1b1813]/70' : 'text-[#1b1813]/40')}>
              ({tab.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
