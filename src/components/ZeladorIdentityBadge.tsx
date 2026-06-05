import { cn } from '../lib/utils';
import { useFounderHouseStatus } from '../hooks/useFounderHouseStatus';
import { FounderHouseBadge } from './founder/FounderHouseBadge';

type ZeladorIdentityBadgeProps = {
  tenantData?: {
    nome?: string;
    foto_url?: string | null;
    plan?: string;
    cargo?: string | null;
    role?: string;
  } | null;
  className?: string;
};

/** Badge de foto, nome, plano e cargo — mesmo visual em todas as páginas. */
export function ZeladorIdentityBadge({ tenantData, className }: ZeladorIdentityBadgeProps) {
  const isZelador = tenantData?.role !== 'filho';
  const { isFounderHouse } = useFounderHouseStatus(isZelador);
  const displayName = tenantData?.nome?.trim() || 'Zelador';
  const initial = (displayName[0] || 'Z').toUpperCase();
  const roleLine =
    tenantData?.role === 'filho' ? 'Filho de Santo' : tenantData?.cargo?.trim() || null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 pr-3',
        className
      )}
      aria-label="Identificação do zelador"
    >
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary bg-primary text-sm font-black text-background shadow-lg shadow-primary/20 md:h-9 md:w-9">
        {tenantData?.foto_url ? (
          <img
            src={tenantData.foto_url}
            alt={displayName}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) parent.textContent = initial;
            }}
          />
        ) : (
          initial
        )}
      </div>
      <div className="hidden min-w-0 flex-col items-start gap-0.5 md:flex">
        <div className="flex max-w-[220px] items-center gap-2">
          <span className="truncate text-sm font-bold tracking-tight text-white" title={displayName}>
            {displayName}
          </span>
          {isFounderHouse ? (
            <FounderHouseBadge variant="compact" />
          ) : (
            <span className="shrink-0 rounded-[4px] bg-[#FBBC00]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FBBC00]">
              {tenantData?.plan?.toUpperCase() || 'PREMIUM'}
            </span>
          )}
        </div>
        {roleLine && (
          <span className="max-w-[220px] truncate text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {roleLine}
          </span>
        )}
      </div>
    </div>
  );
}
