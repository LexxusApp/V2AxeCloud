import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type TenantOption = {
  id: string;
  nomeTerreiro: string;
  email: string | null;
};

type Recipient = {
  filhoId: string;
  nome: string;
  phoneMasked: string;
  valorFmt: string;
  vencimentoBr: string;
  sentToday: boolean;
};

type Preview = {
  tenantId: string;
  nomeTerreiro: string;
  competencia: string;
  mesExtenso: string;
  pending: number;
  eligible: number;
  withoutPhone: number;
  alreadySentToday: number;
  sendable: number;
  truncated: number;
  automaticEnabled: boolean;
  maxRecipients: number;
  recipients: Recipient[];
};

type Feedback = { kind: "ok" | "err"; message: string } | null;

export function MensalidadeDispatchPanel() {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [busy, setBusy] = useState<"idle" | "loading" | "sending">("loading");
  const [feedback, setFeedback] = useState<Feedback>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId),
    [tenantId, tenants],
  );

  const loadTenants = useCallback(async () => {
    setBusy("loading");
    setFeedback(null);
    try {
      const result = await apiJson<{ tenants: TenantOption[]; metaConfigured: boolean }>(
        "/api/admin-console/mensalidades/tenants",
      );
      setTenants(result.tenants);
      setMetaConfigured(result.metaConfigured);
    } catch (error) {
      setFeedback({ kind: "err", message: error instanceof Error ? error.message : "Erro ao listar terreiros." });
    } finally {
      setBusy("idle");
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const loadPreview = useCallback(async (id: string) => {
    if (!id) {
      setPreview(null);
      return;
    }
    setBusy("loading");
    setFeedback(null);
    setConfirmed(false);
    try {
      const result = await apiJson<Preview>(
        `/api/admin-console/mensalidades/preview?tenantId=${encodeURIComponent(id)}`,
      );
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setFeedback({ kind: "err", message: error instanceof Error ? error.message : "Erro ao preparar a cobrança." });
    } finally {
      setBusy("idle");
    }
  }, []);

  function selectTenant(id: string) {
    setTenantId(id);
    void loadPreview(id);
  }

  async function send() {
    if (!preview || !confirmed || preview.sendable === 0) return;
    setBusy("sending");
    setFeedback(null);
    try {
      const result = await apiJson<{ sent: number; failed: number; skipped: number }>(
        "/api/admin-console/mensalidades/send",
        {
          method: "POST",
          body: JSON.stringify({
            tenantId: preview.tenantId,
            confirmation: preview.nomeTerreiro,
          }),
        },
      );
      setFeedback({
        kind: result.failed ? "err" : "ok",
        message: result.failed
          ? `${result.sent} cobrança(s) enviada(s) e ${result.failed} falha(s). Confira a Central de envios.`
          : `${result.sent} cobrança(s) enviada(s) para ${preview.nomeTerreiro}.`,
      });
      setConfirmed(false);
      await loadPreview(preview.tenantId);
    } catch (error) {
      setFeedback({ kind: "err", message: error instanceof Error ? error.message : "Falha ao enviar cobranças." });
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="space-y-6">
      <header className="admin-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--ac-text)]">
              <CreditCard className="h-5 w-5 text-[var(--ac-accent)]" aria-hidden="true" />
              Cobrança manual de mensalidades
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ac-text-muted)]">
              Escolha uma casa, confira quem está pendente no mês atual e autorize o envio. Cada membro recebe no máximo uma cobrança manual por dia.
            </p>
          </div>
          <span className={cn("admin-badge inline-flex items-center gap-2", metaConfigured && "admin-badge-strong")}>
            {metaConfigured ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {metaConfigured ? "Meta API pronta" : "Meta API indisponível"}
          </span>
        </div>
      </header>

      <section className="admin-panel" aria-labelledby="automatic-policy-title">
        <div className="flex items-start gap-3">
          <CalendarCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ac-success)]" aria-hidden="true" />
          <div>
            <h4 id="automatic-policy-title" className="text-sm font-bold text-[var(--ac-text)]">
              Automático somente no dia 1
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ac-text-muted)]">
              O sistema envia apenas o aviso de que a mensalidade está disponível. Não há cobrança semanal, diária, no vencimento ou após o vencimento.
            </p>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={cn(
            "rounded-[var(--ac-radius-sm)] border px-4 py-3 text-sm",
            feedback.kind === "ok"
              ? "border-[#abefc6] bg-[var(--ac-success-soft)] text-[var(--ac-success)]"
              : "border-[#fecdca] bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]",
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="admin-panel space-y-4" aria-busy={busy === "loading"}>
          <div>
            <label htmlFor="mensalidade-tenant" className="admin-label">
              Terreiro
            </label>
            <select
              id="mensalidade-tenant"
              value={tenantId}
              onChange={(event) => selectTenant(event.target.value)}
              disabled={busy !== "idle"}
              className="admin-input mt-1 w-full disabled:cursor-wait disabled:opacity-60"
            >
              <option value="">Selecione uma casa</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.nomeTerreiro}
                </option>
              ))}
            </select>
            {selectedTenant?.email && (
              <p className="mt-1 text-xs text-[var(--ac-text-faint)]">{selectedTenant.email}</p>
            )}
          </div>

          {preview && (
            <dl className="grid grid-cols-2 gap-3 border-t border-[var(--ac-paper-border)] pt-4">
              <div>
                <dt className="text-[11px] font-semibold text-[var(--ac-text-muted)]">Competência</dt>
                <dd className="admin-mono mt-1 text-sm font-bold text-[var(--ac-text)]">{preview.competencia}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[var(--ac-text-muted)]">Prontos para envio</dt>
                <dd className="admin-mono mt-1 text-sm font-bold text-[var(--ac-text)]">{preview.sendable}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[var(--ac-text-muted)]">Já cobrados hoje</dt>
                <dd className="admin-mono mt-1 text-sm font-bold text-[var(--ac-text)]">{preview.alreadySentToday}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[var(--ac-text-muted)]">Sem WhatsApp válido</dt>
                <dd className="admin-mono mt-1 text-sm font-bold text-[var(--ac-text)]">{preview.withoutPhone}</dd>
              </div>
            </dl>
          )}

          {preview?.truncated > 0 && (
            <p className="rounded-[var(--ac-radius-sm)] bg-[var(--ac-warn-soft)] p-3 text-xs text-[var(--ac-warn)]">
              O limite seguro é {preview.maxRecipients} envios por lote. Restaram {preview.truncated} membros para um próximo envio.
            </p>
          )}
        </section>

        <section className="admin-panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-text)]">
              <Users className="h-4 w-4 text-[var(--ac-accent)]" aria-hidden="true" />
              Membros pendentes no mês
            </h4>
            {preview && (
              <button
                type="button"
                onClick={() => void loadPreview(preview.tenantId)}
                disabled={busy !== "idle"}
                className="admin-btn-ghost !min-h-9 disabled:opacity-50"
                aria-label="Atualizar prévia"
              >
                <RefreshCw className={cn("h-4 w-4", busy === "loading" && "animate-spin")} />
                Atualizar
              </button>
            )}
          </div>

          {!preview && (
            <div className="py-10 text-center text-sm text-[var(--ac-text-muted)]">
              Selecione um terreiro para carregar a prévia da cobrança.
            </div>
          )}

          {preview && preview.recipients.length === 0 && (
            <div className="rounded-[var(--ac-radius-sm)] bg-[var(--ac-success-soft)] px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-[var(--ac-success)]" />
              <p className="mt-2 text-sm font-semibold text-[var(--ac-success)]">Nenhuma mensalidade pendente neste mês.</p>
            </div>
          )}

          {preview && preview.recipients.length > 0 && (
            <>
              <div className="max-h-80 overflow-y-auto rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)]">
                <ul className="divide-y divide-[var(--ac-paper-border)]">
                  {preview.recipients.map((recipient) => (
                    <li key={recipient.filhoId} className="flex items-start justify-between gap-4 px-3 py-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--ac-text)]">{recipient.nome}</p>
                        <p className="mt-0.5 text-[var(--ac-text-muted)]">{recipient.phoneMasked} · vence {recipient.vencimentoBr}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="admin-mono font-bold text-[var(--ac-text)]">R$ {recipient.valorFmt}</p>
                        {recipient.sentToday && <span className="text-[10px] font-semibold text-[var(--ac-success)]">enviado hoje</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--ac-radius-sm)] bg-[var(--ac-paper-elevated)] p-3 text-xs text-[var(--ac-text-muted)]">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  disabled={preview.sendable === 0 || busy !== "idle"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Confirmo o envio para <strong className="text-[var(--ac-text)]">{preview.sendable} membro(s)</strong> de {preview.nomeTerreiro}.
                </span>
              </label>

              <button
                type="button"
                onClick={() => void send()}
                disabled={!confirmed || preview.sendable === 0 || busy !== "idle" || !metaConfigured}
                className="admin-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {busy === "sending" ? "Enviando cobranças..." : `Enviar ${preview.sendable} cobrança(s) agora`}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
