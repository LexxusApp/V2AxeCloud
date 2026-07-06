import { cn } from '../../lib/utils';
import {
  adminActionDotClass,
  buildDashboardAdminActions,
  formatAdminActionWhen,
  type DashboardAdminAction,
} from '../../lib/dashboardAdminActions';

type DashboardAcoesAdministrativasProps = {
  transactions?: Array<{ tipo?: string; descricao?: string; valor?: number; data?: string; categoria?: string }>;
  children?: Array<{ id?: string; nome?: string; created_at?: string; cargo?: string; categoria?: string }>;
  notices?: Array<{ id?: string; titulo?: string; categoria?: string; data_publicacao?: string; created_at?: string }>;
  pedidos?: Array<{ id?: string; nome?: string; status?: string; created_at?: string; mensagem?: string }>;
  onOpenFinancial?: () => void;
  onOpenMural?: () => void;
  maxItems?: number;
};

function ActionRow({ action }: { action: DashboardAdminAction }) {
  return (
    <div className="flex items-start gap-3 text-xs text-gray-400">
      <span
        className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', adminActionDotClass(action.tone))}
        aria-hidden
      />
      <div>
        <span className="font-bold text-[#F1F5F9]">{action.label}</span> {action.detail}
        <span className="mt-0.5 block font-mono text-[10px] text-gray-500">{formatAdminActionWhen(action.at)}</span>
      </div>
    </div>
  );
}

export function DashboardAcoesAdministrativas({
  transactions = [],
  children = [],
  notices = [],
  pedidos = [],
  onOpenFinancial,
  onOpenMural,
  maxItems = 6,
}: DashboardAcoesAdministrativasProps) {
  const actions = buildDashboardAdminActions({
    transactions,
    children,
    notices,
    pedidos,
    max: maxItems,
  });

  return (
    <div className="space-y-4 rounded-3xl border border-[#1E242B] bg-[#13171D] p-6">
      <h4 className="font-display border-b border-[#1E242B] pb-3 text-sm font-black text-[#F1F5F9]">
        Últimas Ações Administrativas do Terreiro
      </h4>

      {actions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1E242B] bg-[#0D0F12] px-5 py-8 text-center">
          <p className="text-sm font-bold text-gray-400">Nenhuma ação recente registrada</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-gray-500">
            Lançamentos financeiros, cadastros, avisos no mural e pedidos de reza aparecem aqui automaticamente.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {onOpenFinancial ? (
              <button
                type="button"
                onClick={onOpenFinancial}
                className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-1.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-950/50"
              >
                Ir ao Financeiro
              </button>
            ) : null}
            {onOpenMural ? (
              <button
                type="button"
                onClick={onOpenMural}
                className="rounded-xl border border-rose-500/20 bg-rose-950/30 px-3 py-1.5 text-[10px] font-bold text-rose-400 transition-colors hover:bg-rose-950/50"
              >
                Publicar no Mural
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
