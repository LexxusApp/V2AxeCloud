import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, RotateCcw, Send } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type TemplateOpt = {
  id: string;
  name: string;
  label: string;
  description: string;
  isDefault: boolean;
};

type TenantRow = {
  id: string;
  nomeTerreiro: string;
  email: string | null;
  upcomingEvents: number;
};

type EventRow = {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  tipo: string | null;
  eventoPublico: boolean;
};

type PreviewMsg = {
  body: string;
  footer?: string;
  hasBanner: boolean;
};

type DispatchLogRow = {
  id: string;
  tenantId: string;
  nomeTerreiro: string | null;
  filhoId: string | null;
  filhoNome: string | null;
  telefoneMasked: string;
  status: string;
  externalId: string | null;
  preview: string;
  failureHint: string | null;
  createdAt: string;
};

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "read") return "admin-badge-strong";
  if (s === "failed") return "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]";
  if (s === "sent") return "admin-badge";
  return "admin-badge";
}

function formatDataBr(ymd: string): string {
  const s = String(ymd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function resolveQuandoLabel(eventYmd: string): string {
  const ymd = String(eventYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "em breve";

  const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const today = `${br.getFullYear()}-${String(br.getMonth() + 1).padStart(2, "0")}-${String(br.getDate()).padStart(2, "0")}`;
  const tmr = new Date(br);
  tmr.setDate(tmr.getDate() + 1);
  const tomorrow = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, "0")}-${String(tmr.getDate()).padStart(2, "0")}`;

  if (ymd === today) return "hoje";
  if (ymd === tomorrow) return "amanha";
  const [, em, ed] = ymd.split("-");
  return `no dia ${ed}/${em}/${ymd.slice(0, 4)}`;
}

function buildMessagePreview(opts: {
  templateName: string;
  membroNome: string;
  terreiro: string;
  evento?: EventRow | null;
}): PreviewMsg | null {
  const { templateName, membroNome, terreiro, evento } = opts;
  if (!evento || !templateName) return null;

  const titulo = String(evento.titulo || "Gira").trim() || "Gira";
  const dataBr = formatDataBr(evento.data);
  const hora = String(evento.hora || "—").slice(0, 5);
  const quando = resolveQuandoLabel(evento.data);

  if (templateName.includes("lembrete_membro")) {
    return {
      body: [
        `Ola, ${membroNome}!`,
        "",
        `O AxeCloud esta passando para lembrar que ${quando} tem gira no terreiro ${terreiro}:`,
        "",
        titulo,
        `Horario: ${hora}`,
        "",
        "Consulte o AxeCloud para mais detalhes.",
      ].join("\n"),
      footer: "Mensagem automatica — nao responda.",
      hasBanner: false,
    };
  }

  if (templateName === "aviso_gira_axecloud") {
    return {
      body: [
        "Novo evento no calendario do terreiro:",
        "",
        titulo,
        "",
        `Data: ${dataBr}`,
        `Horario: ${hora}`,
        "",
        "Consulte o AxeCloud para mais detalhes.",
      ].join("\n"),
      hasBanner: true,
    };
  }

  // util / demais
  return {
    body: [
      "Novo evento no calendario do terreiro:",
      "",
      titulo,
      "",
      `Data: ${dataBr}`,
      `Horario: ${hora}`,
      "",
      "Consulte o AxeCloud para mais detalhes.",
    ].join("\n"),
    hasBanner: false,
  };
}

function WhatsAppPreviewBubble({
  preview,
  emptyHint,
}: {
  preview: PreviewMsg | null;
  emptyHint: string;
}) {
  const now = useMemo(
    () =>
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só para carimbo visual
    [preview?.body]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f2c34] bg-[#0b141a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2 border-b border-[#1f2c34] bg-[#1f2c34] px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884]/20 text-[11px] font-bold text-[#00a884]">
          AC
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#e9edef]">AxéCloud</p>
          <p className="text-[10px] text-[#8696a0]">WhatsApp Business · prévia</p>
        </div>
      </div>

      <div
        className="relative min-h-[220px] px-3 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0 1px, transparent 1px), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.025) 0 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          backgroundColor: "#0b141a",
        }}
      >
        {!preview ? (
          <p className="rounded-xl bg-[#1f2c34]/80 px-3 py-4 text-center text-[11px] leading-relaxed text-[#8696a0]">
            {emptyHint}
          </p>
        ) : (
          <div className="ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[12px] leading-relaxed text-[#e9edef] shadow-md">
            {preview.hasBanner ? (
              <div className="mb-2 overflow-hidden rounded-lg bg-[#024c3f]">
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#0d9488]/40 to-[#134e4a]/80 text-[10px] font-semibold uppercase tracking-wider text-[#99f6e4]/80">
                  Banner do evento
                </div>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap">{preview.body}</p>
            {preview.footer ? (
              <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-[#aebac1]">{preview.footer}</p>
            ) : null}
            <p className="mt-1 text-right text-[9px] text-[#aebac1]">{now}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function GiraDispatchPanel() {
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [eventId, setEventId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [membroPreview, setMembroPreview] = useState("Maria");
  const [busy, setBusy] = useState<"idle" | "load" | "events" | "send" | "retry">("idle");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [progress, setProgress] = useState<{
    sent: number;
    errors: number;
    eligible: number;
    index: number;
    phase: string;
  } | null>(null);
  const [logRows, setLogRows] = useState<DispatchLogRow[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const selectedTenant = useMemo(() => tenants.find((t) => t.id === tenantId), [tenants, tenantId]);
  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId), [events, eventId]);
  const selectedTpl = useMemo(
    () => templates.find((t) => t.name === templateName),
    [templates, templateName]
  );

  const preview = useMemo(
    () =>
      buildMessagePreview({
        templateName,
        membroNome: membroPreview.trim() || "Maria",
        terreiro: selectedTenant?.nomeTerreiro || "Terreiro",
        evento: selectedEvent,
      }),
    [templateName, membroPreview, selectedTenant, selectedEvent]
  );

  const loadLog = useCallback(async (tid?: string) => {
    try {
      const qs = new URLSearchParams({ limit: "40" });
      if (tid) qs.set("tenantId", tid);
      const r = await apiJson<{ rows: DispatchLogRow[] }>(
        `/api/admin-console/gira-dispatch/dispatch-log?${qs.toString()}`
      );
      setLogRows(r.rows || []);
    } catch {
      /* histórico é complementar — não bloqueia o painel */
    }
  }, []);

  const loadBase = useCallback(async (search = "") => {
    setBusy("load");
    setFeedback(null);
    try {
      const [tpl, ten] = await Promise.all([
        apiJson<{ templates: TemplateOpt[]; metaConfigured: boolean; defaultTemplate: string | null }>(
          "/api/admin-console/gira-dispatch/templates"
        ),
        apiJson<{ tenants: TenantRow[]; metaConfigured: boolean }>(
          `/api/admin-console/gira-dispatch/tenants?q=${encodeURIComponent(search)}&limit=100`
        ),
      ]);
      setTemplates(tpl.templates || []);
      setMetaConfigured(Boolean(tpl.metaConfigured));
      setTenants(ten.tenants || []);
      setTemplateName((prev) => {
        if (prev && tpl.templates?.some((t) => t.name === prev)) return prev;
        return (
          tpl.defaultTemplate ||
          tpl.templates?.find((t) => t.isDefault)?.name ||
          tpl.templates?.[0]?.name ||
          ""
        );
      });
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha ao carregar" });
    } finally {
      setBusy("idle");
    }
  }, []);

  const loadEvents = useCallback(async (tid: string) => {
    if (!tid) {
      setEvents([]);
      setEventId("");
      return;
    }
    setBusy("events");
    try {
      const r = await apiJson<{ events: EventRow[] }>(
        `/api/admin-console/gira-dispatch/events?tenantId=${encodeURIComponent(tid)}`
      );
      setEvents(r.events || []);
      setEventId((prev) => (r.events?.some((e) => e.id === prev) ? prev : r.events?.[0]?.id || ""));
    } catch (e) {
      setEvents([]);
      setEventId("");
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha ao listar giras" });
    } finally {
      setBusy("idle");
    }
  }, []);

  useEffect(() => {
    void loadBase("");
  }, [loadBase]);

  useEffect(() => {
    void loadEvents(tenantId);
  }, [tenantId, loadEvents]);

  useEffect(() => {
    void loadLog(tenantId || undefined);
  }, [tenantId, loadLog]);

  async function retryFailed(row: DispatchLogRow) {
    if (!row.filhoId) {
      setFeedback({ kind: "err", msg: "Este log não tem membro vinculado para reenviar." });
      return;
    }
    if (!eventId) {
      setFeedback({
        kind: "err",
        msg: "Selecione a gira acima (mesma do disparo) para reenviar este membro.",
      });
      return;
    }
    if (row.tenantId && tenantId && row.tenantId !== tenantId) {
      setFeedback({ kind: "err", msg: "Selecione o terreiro deste envio antes de reenviar." });
      return;
    }
    const tid = tenantId || row.tenantId;
    if (!tid) {
      setFeedback({ kind: "err", msg: "Selecione o terreiro." });
      return;
    }
    if (
      !confirm(
        `Reenviar aviso só para ${row.filhoNome || row.telefoneMasked}?\n\nPode falhar de novo se a Meta bloquear marketing (#131049).`
      )
    ) {
      return;
    }
    setBusy("retry");
    setRetryingId(row.id);
    setFeedback({ kind: "info", msg: "Reenviando…" });
    try {
      const r = await apiJson<{
        sent: number;
        errors: number;
        eligible: number;
        status: string;
        templateName: string;
      }>("/api/admin-console/gira-dispatch/retry", {
        method: "POST",
        body: JSON.stringify({
          tenantId: tid,
          eventId,
          filhoId: row.filhoId,
          templateName,
        }),
      });
      setFeedback({
        kind: r.sent > 0 ? "ok" : "err",
        msg:
          r.sent > 0
            ? `Reenviado para ${row.filhoNome || "membro"} (${r.templateName}).`
            : `Reenvio sem entrega (status ${r.status}, falhas ${r.errors}). Meta pode ter bloqueado de novo.`,
      });
      await loadLog(tid);
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Falha no reenvio" });
    } finally {
      setRetryingId(null);
      setBusy("idle");
    }
  }

  async function send() {
    if (!tenantId || !eventId || !templateName) {
      setFeedback({ kind: "err", msg: "Selecione terreiro, gira e template." });
      return;
    }
    const label = selectedEvent
      ? `${selectedEvent.titulo} (${formatDataBr(selectedEvent.data)} ${selectedEvent.hora})`
      : "gira";
    const house = selectedTenant?.nomeTerreiro || "terreiro";
    if (
      !confirm(
        `Disparar aviso de gira?\n\nTerreiro: ${house}\nEvento: ${label}\nTemplate: ${selectedTpl?.label || templateName}\n\nVai para todos os membros ativos com WhatsApp.\nOs envios saem com intervalo (~20s entre cada) — acompanhe o progresso na tela.`
      )
    ) {
      return;
    }
    setBusy("send");
    setFeedback({ kind: "info", msg: "Disparo iniciado… aguardando progresso." });
    setProgress({ sent: 0, errors: 0, eligible: 0, index: 0, phase: "queued" });
    try {
      const started = await apiJson<{
        job: {
          id: string;
          phase: string;
          sent: number;
          errors: number;
          eligible: number;
          index: number;
          status: string;
          error: string | null;
          templateName: string;
        };
      }>("/api/admin-console/gira-dispatch/send", {
        method: "POST",
        body: JSON.stringify({ tenantId, eventId, templateName }),
      });

      const jobId = started.job?.id;
      if (!jobId) throw new Error("Job não retornado pelo servidor.");

      // Poll até concluir (envios com ritmo ~20s/membro)
      for (;;) {
        await new Promise((r) => setTimeout(r, 1200));
        const poll = await apiJson<{
          job: {
            id: string;
            phase: string;
            sent: number;
            errors: number;
            eligible: number;
            index: number;
            status: string;
            error: string | null;
            templateName: string;
          };
        }>(`/api/admin-console/gira-dispatch/jobs/${encodeURIComponent(jobId)}`);

        const job = poll.job;
        setProgress({
          sent: job.sent,
          errors: job.errors,
          eligible: job.eligible,
          index: job.index,
          phase: job.phase,
        });

        if (job.eligible > 0) {
          setFeedback({
            kind: "info",
            msg: `Enviando ${Math.min(job.index || job.sent + job.errors, job.eligible)}/${job.eligible}… · ok ${job.sent} · falhas ${job.errors}`,
          });
        }

        if (job.phase === "done") {
          setFeedback({
            kind: job.sent > 0 ? "ok" : "err",
            msg: `Concluído: ${job.sent}/${job.eligible} enviados · falhas ${job.errors} · ${job.templateName}`,
          });
          await loadLog(tenantId);
          break;
        }
        if (job.phase === "failed") {
          setFeedback({
            kind: "err",
            msg: job.error || "Disparo falhou.",
          });
          await loadLog(tenantId);
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha no disparo";
      const timedOut = /signal timed out|aborted|timeout/i.test(msg);
      setFeedback({
        kind: "err",
        msg: timedOut
          ? "A conexão caiu, mas o disparo pode ter continuado no servidor. Confira o histórico abaixo / WhatsApp dos membros."
          : msg,
      });
      await loadLog(tenantId);
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-kicker">Corrente</p>
            <h3 className="admin-title text-base">Disparo de gira</h3>
            <p className="mt-1 text-xs text-[var(--ac-text-muted)]">
              Escolha o terreiro, a gira futura e o template. A prévia ao lado mostra exatamente o texto que a Meta envia.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn-ghost"
            disabled={busy !== "idle"}
            onClick={() => void loadBase(q)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "load" && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {!metaConfigured && (
          <p className="mt-3 rounded-lg border border-[#fecdca] bg-[var(--ac-danger-soft)] px-3 py-2 text-xs text-[var(--ac-danger)]">
            Meta Cloud não configurada neste ambiente — o disparo pode falhar.
          </p>
        )}

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <div className="space-y-3">
            <label className="block">
              <span className="admin-label">Buscar terreiro</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  className="admin-input w-full"
                  value={q}
                  placeholder="Nome ou e-mail…"
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadBase(q);
                  }}
                />
                <button
                  type="button"
                  className="admin-btn-secondary shrink-0"
                  disabled={busy !== "idle"}
                  onClick={() => void loadBase(q)}
                >
                  Buscar
                </button>
              </div>
            </label>

            <label className="block">
              <span className="admin-label">Terreiro</span>
              <select
                className="admin-input mt-1.5 w-full"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nomeTerreiro}
                    {t.upcomingEvents ? ` · ${t.upcomingEvents} futuras` : ""}
                    {t.email ? ` · ${t.email}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="admin-label">Gira / evento</span>
              <select
                className="admin-input mt-1.5 w-full"
                value={eventId}
                disabled={!tenantId || busy === "events"}
                onChange={(e) => setEventId(e.target.value)}
              >
                <option value="">{tenantId ? "Selecione…" : "Escolha o terreiro primeiro"}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {formatDataBr(ev.data)} {ev.hora} — {ev.titulo}
                    {ev.tipo ? ` (${ev.tipo})` : ""}
                  </option>
                ))}
              </select>
              {tenantId && events.length === 0 && busy === "idle" ? (
                <span className="mt-1.5 block text-[10px] text-[var(--ac-text-faint)]">
                  Nenhuma gira futura neste terreiro.
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="admin-label">Template</span>
              <select
                className="admin-input mt-1.5 w-full"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.label}
                    {t.isDefault ? " · padrão do servidor" : ""}
                  </option>
                ))}
              </select>
              {selectedTpl ? (
                <span className="mt-1.5 block text-[10px] text-[var(--ac-text-faint)]">
                  {selectedTpl.description} · <code>{selectedTpl.name}</code>
                </span>
              ) : null}
            </label>

            {templateName.includes("lembrete_membro") ? (
              <label className="block">
                <span className="admin-label">Nome na prévia (exemplo de membro)</span>
                <input
                  className="admin-input mt-1.5 w-full"
                  value={membroPreview}
                  onChange={(e) => setMembroPreview(e.target.value)}
                  placeholder="Maria"
                />
                <span className="mt-1.5 block text-[10px] text-[var(--ac-text-faint)]">
                  No disparo real, cada filho recebe o próprio nome. Aqui só para visualizar.
                </span>
              </label>
            ) : null}

            {selectedEvent ? (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--ac-border)] bg-[var(--ac-surface-2)] px-3 py-2.5 text-xs text-[var(--ac-text-muted)]">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ac-accent)]" />
                <div>
                  <p className="font-semibold text-[var(--ac-text)]">{selectedEvent.titulo}</p>
                  <p>
                    {formatDataBr(selectedEvent.data)} às {selectedEvent.hora}
                    {selectedEvent.tipo ? ` · ${selectedEvent.tipo}` : ""}
                    {selectedTenant ? ` · ${selectedTenant.nomeTerreiro}` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                className="admin-btn-primary disabled:cursor-not-allowed disabled:opacity-45"
                disabled={busy === "send" || !tenantId || !eventId || !templateName}
                onClick={() => void send()}
              >
                <Send className="h-4 w-4" />
                {busy === "send" ? "Disparando…" : "Disparar para a corrente"}
              </button>
            </div>

            {progress && (busy === "send" || progress.phase === "running") ? (
              <div className="rounded-xl border border-[var(--ac-border)] bg-[var(--ac-surface-2)] px-3 py-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--ac-text)]">
                  <span>Progresso do disparo</span>
                  <span className="text-[var(--ac-text-muted)]">
                    {progress.eligible > 0
                      ? `${Math.min(progress.index || progress.sent + progress.errors, progress.eligible)}/${progress.eligible}`
                      : "iniciando…"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--ac-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--ac-brand)] transition-all duration-500"
                    style={{
                      width: `${
                        progress.eligible > 0
                          ? Math.min(
                              100,
                              Math.round(
                                ((progress.index || progress.sent + progress.errors) / progress.eligible) * 100
                              )
                            )
                          : 8
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-[var(--ac-text-faint)]">
                  Intervalo ~20s entre mensagens (anti-spam Meta). Não feche esta aba.
                </p>
              </div>
            ) : null}

            {feedback ? (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-xs",
                  feedback.kind === "ok"
                    ? "border border-[var(--ac-ok-border, #abefc6)] bg-[var(--ac-ok-soft,#ecfdf3)] text-[var(--ac-ok,#067647)]"
                    : feedback.kind === "info"
                      ? "border border-[var(--ac-border)] bg-[var(--ac-surface-2)] text-[var(--ac-text-muted)]"
                      : "border border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]"
                )}
              >
                {feedback.msg}
              </p>
            ) : null}
          </div>

          <div>
            <p className="admin-label mb-1.5">Pré-visualização</p>
            <WhatsAppPreviewBubble
              preview={preview}
              emptyHint="Selecione terreiro e gira para ver como a mensagem chega no WhatsApp."
            />
            {preview && selectedEvent ? (
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--ac-text-faint)]">
                “{resolveQuandoLabel(selectedEvent.data)}” muda sozinho: hoje / amanha / no dia DD/MM/AAAA.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="admin-panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[var(--ac-text)]">Histórico de disparos</h4>
            <p className="mt-0.5 text-[11px] text-[var(--ac-text-muted)]">
              Status do webhook Meta: sent → delivered → read · failed = não entregue.
              {tenantId ? " Filtrado pelo terreiro selecionado." : " Mostrando os mais recentes de todos."}
            </p>
          </div>
          <button
            type="button"
            className="admin-btn-secondary !text-[11px]"
            disabled={busy !== "idle"}
            onClick={() => void loadLog(tenantId || undefined)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "load" && "animate-spin")} />
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ac-paper-border)] text-[var(--ac-text-muted)]">
                <th className="py-2 pr-3 font-semibold">Quando</th>
                <th className="py-2 pr-3 font-semibold">Terreiro</th>
                <th className="py-2 pr-3 font-semibold">Membro</th>
                <th className="py-2 pr-3 font-semibold">Telefone</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Prévia</th>
                <th className="py-2 font-semibold">Ação</th>
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
                  <td className="py-2 pr-3 font-medium text-[var(--ac-text)]">
                    {row.nomeTerreiro || "—"}
                  </td>
                  <td className="py-2 pr-3 text-[var(--ac-text)]">{row.filhoNome || "—"}</td>
                  <td className="py-2 pr-3 admin-mono text-[var(--ac-text-muted)]">
                    {row.telefoneMasked}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        statusBadgeClass(row.status)
                      )}
                    >
                      {row.status}
                    </span>
                    {row.failureHint ? (
                      <p className="mt-1 max-w-[180px] text-[10px] leading-snug text-[var(--ac-danger)]">
                        {row.failureHint}
                      </p>
                    ) : null}
                  </td>
                  <td
                    className="py-2 pr-3 max-w-[220px] truncate text-[var(--ac-text-muted)]"
                    title={row.preview}
                  >
                    {row.preview || "—"}
                  </td>
                  <td className="py-2">
                    {String(row.status).toLowerCase() === "failed" && row.filhoId ? (
                      <button
                        type="button"
                        className="admin-btn-ghost !px-2 !py-1 !text-[10px]"
                        disabled={busy !== "idle" || !eventId || (!!tenantId && tenantId !== row.tenantId)}
                        title={
                          !eventId
                            ? "Selecione a gira acima para reenviar"
                            : "Reenviar só este membro"
                        }
                        onClick={() => void retryFailed(row)}
                      >
                        <RotateCcw
                          className={cn("h-3 w-3", retryingId === row.id && "animate-spin")}
                        />
                        Reenviar
                      </button>
                    ) : (
                      <span className="text-[var(--ac-text-faint)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!logRows.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--ac-text-muted)]">
                    Nenhum disparo de gira registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
