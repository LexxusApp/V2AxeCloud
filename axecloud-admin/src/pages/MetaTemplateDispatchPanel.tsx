import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Send, ShieldAlert, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type TemplateVariable = {
  key: string;
  label: string;
  source: "zelador" | "terreiro" | "email" | "expires_date_br" | "manual";
  placeholder: string;
  maxLength: number;
  hint?: string;
};

type TemplateDef = {
  id: string;
  templateName: string;
  label: string;
  description: string;
  category: string;
  body: string;
  footer?: string;
  button?: { text: string; url: string };
  variables: TemplateVariable[];
};

type Recipient = {
  tenantId: string;
  nomeTerreiro: string;
  nomeZelador: string;
  email: string;
  phone: string | null;
  phoneMasked: string | null;
  hasPhone: boolean;
  expiresAt: string | null;
  expiresDateBr: string | null;
  isTrial: boolean;
  daysUntilExpiry: number | null;
};

type DispatchLogRow = {
  id: string;
  tenantId: string;
  nomeTerreiro: string | null;
  tipo: string;
  telefoneMasked: string;
  status: string;
  externalId: string | null;
  preview: string;
  createdAt: string;
};

function renderPreview(tpl: TemplateDef, values: Record<string, string>): string {
  let body = tpl.body;
  for (const v of tpl.variables) {
    const val = String(values[v.key] ?? v.placeholder).trim();
    body = body.split(`{{${v.key}}}`).join(val);
  }
  const parts = [body];
  if (tpl.footer) parts.push(tpl.footer);
  if (tpl.button) parts.push(`[ ${tpl.button.text} ]`);
  return parts.join("\n\n");
}

function buildValuesForPreview(
  tpl: TemplateDef,
  recipient: Recipient | undefined,
  manual: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...manual };
  for (const v of tpl.variables) {
    if (v.source === "manual") continue;
    if (!recipient) {
      out[v.key] = v.placeholder;
      continue;
    }
    if (v.source === "zelador") out[v.key] = recipient.nomeZelador;
    else if (v.source === "terreiro") out[v.key] = recipient.nomeTerreiro;
    else if (v.source === "email") out[v.key] = recipient.email;
    else if (v.source === "expires_date_br") out[v.key] = recipient.expiresDateBr || manual[v.key] || v.placeholder;
  }
  return out;
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "read") return "admin-badge-strong";
  if (s === "failed") return "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]";
  if (s === "sent") return "admin-badge";
  return "admin-badge";
}

export function MetaTemplateDispatchPanel() {
  const [templates, setTemplates] = useState<TemplateDef[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filter, setFilter] = useState<"all" | "trial" | "expiring_14">("expiring_14");
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [logRows, setLogRows] = useState<DispatchLogRow[]>([]);
  const [busy, setBusy] = useState<"idle" | "load" | "send">("idle");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const tpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const loadAll = useCallback(async () => {
    setBusy("load");
    try {
      const [cat, rec, log] = await Promise.all([
        apiJson<{ templates: TemplateDef[]; metaConfigured: boolean }>(
          "/api/admin-console/meta-templates/catalog"
        ),
        apiJson<{ recipients: Recipient[]; metaConfigured: boolean }>(
          `/api/admin-console/meta-templates/recipients?filter=${filter}`
        ),
        apiJson<{ rows: DispatchLogRow[] }>("/api/admin-console/meta-templates/dispatch-log?limit=30"),
      ]);
      setTemplates(cat.templates);
      setMetaConfigured(cat.metaConfigured);
      setRecipients(rec.recipients);
      setLogRows(log.rows);
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao carregar." });
    } finally {
      setBusy("idle");
    }
  }, [filter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  useEffect(() => {
    if (!tpl) return;
    setManualValues((prev) => {
      const next = { ...prev };
      for (const v of tpl.variables) {
        if (v.source === "manual" && next[v.key] === undefined) {
          next[v.key] = "";
        }
      }
      return next;
    });
  }, [tpl]);

  const previewRecipient = useMemo(() => {
    const firstId = [...selected][0];
    return recipients.find((r) => r.tenantId === firstId) || recipients.find((r) => r.hasPhone);
  }, [recipients, selected]);

  const previewText = useMemo(() => {
    if (!tpl) return "";
    const values = buildValuesForPreview(tpl, previewRecipient, manualValues);
    return renderPreview(tpl, values);
  }, [tpl, previewRecipient, manualValues]);

  function toggleRecipient(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function autoFillPrazo() {
    const r = previewRecipient;
    if (!r || r.daysUntilExpiry == null) return;
    const d = r.daysUntilExpiry;
    let prazo = `em ${d} dias`;
    if (d === 0) prazo = "hoje";
    else if (d === 1) prazo = "Amanhã";
    setManualValues((prev) => ({ ...prev, "4": prazo }));
  }

  async function send() {
    if (!tpl) return;
    setFeedback(null);
    if (!selected.size) {
      setFeedback({ kind: "err", msg: "Selecione ao menos um terreiro." });
      return;
    }
    setBusy("send");
    try {
      const out = await apiJson<{ sent: number; failed: number; results: Array<{ ok: boolean; error?: string; nomeTerreiro: string }> }>(
        "/api/admin-console/meta-templates/send",
        {
          method: "POST",
          body: JSON.stringify({
            templateId: tpl.id,
            tenantIds: [...selected],
            manualValues,
          }),
        }
      );
      const failDetail = out.results.filter((r) => !r.ok).slice(0, 3).map((r) => `${r.nomeTerreiro}: ${r.error}`).join(" · ");
      setFeedback({
        kind: out.failed === 0 ? "ok" : "err",
        msg:
          out.failed === 0
            ? `${out.sent} mensagem(ns) enviada(s). Confira o histórico abaixo (entrega pode levar alguns segundos).`
            : `${out.sent} enviadas, ${out.failed} falha(s).${failDetail ? ` ${failDetail}` : ""}`,
      });
      await loadAll();
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha ao enviar." });
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="space-y-6">
      <header className="admin-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="admin-kicker">Console · Meta Cloud</p>
            <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-[var(--ac-text)]">
              <Send className="h-5 w-5 text-[var(--ac-accent)]" />
              Disparo por template aprovado
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--ac-text-muted)]">
              Envia pelo número oficial Meta (Cloud API). Não depende do WhatsApp Baileys conectado acima.
              Só é possível preencher as variáveis <code className="admin-mono">{`{{1}}`}</code>,{" "}
              <code className="admin-mono">{`{{2}}`}</code>… do template — o texto fixo não pode ser alterado.
            </p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest ring-1",
              metaConfigured ? "admin-badge-strong" : "admin-badge"
            )}
          >
            {metaConfigured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {metaConfigured ? "Meta API OK" : "Meta API off"}
          </div>
        </div>
      </header>

      {feedback && (
        <div
          className={cn(
            "rounded-[var(--ac-radius-sm)] border px-4 py-3 text-sm",
            feedback.kind === "ok"
              ? "border-[#abefc6] bg-[var(--ac-success-soft)] text-[var(--ac-success)]"
              : "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
          )}
        >
          {feedback.msg}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="admin-panel space-y-4">
            <label className="admin-label">Template Meta</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="admin-input w-full"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.category})
                </option>
              ))}
            </select>
            {tpl && (
              <p className="text-xs text-[var(--ac-text-muted)]">
                <span className="admin-mono text-[var(--ac-text)]">{tpl.templateName}</span> — {tpl.description}
              </p>
            )}

            {tpl && (
              <div className="space-y-3 border-t border-[var(--ac-paper-border)] pt-4">
                <p className="admin-label">Variáveis do template</p>
                {tpl.variables.map((v) => {
                  const isAuto = v.source !== "manual";
                  return (
                    <div key={v.key}>
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-[var(--ac-text)]">
                          {`{{${v.key}}}`} — {v.label}
                        </label>
                        <span className="text-[10px] text-[var(--ac-text-faint)]">
                          {isAuto ? "automático" : `máx. ${v.maxLength}`}
                        </span>
                      </div>
                      {isAuto ? (
                        <p className="mt-1 rounded-[var(--ac-radius-sm)] border border-dashed border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text-muted)]">
                          Preenchido por terreiro ({v.source === "expires_date_br" ? "data fim teste, fuso BR" : v.source})
                          {previewRecipient && (
                            <>
                              {" "}
                              →{" "}
                              <span className="font-semibold text-[var(--ac-text)]">
                                {buildValuesForPreview(tpl, previewRecipient, manualValues)[v.key]}
                              </span>
                            </>
                          )}
                        </p>
                      ) : (
                        <>
                          <input
                            value={manualValues[v.key] ?? ""}
                            maxLength={v.maxLength}
                            onChange={(e) =>
                              setManualValues((prev) => ({ ...prev, [v.key]: e.target.value }))
                            }
                            placeholder={v.placeholder}
                            className="admin-input mt-1 w-full text-sm"
                          />
                          {v.hint && (
                            <p className="mt-1 text-[10px] text-[var(--ac-text-faint)]">{v.hint}</p>
                          )}
                          {v.key === "4" && tpl.id === "teste_encerrando_zelador" && (
                            <button
                              type="button"
                              onClick={autoFillPrazo}
                              className="admin-btn-ghost mt-1 !text-[10px]"
                            >
                              Sugerir prazo (Amanhã / em N dias)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="admin-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-text)]">
                <Users className="h-4 w-4 text-[var(--ac-accent)]" />
                Destinatários (zeladores)
              </h4>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="admin-input !w-auto !py-1.5 text-xs"
              >
                <option value="expiring_14">Expiram em 14 dias</option>
                <option value="trial">Em teste</option>
                <option value="all">Todos</option>
              </select>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {recipients.map((r) => (
                <label
                  key={r.tenantId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[var(--ac-radius-sm)] border px-3 py-2 text-xs",
                    selected.has(r.tenantId)
                      ? "border-[var(--ac-accent)] bg-[var(--ac-accent-soft)]"
                      : "border-[var(--ac-paper-border)]",
                    !r.hasPhone && "opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.tenantId)}
                    disabled={!r.hasPhone}
                    onChange={() => toggleRecipient(r.tenantId)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[var(--ac-text)]">{r.nomeTerreiro}</span>
                    <span className="text-[var(--ac-text-muted)]">
                      {r.nomeZelador}
                      {r.expiresDateBr ? ` · vence ${r.expiresDateBr}` : ""}
                      {r.daysUntilExpiry != null && r.daysUntilExpiry <= 3 ? " · urgente" : ""}
                    </span>
                    <span className="admin-mono text-[10px] text-[var(--ac-text-faint)]">
                      {r.hasPhone ? r.phoneMasked : "sem WhatsApp"}
                    </span>
                  </span>
                </label>
              ))}
              {!recipients.length && (
                <p className="text-xs text-[var(--ac-text-muted)]">Nenhum terreiro neste filtro.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy === "send" || !metaConfigured || !selected.size}
              className="admin-btn-primary w-full disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy === "send" ? "A enviar…" : `Enviar para ${selected.size} selecionado(s)`}
            </button>
          </section>
        </div>

        <section className="admin-panel flex flex-col gap-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-text)]">
            <Eye className="h-4 w-4 text-[var(--ac-accent)]" />
            Pré-visualização
          </h4>
          <div className="rounded-2xl border border-[#d1e7dd] bg-[#e7f5ec] p-4 shadow-inner">
            <div className="mx-auto max-w-[280px] rounded-xl bg-white p-3 text-sm leading-relaxed text-[#111] shadow-md">
              {previewText.split("\n\n").map((block, i) => (
                <p key={i} className={i > 0 ? "mt-3 text-[12px] text-[#667]" : ""}>
                  {block}
                </p>
              ))}
              {tpl?.button && (
                <p className="mt-3 rounded-lg bg-[#f0f2f5] py-2 text-center text-xs font-semibold text-[#008069]">
                  {tpl.button.text}
                </p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[var(--ac-text-faint)]">
            Preview usa o primeiro terreiro selecionado (ou o primeiro com WhatsApp). Cada destinatário recebe
            nome/terreiro/data próprios.
          </p>
        </section>
      </div>

      <section className="admin-panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[var(--ac-text)]">Histórico de envios (entrega)</h4>
          <button type="button" onClick={() => void loadAll()} className="admin-btn-secondary !text-[11px]">
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "load" && "animate-spin")} />
            Atualizar
          </button>
        </div>
        <p className="text-[11px] text-[var(--ac-text-muted)]">
          Status vem do webhook Meta: <strong>sent</strong> → enviado à Meta · <strong>delivered</strong> → chegou
          no aparelho · <strong>read</strong> → lido · <strong>failed</strong> → falhou.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ac-paper-border)] text-[var(--ac-text-muted)]">
                <th className="py-2 pr-3 font-semibold">Quando</th>
                <th className="py-2 pr-3 font-semibold">Terreiro</th>
                <th className="py-2 pr-3 font-semibold">Telefone</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">Prévia</th>
              </tr>
            </thead>
            <tbody>
              {logRows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--ac-paper-border)]/60 align-top">
                  <td className="py-2 pr-3 admin-mono whitespace-nowrap text-[var(--ac-text-muted)]">
                    {row.createdAt
                      ? format(parseISO(row.createdAt), "dd/MM HH:mm", { locale: ptBR })
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 font-medium text-[var(--ac-text)]">{row.nomeTerreiro || "—"}</td>
                  <td className="py-2 pr-3 admin-mono text-[var(--ac-text-muted)]">{row.telefoneMasked}</td>
                  <td className="py-2 pr-3">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(row.status))}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 max-w-xs truncate text-[var(--ac-text-muted)]" title={row.preview}>
                    {row.preview}
                  </td>
                </tr>
              ))}
              {!logRows.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[var(--ac-text-muted)]">
                    Nenhum disparo por template ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
