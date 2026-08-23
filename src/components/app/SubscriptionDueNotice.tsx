import { AlertTriangle, ArrowRight, CalendarClock } from 'lucide-react';
import { getSubscriptionDueState } from '../../lib/subscriptionDue';

type SubscriptionDueNoticeProps = {
  tenantData: {
    plan?: string | null;
    expires_at?: string | null;
    status?: string | null;
    is_trial?: boolean;
  } | null;
  onOpen: () => void;
};

export function SubscriptionDueNotice({ tenantData, onOpen }: SubscriptionDueNoticeProps) {
  const due = getSubscriptionDueState({
    expiresAt: tenantData?.expires_at,
    plan: tenantData?.plan,
    status: tenantData?.status,
    isTrial: tenantData?.is_trial,
  });

  if (!due.needsAttention) return null;

  const Icon = due.isOverdue || due.daysRemaining === 0 ? AlertTriangle : CalendarClock;
  const title = due.isOverdue
    ? 'A mensalidade do AxéCloud precisa de atenção.'
    : due.daysRemaining === 0
      ? 'A mensalidade vence hoje.'
      : `A mensalidade vence em ${due.daysRemaining} dia${due.daysRemaining === 1 ? '' : 's'}.`;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
      <aside className="flex flex-col gap-4 rounded-2xl border border-amber-300/45 bg-[#FFF4D7] p-4 text-[#2B2415] shadow-[0_14px_35px_-28px_rgba(114,73,0,.75)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E5AE12] text-[#1B180E]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <strong className="block text-sm font-black">{title}</strong>
            <span className="mt-1 block text-xs font-semibold text-[#756443]">
              Consulte o ciclo e pague por Pix ou cartão sem sair do sistema.
            </span>
          </div>
        </div>
        <button type="button" onClick={onOpen} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173E30] px-4 text-xs font-black text-white transition hover:bg-[#102D23]">
          Ver minha assinatura <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </aside>
    </div>
  );
}
