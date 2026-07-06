import Avatar from '../Avatar';
import { cn } from '../../lib/utils';
import type { EventoConfirmadoResumo } from '../../lib/giraOperations';

const DEFAULT_MAX = 4;

export function EventConfirmedAvatars({
  members,
  maxVisible = DEFAULT_MAX,
  className,
}: {
  members: EventoConfirmadoResumo[];
  maxVisible?: number;
  className?: string;
}) {
  if (members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const extra = members.length - visible.length;

  return (
    <div className={cn('flex items-center gap-2 border-t border-[#1E242B] px-3 py-2', className)}>
      <p className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Confirmados</p>
      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex -space-x-2">
          {visible.map((member) => (
            <span key={member.filho_id} title={member.nome} className="inline-flex shrink-0">
              <Avatar
                src={member.foto_url}
                name={member.nome}
                shape="circle"
                className="h-7 w-7 border-2 border-[#13171D]"
                textSize="text-[9px]"
              />
            </span>
          ))}
        </div>
        {extra > 0 ? (
          <span
            className="ml-1.5 shrink-0 rounded-full bg-[#12161A] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary"
            title={`${members.length} confirmados`}
          >
            +{extra}
          </span>
        ) : null}
      </div>
    </div>
  );
}
