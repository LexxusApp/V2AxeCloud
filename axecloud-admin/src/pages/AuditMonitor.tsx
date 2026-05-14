import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  Webhook,
  XCircle,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type AuditTarget = {
  id: string;
  url: string;
  label: string | null;
  enabled: boolean;
  run_dns: boolean;
  run_psi: boolean;
  alert_webhook: string | null;
  alert_threshold: number;
  alert_grade: string | null;
  schedule: string;
  last_run_at: string | null;
  last_score: number | null;
  last_grade: string | null;
  created_at: string;
  updated_at: string;
};

type AuditRunRow = {
  id: string;
  created_at: string;
  source: "manual" | "cron" | "webhook";
  status: "ok" | "error";
  score_total: number | null;
  score_grade: string | null;
  delta_total: number | null;
  http_status: number | null;
  issues_count: number | null;
  performance_score: number | null;
  ran_psi: boolean;
  ran_dns: boolean;
  alerted: boolean;
  error: string | null;
};

function gradeBadge(grade: string | null) {
  if (!grade) return "bg-white/[0.06] text-slate-400 ring-white/10";
  if (grade === "A+" || grade === "A") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30";
  if (grade === "B") return "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30";
  if (grade === "C") return "bg-amber-500/15 text-amber-200 ring-amber-400/30";
  return "bg-red-500/15 text-red-200 ring-red-400/30";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function relTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return `${Math.floor(diff / 86_400_000)}d atrás`;
}

export function AuditMonitor() {
  const [targets, setTargets] = useState<AuditTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyById, setBusyById] = useState<Record<string, "run" | "test" | "patch" | "del" | null>>({});
  const [historyByTarget, setHistoryByTarget] = useState<Record<string, AuditRunRow[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formRunPsi, setFormRunPsi] = useState(false);
  const [formAlertThreshold, setFormAlertThreshold] = useState(60);
  const [formWebhook, setFormWebhook] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const j = await apiJson<{ ok: boolean; targets: AuditTarget[]; notice?: string }>(
        "/api/admin-console/audit/targets"
      );
      setTargets(j.targets || []);
      setNotice(j.notice || null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao carregar alvos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function loadHistory(targetId: string) {
    try {
      const j = await apiJson<{ ok: boolean; runs: AuditRunRow[] }>(
        `/api/admin-console/audit/targets/${targetId}/history?n=30`
      );
      setHistoryByTarget((prev) => ({ ...prev, [targetId]: j.runs || [] }));
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleExpand(targetId: string) {
    if (expandedId === targetId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(targetId);
    if (!historyByTarget[targetId]) await loadHistory(targetId);
  }

  async function createTarget() {
    setFormBusy(true);
    setFormError(null);
    try {
      let url = formUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      await apiJson("/api/admin-console/audit/targets", {
        method: "POST",
        body: JSON.stringify({
          url,
          label: formLabel.trim() || null,
          run_psi: formRunPsi,
          alert_threshold: formAlertThreshold,
          alert_webhook: formWebhook.trim() || null,
          schedule: "hourly",
        }),
      });
      setFormUrl("");
      setFormLabel("");
      setFormRunPsi(false);
      setFormAlertThreshold(60);
      setFormWebhook("");
      setShowForm(false);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Falha ao criar alvo.");
    } finally {
      setFormBusy(false);
    }
  }

  async function patchTarget(id: string, patch: Partial<AuditTarget>) {
    setBusyById((b) => ({ ...b, [id]: "patch" }));
    try {
      const j = await apiJson<{ ok: boolean; target: AuditTarget }>(`/api/admin-console/audit/targets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTargets((prev) => prev.map((t) => (t.id === id ? j.target : t)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyById((b) => ({ ...b, [id]: null }));
    }
  }

  async function deleteTarget(id: string) {
    if (!confirm("Remover este alvo? O histórico também será excluído.")) return;
    setBusyById((b) => ({ ...b, [id]: "del" }));
    try {
      await apiJson(`/api/admin-console/audit/targets/${id}`, { method: "DELETE" });
      setTargets((prev) => prev.filter((t) => t.id !== id));
      setHistoryByTarget((prev) => {
        const cp = { ...prev };
        delete cp[id];
        return cp;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyById((b) => ({ ...b, [id]: null }));
    }
  }

  async function runNow(id: string) {
    setBusyById((b) => ({ ...b, [id]: "run" }));
    try {
      await apiJson(`/api/admin-console/audit/targets/${id}/run`, { method: "POST" });
      await refresh();
      if (expandedId === id) await loadHistory(id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyById((b) => ({ ...b, [id]: null }));
    }
  }

  async function testWebhook(id: string) {
    setBusyById((b) => ({ ...b, [id]: "test" }));
    try {
      const j = await apiJson<{ ok: boolean; status?: number; error?: string }>(
        `/api/admin-console/audit/targets/${id}/test-webhook`,
        { method: "POST" }
      );
      alert(j.ok ? `Webhook enviado (HTTP ${j.status ?? "ok"})` : `Falha: ${j.error}`);
    } catch (e: any) {
      alert(`Falha: ${e?.message}`);
    } finally {
      setBusyById((b) => ({ ...b, [id]: null }));
    }
  }

  const summary = useMemo(() => {
    const total = targets.length;
    const enabled = targets.filter((t) => t.enabled).length;
    const alerting = targets.filter((t) => t.last_score != null && t.last_score < t.alert_threshold).length;
    const avg = targets.length
      ? Math.round(
          targets.filter((t) => typeof t.last_score === "number").reduce((acc, t) => acc + (t.last_score || 0), 0) /
            Math.max(1, targets.filter((t) => typeof t.last_score === "number").length)
        )
      : null;
    return { total, enabled, alerting, avg };
  }, [targets]);

  return (
    <div className="space-y-4">
      {/* Header / KPIs */}
      <div className="rounded-md border border-white/10 bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.04] p-4 shadow-xl ring-1 ring-violet-400/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Activity className="h-5 w-5 text-violet-300" />
              Monitor contínuo
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Auditoria automática dos alvos cadastrados via Vercel Cron, com alertas de queda de score.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.1] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/30"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo alvo
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          <Kpi label="Alvos" value={summary.total} icon={<Activity className="h-4 w-4 text-violet-300" />} />
          <Kpi label="Ativos" value={summary.enabled} icon={<Play className="h-4 w-4 text-emerald-300" />} />
          <Kpi
            label="Alertando"
            value={summary.alerting}
            tone={summary.alerting > 0 ? "text-red-200 bg-red-500/10 ring-red-400/30" : undefined}
            icon={<Bell className="h-4 w-4 text-red-300" />}
          />
          <Kpi label="Score médio" value={summary.avg ?? "—"} icon={<TrendingUp className="h-4 w-4 text-cyan-300" />} />
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {notice}
        </div>
      )}

      {/* Form novo alvo */}
      {showForm && (
        <div className="rounded-md border border-white/10 bg-black/30 p-4 ring-1 ring-violet-400/10">
          <h3 className="mb-3 text-sm font-bold text-white">Novo alvo de monitoramento</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="URL">
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://exemplo.com.br"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40"
              />
            </Field>
            <Field label="Rótulo (opcional)">
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Landing institucional"
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40"
              />
            </Field>
            <Field label="Webhook (Discord/Slack)">
              <input
                value={formWebhook}
                onChange={(e) => setFormWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-400/40"
              />
            </Field>
            <Field label={`Limite de alerta (${formAlertThreshold})`}>
              <input
                type="range"
                min={20}
                max={95}
                step={5}
                value={formAlertThreshold}
                onChange={(e) => setFormAlertThreshold(Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={formRunPsi}
                onChange={(e) => setFormRunPsi(e.target.checked)}
                className="rounded border-white/20 bg-black/40"
              />
              Rodar PageSpeed Insights (mais lento, ~20s/tick)
            </label>
          </div>
          {formError && <p className="mt-2 text-xs text-red-300">{formError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => void createTarget()}
              disabled={formBusy || !formUrl.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-100 ring-1 ring-violet-400/40 hover:bg-violet-500/40 disabled:opacity-50"
            >
              {formBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Criar alvo
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/[0.08]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de alvos */}
      <div className="space-y-2">
        {loading && targets.length === 0 && (
          <p className="flex items-center gap-2 px-3 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando alvos…
          </p>
        )}
        {!loading && targets.length === 0 && (
          <p className="rounded-md border border-white/10 bg-black/30 px-3 py-4 text-center text-xs text-slate-400">
            Nenhum alvo cadastrado ainda. Clique em <span className="text-violet-300">Novo alvo</span> para começar.
          </p>
        )}
        {targets.map((t) => {
          const busy = busyById[t.id];
          const history = historyByTarget[t.id] || [];
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="overflow-hidden rounded-md border border-white/10 bg-black/30">
              <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <button
                  onClick={() => void toggleExpand(t.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex h-9 w-12 items-center justify-center rounded-md font-mono-data text-xs font-black ring-1",
                      gradeBadge(t.last_grade)
                    )}
                  >
                    {t.last_grade || "—"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <span className="truncate">{t.label || t.url.replace(/^https?:\/\//, "")}</span>
                      {!t.enabled && (
                        <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">
                          pausado
                        </span>
                      )}
                      {t.run_psi && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                          PSI
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="truncate font-mono-data">{t.url}</span>
                      <span>·</span>
                      <span>último: {relTime(t.last_run_at)}</span>
                      {typeof t.last_score === "number" && (
                        <>
                          <span>·</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5",
                              t.last_score < t.alert_threshold ? "text-red-300" : "text-slate-400"
                            )}
                          >
                            score {t.last_score}
                            {t.last_score < t.alert_threshold && <AlertTriangle className="h-3 w-3" />}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1">
                  <ActionBtn
                    onClick={() => void runNow(t.id)}
                    busy={busy === "run"}
                    title="Executar agora"
                    icon={<Play className="h-3.5 w-3.5" />}
                  />
                  <ActionBtn
                    onClick={() => void patchTarget(t.id, { enabled: !t.enabled })}
                    busy={busy === "patch"}
                    title={t.enabled ? "Pausar" : "Retomar"}
                    icon={t.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  />
                  {t.alert_webhook && (
                    <ActionBtn
                      onClick={() => void testWebhook(t.id)}
                      busy={busy === "test"}
                      title="Testar webhook"
                      icon={<Send className="h-3.5 w-3.5" />}
                    />
                  )}
                  <ActionBtn
                    onClick={() => void deleteTarget(t.id)}
                    busy={busy === "del"}
                    title="Remover"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    danger
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 bg-black/20 px-3 py-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Configuração</p>
                      <ul className="mt-1 space-y-1 text-[11px]">
                        <li className="flex items-center gap-2">
                          <span className="text-slate-400">DNS/WHOIS:</span>
                          <ToggleSwitch
                            on={t.run_dns}
                            onChange={(v) => void patchTarget(t.id, { run_dns: v })}
                            disabled={busy === "patch"}
                          />
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-slate-400">PageSpeed:</span>
                          <ToggleSwitch
                            on={t.run_psi}
                            onChange={(v) => void patchTarget(t.id, { run_psi: v })}
                            disabled={busy === "patch"}
                          />
                        </li>
                        <li className="text-slate-400">
                          Limite alerta:{" "}
                          <input
                            type="number"
                            min={20}
                            max={95}
                            value={t.alert_threshold}
                            onChange={(e) => void patchTarget(t.id, { alert_threshold: Number(e.target.value) })}
                            className="w-14 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-right text-[11px] text-white"
                          />
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Webhook</p>
                      <input
                        type="url"
                        defaultValue={t.alert_webhook || ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== t.alert_webhook) void patchTarget(t.id, { alert_webhook: v });
                        }}
                        placeholder="Discord ou Slack webhook…"
                        className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"
                      />
                      <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                        <Webhook className="h-3 w-3" /> auto-detecta Discord/Slack
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Última execução</p>
                      <p className="mt-1 text-[11px] text-slate-300">{fmtDate(t.last_run_at)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Schedule: {t.schedule} · Vercel Cron decide o intervalo real
                      </p>
                    </div>
                  </div>

                  {/* sparkline + tabela de history */}
                  <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Histórico ({history.length})
                      </p>
                      <button
                        onClick={() => void loadHistory(t.id)}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
                      >
                        <RefreshCw className="h-3 w-3" /> atualizar
                      </button>
                    </div>
                    <Sparkline runs={history} />
                    <div className="mt-2 max-h-64 overflow-y-auto">
                      <table className="w-full text-[10px]">
                        <thead className="sticky top-0 bg-black/60 text-slate-500">
                          <tr>
                            <th className="px-2 py-1 text-left">Quando</th>
                            <th className="px-2 py-1 text-left">Origem</th>
                            <th className="px-2 py-1 text-left">Status</th>
                            <th className="px-2 py-1 text-right">Score</th>
                            <th className="px-2 py-1 text-right">Δ</th>
                            <th className="px-2 py-1 text-right">Perf</th>
                            <th className="px-2 py-1 text-right">Issues</th>
                            <th className="px-2 py-1 text-left">Alerta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((r) => (
                            <tr key={r.id} className="border-t border-white/5">
                              <td className="px-2 py-1 text-slate-300">{fmtDate(r.created_at)}</td>
                              <td className="px-2 py-1 text-slate-400">{r.source}</td>
                              <td className="px-2 py-1">
                                {r.status === "ok" ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-300" />
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-mono-data">
                                <span
                                  className={cn(
                                    "rounded px-1 py-0.5",
                                    gradeBadge(r.score_grade)
                                  )}
                                >
                                  {r.score_total ?? "—"}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-right font-mono-data">
                                {r.delta_total == null ? (
                                  <span className="text-slate-500">—</span>
                                ) : r.delta_total > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-300">
                                    <TrendingUp className="h-3 w-3" />+{r.delta_total}
                                  </span>
                                ) : r.delta_total < 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-red-300">
                                    <TrendingDown className="h-3 w-3" />
                                    {r.delta_total}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0</span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-mono-data text-slate-400">
                                {r.performance_score ?? "—"}
                              </td>
                              <td className="px-2 py-1 text-right font-mono-data text-slate-400">
                                {r.issues_count ?? "—"}
                              </td>
                              <td className="px-2 py-1">
                                {r.alerted && <Bell className="h-3 w-3 text-red-300" />}
                              </td>
                            </tr>
                          ))}
                          {history.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-2 py-3 text-center text-slate-500">
                                Nenhuma execução ainda. Clique em "Executar agora".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-white/10 bg-black/30 p-2 ring-1 ring-white/10",
        tone
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 font-mono-data text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ActionBtn({
  onClick,
  busy,
  title,
  icon,
  danger,
}: {
  onClick: () => void;
  busy?: boolean;
  title: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!busy}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 transition-colors",
        danger
          ? "bg-red-500/10 text-red-300 ring-red-400/20 hover:bg-red-500/20"
          : "bg-white/[0.06] text-slate-300 ring-white/10 hover:bg-white/[0.1]",
        busy && "opacity-50"
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    </button>
  );
}

function ToggleSwitch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
        on ? "bg-emerald-400/70" : "bg-white/10",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-3.5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Sparkline({ runs }: { runs: AuditRunRow[] }) {
  const points = runs
    .slice()
    .reverse()
    .filter((r) => typeof r.score_total === "number")
    .map((r) => r.score_total as number);
  if (points.length < 2) {
    return (
      <p className="text-[10px] text-slate-500">
        Necessário ao menos 2 execuções para desenhar o gráfico.
      </p>
    );
  }
  const W = 600;
  const H = 60;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const range = Math.max(1, max - min);
  const stepX = W / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = H - ((p - min) / range) * (H - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="audit-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${W} ${H} L 0 ${H} Z`}
        fill="url(#audit-spark)"
        stroke="none"
      />
      <path d={path} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
    </svg>
  );
}
