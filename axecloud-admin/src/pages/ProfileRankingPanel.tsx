import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Trophy } from "lucide-react";
import { apiJson } from "@/lib/api";
import { admin } from "@/lib/adminTheme";
import { cn } from "@/lib/cn";

type RankingItem = {
  terreiroId: string;
  terreiro: string;
  visits: number;
  googleVisits: number;
  directoryClicks: number;
};

type RankingResponse = {
  items: RankingItem[];
  totalClicks: number;
  totalGoogleVisits: number;
  profilesWithViews: number;
};

const number = new Intl.NumberFormat("pt-BR");

export function ProfileRankingPanel() {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiJson<RankingResponse>("/api/admin-console/profile-ranking"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar ranking.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cn(admin.card, "p-5")}>
          <div className="flex items-center gap-3">
            <span className="admin-icon-chip admin-icon-chip--violet"><Eye className="h-4 w-4" /></span>
            <div>
              <p className="admin-label">Visitas acumuladas</p>
              <strong className="mt-1 block text-2xl text-[var(--ac-text)]">{loading ? "—" : number.format(data?.totalClicks || 0)}</strong>
            </div>
          </div>
        </div>
        <div className={cn(admin.card, "p-5")}>
          <div className="flex items-center gap-3">
            <span className="admin-icon-chip admin-icon-chip--emerald"><Eye className="h-4 w-4" /></span>
            <div>
              <p className="admin-label">Vindas do Google</p>
              <strong className="mt-1 block text-2xl text-[var(--ac-text)]">{loading ? "—" : number.format(data?.totalGoogleVisits || 0)}</strong>
            </div>
          </div>
        </div>
        <div className={cn(admin.card, "p-5")}>
          <div className="flex items-center gap-3">
            <span className="admin-icon-chip admin-icon-chip--amber"><Trophy className="h-4 w-4" /></span>
            <div>
              <p className="admin-label">Perfis com visitas</p>
              <strong className="mt-1 block text-2xl text-[var(--ac-text)]">{loading ? "—" : number.format(data?.profilesWithViews || 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      <section className={admin.card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ac-paper-border)] p-4">
          <div>
            <h2 className="font-semibold text-[var(--ac-text)]">Terreiros mais procurados</h2>
            <p className="mt-0.5 text-xs text-[var(--ac-text-muted)]">Ordenado pelo total histórico de visitas; o Google aparece como desempate.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center text-sm text-[var(--ac-danger)]">{error}</div>
        ) : loading ? (
          <div className="p-12 text-center text-sm text-[var(--ac-text-muted)]">Carregando ranking…</div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center text-sm text-[var(--ac-text-muted)]">Nenhum perfil recebeu visitas ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={admin.table}>
              <thead><tr className={admin.thead}>
                <th className={cn(admin.th, "w-20 text-center")}>Posição</th>
                <th className={admin.th}>Terreiro</th>
                <th className={cn(admin.th, "w-36 text-right")}>Google</th>
                <th className={cn(admin.th, "w-36 text-right")}>Mapa</th>
                <th className={cn(admin.th, "w-36 text-right")}>Total</th>
              </tr></thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={item.terreiroId} className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)] last:border-0")}>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-[var(--ac-text-muted)]">{index + 1}º</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--ac-text)]">{item.terreiro}</td>
                    <td className="px-4 py-3 text-right admin-mono text-sm font-bold text-emerald-700">{number.format(item.googleVisits)}</td>
                    <td className="px-4 py-3 text-right admin-mono text-sm font-semibold text-[var(--ac-text-muted)]">{number.format(item.directoryClicks)}</td>
                    <td className="px-4 py-3 text-right admin-mono text-sm font-bold text-[var(--ac-accent)]">{number.format(item.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
