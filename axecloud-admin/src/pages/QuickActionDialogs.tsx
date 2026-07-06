import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

export type QuickActionKind = "lifetime" | "notice" | "notify" | "report" | null;

type TenantOption = {
  id: string;
  nome_terreiro: string | null;
  email: string | null;
};

type QuickActionDialogsProps = {
  kind: QuickActionKind;
  onClose: () => void;
  tenants: TenantOption[];
  busy?: boolean;
  onLifetime: (tenantId: string) => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(16,24,40,0.4)]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--ac-paper-border)] bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ac-text)]">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-[var(--ac-text-muted)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ac-text-muted)] hover:bg-[var(--ac-accent-soft)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuickActionDialogs({
  kind,
  onClose,
  tenants,
  busy,
  onLifetime,
  onSuccess,
  onError,
}: QuickActionDialogsProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;

  if (kind === "lifetime") {
    return (
      <LifetimeDialog
        tenants={tenants}
        busy={busy || submitting}
        onClose={onClose}
        onSubmit={async (tenantId) => {
          setSubmitting(true);
          try {
            await onLifetime(tenantId);
            onSuccess("Acesso vitalício activado para o terreiro seleccionado.");
            onClose();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Erro");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  if (kind === "notice") {
    return (
      <NoticeDialog
        busy={submitting}
        onClose={onClose}
        onSubmit={async (payload) => {
          setSubmitting(true);
          try {
            const r = await apiJson<{
              noticesCreated: number;
              tenantsTotal: number;
              pushSent: number;
              errors: string[];
            }>("/api/admin-console/quick-actions/global-notice", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            const errHint = r.errors?.length ? ` (${r.errors.length} falhas)` : "";
            onSuccess(
              `Comunicado publicado em ${r.noticesCreated}/${r.tenantsTotal} terreiros` +
                (payload.sendPush ? ` · ${r.pushSent} push enviados` : "") +
                errHint
            );
            onClose();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Erro ao publicar");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  if (kind === "notify") {
    return (
      <NotifyDialog
        busy={submitting}
        onClose={onClose}
        onSubmit={async (channel, payload) => {
          setSubmitting(true);
          try {
            if (channel === "push") {
              const r = await apiJson<{ sent: number; targets: number }>(
                "/api/admin-console/quick-actions/broadcast-push",
                { method: "POST", body: JSON.stringify(payload) }
              );
              onSuccess(`Push enviado: ${r.sent}/${r.targets} dispositivos.`);
            } else {
              const r = await apiJson<{
                sent: number;
                skipped: number;
                failed: number;
                tenantsTotal: number;
              }>("/api/admin-console/quick-actions/broadcast-whatsapp", {
                method: "POST",
                body: JSON.stringify({ message: payload.body }),
              });
              onSuccess(
                `WhatsApp: ${r.sent} enviados · ${r.skipped} sem número · ${r.failed} falhas (de ${r.tenantsTotal} terreiros).`
              );
            }
            onClose();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Erro ao enviar");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  if (kind === "report") {
    return (
      <ReportDialog
        busy={submitting}
        onClose={onClose}
        onGenerate={async () => {
          setSubmitting(true);
          try {
            const r = await apiJson<{
              rows: {
                id: string;
                terreiro: string;
                tenant_id: string;
                tipo: string;
                valor: number;
                categoria: string;
                data: string;
                descricao: string;
                status: string;
              }[];
              summary: { entradas: number; saidas: number; saldo: number; lancamentos: number };
              generatedAt: string;
            }>("/api/admin-console/quick-actions/financial-report");
            const stamp = new Date(r.generatedAt).toISOString().slice(0, 10);
            downloadCsv(
              `axecloud-financeiro-${stamp}.csv`,
              r.rows.map((row) => ({
                terreiro: row.terreiro,
                tenant_id: row.tenant_id,
                tipo: row.tipo,
                valor: row.valor,
                categoria: row.categoria,
                data: row.data,
                status: row.status,
                descricao: row.descricao,
              }))
            );
            onSuccess(
              `Relatório gerado: ${r.summary.lancamentos} lançamentos · entradas R$ ${r.summary.entradas.toFixed(2)} · saídas R$ ${r.summary.saidas.toFixed(2)} · saldo R$ ${r.summary.saldo.toFixed(2)}. CSV descarregado.`
            );
            onClose();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Erro ao gerar relatório");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    );
  }

  return null;
}

function LifetimeDialog({
  tenants,
  busy,
  onClose,
  onSubmit,
}: {
  tenants: TenantOption[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (tenantId: string) => Promise<void>;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");

  return (
    <ModalShell
      title="Liberar acesso vitalício"
      subtitle="Marca o plano Vita (sem expiração) para o terreiro seleccionado."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!tenantId) return;
          void onSubmit(tenantId);
        }}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="font-medium text-[var(--ac-text)]">Terreiro</span>
          <select
            className="admin-input mt-1 w-full"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome_terreiro || t.email || t.id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="admin-btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={busy || !tenantId} className="admin-btn-primary disabled:opacity-50">
            {busy ? "A aplicar…" : "Activar vitalício"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function NoticeDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (p: { titulo: string; conteudo: string; categoria: string; sendPush: boolean }) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("Sistema");
  const [sendPush, setSendPush] = useState(true);

  return (
    <ModalShell
      title="Comunicado global"
      subtitle="Publica um aviso no mural de todos os terreiros activos."
      onClose={onClose}
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void onSubmit({ titulo, conteudo, categoria, sendPush });
        }}
        className="space-y-3"
      >
        <Field label="Título" value={titulo} onChange={setTitulo} required />
        <label className="block text-sm">
          <span className="font-medium">Conteúdo</span>
          <textarea
            className="admin-input mt-1 min-h-[100px] w-full resize-y"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            required
          />
        </label>
        <Field label="Categoria" value={categoria} onChange={setCategoria} />
        <label className="flex items-center gap-2 text-sm text-[var(--ac-text-muted)]">
          <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} />
          Enviar push aos filhos de santo (onde houver inscrição)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="admin-btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="admin-btn-primary disabled:opacity-50">
            {busy ? "A publicar…" : "Publicar em todos"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function NotifyDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (
    channel: "push" | "whatsapp",
    p: { title: string; body: string; url?: string }
  ) => Promise<void>;
}) {
  const [channel, setChannel] = useState<"push" | "whatsapp">("push");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <ModalShell
      title="Enviar notificações"
      subtitle="Push para todos os dispositivos inscritos ou WhatsApp para zeladores com número no cadastro."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(channel, { title, body, url: "/mural" });
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          {(["push", "whatsapp"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                channel === c
                  ? "border-[var(--ac-accent)] bg-[var(--ac-accent-soft)] text-[var(--ac-accent)]"
                  : "border-[var(--ac-paper-border)] text-[var(--ac-text-muted)]"
              )}
            >
              {c === "push" ? "Push (app)" : "WhatsApp"}
            </button>
          ))}
        </div>
        {channel === "push" && <Field label="Título" value={title} onChange={setTitle} required />}
        <label className="block text-sm">
          <span className="font-medium">{channel === "push" ? "Mensagem" : "Texto WhatsApp"}</span>
          <textarea
            className="admin-input mt-1 min-h-[80px] w-full resize-y"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        {channel === "whatsapp" && (
          <p className="text-xs text-[var(--ac-text-muted)]">
            Requer WhatsApp do console conectado (aba Notificações). Só envia para zeladores com número no cadastro.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="admin-btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="admin-btn-primary disabled:opacity-50">
            {busy ? "A enviar…" : "Enviar agora"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReportDialog({
  busy,
  onClose,
  onGenerate,
}: {
  busy?: boolean;
  onClose: () => void;
  onGenerate: () => Promise<void>;
}) {
  return (
    <ModalShell
      title="Relatório financeiro"
      subtitle="Exporta todos os lançamentos da plataforma em CSV (até 15 000 registos)."
      onClose={onClose}
    >
      <p className="mb-4 text-sm text-[var(--ac-text-muted)]">
        Inclui terreiro, tipo, valor, categoria, data e descrição. O ficheiro é descarregado automaticamente.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="admin-btn-secondary">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onGenerate()}
          className="admin-btn-primary disabled:opacity-50"
        >
          {busy ? "A gerar…" : "Gerar e descarregar CSV"}
        </button>
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="admin-input mt-1 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}
