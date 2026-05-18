import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/cn";

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
    <section className="bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-yellow-500 uppercase tracking-[0.3em] text-xs">Sistema</p>
          <h3 className="text-2xl sm:text-3xl font-black mt-2">
            {compact ? "Últimos terreiros cadastrados" : "Terreiros cadastrados"}
          </h3>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar usuário ou terreiro..."
          className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 w-full lg:w-96 outline-none focus:border-yellow-500 text-white placeholder:text-zinc-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400 text-sm uppercase tracking-wider">
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
                <td colSpan={compact ? 5 : 6} className="px-8 py-12 text-center text-zinc-500">
                  {busy ? "A carregar…" : "Nenhum terreiro encontrado."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-900 hover:bg-zinc-900/60 transition-all"
                >
                  <td className="px-6 sm:px-8 py-6 font-semibold">{row.nome_terreiro || "—"}</td>
                  <td className="px-6 sm:px-8 py-6">
                    <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-semibold">
                      {planLabel(row.plan)}
                    </span>
                  </td>
                  {!compact && (
                    <td className="px-6 sm:px-8 py-6 text-zinc-400 text-sm max-w-[200px] truncate">
                      {row.email || "—"}
                    </td>
                  )}
                  <td className="px-6 sm:px-8 py-6 text-zinc-400 text-sm">
                    {row.expires_at
                      ? format(new Date(row.expires_at), "dd/MM/yyyy", { locale: ptBR })
                      : cadastroLabel(row.expires_at, row.created_at)}
                  </td>
                  <td className="px-6 sm:px-8 py-6">
                    {row.is_blocked ? (
                      <span className="text-red-400">● Bloqueado</span>
                    ) : (
                      <span className="text-emerald-400">● Ativo</span>
                    )}
                  </td>
                  <td className="px-6 sm:px-8 py-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onManage(row.id)}
                        className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-semibold hover:scale-105 transition-all text-sm"
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        onClick={() => onBlock(row.id, !row.is_blocked)}
                        className={cn(
                          "px-4 py-2 rounded-xl bg-zinc-900 border font-semibold text-sm transition-all",
                          row.is_blocked
                            ? "border-emerald-700 hover:border-emerald-500 text-emerald-300"
                            : "border-zinc-700 hover:border-red-500 text-zinc-300"
                        )}
                      >
                        {row.is_blocked ? "Desbloquear" : "Bloquear"}
                      </button>
                      {!compact && (
                        <>
                          <button
                            type="button"
                            onClick={() => onRenewMonth(row.id)}
                            className="px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:border-yellow-500/40"
                          >
                            +1 mês
                          </button>
                          <button
                            type="button"
                            onClick={() => onLifetime(row.id)}
                            className="px-3 py-2 rounded-xl border border-zinc-700 text-xs text-zinc-400 hover:border-yellow-500/40"
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
