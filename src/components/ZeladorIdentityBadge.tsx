import { cn } from '../lib/utils';
import { performFastLogout } from '../lib/logout';
import Avatar from './Avatar';

type ZeladorIdentityBadgeProps = {
  tenantData?: {
    nome?: string;
    foto_url?: string | null;
    plan?: string;
    cargo?: string | null;
    role?: string;
  } | null;
  className?: string;
  /** Link discreto de logout abaixo da foto */
  showLogout?: boolean;
  /** Só avatar (+ sair); sem nome e badges */
  compact?: boolean;
  /** Foto alternativa (ex.: filho de santo) */
  fotoUrl?: string | null;
  displayName?: string;
};

/** Badge de foto, nome, plano e cargo — mesmo visual em todas as páginas. */
export function ZeladorIdentityBadge({
  tenantData,
  className,
  showLogout,
  compact,
  fotoUrl,
  displayName: displayNameProp,
}: ZeladorIdentityBadgeProps) {
  const displayName = displayNameProp?.trim() || tenantData?.nome?.trim() || 'Zelador';
  const roleLine =
    tenantData?.role === 'filho' ? 'Filho de Santo' : tenantData?.cargo?.trim() || null;
  const avatarSrc = fotoUrl ?? tenantData?.foto_url;

  const avatar = (
    <Avatar
      src={avatarSrc}
      name={displayName}
      alt={displayName}
      shape="circle"
      textSize="text-xs"
      className="h-8 w-8 border border-primary shadow-lg shadow-primary/20 md:h-9 md:w-9"
    />
  );

  const logoutBtn = showLogout ? (
    <button
      type="button"
      onClick={() => void performFastLogout()}
      className="text-[9px] font-medium tracking-wide text-[#4B5563] transition-colors hover:text-[#94A3B8]"
    >
      sair
    </button>
  ) : null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1',
        compact ? 'pr-1' : 'pr-3',
        className
      )}
      aria-label="Identificação do zelador"
    >
      {showLogout ? (
        <div className="flex flex-col items-center gap-0.5 px-0.5">
          {avatar}
          {logoutBtn}
        </div>
      ) : (
        avatar
      )}
      {!compact && (
      <div className="hidden min-w-0 flex-col items-start gap-0.5 md:flex">
        <div className="flex max-w-[220px] items-center gap-2">
          <span className="truncate text-sm font-bold tracking-tight text-white" title={displayName}>
            {displayName}
          </span>
          <span className="shrink-0 rounded-[4px] bg-[#FBBC00]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FBBC00]">
            {tenantData?.plan?.toUpperCase() || 'PREMIUM'}
          </span>
        </div>
        {roleLine && (
          <span className="max-w-[220px] truncate text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {roleLine}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
