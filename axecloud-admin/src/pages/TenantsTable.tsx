import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/cn";
import { admin } from "@/lib/adminTheme";

export type TenantTableRow = {
  id: string;
  email: string | null;
  nome_terreiro: string | null;
  is_blocked?: boolean | null;
  plan?: string;
  expires_at?: string | null;
  totalChildren?: number;
  created_at?: string | null;
};

function planLabel(plan?: string | null): string {
  const p = (plan || "").toLowerCase();
  if (p === "vita" || p === "vitalicio" || p === "lifetime") return "Vitalício";
  if (p === "premium") return "Premium";
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function cadastroLabel(created_at?: string | null): string {
  if (!created_at) return "—";
  try {
    return formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

function expiraLabel(expires_at?: string | null): string {
  if (!expires_at) return "—";
  try {
    return format(new Date(expires_at), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

type TenantsTableProps = {
  rows: TenantTableRow[];
  search: string;
  onSearchChange: (v: string) => void;
  onManage: (id: string) => void;
  onBlock: (id: string, blocked: boolean) => void;
  onRenewMonth: (id: string) => void;
  onLifetime: (id: string) => void;
  onDelete?: (id: string) => void;
  busy?: boolean;
  compact?: boolean;
};

export function TenantsTable({
  rows,
  search,
  onSearchChange,
  onManage,
  onBlock,
  onRenewMonth,
  onLifetime,
  onDelete,
  busy,
  compact,
}: TenantsTableProps) {
  const cell = "px-4 py-2.5";
  const head = cn(cell, "text-[10px] font-semibold uppercase tracking-wider text-[var(--ac-text-muted)]");

  return (
    <section className="admin-panel !p-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--ac-paper-border)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="admin-kicker !text-[10px]">Sistema</p>
          <h3 className="text-base font-semibold text-[var(--ac-text)] mt-0.5">
            {compact ? "Últimos terreiros cadastrados" : "Terreiros cadastrados"}
          </h3>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar usuário ou terreiro..."
          className="admin-input !py-2 !text-sm w-full lg:max-w-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={cn(admin.thead, "text-left")}>
              <th className={head}>Terreiro</th>
              <th className={head}>Plano</th>
              {!compact && <th className={head}>E-mail</th>}
              <th className={head}>Cadastro</th>
              {!compact && <th className={head}>Expira</th>}
              <th className={head}>Status</th>
              <th className={head}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={compact ? 5 : 7} className="px-4 py-8 text-center text-xs text-[var(--ac-text-muted)]">
                  {busy ? "A carregar…" : "Nenhum terreiro encontrado."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)] transition-all")}
                >
                  <td className={cn(cell, "font-medium text-[var(--ac-text)] max-w-[180px] truncate")}>
                    {row.nome_terreiro || "—"}
                  </td>
                  <td className={cell}>
                    <span className={cn(admin.badgeStrong, "px-2 py-0.5 text-[11px] font-medium")}>
                      {planLabel(row.plan)}
                    </span>
                  </td>
                  {!compact && (
                    <td className={cn(cell, "text-[var(--ac-text-muted)] text-xs max-w-[160px] truncate")}>
                      {row.email || "—"}
                    </td>
                  )}
                  <td className={cn(cell, "text-[var(--ac-text-muted)] text-xs whitespace-nowrap")}>
                    {cadastroLabel(row.created_at)}
                  </td>
                  {!compact && (
                    <td className={cn(cell, "text-[var(--ac-text-muted)] text-xs whitespace-nowrap")}>
                      {expiraLabel(row.expires_at)}
                    </td>
                  )}
                  <td className={cn(cell, "text-xs whitespace-nowrap")}>
                    {row.is_blocked ? (
                      <span className="text-[var(--ac-danger)]">● Bloqueado</span>
                    ) : (
                      <span className="text-[var(--ac-success)]">● Ativo</span>
                    )}
                  </td>
                  <td className={cell}>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onManage(row.id)}
                        className="admin-btn-primary !px-2.5 !py-1 text-xs"
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlock(row.id, !row.is_blocked)}
                        className={cn(
                          "admin-btn-secondary !px-2.5 !py-1 text-xs",
                          row.is_blocked
                            ? "!border-[rgba(13,122,78,0.35)] !text-[var(--ac-success)]"
                            : "!border-[var(--ac-paper-border)] hover:!border-[var(--ac-danger)] hover:!text-[var(--ac-danger)]"
                        )}
                      >
                        {row.is_blocked ? "Desbloquear" : "Bloquear"}
                      </button>
                      {!compact && (
                        <>
                          <button
                            type="button"
                            onClick={() => onRenewMonth(row.id)}
                            className="admin-btn-ghost border border-[var(--ac-paper-border)] !px-2 !py-1 text-[11px]"
                          >
                            +1 mês
                          </button>
                          <button
                            type="button"
                            onClick={() => onLifetime(row.id)}
                            className="admin-btn-ghost border border-[var(--ac-paper-border)] !px-2 !py-1 text-[11px]"
                          >
                            Vitalício
                          </button>
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(row.id)}
                              disabled={busy}
                              className="admin-btn-ghost !rounded-lg border border-[rgba(180,40,40,0.35)] !px-2 !py-1 text-[11px] text-[var(--ac-danger)] hover:!bg-[rgba(180,40,40,0.06)] disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
