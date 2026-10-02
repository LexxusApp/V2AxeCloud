import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type PaymentSummary = {
  windowDays: number;
  generated: number;
  paid: number;
  pending: number;
  failed: number;
  expired: number;
  cancelled: number;
  revenueCents: number;
  conversionRate: number;
  events: number;
  lastEventAt: string | null;
};

type PaymentEvent = {
  id: string;
  tenant_id: string | null;
  provider: string;
  external_id: string;
  event_type: string;
  status: string;
  payment_method: string;
  amount_cents: number | null;
  billing_cycle: string | null;
  charge_id: string | null;
  error_code: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  tenant: { nome_terreiro: string | null; email: string | null; cargo: string | null } | null;
};

type PaymentsResponse = {
  available: boolean;
  rows: PaymentEvent[];
  summary: PaymentSummary;
  checkedAt?: string;
  message?: string;
};

const EMPTY_SUMMARY: PaymentSummary = {
  windowDays: 30,
  generated: 0,
  paid: 0,
  pending: 0,
  failed: 0,
  expired: 0,
  cancelled: 0,
  revenueCents: 0,
  conversionRate: 0,
  events: 0,
  lastEventAt: null,
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pago",
  pending: "Aguardando",
  processing: "Processando",
  failed: "Falhou",
  expired: "Vencido",
  cancelled: "Cancelado",
  processed: "Recebido",
};

const EVENT_LABELS: Record<string, string> = {
  pix_requested: "Tentativa de PIX",
  pix_created: "PIX gerado",
  pix_status_checked: "Status do PIX",
  pix_status_failed: "Falha ao consultar PIX",
  pix_failed: "Falha ao gerar PIX",
  card_requested: "Tentativa no cartão",
  card_created: "Cobrança no cartão",
  card_failed: "Falha no cartão",
  payment_confirmed: "Pagamento confirmado",
  webhook_status_received: "Atualização da Efí",
  webhook_received: "Webhook recebido",
  subscription_activation_failed: "Falha ao ativar assinatura",
};

function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function when(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: string): string {
  if (status === "paid") return "bg-[var(--ac-success-soft)] text-[var(--ac-success)]";
  if (status === "failed") return "bg-[var(--ac-danger-soft)] text-[var(--ac-danger)]";
  if (status === "pending" || status === "expired") return "bg-[var(--ac-warn-soft)] text-[var(--ac-warn)]";
  if (status === "cancelled") return "bg-[var(--ac-paper-elevated)] text-[var(--ac-text-muted)]";
  return "bg-[var(--ac-blue-soft)] text-[var(--ac-blue)]";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "paid") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === "failed") return <XCircle className="h-4 w-4" aria-hidden />;
  if (status === "pending" || status === "expired") return <Clock3 className="h-4 w-4" aria-hidden />;
  return <ShieldCheck className="h-4 w-4" aria-hidden />;
}

function PaymentMethodIcon({ method }: { method: string }) {
  return method === "pix" ? <QrCode className="h-4 w-4" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />;
}

function SummaryItem({ label, value, helper, tone = "neutral" }: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const toneClass = tone === "success" ? "text-[var(--ac-success)]" : tone === "danger"
    ? "text-[var(--ac-danger)]" : tone === "warning" ? "text-[var(--ac-warn)]" : "text-[var(--ac-text)]";
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold text-[var(--ac-text-muted)]">{label}</p>
      <p className={cn("admin-mono mt-1 text-2xl font-semibold tracking-[-0.03em]", toneClass)}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--ac-text-faint)]">{helper}</p>
    </div>
  );
}

export function PaymentsPanel() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "120" });
      if (status) params.set("status", status);
      if (method) params.set("method", method);
      if (query) params.set("q", query);
      const response = await apiJson<PaymentsResponse>(`/api/admin-console/payments?${params.toString()}`);
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pagamentos.");
    } finally {
      setLoading(false);
    }
  }, [method, query, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = data?.summary || EMPTY_SUMMARY;
  const rows = data?.rows || [];
  const criticalCount = summary.failed + summary.expired;
  const lastUpdate = useMemo(() => when(data?.checkedAt), [data?.checkedAt]);

  async function copyId(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied((current) => current === value ? null : current), 1600);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[var(--ac-radius)] bg-[#0b3028] text-white shadow-[var(--ac-shadow)]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f4c84a] text-[#10251f]">
              <WalletCards className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Central de pagamentos</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-emerald-50/75">
                Acompanhe a cobrança desde o PIX gerado até a confirmação, vencimento ou falha na Efí.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-50/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Atualização automática · {lastUpdate}
          </div>
        </div>
      </section>

      <section aria-label="Resumo dos últimos 30 dias" className="admin-panel !p-0 overflow-hidden">
        <div className="grid divide-y divide-[var(--ac-paper-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          <SummaryItem label="Recebido" value={money(summary.revenueCents)} helper="Pagamentos confirmados em 30 dias" tone="success" />
          <SummaryItem label="Cobranças geradas" value={String(summary.generated)} helper="PIX e cartão criados" />
          <SummaryItem label="Confirmados" value={String(summary.paid)} helper={`${summary.conversionRate}% de conversão`} tone="success" />
          <SummaryItem label="Aguardando" value={String(summary.pending)} helper="Ainda podem ser pagos" tone="warning" />
          <SummaryItem label="Falhas e vencidos" value={String(criticalCount)} helper={`${summary.failed} falhas · ${summary.expired} vencidos`} tone={criticalCount ? "danger" : "neutral"} />
        </div>
      </section>

      {criticalCount > 0 ? (
        <section className="flex flex-col gap-3 rounded-[var(--ac-radius)] bg-[var(--ac-danger-soft)] px-4 py-3 text-[var(--ac-danger)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Há {criticalCount} ocorrências que merecem revisão</p>
              <p className="mt-0.5 text-xs opacity-80">Abra a linha do tempo para identificar o terreiro, a etapa e o motivo informado pelo provedor.</p>
            </div>
          </div>
          <button type="button" onClick={() => setStatus("failed")} className="admin-btn-secondary shrink-0 !border-red-200 !text-[var(--ac-danger)]">
            Ver falhas
          </button>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="flex flex-col gap-3 border-b border-[var(--ac-paper-border)] pb-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--ac-text)]">Linha do tempo financeira</h3>
            <p className="mt-1 text-xs text-[var(--ac-text-muted)]">{rows.length} eventos visíveis · histórico mais recente primeiro</p>
          </div>
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar terreiro, e-mail ou código da cobrança</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ac-text-faint)]" aria-hidden />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="admin-input w-full !pl-9" placeholder="Terreiro, e-mail ou cobrança" />
            </label>
            <button type="submit" className="admin-btn-secondary">Buscar</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="admin-input !w-auto" aria-label="Filtrar por situação">
              <option value="">Todas as situações</option>
              <option value="paid">Pagos</option>
              <option value="pending">Aguardando</option>
              <option value="processing">Processando</option>
              <option value="failed">Falhas</option>
              <option value="expired">Vencidos</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="admin-input !w-auto" aria-label="Filtrar por meio de pagamento">
              <option value="">PIX e cartão</option>
              <option value="pix">PIX</option>
              <option value="card">Cartão</option>
            </select>
            <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary" aria-label="Atualizar pagamentos">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
              Atualizar
            </button>
          </div>
        </div>

        {error ? <div className="admin-alert-error mt-4">{error}</div> : null}
        {data && !data.available ? <div className="admin-alert-info mt-4">{data.message || "Histórico financeiro indisponível."}</div> : null}

        {loading && !data ? (
          <div className="space-y-3 py-5" aria-label="Carregando pagamentos">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-[var(--ac-paper-elevated)]" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <ShieldCheck className="h-9 w-9 text-[var(--ac-text-faint)]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-[var(--ac-text)]">Nenhum evento encontrado</p>
            <p className="mt-1 max-w-md text-xs text-[var(--ac-text-muted)]">Tente remover os filtros. Novas tentativas de pagamento aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 pt-4 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="rounded-lg bg-[var(--ac-paper-elevated)] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 text-[var(--ac-text-muted)]"><PaymentMethodIcon method={row.payment_method} /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ac-text)]">{row.tenant?.nome_terreiro || "Terreiro não identificado"}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--ac-text-muted)]">{EVENT_LABELS[row.event_type] || row.event_type}</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", statusClass(row.status))}>
                      <StatusIcon status={row.status} />{STATUS_LABELS[row.status] || row.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-[var(--ac-text-faint)]">Valor</p><p className="admin-mono mt-0.5 font-semibold text-[var(--ac-text)]">{money(row.amount_cents)}</p></div>
                    <div><p className="text-[var(--ac-text-faint)]">Quando</p><p className="mt-0.5 text-[var(--ac-text)]">{when(row.occurred_at)}</p></div>
                  </div>
                  {row.message ? <p className="mt-3 border-t border-[var(--ac-paper-border)] pt-3 text-xs leading-relaxed text-[var(--ac-text-muted)]">{row.message}</p> : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto pt-4 md:block">
              <table className="admin-table min-w-[940px]">
                <thead><tr className="admin-thead">
                  <th className="admin-th">Quando</th><th className="admin-th">Terreiro</th><th className="admin-th">Evento</th>
                  <th className="admin-th">Situação</th><th className="admin-th">Meio</th><th className="admin-th text-right">Valor</th><th className="admin-th">Cobrança</th>
                </tr></thead>
                <tbody>
                  {rows.map((row) => {
                    const charge = row.charge_id || row.external_id;
                    return (
                      <tr key={row.id} className="admin-tr-hover border-b border-[var(--ac-paper-border)] align-top">
                        <td className="whitespace-nowrap px-3 py-3 text-[11px] text-[var(--ac-text-muted)]">{when(row.occurred_at)}</td>
                        <td className="max-w-[14rem] px-3 py-3"><p className="truncate text-xs font-semibold text-[var(--ac-text)]">{row.tenant?.nome_terreiro || "Não identificado"}</p><p className="mt-0.5 truncate text-[10px] text-[var(--ac-text-faint)]">{row.tenant?.email || row.tenant_id || "Sem vínculo"}</p></td>
                        <td className="max-w-[16rem] px-3 py-3"><p className="text-xs font-medium text-[var(--ac-text)]">{EVENT_LABELS[row.event_type] || row.event_type}</p><p className="mt-0.5 truncate text-[10px] text-[var(--ac-text-muted)]" title={row.message || undefined}>{row.message || "—"}</p></td>
                        <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", statusClass(row.status))}><StatusIcon status={row.status} />{STATUS_LABELS[row.status] || row.status}</span></td>
                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-xs text-[var(--ac-text-muted)]"><PaymentMethodIcon method={row.payment_method} />{row.payment_method === "pix" ? "PIX" : row.payment_method === "card" ? "Cartão" : "Outro"}</span></td>
                        <td className="admin-mono whitespace-nowrap px-3 py-3 text-right text-xs font-semibold text-[var(--ac-text)]">{money(row.amount_cents)}</td>
                        <td className="px-3 py-3"><button type="button" onClick={() => void copyId(charge)} className="inline-flex max-w-[10rem] items-center gap-1.5 text-[11px] text-[var(--ac-text-muted)] hover:text-[var(--ac-text)]" title={charge}><span className="admin-mono truncate">{charge}</span><Copy className="h-3 w-3 shrink-0" aria-hidden /><span className="sr-only">{copied === charge ? "Código copiado" : "Copiar código"}</span></button>{copied === charge ? <p className="mt-1 text-[9px] text-[var(--ac-success)]">Copiado</p> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
