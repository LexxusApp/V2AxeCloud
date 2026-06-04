import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Crown,
  ExternalLink,
  Link2,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { FounderPrefillSource } from "@/lib/founderPrefill";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { admin } from "@/lib/adminTheme";
import { AdminPanel, AdminStatCard } from "./AdminDashboardLayout";

type FounderStatus = "pending" | "contacted" | "accepted" | "rejected";

type FounderRow = {
  id: string;
  created_at: string;
  nome_casa: string;
  cidade: string;
  estado: string;
  tradicao: string;
  whatsapp: string;
  nome_contato: string | null;
  email: string | null;
  mensagem: string | null;
  autoriza_perfil_publico: boolean;
  autoriza_depoimento: boolean;
  status: FounderStatus;
  leader_id: string | null;
  linked_nome_terreiro?: string | null;
  linked_tenant_id?: string | null;
};

type FounderStats = {
  available: boolean;
  total: number;
  pending: number;
  contacted: number;
  accepted: number;
  rejected: number;
  maxSlots: number;
  remainingSlots: number;
};

const STATUS_LABEL: Record<FounderStatus, string> = {
  pending: "Pendente",
  contacted: "Contactado",
  accepted: "Aceito",
  rejected: "Recusado",
};

const TRADICAO_LABEL: Record<string, string> = {
  umbanda: "Umbanda",
  candomble: "Candomblé",
  jurema: "Jurema",
  mista: "Mista",
  outra: "Outra",
};

function whatsappHref(digits: string): string {
  const n = String(digits || "").replace(/\D/g, "");
  if (!n) return "";
  return `https://wa.me/${n.startsWith("55") ? n : `55${n}`}`;
}

function statusBadge(status: FounderStatus) {
  const map: Record<FounderStatus, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    contacted: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    rejected: "bg-red-500/10 text-red-400 border-red-500/25",
  };
  return map[status];
}

type FounderProgramPanelProps = {
  onMessage: (msg: string) => void;
  onCreateTenant: (row: FounderPrefillSource) => void;
  onOpenTerreiro?: (leaderId: string) => void;
};

export function FounderProgramPanel({ onMessage, onCreateTenant, onOpenTerreiro }: FounderProgramPanelProps) {
  const [stats, setStats] = useState<FounderStats | null>(null);
  const [rows, setRows] = useState<FounderRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (filter) qs.set("status", filter);
      const j = await apiJson<{
        stats: FounderStats;
        rows: FounderRow[];
        available?: boolean;
        notice?: string;
      }>(`/api/admin-console/founder-applications?${qs.toString()}`);
      setStats(j.stats);
      setRows(j.rows || []);
      setAvailable(j.available !== false);
      setNotice(j.notice || "");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Erro ao carregar inscrições");
    } finally {
      setBusy(false);
    }
  }, [filter, onMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatus(id: string, status: FounderStatus) {
    setUpdatingId(id);
    try {
      await apiJson(`/api/admin-console/founder-applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onMessage(`Status actualizado: ${STATUS_LABEL[status]}`);
      await refresh();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Erro ao actualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  async function linkExisting(id: string) {
    setUpdatingId(id);
    try {
      const j = await apiJson<{ row: FounderRow }>(
        `/api/admin-console/founder-applications/${id}/link-existing`,
        { method: "POST" }
      );
      onMessage(
        j.row?.linked_nome_terreiro
          ? `Vinculado a «${j.row.linked_nome_terreiro}».`
          : "Terreiro vinculado à inscrição."
      );
      await refresh();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Erro ao vincular");
    } finally {
      setUpdatingId(null);
    }
  }

  const empty = !busy && rows.length === 0;

  const statCards = useMemo(
    () => [
      { title: "Pendentes", value: stats?.pending ?? "—", icon: Sparkles },
      { title: "Contactados", value: stats?.contacted ?? "—", icon: MessageCircle },
      { title: "Aceitos", value: stats?.accepted ?? "—", icon: Check },
      { title: "Vagas restantes", value: stats?.remainingSlots ?? "—", icon: Crown },
    ],
    [stats]
  );

  return (
    <div className="space-y-6">
      {!available && (
        <div className="admin-alert-warn text-[var(--ac-warn)]">
          {notice || "Tabela founder_applications não disponível. Execute a migration no Supabase."}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ title, value, icon: Icon }) => (
          <AdminStatCard key={title} title={title} value={String(value)} icon={Icon} />
        ))}
      </section>

      <AdminPanel
        kicker="Programa Fundador"
        title="Inscrições de casas"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="admin-input !w-auto min-w-[10rem] !py-2 !text-sm"
            >
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as FounderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void refresh()} disabled={busy} className="admin-btn-secondary !py-2">
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            </button>
          </div>
        }
      >
        <div className={admin.tableWrap}>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={admin.thead}>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Casa
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Local
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Contato
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Inscrição
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--ac-text-muted)]">
                  Acções
                </th>
              </tr>
            </thead>
            <tbody>
              {empty ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[var(--ac-text-muted)]">
                    {busy ? "A carregar…" : "Nenhuma inscrição encontrada."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const wa = whatsappHref(row.whatsapp);
                  return (
                    <tr key={row.id} className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)]")}>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-[var(--ac-text)]">{row.nome_casa}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--ac-text-muted)]">
                          {TRADICAO_LABEL[row.tradicao] || row.tradicao}
                        </p>
                        {row.leader_id ? (
                          <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400">
                              Terreiro no sistema
                            </span>
                            {row.linked_nome_terreiro ? (
                              <span className="text-[var(--ac-text-muted)]">{row.linked_nome_terreiro}</span>
                            ) : null}
                          </p>
                        ) : row.email ? (
                          <p className="mt-1 text-[11px] text-amber-400/90">
                            E-mail pode corresponder a terreiro já cadastrado — use «Vincular existente».
                          </p>
                        ) : null}
                        {row.mensagem ? (
                          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-[var(--ac-text-faint)] line-clamp-2">
                            {row.mensagem}
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[var(--ac-text-muted)]">
                          {row.autoriza_perfil_publico ? (
                            <span className="rounded border border-emerald-500/20 px-1.5 py-0.5 text-emerald-400">
                              Perfil público OK
                            </span>
                          ) : null}
                          {row.autoriza_depoimento ? (
                            <span className="rounded border border-sky-500/20 px-1.5 py-0.5 text-sky-400">
                              Depoimento OK
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-[var(--ac-text-muted)] whitespace-nowrap">
                        {row.cidade}, {row.estado}
                      </td>
                      <td className="px-3 py-3 align-top text-xs">
                        <p className="text-[var(--ac-text)]">{row.nome_contato || "—"}</p>
                        <p className="mt-0.5 text-[var(--ac-text-muted)]">{row.whatsapp}</p>
                        {row.email ? <p className="mt-0.5 text-[var(--ac-text-faint)]">{row.email}</p> : null}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-[var(--ac-text-muted)] whitespace-nowrap">
                        {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-[var(--ac-radius-sm)] border px-2 py-0.5 text-[11px] font-medium",
                            statusBadge(row.status)
                          )}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-1.5 min-w-[9rem]">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] px-2 py-1 text-[11px] font-semibold text-[var(--ac-accent)] hover:bg-[var(--ac-accent-soft)]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </a>
                          ) : null}
                          {row.leader_id && onOpenTerreiro ? (
                            <button
                              type="button"
                              onClick={() => onOpenTerreiro(row.leader_id!)}
                              className="inline-flex items-center gap-1 rounded-[var(--ac-radius-sm)] border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver terreiro
                            </button>
                          ) : null}
                          {row.status !== "rejected" && !row.leader_id && row.email ? (
                            <button
                              type="button"
                              disabled={updatingId === row.id}
                              onClick={() => void linkExisting(row.id)}
                              className="inline-flex items-center gap-1 rounded-[var(--ac-radius-sm)] border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-400 hover:bg-sky-500/20"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              Vincular existente
                            </button>
                          ) : null}
                          {row.status !== "rejected" && !row.leader_id ? (
                            <button
                              type="button"
                              onClick={() => onCreateTenant(row)}
                              className="inline-flex items-center gap-1 rounded-[var(--ac-radius-sm)] border border-[var(--ac-accent)] bg-[var(--ac-accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--ac-accent)] hover:bg-[var(--ac-accent)] hover:text-white"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              Criar terreiro
                            </button>
                          ) : null}
                          <select
                            value={row.status}
                            disabled={updatingId === row.id}
                            onChange={(e) => void setStatus(row.id, e.target.value as FounderStatus)}
                            className="admin-input !py-1 !text-[11px]"
                          >
                            {(Object.keys(STATUS_LABEL) as FounderStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[var(--ac-text-muted)]">
          Fluxo sugerido: <strong className="text-[var(--ac-text)]">Pendente</strong> → contactar no WhatsApp →{" "}
          <strong className="text-[var(--ac-text)]">Contactado</strong> → onboarding manual em «Novo terreiro» →{" "}
          <strong className="text-[var(--ac-text)]">Aceito</strong>.
          {stats ? (
            <>
              {" "}
              Limite do programa: {stats.maxSlots} vagas ({stats.remainingSlots} restantes para pendentes/contactados/aceitos).
            </>
          ) : null}
        </p>
      </AdminPanel>
    </div>
  );
}
