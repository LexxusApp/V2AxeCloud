import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type TenantOption = { id: string; nome_terreiro: string | null; email: string | null };
type ClaimStatus = "pending" | "approved" | "rejected";
type ClaimRow = {
  id: string;
  requester_name: string;
  requester_role: string;
  requester_email: string;
  requester_phone: string;
  evidence: string;
  message: string | null;
  status: ClaimStatus;
  admin_notes: string | null;
  claimed_tenant_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  terreiro: {
    id: string;
    nome: string;
    slug: string;
    cidade: string | null;
    estado: string | null;
    endereco: string | null;
    verified_at: string | null;
  } | null;
  tenant: TenantOption | null;
};

const STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function evidenceHref(value: string): string | null {
  const candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

export function DirectoryClaimsPanel({
  tenants,
  onMessage,
}: {
  tenants: TenantOption[];
  onMessage: (message: string | null) => void;
}) {
  const [status, setStatus] = useState<ClaimStatus | "all">("pending");
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tenantByClaim, setTenantByClaim] = useState<Record<string, string>>({});
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson<{ rows: ClaimRow[] }>(
        `/api/admin-console/diretorio-claims?status=${encodeURIComponent(status)}`,
      );
      setRows(result.rows || []);
      setTenantByClaim((current) => {
        const next = { ...current };
        for (const row of result.rows || []) if (row.claimed_tenant_id) next[row.id] = row.claimed_tenant_id;
        return next;
      });
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Erro ao carregar reivindicações.");
    } finally {
      setLoading(false);
    }
  }, [onMessage, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.terreiro?.nome, row.requester_name, row.requester_email, row.requester_phone, row.terreiro?.cidade]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [rows, search]);

  async function review(row: ClaimRow, nextStatus: "approved" | "rejected") {
    const action = nextStatus === "approved" ? "aprovar" : "recusar";
    if (!window.confirm(`Confirma ${action} a reivindicação de ${row.requester_name}?`)) return;
    setWorkingId(row.id);
    onMessage(null);
    try {
      await apiJson(`/api/admin-console/diretorio-claims/${row.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status: nextStatus,
          tenantId: nextStatus === "approved" ? tenantByClaim[row.id] || null : null,
          adminNotes: notesByClaim[row.id] || null,
        }),
      });
      onMessage(nextStatus === "approved" ? "Reivindicação aprovada e vinculada à conta do terreiro." : "Reivindicação recusada.");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Erro ao analisar reivindicação.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={cn("admin-btn-secondary", status === item && "!border-[var(--ac-brand)] !text-[var(--ac-brand)]")}
            >
              {item === "all" ? "Todas" : STATUS_LABEL[item]}
            </button>
          ))}
        </div>
        <label className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ac-text-faint)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar casa ou responsável" className="admin-input w-full !pl-10" />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="admin-panel grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--ac-brand)]" /></div>
      ) : visibleRows.length === 0 ? (
        <div className="admin-panel py-14 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-[var(--ac-success)]" />
          <p className="mt-3 font-semibold text-[var(--ac-text)]">Nenhuma reivindicação nesta lista.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRows.map((row) => {
            const link = evidenceHref(row.evidence);
            const working = workingId === row.id;
            return (
              <article key={row.id} className="admin-panel !p-0 overflow-hidden">
                <header className="border-b border-[var(--ac-paper-border)] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="admin-kicker">{row.terreiro?.cidade || "Cidade não informada"}{row.terreiro?.estado ? ` · ${row.terreiro.estado}` : ""}</p>
                      <h3 className="mt-1 truncate text-base font-bold text-[var(--ac-text)]">{row.terreiro?.nome || "Terreiro removido"}</h3>
                    </div>
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      row.status === "pending" && "bg-[var(--ac-warning-soft)] text-[var(--ac-warning)]",
                      row.status === "approved" && "bg-[var(--ac-success-soft)] text-[var(--ac-success)]",
                      row.status === "rejected" && "bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]",
                    )}>{STATUS_LABEL[row.status]}</span>
                  </div>
                  {row.terreiro?.slug ? <a href={`https://axecloud.com.br/terreiro/${row.terreiro.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ac-brand)]">Abrir perfil <ExternalLink className="h-3 w-3" /></a> : null}
                </header>

                <div className="space-y-4 px-5 py-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><p className="admin-label">Responsável</p><p className="mt-1 font-semibold text-[var(--ac-text)]">{row.requester_name}</p><p className="text-xs text-[var(--ac-text-muted)]">{row.requester_role}</p></div>
                    <div><p className="admin-label">Contato</p><a className="mt-1 block font-semibold text-[var(--ac-text)] hover:underline" href={`mailto:${row.requester_email}`}>{row.requester_email}</a><a className="text-xs text-[var(--ac-text-muted)] hover:underline" href={`https://wa.me/55${row.requester_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{row.requester_phone}</a></div>
                  </div>
                  <div><p className="admin-label">Comprovação</p>{link ? <a href={link} target="_blank" rel="noreferrer" className="mt-1 inline-flex break-all font-semibold text-[var(--ac-brand)] hover:underline">{row.evidence} <ExternalLink className="ml-1 h-3.5 w-3.5 shrink-0" /></a> : <p className="mt-1 whitespace-pre-wrap text-[var(--ac-text)]">{row.evidence}</p>}</div>
                  {row.message ? <div><p className="admin-label">Observações do solicitante</p><p className="mt-1 whitespace-pre-wrap text-[var(--ac-text-muted)]">{row.message}</p></div> : null}
                  <p className="text-[11px] text-[var(--ac-text-faint)]">Recebida em {formatDate(row.created_at)}{row.reviewed_at ? ` · analisada em ${formatDate(row.reviewed_at)}` : ""}</p>

                  {row.status === "pending" ? (
                    <div className="space-y-3 border-t border-[var(--ac-paper-border)] pt-4">
                      <label className="block"><span className="admin-label">Conta que administrará o perfil</span><select required value={tenantByClaim[row.id] || ""} onChange={(event) => setTenantByClaim({ ...tenantByClaim, [row.id]: event.target.value })} className="admin-input mt-1.5 w-full"><option value="">Selecione uma conta antes de aprovar</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome_terreiro || tenant.email || tenant.id}</option>)}</select><span className="mt-1.5 block text-[10px] text-[var(--ac-text-faint)]">Se o responsável ainda não tem acesso, crie a conta em “Novo terreiro” e volte para concluir.</span></label>
                      <label className="block"><span className="admin-label">Nota interna</span><textarea rows={2} maxLength={1500} value={notesByClaim[row.id] || ""} onChange={(event) => setNotesByClaim({ ...notesByClaim, [row.id]: event.target.value })} className="admin-input mt-1.5 w-full" placeholder="Resultado da verificação ou motivo da recusa" /></label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button type="button" disabled={working} onClick={() => void review(row, "rejected")} className="admin-btn-secondary text-[var(--ac-danger)]"><XCircle className="h-4 w-4" /> Recusar</button>
                        <button type="button" disabled={working || !tenantByClaim[row.id]} onClick={() => void review(row, "approved")} className="admin-btn-primary disabled:cursor-not-allowed disabled:opacity-45">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Aprovar e liberar edição</button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-[var(--ac-paper-elevated)] p-3 text-xs text-[var(--ac-text-muted)]">
                      {row.tenant ? <>Vinculada a <strong className="text-[var(--ac-text)]">{row.tenant.nome_terreiro || row.tenant.email}</strong>.</> : row.status === "approved" ? "Perfil verificado sem conta vinculada." : "Solicitação recusada."}
                      {row.admin_notes ? <p className="mt-1">Nota: {row.admin_notes}</p> : null}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
