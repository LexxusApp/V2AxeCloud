import { useCallback, useEffect, useState } from "react";
import { HardDrive, RefreshCw } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { admin } from "@/lib/adminTheme";
import { AdminPanel } from "./AdminDashboardLayout";

type R2Tenant = { tenantPrefix: string; objects: number; mb: number };

type R2Payload = {
  configured?: boolean;
  message?: string;
  keysScanned?: number;
  truncated?: boolean;
  tenants?: R2Tenant[];
  error?: string;
};

export function StoragePanel({ onMessage }: { onMessage?: (msg: string) => void }) {
  const [data, setData] = useState<R2Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiJson<R2Payload>("/api/admin-console/r2-usage?maxKeys=12000");
      setData(j);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar R2";
      setData({ configured: false, message: msg });
      onMessage?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenants = data?.tenants || [];
  const totalMb = tenants.reduce((s, t) => s + (t.mb || 0), 0);

  return (
    <AdminPanel
      kicker="Infra"
      title="Armazenamento R2"
      action={
        <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Actualizar
        </button>
      }
    >
      {loading && !data ? (
        <p className="text-sm text-[var(--ac-text-muted)]">A carregar uso do bucket…</p>
      ) : !data?.configured ? (
        <div className="admin-alert-info max-w-2xl">
          <HardDrive className="h-5 w-5 shrink-0 text-[var(--ac-accent)]" />
          <div>
            <p className="font-semibold text-[var(--ac-text)]">R2 não disponível</p>
            <p className="mt-1 text-sm text-[var(--ac-text-muted)]">
              {data?.message ||
                "Configure R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET_NAME no servidor."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-faint)]">Prefixos</p>
              <p className="admin-mono mt-1 text-xl font-semibold text-[var(--ac-text)]">{tenants.length}</p>
            </div>
            <div className="rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-faint)]">Total (amostra)</p>
              <p className="admin-mono mt-1 text-xl font-semibold text-[var(--ac-text)]">{totalMb.toFixed(1)} MB</p>
            </div>
            <div className="rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-faint)]">Chaves lidas</p>
              <p className="admin-mono mt-1 text-xl font-semibold text-[var(--ac-text)]">{data.keysScanned ?? 0}</p>
            </div>
          </div>

          <p className="text-xs text-[var(--ac-text-muted)]">
            Amostra do bucket Cloudflare R2.{data.truncated ? " Listagem truncada no limite pedido." : ""}
          </p>

          {tenants.length === 0 ? (
            <p className="text-sm text-[var(--ac-text-muted)]">Nenhum objecto encontrado na amostra.</p>
          ) : (
            <div className={admin.tableWrap}>
              <table className={admin.table}>
                <thead className={admin.thead}>
                  <tr>
                    <th className={admin.th}>Prefixo / terreiro</th>
                    <th className={admin.th}>Objectos</th>
                    <th className={admin.th}>MB</th>
                  </tr>
                </thead>
                <tbody className={admin.tbody}>
                  {tenants.map((t) => (
                    <tr key={t.tenantPrefix} className={admin.trHover}>
                      <td className="px-3 py-2.5 text-[var(--ac-text)]">{t.tenantPrefix}</td>
                      <td className="px-3 py-2.5 admin-mono text-[var(--ac-text-muted)]">{t.objects}</td>
                      <td className="px-3 py-2.5 admin-mono text-[var(--ac-text)]">{t.mb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
