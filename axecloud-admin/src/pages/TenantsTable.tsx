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

function cadastroLabel(expires_at?: string | null, created_at?: string | null): string {
  const ref = created_at || expires_at;
  if (!ref) return "—";
  try {
    return formatDistanceToNow(new Date(ref), { addSuffix: true, locale: ptBR });
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
  busy,
  compact,
}: TenantsTableProps) {
  return (
    <section className="admin-panel !p-0 overflow-hidden">
      <div className="flex flex-col gap-6 border-b border-[var(--ac-paper-border)] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="admin-kicker">Sistema</p>
          <h3 className="admin-section-title mt-1">
            {compact ? "Últimos terreiros cadastrados" : "Terreiros cadastrados"}
          </h3>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar usuário ou terreiro..."
          className="admin-input w-full lg:max-w-md"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className={cn(admin.thead, "text-left text-sm uppercase tracking-wider")}>
              <th className="px-6 sm:px-8 py-5">Terreiro</th>
              <th className="px-6 sm:px-8 py-5">Plano</th>
              {!compact && <th className="px-6 sm:px-8 py-5">E-mail</th>}
              <th className="px-6 sm:px-8 py-5">Cadastro</th>
              <th className="px-6 sm:px-8 py-5">Status</th>
              <th className="px-6 sm:px-8 py-5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={compact ? 5 : 6} className="px-8 py-12 text-center text-[var(--ac-text-muted)]">
                  {busy ? "A carregar…" : "Nenhum terreiro encontrado."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)] transition-all")}
                >
                  <td className="px-6 sm:px-8 py-6 font-semibold text-[var(--ac-text)]">{row.nome_terreiro || "—"}</td>
                  <td className="px-6 sm:px-8 py-6">
                    <span className={admin.badgeStrong + " px-4 py-2 rounded-full text-sm"}>
                      {planLabel(row.plan)}
                    </span>
                  </td>
                  {!compact && (
                    <td className="px-6 sm:px-8 py-6 text-[var(--ac-text-muted)] text-sm max-w-[200px] truncate">
                      {row.email || "—"}
                    </td>
                  )}
                  <td className="px-6 sm:px-8 py-6 text-[var(--ac-text-muted)] text-sm">
                    {row.expires_at
                      ? format(new Date(row.expires_at), "dd/MM/yyyy", { locale: ptBR })
                      : cadastroLabel(row.expires_at, row.created_at)}
                  </td>
                  <td className="px-6 sm:px-8 py-6">
                    {row.is_blocked ? (
                      <span className="text-[var(--ac-danger)]">● Bloqueado</span>
                    ) : (
                      <span className="text-[var(--ac-success)]">● Ativo</span>
                    )}
                  </td>
                  <td className="px-6 sm:px-8 py-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onManage(row.id)}
                        className="admin-btn-primary !rounded-xl text-sm hover:scale-[1.02]"
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlock(row.id, !row.is_blocked)}
                        className={cn(
                          "admin-btn-secondary !rounded-xl text-sm",
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
                            className="admin-btn-ghost !rounded-xl border border-[var(--ac-paper-border)] !px-3 !py-2"
                          >
                            +1 mês
                          </button>
                          <button
                            type="button"
                            onClick={() => onLifetime(row.id)}
                            className="admin-btn-ghost !rounded-xl border border-[var(--ac-paper-border)] !px-3 !py-2"
                          >
                            Vitalício
                          </button>
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
