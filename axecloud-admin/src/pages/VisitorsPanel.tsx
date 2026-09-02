import { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw, UsersRound } from "lucide-react";
import { apiJson } from "@/lib/api";
import { admin } from "@/lib/adminTheme";
import { cn } from "@/lib/cn";

type MonthlyVisitor = {
  month: string;
  label: string;
  visits: number;
  startsAt: string;
  endsAt: string;
  current: boolean;
};

type MonthlyVisitorsResponse = {
  available: boolean;
  months: MonthlyVisitor[];
  totalVisits: number;
};

const number = new Intl.NumberFormat("pt-BR");

function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function VisitorsPanel() {
  const [data, setData] = useState<MonthlyVisitorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiJson<MonthlyVisitorsResponse>("/api/admin-console/visitor-months"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar visitantes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentMonth = data?.months.find((month) => month.current);
  const closedMonths = data?.months.filter((month) => !month.current) || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={cn(admin.card, "p-5")}>
          <div className="flex items-center gap-3">
            <span className="admin-icon-chip admin-icon-chip--sky"><UsersRound className="h-4 w-4" /></span>
            <div>
              <p className="admin-label">Mês atual</p>
              <strong className="mt-1 block text-2xl text-[var(--ac-text)]">
                {loading ? "—" : number.format(currentMonth?.visits || 0)}
              </strong>
              <p className="mt-1 text-xs text-[var(--ac-text-muted)]">{currentMonth?.label || "Visitantes"}</p>
            </div>
          </div>
        </div>
        <div className={cn(admin.card, "p-5")}>
          <div className="flex items-center gap-3">
            <span className="admin-icon-chip admin-icon-chip--violet"><CalendarDays className="h-4 w-4" /></span>
            <div>
              <p className="admin-label">Histórico registrado</p>
              <strong className="mt-1 block text-2xl text-[var(--ac-text)]">
                {loading ? "—" : number.format(data?.totalVisits || 0)}
              </strong>
              <p className="mt-1 text-xs text-[var(--ac-text-muted)]">Soma de todos os meses</p>
            </div>
          </div>
        </div>
      </div>

      <section className={admin.card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ac-paper-border)] p-4">
          <div>
            <h2 className="font-semibold text-[var(--ac-text)]">Visitantes por mês</h2>
            <p className="mt-0.5 text-xs text-[var(--ac-text-muted)]">
              Cada navegador é contabilizado uma vez por dia; os meses encerrados não mudam.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center text-sm text-[var(--ac-danger)]">{error}</div>
        ) : loading ? (
          <div className="p-12 text-center text-sm text-[var(--ac-text-muted)]">Carregando histórico…</div>
        ) : data?.available === false ? (
          <div className="p-12 text-center text-sm text-[var(--ac-text-muted)]">A medição de visitantes ainda não está disponível.</div>
        ) : !data?.months.length ? (
          <div className="p-12 text-center text-sm text-[var(--ac-text-muted)]">Nenhuma visita registrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={admin.table}>
              <thead><tr className={admin.thead}>
                <th className={admin.th}>Mês</th>
                <th className={admin.th}>Período</th>
                <th className={cn(admin.th, "w-40 text-right")}>Visitas totais</th>
              </tr></thead>
              <tbody>
                {data.months.map((month) => (
                  <tr key={month.month} className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)] last:border-0")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--ac-text)]">{month.label}</span>
                        {month.current ? <span className="admin-badge admin-badge-blue">Em andamento</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ac-text-muted)]">
                      {shortDate(month.startsAt)} a {shortDate(month.endsAt)}
                    </td>
                    <td className="px-4 py-3 text-right admin-mono text-base font-bold text-[var(--ac-accent)]">
                      {number.format(month.visits)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closedMonths.length ? (
        <p className="text-xs text-[var(--ac-text-faint)]">{closedMonths.length} mês(es) encerrado(s) no histórico.</p>
      ) : null}
    </div>
  );
}
