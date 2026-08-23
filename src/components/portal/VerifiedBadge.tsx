import { BadgeCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1877F2]/12 font-bold text-[#1877F2]',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      )}
      title="Terreiro verificado e reivindicado no AxéCloud"
    >
      <BadgeCheck className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {compact ? null : 'Terreiro verificado e reivindicado'}
    </span>
  );
}
