import PageLoading from "../shared/PageLoading";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Coffee,
  Download,
  Flame,
  Heart,
  Leaf,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import type { DemoMember } from "./MembersPage";
import {
  financialMoney as money,
  ledgerTotals,
  parseFinancialAmount,
  preferredLedgerPeriod,
  type CashEntry,
  type LedgerEntry,
} from "./finance";
import {
  financialToday,
  shortFinancialDate,
  type MonthlyCharge,
} from "./billing";
import type { DemoPix } from "./PixSettingsPage";
import FinancialEntryDialog from "./FinancialEntryDialog";
import { WorkflowDialog } from "./WorkflowUI";
import "./financial-overview.css";

type Props = {
  storePendingCents?: number;
  ledger: LedgerEntry[];
  members: DemoMember[];
  charges: MonthlyCharge[];
  pix: DemoPix | null;
  onSaveCharge: (charge: MonthlyCharge) => void;
  debts: { name: string; value: number }[];
  entryOpen: boolean;
  onEntryOpenChange: (open: boolean) => void;
  onSave: (entry: CashEntry) => void;
  onRemove: (id: string) => void | Promise<void>;
  onNavigate: (id: string) => void;
};
type Mode = "ready" | "empty" | "loading" | "error";
type Draft = {
  id: string;
  kind: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: string;
  memberId: string;
  createdAt: number;
};
const blank = (): Draft => ({
  id: `cash-${Date.now()}`,
  kind: "income",
  description: "",
  category: "Doação",
  date: financialToday(),
  amount: "",
  memberId: "",
  createdAt: Date.now(),
});
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const formatDate = (s: string, short = false) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(short ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  }).format(new Date(`${s}T12:00:00Z`));
const formatMonth = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${s}-01T12:00:00Z`));
const getWeek = (date: string) =>
  Math.min(3, Math.floor((Number(date.slice(8)) - 1) / 7));
const ranges = ["01–07", "08–14", "15–21", "22–31"];
const chartTick = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
const quickEntries = [
  {
    title: "Velas e defumação",
    kind: "expense",
    category: "Insumos",
    description: "Compra de velas e defumação",
    icon: Flame,
  },
  {
    title: "Ervas da casa",
    kind: "expense",
    category: "Insumos",
    description: "Compra de ervas",
    icon: Leaf,
  },
  {
    title: "Receber doação",
    kind: "income",
    category: "Doação",
    description: "Doação para a casa",
    icon: Heart,
  },
  {
    title: "Contas da casa",
    kind: "expense",
    category: "Contas",
    description: "Conta da casa",
    icon: Building2,
  },
] as const;

export default function FinancialOverview({
  storePendingCents = 0,
  ledger,
  members,
  charges,
  pix,
  onSaveCharge,
  debts,
  entryOpen,
  onEntryOpenChange,
  onSave,
  onRemove,
  onNavigate,
}: Props) {
  const [mode, setMode] = useState<Mode>("ready");
  const currentPeriod = financialToday().slice(0, 7);
  const preferredPeriod = preferredLedgerPeriod(ledger, currentPeriod);
  const [period, setPeriod] = useState(preferredPeriod);
  const periodWasChosen = useRef(false);
  const [kind, setKind] = useState("all");
  const [week, setWeek] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(blank);

  const [feedback, setFeedback] = useState("");
  const [removeTarget, setRemoveTarget] = useState<LedgerEntry | null>(null),
    [removing, setRemoving] = useState(false),
    [removeError, setRemoveError] = useState("");
  const removeLock = useRef(false);
  const seed = useRef<Draft | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const ledgerHeading = useRef<HTMLHeadingElement>(null);
  const records = mode === "empty" ? [] : ledger;
  const totals = ledgerTotals(records, period);
  const pendingMembers =
    mode === "empty"
      ? []
      : charges.filter((charge) => charge.status === "pending");
  const cantinaDebt =
    mode === "empty"
      ? 0
      : Math.round(debts.reduce((v, d) => v + d.value, 0) * 100);
  const storeDebt = mode === "empty" ? 0 : storePendingCents;
  const receivable =
    pendingMembers.reduce((sum, charge) => sum + charge.totalCents, 0) +
    cantinaDebt +
    storeDebt;
  const months = [
    ...new Set([
      currentPeriod,
      ...ledger.map((e) => e.date.slice(0, 7)),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const monthly = records.filter((e) => e.date.startsWith(period));
  const weeks = ranges.map((label, i) => ({
    label,
    income: monthly
      .filter((e) => getWeek(e.date) === i && e.kind === "income")
      .reduce((v, e) => v + e.cents, 0),
    expense: monthly
      .filter((e) => getWeek(e.date) === i && e.kind === "expense")
      .reduce((v, e) => v + e.cents, 0),
  }));
  const maxBar =
    Math.ceil(
      Math.max(10000, ...weeks.flatMap((w) => [w.income, w.expense])) / 10000,
    ) * 10000;
  const shown = monthly.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (week === null || getWeek(e.date) === week) &&
      normalize(
        `${e.description} ${e.category} ${e.memberName || ""}`,
      ).includes(normalize(query)),
  );
  const filteredTotal = shown.reduce(
    (v, e) => v + (e.kind === "income" ? e.cents : -e.cents),
    0,
  );

  useEffect(() => {
    if (!periodWasChosen.current && period !== preferredPeriod) {
      setPeriod(preferredPeriod);
      setWeek(null);
    }
  }, [period, preferredPeriod]);
  useEffect(() => {
    if (entryOpen) {
      opener.current = document.activeElement as HTMLElement;
      setDraft(seed.current || blank());
      seed.current = null;
    }
  }, [entryOpen]);
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => {
      setFeedback("");
    }, 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);
  const openForm = (value?: Partial<Draft>) => {
    seed.current = { ...blank(), ...value };
    onEntryOpenChange(true);
  };
  const initialCash = useMemo(
    () => ({
      id: draft.id,
      kind: draft.kind,
      description: draft.description,
      category: draft.category,
      date: draft.date,
      cents: parseFinancialAmount(draft.amount) || undefined,
      memberId: draft.memberId,
      createdAt: draft.createdAt,
    }),
    [draft],
  );
  const edit = (e: LedgerEntry) =>
    openForm({
      ...e,
      amount: (e.cents / 100).toFixed(2).replace(".", ","),
      memberId: e.memberId || "",
    });
  const remove = (entry: LedgerEntry) => {
    setRemoveError("");
    setRemoveTarget(entry);
  };
  const confirmRemove = async () => {
    if (!removeTarget || removeLock.current) return;
    removeLock.current = true;
    setRemoving(true);
    setRemoveError("");
    try {
      await onRemove(removeTarget.id);
      setRemoveTarget(null);
      setFeedback("Lançamento removido do sistema.");
      ledgerHeading.current?.focus({ preventScroll: true });
    } catch (reason) {
      setRemoveError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível confirmar a remoção. Atualize antes de repetir.",
      );
    } finally {
      removeLock.current = false;
      setRemoving(false);
    }
  };
  const exportCsv = () => {
    const cell = (value: string, index: number) =>
      `"${(/^[=+\-@]/.test(value) && !(index === 4 && /^-?\d+,\d{2}$/.test(value)) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const lines = [
      [
        "Data",
        "Descrição",
        "Categoria",
        "Movimento",
        "Valor (R$)",
        "Membro",
        "Ambiente",
      ],
      ...shown.map((e) => [
        formatDate(e.date),
        e.description,
        e.category,
        e.kind === "income" ? "Entrada" : "Saída",
        `${e.kind === "expense" ? "-" : ""}${(e.cents / 100).toFixed(2).replace(".", ",")}`,
        e.memberName || "",
        "Dados reais",
      ]),
    ];
    const href = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + lines.map((line) => line.map(cell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = `axecloud-extrato-${period}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setFeedback("Extrato gerado com os registros consultados no servidor.");
  };

  return (
    <div className="finance-overview">
      {feedback && (
        <div className="f-feedback" role="status">
          <Check size={17} />
          <span>{feedback}</span>
        </div>
      )}
      {mode === "loading" ? (
        <PageLoading route="financial" />
      ) : mode === "error" ? (
        <section className="hs-state" role="alert">
          <h2>Não foi possível consultar o caixa.</h2>
          <p>Tente novamente para consultar as informações.</p>
          <button className="button secondary" onClick={() => setMode("ready")}>
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <div className="f-toolbar">
            <div>
              <span className="f-live-dot" />
              <span>Livro de caixa da casa</span>
              <span className="f-demo-pill">Dados reais</span>
            </div>
            <label>
              Período do extrato
              <select
                aria-label="Período do extrato"
                value={period}
                onChange={(e) => {
                  periodWasChosen.current = true;
                  setPeriod(e.target.value);
                  setWeek(null);
                }}
              >
                {months.map((m) => (
                  <option value={m} key={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="f-composition">
            <section className="f-balance" aria-labelledby="f-balance-title">
              <div className="f-balance-head">
                <h2 id="f-balance-title">Saldo acumulado em caixa</h2>
                <Wallet size={24} />
              </div>
              <strong
                className={`f-balance-value ${money(totals.balance).length > 13 ? "long" : ""}`}
              >
                {money(totals.balance)}
              </strong>
              <p>
                {totals.balance > 0
                  ? "Disponível para os cuidados da casa."
                  : totals.balance < 0
                    ? "As saídas superam o valor recebido."
                    : "Nenhum valor disponível no caixa."}
              </p>
              <span
                className={`f-balance-status ${totals.balance < 0 ? "negative" : ""}`}
              >
                {totals.balance >= 0 ? (
                  <Check size={14} />
                ) : (
                  <CircleAlert size={14} />
                )}
                {totals.balance > 0
                  ? "Caixa positivo"
                  : totals.balance === 0
                    ? "Sem saldo disponível"
                    : "Saldo pede atenção"}
              </span>
              <div className="f-balance-flow">
                <div>
                  <span>
                    <ArrowUpRight size={16} />
                    Entradas no período
                  </span>
                  <strong>{money(totals.income)}</strong>
                </div>
                <div>
                  <span>
                    <ArrowDownRight size={16} />
                    Saídas no período
                  </span>
                  <strong>{money(totals.expense)}</strong>
                </div>
              </div>
              <div className="f-balance-footer">
                <ShieldCheck size={14} />
                <span>
                  Soma dos movimentos recebidos e pagos, inclusive de meses
                  anteriores.
                </span>
              </div>
            </section>
            <section className="f-flow" aria-labelledby="f-flow-title">
              <div className="f-section-head">
                <div>
                  <h2 id="f-flow-title">Como o caixa se moveu</h2>
                  <p>
                    {formatMonth(period)} · selecione uma semana para filtrar o
                    extrato.
                  </p>
                </div>
                <span className="f-flow-period">
                  <strong
                    className={
                      totals.income - totals.expense < 0 ? "negative" : ""
                    }
                  >
                    {money(totals.income - totals.expense)}
                  </strong>
                  <small>Resultado do período</small>
                </span>
              </div>
              <div className="f-chart-key">
                <span>
                  <i />
                  Entradas
                </span>
                <span>
                  <i />
                  Saídas
                </span>
                <span className="f-chart-unit">Valores em R$</span>
                {week !== null && (
                  <button onClick={() => setWeek(null)}>
                    Limpar semana
                    <X size={13} />
                  </button>
                )}
              </div>
              <div
                className="f-chart"
                role="group"
                aria-label="Entradas e saídas por semana"
              >
                <div className="f-chart-scale" aria-hidden="true">
                  <span>{chartTick(maxBar)}</span>
                  <span>{chartTick(Math.round(maxBar / 2))}</span>
                  <span>0</span>
                </div>
                <div className="f-chart-weeks">
                  {weeks.map((w, i) => (
                    <button
                      key={w.label}
                      className={week === i ? "selected" : ""}
                      aria-pressed={week === i}
                      aria-label={`Semana ${i + 1}, dias ${w.label}, entradas ${money(w.income)}, saídas ${money(w.expense)}`}
                      onClick={() => setWeek(week === i ? null : i)}
                    >
                      <span className="f-chart-bars">
                        <span
                          className="f-income-bar"
                          style={{ height: `${(w.income / maxBar) * 100}%` }}
                        />
                        <span
                          className="f-expense-bar"
                          style={{ height: `${(w.expense / maxBar) * 100}%` }}
                        />
                      </span>
                      <span className="f-week-label">{w.label}</span>
                      <span className="f-week-values">
                        <strong>{money(w.income)}</strong>
                        <small>− {money(w.expense)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {!monthly.length && (
                <p className="f-empty-chart">
                  Nenhum movimento neste período. Se houver saldo acumulado, ele
                  vem de movimentos exibidos nos outros meses do seletor.
                </p>
              )}
            </section>
            <section
              className="f-receivable"
              aria-labelledby="f-receivable-title"
            >
              <div className="f-receivable-heading">
                <h2 id="f-receivable-title">Ainda falta receber</h2>
                <Clock3 size={22} />
              </div>
              <strong>{money(receivable)}</strong>
              <p>Contribuições e consumos em aberto.</p>
              <div className="f-receivable-lines">
                {pendingMembers.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onNavigate("financial-mensalidades")}
                  >
                    <span>
                      <strong>
                        {members.find((member) => member.id === m.memberId)
                          ?.name || m.memberName}
                      </strong>
                      <small>
                        Mensalidade · venc. {shortFinancialDate(m.dueDate)}
                      </small>
                    </span>
                    <span>
                      {money(m.totalCents)}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                ))}
                {cantinaDebt > 0 && (
                  <button onClick={() => onNavigate("financial-cantina")}>
                    <span>
                      <strong>Caderneta da cantina</strong>
                      <small>Consumos ainda não quitados</small>
                    </span>
                    <span>
                      {money(cantinaDebt)}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                )}
                {storeDebt > 0 && (
                  <button onClick={() => onNavigate("store")}>
                    <span>
                      <strong>Pedidos da loja em aberto</strong>
                      <small>Reservas não entram neste valor</small>
                    </span>
                    <span>
                      {money(storeDebt)}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                )}
                {receivable === 0 && (
                  <div className="f-all-paid">
                    <Check size={18} />
                    Nenhuma pendência em aberto.
                  </div>
                )}
              </div>
              <button
                className="f-receivable-action"
                onClick={() =>
                  onNavigate(
                    pendingMembers.length
                      ? "financial-mensalidades"
                      : cantinaDebt
                        ? "financial-cantina"
                        : storeDebt
                          ? "store"
                          : "financial-mensalidades",
                  )
                }
              >
                {receivable ? "Acompanhar pendências" : "Consultar financeiro"}
                <ArrowRight size={17} />
              </button>
              <small>Valores pendentes não compõem o saldo em caixa.</small>
            </section>
            <section className="f-ledger" aria-labelledby="f-ledger-title">
              <div className="f-section-head">
                <div>
                  <h2 id="f-ledger-title" ref={ledgerHeading} tabIndex={-1}>
                    Movimentos do caixa
                  </h2>
                  <p>
                    {shown.length}{" "}
                    {shown.length === 1 ? "lançamento" : "lançamentos"}
                    {week !== null ? ` · semana ${week + 1}` : ""} ·{" "}
                    {formatMonth(period)}
                  </p>
                </div>
                <button
                  className="f-export"
                  aria-label="Baixar extrato"
                  title="Baixar extrato"
                  disabled={!shown.length}
                  onClick={exportCsv}
                >
                  <Download size={17} />
                  <span>Baixar extrato</span>
                </button>
              </div>
              <div className="f-ledger-tools">
                <label className="f-search">
                  <Search size={18} />
                  <input
                    aria-label="Buscar lançamento"
                    placeholder="Descrição, categoria ou membro…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Limpar busca do extrato"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <div
                  className="f-kind-filter"
                  role="group"
                  aria-label="Filtrar movimentos"
                >
                  {[
                    { id: "all", label: "Todos" },
                    { id: "income", label: "Entradas" },
                    { id: "expense", label: "Saídas" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      aria-pressed={kind === f.id}
                      onClick={() => setKind(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="f-transactions">
                {shown.map((e) => (
                  <details key={e.id} className="f-transaction">
                    <summary>
                      <span className={`f-entry-icon ${e.kind}`}>
                        {e.kind === "income" ? (
                          <ArrowDownLeft size={19} />
                        ) : (
                          <ArrowUpRight size={19} />
                        )}
                      </span>
                      <span className="f-entry-copy">
                        <strong>{e.description}</strong>
                        <small>
                          <time dateTime={e.date}>
                            {formatDate(e.date, true)}
                          </time>
                          <span>·</span>
                          {e.memberName || e.category}
                        </small>
                      </span>
                      <span className={`f-entry-amount ${e.kind}`}>
                        {e.kind === "income" ? "+" : "−"} {money(e.cents)}
                      </span>
                      <ChevronDown size={15} />
                    </summary>
                    <div className="f-entry-details">
                      <dl>
                        <div>
                          <dt>Categoria</dt>
                          <dd>{e.category}</dd>
                        </div>
                        <div>
                          <dt>Data</dt>
                          <dd>{formatDate(e.date)}</dd>
                        </div>
                        <div>
                          <dt>Vínculo</dt>
                          <dd>{e.memberName || "Lançamento da casa"}</dd>
                        </div>
                        <div>
                          <dt>Movimento</dt>
                          <dd>
                            {e.kind === "income"
                              ? "Valor recebido"
                              : "Valor pago"}
                          </dd>
                        </div>
                      </dl>
                      {e.source === "manual" ? (
                        <div className="f-entry-actions">
                          <button onClick={() => edit(e)}>
                            <Pencil size={15} />
                            Editar lançamento
                          </button>
                          <button onClick={() => remove(e)}>
                            <Trash2 size={15} />
                            Remover
                          </button>
                        </div>
                      ) : (
                        <p>
                          Registrado como{" "}
                          {e.source === "monthly"
                            ? "recebimento da mensalidade"
                            : e.source === "cantina"
                              ? "recebimentos do balcão da cantina"
                              : e.source === "store"
                                ? "recebimento da loja"
                                : "despesa da casa"}
                          .{" "}
                          {e.source === "store" && (
                            <button onClick={() => onNavigate("store")}>
                              Ver pedidos da Loja
                              <ArrowUpRight size={13} />
                            </button>
                          )}
                          {e.source === "monthly" && (
                            <button
                              onClick={() =>
                                onNavigate("financial-mensalidades")
                              }
                            >
                              Ver mensalidades
                              <ArrowUpRight size={13} />
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
              {!shown.length && (
                <div className="f-no-movements">
                  <Wallet size={27} />
                  <h3>
                    {monthly.length
                      ? "Nenhum lançamento neste filtro."
                      : "Nenhum movimento neste período."}
                  </h3>
                  <p>
                    {monthly.length
                      ? "Tente outro termo ou limpe a seleção para consultar o extrato."
                      : "Registre uma entrada ou saída para acompanhar o movimento da casa."}
                  </p>
                  <button
                    className="f-button secondary"
                    onClick={() => {
                      if (monthly.length) {
                        setKind("all");
                        setWeek(null);
                        setQuery("");
                      } else openForm();
                    }}
                  >
                    {monthly.length ? "Limpar filtros" : "Registrar no caixa"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="f-ledger-total">
                <span>Resultado dos lançamentos exibidos</span>
                <strong className={filteredTotal < 0 ? "negative" : ""}>
                  {money(filteredTotal)}
                </strong>
              </div>
              <p className="f-ledger-note">
                O extrato inclui somente os lançamentos exibidos.
              </p>
            </section>
            <section
              className="f-shortcuts"
              aria-labelledby="f-shortcuts-title"
            >
              <h2 id="f-shortcuts-title">Registrar um cuidado</h2>
              <p>Um atalho para as rotinas do caixa.</p>
              <div>
                {quickEntries.map((a) => (
                  <button
                    key={a.title}
                    onClick={() =>
                      openForm({
                        kind: a.kind,
                        category: a.category,
                        description: a.description,
                      })
                    }
                  >
                    <a.icon size={19} />
                    <span>{a.title}</span>
                    <Plus size={15} />
                  </button>
                ))}
              </div>
            </section>
            <details className="f-reserves">
              <summary>
                <Building2 size={18} />
                Caixas e reservas
                <ChevronDown size={17} />
              </summary>
              <div>
                <strong>Caixa operacional</strong>
                <span>{money(totals.balance)}</span>
                <p>Manutenção, contas e insumos da casa.</p>
              </div>
              <div>
                <strong>Caixinha dos Orixás</strong>
                <span>Integrada ao caixa</span>
                <p>Festas e obrigações coletivas.</p>
              </div>
              <div>
                <strong>Obras e camarinha</strong>
                <span>Integradas ao caixa</span>
                <p>Reformas, ampliações e melhorias.</p>
              </div>
              <p>Não há saldos separados configurados.</p>
            </details>
          </div>
        </>
      )}

      <WorkflowDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !removeLock.current) {
            setRemoveTarget(null);
            setRemoveError("");
          }
        }}
        title="Remover lançamento do caixa?"
        description="A remoção é permanente e altera o saldo da casa. Confira o registro antes de confirmar."
      >
        <div className="wf-confirm-summary">
          <span>{removeTarget?.description}</span>
          <strong>{money(removeTarget?.cents || 0)}</strong>
        </div>
        {removeError && (
          <p className="wf-error" role="alert">
            {removeError}
          </p>
        )}
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            disabled={removing}
            onClick={() => setRemoveTarget(null)}
          >
            Manter lançamento
          </button>
          <button
            className="wf-button"
            disabled={removing}
            onClick={() => void confirmRemove()}
          >
            {removing ? "Removendo…" : "Confirmar remoção"}
          </button>
        </div>
      </WorkflowDialog>
      <FinancialEntryDialog
        open={entryOpen}
        onOpenChange={onEntryOpenChange}
        members={members}
        charges={charges}
        pix={pix}
        initialCash={initialCash}
        editingCash={ledger.some((entry) => entry.id === draft.id)}
        onSaveCash={async (entry) => {
          await onSave(entry);
          setMode("ready");
          setPeriod(entry.date.slice(0, 7));
          setQuery("");
          setKind("all");
          setWeek(null);
          setFeedback("Lançamento confirmado pelo servidor.");
        }}
        onSaveCharge={async (charge) => {
          await onSaveCharge(charge);
          setFeedback(
            charge.status === "pending"
              ? "Mensalidade criada. Consulte a cobrança em Mensalidades e no perfil do membro."
              : "Mensalidade quitada e recebimento incluído no caixa.",
          );
          if (charge.receivedDate) setPeriod(charge.receivedDate.slice(0, 7));
        }}
      />
    </div>
  );
}
