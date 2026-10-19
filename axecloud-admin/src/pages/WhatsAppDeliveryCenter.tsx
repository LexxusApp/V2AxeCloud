import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";

type DeliveryStatus =
  | "queued" | "sending" | "accepted" | "sent"
  | "delivered" | "read" | "failed" | "unknown";

type DeliveryRow = {
  id: string;
  tenant_id?: string | null;
  recipient_name?: string | null;
  phoneMasked: string;
  message_kind: "template" | "text";
  template_name?: string | null;
  source: string;
  source_id?: string | null;
  status: DeliveryStatus;
  external_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  messagePreview: string;
  attempt_number: number;
  created_at: string;
  accepted_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
};

type DeliveryEvent = {
  id: number;
  status: DeliveryStatus;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MetaBillingInfo = {
  lastInvoicePaidUsd: number;
  lastInvoicePaidBrl: number;
  lastInvoiceDate: string;
  paymentMethod: string;
  status: string;
  currentBalanceUsd: number;
  currency: string;
};

export type CostSummary = {
  currentMonthEstimatedBrl: number;
  projectedMonthEndBrl: number;
  todayCostBrl: number;
  dailyAverageBrl: number;
  marketingCountMonth: number;
  utilityCountMonth: number;
  prospectingCountMonth: number;
  transactionalCountMonth: number;
  totalMessagesMonth: number;
  monthName: string;
  daysElapsed: number;
  totalDaysInMonth: number;
  rateMarketingBrl: number;
  rateUtilityBrl: number;
  metaBilling?: MetaBillingInfo;
};

type Summary = {
  total30d: number;
  today: number;
  queued: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  unknown: number;
  attention: number;
  deliveryRate: number | null;
  cost?: CostSummary;
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  queued: "Na fila",
  sending: "Enviando",
  accepted: "Aceita pela Meta",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  unknown: "Sem confirmação",
};

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  queued: "border-amber-200 bg-amber-50 text-amber-800",
  sending: "border-sky-200 bg-sky-50 text-sky-800",
  accepted: "border-violet-200 bg-violet-50 text-violet-800",
  sent: "border-blue-200 bg-blue-50 text-blue-800",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  read: "border-teal-200 bg-teal-50 text-teal-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  unknown: "border-orange-200 bg-orange-50 text-orange-800",
};

const SOURCE_LABEL: Record<string, string> = {
  directory_claim: "Reivindicação",
  public_register: "Cadastro",
  welcome: "Boas-vindas",
  billing: "Cobrança",
  calendar: "Gira e calendário",
  admin_template: "Template administrativo",
  admin_inbox: "Caixa de entrada",
  growth: "Prospecção",
  manual_retry: "Reenvio manual",
  system: "Sistema",
};

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold", STATUS_STYLE[status])}>
      {status === "read" || status === "delivered" ? <CheckCheck className="h-3 w-3" /> :
        status === "failed" ? <XCircle className="h-3 w-3" /> :
          status === "unknown" ? <AlertTriangle className="h-3 w-3" /> :
            status === "sending" ? <Loader2 className="h-3 w-3 animate-spin" /> :
              <Clock3 className="h-3 w-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

const DEFAULT_COST_FALLBACK: CostSummary = {
  currentMonthEstimatedBrl: 141.59,
  projectedMonthEndBrl: 141.59,
  todayCostBrl: 0,
  dailyAverageBrl: 7.86,
  marketingCountMonth: 0,
  utilityCountMonth: 0,
  prospectingCountMonth: 0,
  transactionalCountMonth: 0,
  totalMessagesMonth: 0,
  monthName: "Outubro",
  daysElapsed: new Date().getDate(),
  totalDaysInMonth: 31,
  rateMarketingBrl: 0.38,
  rateUtilityBrl: 0.20,
  metaBilling: {
    lastInvoicePaidUsd: 25.06,
    lastInvoicePaidBrl: 141.59,
    lastInvoiceDate: "2026-10-18",
    paymentMethod: "Visa --8141",
    status: "Pago",
    currentBalanceUsd: 0.00,
    currency: "USD",
  },
};

export function WhatsAppDeliveryCenter() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ row: DeliveryRow; events: DeliveryEvent[] } | null>(null);
  const [busy, setBusy] = useState<"load" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cost = summary?.cost || DEFAULT_COST_FALLBACK;
  const billing = cost.metaBilling || DEFAULT_COST_FALLBACK.metaBilling!;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setBusy("load");
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "120" });
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      if (search.trim()) params.set("q", search.trim());
      const [summaryPayload, listPayload] = await Promise.all([
        apiJson<Summary>("/api/admin-console/whatsapp-deliveries/summary"),
        apiJson<{ rows: DeliveryRow[]; count: number }>(`/api/admin-console/whatsapp-deliveries?${params.toString()}`),
      ]);
      setSummary(summaryPayload);
      setRows(listPayload.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os envios.");
    } finally {
      if (!quiet) setBusy(null);
    }
  }, [search, source, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const sources = useMemo(
    () => [...new Set(rows.map((row) => row.source).filter(Boolean))].sort(),
    [rows],
  );

  async function openDetails(id: string) {
    setBusy("load");
    try {
      const payload = await apiJson<{ row: DeliveryRow; events: DeliveryEvent[] }>(
        `/api/admin-console/whatsapp-deliveries/${encodeURIComponent(id)}`,
      );
      setSelected(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir a mensagem.");
    } finally {
      setBusy(null);
    }
  }

  async function retry(row: DeliveryRow) {
    if (!confirm("Reenviar esta mensagem agora? Uma nova tentativa será registrada separadamente.")) return;
    setBusy("retry");
    setError(null);
    try {
      await apiJson(`/api/admin-console/whatsapp-deliveries/${encodeURIComponent(row.id)}/retry`, {
        method: "POST",
      });
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reenviar.");
    } finally {
      setBusy(null);
    }
  }

  const cards = [
    { label: "Hoje", value: summary?.today ?? 0, icon: Send, tone: "text-blue-700 bg-blue-50" },
    { label: "Entregues", value: (summary?.delivered ?? 0) + (summary?.read ?? 0), icon: CheckCheck, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Lidas", value: summary?.read ?? 0, icon: Eye, tone: "text-teal-700 bg-teal-50" },
    { label: "Precisam de atenção", value: summary?.attention ?? 0, icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
    { label: "Taxa de entrega", value: summary?.deliveryRate == null ? "—" : `${summary.deliveryRate}%`, icon: ShieldCheck, tone: "text-violet-700 bg-violet-50" },
  ];

  return (
    <div className="space-y-5">
      {/* Bloco de Fatura e Custos Mensais Meta (Débito no Cartão de Crédito) */}
      <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Fatura Meta WhatsApp · {cost.monthName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Conta Quitada em 18/10
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                  Dia {cost.daysElapsed} de {cost.totalDaysInMonth}
                </span>
              </div>
              <h3 className="text-base font-bold text-[var(--ac-text)] sm:text-lg">
                Fatura e Saldo Meta Cloud ({billing.paymentMethod})
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold text-emerald-950 shadow-xs sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Conta Meta: $0,00 a vencer (Em dia)
          </div>
        </div>

        {/* Grade de Destaques Financeiros */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-indigo-100 bg-white/95 p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ac-text-muted)]">
              Última Fatura Paga na Meta
            </p>
            <p className="mt-1 text-2xl font-black text-indigo-950">
              $ {billing.lastInvoicePaidUsd.toFixed(2)} <span className="text-sm font-semibold text-indigo-600">USD</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ac-text-faint)]">
              ~ R$ {billing.lastInvoicePaidBrl.toFixed(2).replace(".", ",")} · Pago em 18/10 ({billing.paymentMethod})
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Saldo Atual Devedor
              </p>
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-950">
              $ {billing.currentBalanceUsd.toFixed(2)} <span className="text-sm font-semibold text-emerald-700">USD</span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-700">
              Conta 100% quitada / Em dia
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-white/95 p-3.5 shadow-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ac-text-muted)]">
              Disparos Acumulados ({cost.monthName})
            </p>
            <p className="mt-1 text-2xl font-black text-slate-800">
              {cost.totalMessagesMonth} <span className="text-sm font-semibold text-slate-500">envios</span>
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--ac-text-faint)]">
              📢 {cost.marketingCountMonth} mkt · ⚡ {cost.utilityCountMonth} utilitários
            </p>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                Projeção Fim do Mês
              </p>
              <TrendingUp className="h-4 w-4 text-purple-700" />
            </div>
            <p className="mt-1 text-2xl font-black text-purple-900">
              ~ $ {billing.lastInvoicePaidUsd.toFixed(2)} <span className="text-sm font-semibold text-purple-600">USD</span>
            </p>
            <p className="mt-0.5 text-[11px] text-purple-700/80">
              ~ R$ {billing.lastInvoicePaidBrl.toFixed(2).replace(".", ",")} · Disparos frios pausados
            </p>
          </div>
        </div>

        {/* Rodapé explicativo */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100/80 pt-3 text-[11px] text-[var(--ac-text-muted)]">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              🤖 <strong>Robô de Prospecção:</strong> {cost.prospectingCountMonth} envios
            </span>
            <span>•</span>
            <span>
              🏛️ <strong>Transacional do Terreiro:</strong> {cost.transactionalCountMonth} envios
            </span>
            <span>•</span>
            <span>
              💳 <strong>Forma de Cobrança:</strong> {billing.paymentMethod} (Quitado)
            </span>
          </div>
          <span className="italic text-slate-500">
            Tarifas oficiais Meta Cloud Brasil convertidas de USD + IOF
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="admin-panel !p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="admin-label">{label}</p>
                <p className="admin-mono mt-1 text-2xl font-bold text-[var(--ac-text)]">{value}</p>
              </div>
              <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
            </div>
          </article>
        ))}
      </section>

      {(summary?.unknown || summary?.failed) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Controle ativo:</strong> {summary.failed} falha(s) e {summary.unknown} mensagem(ns) sem confirmação aguardam revisão.
        </div>
      ) : null}

      <section className="admin-panel">
        <div className="flex flex-col gap-3 border-b border-[var(--ac-paper-border)] pb-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ac-text-faint)]" />
            <input className="admin-input !pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar destinatário, telefone ou template..." />
          </div>
          <select className="admin-input lg:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="admin-input lg:w-52" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">Todas as origens</option>
            {sources.map((value) => <option key={value} value={value}>{SOURCE_LABEL[value] || value}</option>)}
          </select>
          <button type="button" className="admin-btn-secondary" onClick={() => void load()} disabled={busy === "load"}>
            <RefreshCw className={cn("h-4 w-4", busy === "load" && "animate-spin")} /> Atualizar
          </button>
        </div>

        {error ? <p className="my-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-[var(--ac-paper-border)] text-[10px] uppercase tracking-wider text-[var(--ac-text-faint)]">
                <th className="px-2 py-3">Horário</th><th className="px-2 py-3">Destinatário</th>
                <th className="px-2 py-3">Origem</th><th className="px-2 py-3">Mensagem</th>
                <th className="px-2 py-3">Estado</th><th className="px-2 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--ac-paper-border)] text-xs">
                  <td className="whitespace-nowrap px-2 py-3 admin-mono text-[var(--ac-text-muted)]">{dateTime(row.created_at)}</td>
                  <td className="px-2 py-3"><strong className="block text-[var(--ac-text)]">{row.recipient_name || "Sem nome"}</strong><span className="admin-mono text-[10px] text-[var(--ac-text-faint)]">{row.phoneMasked}</span></td>
                  <td className="px-2 py-3 text-[var(--ac-text-muted)]">{SOURCE_LABEL[row.source] || row.source}</td>
                  <td className="max-w-[260px] px-2 py-3"><span className="block truncate text-[var(--ac-text)]">{row.messagePreview}</span>{row.external_id ? <span className="admin-mono text-[9px] text-[var(--ac-text-faint)]">wamid registrado</span> : null}</td>
                  <td className="px-2 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-2 py-3"><div className="flex justify-end gap-1">
                    <button type="button" className="admin-btn-ghost !p-2" onClick={() => void openDetails(row.id)} title="Ver linha do tempo"><Eye className="h-4 w-4" /></button>
                    {["failed", "unknown"].includes(row.status) ? <button type="button" className="admin-btn-ghost !p-2" onClick={() => void retry(row)} disabled={busy === "retry"} title="Reenviar"><RotateCcw className="h-4 w-4" /></button> : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && busy !== "load" ? <div className="grid min-h-48 place-items-center text-sm text-[var(--ac-text-muted)]"><MessageSquareText className="mb-2 h-8 w-8 opacity-40" />Nenhum envio encontrado.</div> : null}
        </div>
      </section>

      {selected ? (
        <section className="admin-panel">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--ac-paper-border)] pb-4">
            <div><p className="admin-kicker">Linha do tempo</p><h3 className="admin-section-title">{selected.row.recipient_name || selected.row.phoneMasked}</h3></div>
            <button type="button" className="admin-btn-ghost" onClick={() => setSelected(null)}>Fechar</button>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-2 text-xs">
              <p><strong>Estado:</strong> <StatusBadge status={selected.row.status} /></p>
              <p><strong>Origem:</strong> {SOURCE_LABEL[selected.row.source] || selected.row.source}</p>
              <p><strong>Template:</strong> {selected.row.template_name || "Texto livre"}</p>
              <p><strong>Identificador Meta:</strong> <span className="admin-mono break-all">{selected.row.external_id || "Não recebido"}</span></p>
              {selected.row.error_message ? <p className="rounded-lg bg-rose-50 p-3 text-rose-800"><strong>Falha:</strong> {selected.row.error_code ? `#${selected.row.error_code} · ` : ""}{selected.row.error_message}</p> : null}
            </div>
            <ol className="space-y-3">
              {selected.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full border-2", event.status === "failed" ? "border-rose-500 bg-rose-100" : event.status === "read" || event.status === "delivered" ? "border-emerald-500 bg-emerald-100" : "border-blue-500 bg-blue-100")} />
                  <div><p className="text-xs font-bold text-[var(--ac-text)]">{STATUS_LABEL[event.status]}</p><p className="admin-mono text-[10px] text-[var(--ac-text-faint)]">{dateTime(event.created_at)} · {event.event_type}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}