import StorePixDialog from "./StorePixDialog";
import { useCreateRequest } from "./useCreateRequest";
import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ImageOff,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import type { DemoMember } from "./MembersPage";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import {
  actShopOrder,
  checkShopCart,
  checkoutShop,
  shopCartLines,
  shopCategories,
  shopDate,
  shopMoney as money,
  shopOrderLabel,
  shopPending,
  shopPrice,
  shopQuantity,
  shopSignature,
  shopTotal,
  type CreditSnapshot,
  type LocalShop,
  type ShopAction,
  type ShopMethod,
  type ShopProduct,
} from "./shopLogic";
import "./store.css";
import { LocalFileField, LocalImage } from "./LocalAttachments";

type Props = {
  creditFor: (memberId: string) => CreditSnapshot;
  state: LocalShop;
  onChange: (state: LocalShop) => void;
  members: DemoMember[];
  createRequest: number;
  onCreateHandled: () => void;
  onNavigate: (id: string) => void;
};
type Draft = {
  id: string;
  name: string;
  description: string;
  category: ShopProduct["category"];
  price: string;
  stock: string;
  minimum: string;
  file?: File | null;
};
const blank = (): Draft => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  category: "Outros",
  price: "",
  stock: "0",
  minimum: "0",
});
const methods: Record<ShopMethod, { label: string; help: string }> = {
  cash: {
    label: "Já recebido",
    help: "Registra uma entrada no caixa da casa. Entrega é confirmada depois.",
  },
  pix: {
    label: "Aguardar Pix",
    help: "Mantém o pedido pendente. O Pix da casa fica disponível nos detalhes do pedido.",
  },
  book: {
    label: "Caderneta",
    help: "Vincula o valor pendente ao membro e ao limite compartilhado da caderneta.",
  },
  reserve: {
    label: "Só reservar",
    help: "Separa o estoque para um membro, sem gerar dívida ou receita.",
  },
};
const actionText: Record<ShopAction, string> = {
  receive: "Confirmar recebimento",
  cancel: "Cancelar pedido",
  deliver: "Marcar como entregue",
  reopen: "Reabrir recebimento",
  "to-pix": "Aguardar Pix",
  "to-book": "Anotar na caderneta",
  "to-cash": "Registrar recebimento",
};

export default function StorePage({
  state,
  creditFor,
  onChange,
  members,
  createRequest,
  onCreateHandled,
  onNavigate,
}: Props) {
  const [pixOrder, setPixOrder] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false),
    [busy, setBusy] = useState(false);
  const [view, setView] = useState<"catalog" | "orders">("catalog");
  const [mode, setMode] = useState<HouseMode>("ready");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [stockFilter, setStockFilter] = useState("active");
  const [sort, setSort] = useState("name");
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderQuery, setOrderQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [bagOpen, setBagOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [method, setMethod] = useState<ShopMethod>("cash");
  const [memberId, setMemberId] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: ShopAction;
  } | null>(null);
  const lastRequest = useRef(createRequest);
  const locked = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const lines = shopCartLines(state);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = shopTotal(lines);
  const products = (mode === "empty" ? [] : state.products)
    .filter(
      (p) =>
        (stockFilter === "archived" ? p.archived : !p.archived) &&
        (stockFilter !== "available" || p.stock > 0) &&
        (stockFilter !== "low" || (p.stock > 0 && p.stock <= p.minimum)) &&
        (stockFilter !== "out" || p.stock === 0) &&
        (category === "Todas" || p.category === category) &&
        textMatch(`${p.name} ${p.category}`, query),
    )
    .sort((a, b) =>
      sort === "price"
        ? a.cents - b.cents
        : a.name.localeCompare(b.name, "pt-BR"),
    );
  const orders = (mode === "empty" ? [] : state.orders)
    .filter(
      (o) =>
        (orderFilter === "all" || o.status === orderFilter) &&
        textMatch(
          `${o.code} ${o.memberName} ${o.lines.map((l) => l.name).join(" ")}`,
          orderQuery,
        ),
    )
    .slice()
    .reverse();
  const currentAction = state.orders.find((o) => o.id === pendingAction?.id);
  const openNew = () => {
    setError("");
    setDraft(blank());
  };
  useCreateRequest(createRequest, onCreateHandled, () => {
    openNew();
  });
  const edit = (p: ShopProduct) => {
    setError("");
    setDraft({
      ...p,
      price: (p.cents / 100).toFixed(2).replace(".", ","),
      stock: String(p.stock),
      minimum: String(p.minimum),
      file: p.photo?.source instanceof File ? p.photo.source : null,
    });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || fileBusy || busy) return;
    const cents = shopPrice(draft.price),
      stock = shopQuantity(draft.stock),
      minimum = shopQuantity(draft.minimum);
    if (
      draft.name.trim().length < 3 ||
      cents === null ||
      stock === null ||
      minimum === null
    ) {
      setError(
        "Informe nome com pelo menos 3 letras, preço até R$ 10.000,00 (use vírgula) e quantidades inteiras até 99.999.",
      );
      return;
    }
    if (
      state.products.some(
        (p) =>
          p.id !== draft.id &&
          textMatch(p.name, draft.name.trim()) &&
          textMatch(draft.name.trim(), p.name),
      )
    ) {
      setError("Já existe um produto com este nome, inclusive nos arquivados.");
      return;
    }
    const product: ShopProduct = {
      id: draft.id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      cents,
      stock,
      minimum,
      photo: draft.file
        ? { source: draft.file, kind: "local" }
        : state.products.find((p) => p.id === draft.id)?.photo || null,
      archived:
        state.products.find((p) => p.id === draft.id)?.archived ?? false,
    };
    const exists = state.products.some((p) => p.id === product.id);
    setBusy(true);
    try {
      await onChange({
        ...state,
        products: exists
          ? state.products.map((p) => (p.id === product.id ? product : p))
          : [...state.products, product],
      });
      setMode("ready");
      setDraft(null);
      setFeedback(
        "Produto salvo no catálogo. Pedidos anteriores mantêm seus valores.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setBusy(false);
    }
  };
  const changeQty = async (id: string, quantity: number) => {
    const p = state.products.find((item) => item.id === id);
    if (!p || p.archived) return;
    const next = Math.max(0, Math.min(quantity, p.stock, 99));
    const cart = { ...state.cart };
    if (next) cart[id] = next;
    else delete cart[id];
    await onChange({ ...state, cart });
    setReview(null);
    setError("");
  };
  const archive = async (p: ShopProduct) => {
    const cart = { ...state.cart };
    delete cart[p.id];
    await onChange({
      ...state,
      cart,
      products: state.products.map((item) =>
        item.id === p.id ? { ...item, archived: !item.archived } : item,
      ),
    });
    setFeedback(
      p.archived
        ? "Produto voltou ao catálogo."
        : "Produto arquivado. Você pode restaurar em “Arquivados”. Pedidos são preservados.",
    );
  };
  const openBag = () => {
    locked.current = false;
    setReview(null);
    setError("");
    setBagOpen(true);
  };
  const prepare = () => {
    const problem = checkShopCart(state);
    if (problem) {
      setError(problem);
      return;
    }
    if ((method === "reserve" || method === "book") && !memberId) {
      setError("Selecione um membro para a reserva ou caderneta.");
      return;
    }
    setError("");
    setReview(shopSignature(state));
  };
  const checkout = async () => {
    if (locked.current || !review) return;
    locked.current = true;
    const result = checkoutShop(state, {
      checkoutId: state.cartId,
      signature: review,
      method,
      memberId: memberId || null,
      memberName:
        members.find((m) => m.id === memberId)?.name || "Venda avulsa",
      memberIds: members.map((m) => m.id),
      now: new Date().toISOString(),
      nextCartId: crypto.randomUUID(),
      credit: creditFor(memberId),
    });
    if (result.ok === false) {
      setError(result.message);
      locked.current = false;
      return;
    }
    setBusy(true);
    try {
      await onChange(result.state);
      setBagOpen(false);
      setView("orders");
      setOrderFilter("all");
      setOrderQuery("");
      setMode("ready");
      setFeedback(`Pedido registrado no sistema. ${methods[method].help}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível confirmar o pedido. Confira antes de repetir.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const applyAction = async () => {
    if (!pendingAction || busy) return;
    const result = actShopOrder(
      state,
      pendingAction.id,
      pendingAction.action,
      new Date().toISOString(),
      members.map((m) => m.id),
      creditFor(
        state.orders.find((order) => order.id === pendingAction.id)?.memberId ||
          "",
      ),
    );
    if (result.ok === false) {
      setError(result.message);
      return;
    }
    setBusy(true);
    try {
      await onChange(result.state);
      setFeedback(
        `Pedido ${result.order?.code}: ${shopOrderLabel(result.order!)}.`,
      );
      setPendingAction(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar o pedido.",
      );
    } finally {
      setBusy(false);
    }
  };
  const action = (id: string, value: ShopAction) => {
    setError("");
    setPendingAction({ id, action: value });
  };

  return (
    <div className="store-page">
      <div className="shop-intro">
        <span className="shop-eyebrow">FEITO PARA A SUA CASA</span>
        <p>
          Peças que acompanham
          <br />
          <em>a vida da corrente.</em>
        </p>
        <div>
          <span>Catálogo da casa</span>
          <small>Produtos, pedidos e recebimentos da casa.</small>
        </div>
      </div>
      {feedback && (
        <div className="wf-feedback shop-feedback" role="status">
          <Check size={18} />
          <span>{feedback}</span>
          <button
            aria-label="Dispensar mensagem"
            onClick={() => setFeedback("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="shop-navigation">
        <div className="shop-tabs" role="group" aria-label="Área da Loja">
          <button
            aria-pressed={view === "catalog"}
            onClick={() => setView("catalog")}
          >
            Catálogo{" "}
            <span>{state.products.filter((p) => !p.archived).length}</span>
          </button>
          <button
            aria-pressed={view === "orders"}
            onClick={() => setView("orders")}
          >
            Pedidos <span>{state.orders.length}</span>
          </button>
        </div>
        <button className="wf-button shop-bag-trigger" onClick={openBag}>
          <ShoppingBag size={18} />
          Sacola <span>{count}</span>
          <ArrowRight size={16} />
        </button>
      </div>
      {mode === "loading" || mode === "error" ? (
        <HouseState mode={mode} onReset={() => setMode("ready")} />
      ) : view === "catalog" ? (
        <>
          <div className="shop-filters">
            <label className="wf-search">
              <Search size={18} />
              <input
                aria-label="Buscar produto"
                placeholder="Encontre uma peça…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="shop-select">
              Disponibilidade
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
              >
                <option value="active">Catálogo ativo</option>
                <option value="available">Disponíveis</option>
                <option value="low">Estoque baixo</option>
                <option value="out">Esgotados</option>
                <option value="archived">Arquivados</option>
              </select>
            </label>
            <label className="shop-select">
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">Nome</option>
                <option value="price">Menor preço</option>
              </select>
            </label>
          </div>
          <div
            className="shop-categories"
            role="group"
            aria-label="Categoria do produto"
          >
            {["Todas", ...shopCategories].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="shop-catalog-meta">
            <span>
              {products.length}{" "}
              {products.length === 1 ? "peça encontrada" : "peças encontradas"}
            </span>
            <span>Valores e estoque do catálogo</span>
          </div>
          {products.length ? (
            <div className="shop-grid">
              {products.map((p) => (
                <article className="shop-product" key={p.id}>
                  <div className="shop-photo">
                    {p.photo ? (
                      <LocalImage source={p.photo.source} alt={p.name} />
                    ) : (
                      <div className="shop-no-photo">
                        <ImageOff size={36} />
                        <span>Sem foto</span>
                      </div>
                    )}
                    <span className={`shop-stock ${!p.stock ? "out" : ""}`}>
                      {p.archived
                        ? "Arquivado"
                        : p.stock === 0
                          ? "Esgotado"
                          : p.stock <= p.minimum
                            ? `${p.stock} disponíveis · estoque baixo`
                            : `${p.stock} disponíveis`}
                    </span>
                  </div>
                  <div className="shop-product-caption">
                    <span>{p.category}</span>
                    <small>Produto da casa</small>
                  </div>
                  <h2>{p.name}</h2>
                  <p className="shop-description">
                    {p.description || "Descrição ainda não informada."}
                  </p>
                  <strong className="shop-price">{money(p.cents)}</strong>
                  <div className="shop-product-actions">
                    {p.archived ? (
                      <button
                        className="wf-button secondary"
                        onClick={async () => await archive(p)}
                      >
                        Restaurar produto
                      </button>
                    ) : (
                      <button
                        className="wf-button"
                        disabled={
                          p.stock === 0 ||
                          (state.cart[p.id] || 0) >= Math.min(p.stock, 99)
                        }
                        onClick={async () => {
                          await changeQty(p.id, (state.cart[p.id] || 0) + 1);
                          setFeedback(`${p.name} na sacola.`);
                        }}
                      >
                        <Plus size={17} />
                        {state.cart[p.id]
                          ? `${state.cart[p.id]} na sacola · adicionar`
                          : "Adicionar à sacola"}
                      </button>
                    )}
                    <button
                      className="shop-edit"
                      aria-label={`Editar ${p.name}`}
                      onClick={() => edit(p)}
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                  <button
                    className="shop-archive"
                    onClick={async () => await archive(p)}
                  >
                    {p.archived ? "Manter no catálogo" : "Arquivar produto"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="shop-empty">
              <Package size={36} />
              <WorkflowEmpty
                title={
                  mode === "empty"
                    ? "Sua vitrine começa com uma peça."
                    : "Nenhum produto por aqui."
                }
                text="Cadastre um produto ou ajuste os filtros para explorar o catálogo."
              />
              <button
                className="wf-button"
                onClick={
                  mode === "empty" || !state.products.length
                    ? openNew
                    : () => {
                        setQuery("");
                        setCategory("Todas");
                        setStockFilter("active");
                      }
                }
              >
                {mode === "empty" || !state.products.length
                  ? "Cadastrar produto"
                  : "Limpar filtros"}
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="shop-orders">
          <div className="shop-orders-summary">
            <div>
              <span>Em aberto · sem reservas</span>
              <strong>
                {money(mode === "empty" ? 0 : shopPending(state))}
              </strong>
            </div>
            <p>
              Recebimentos confirmados entram no caixa.
              <br />
              Reservas apenas separam o estoque.
            </p>
            <button
              className="shop-text-button"
              onClick={() => onNavigate("financial")}
            >
              Conferir financeiro
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="shop-filters">
            <label className="wf-search">
              <Search size={18} />
              <input
                aria-label="Buscar pedido"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Código, membro ou produto"
              />
            </label>
            <label className="shop-select">
              Situação do pedido
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
              >
                <option value="all">Todas as situações</option>
                <option value="reserved">Reservados</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagos</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </label>
          </div>
          {!orders.length && (
            <WorkflowEmpty
              title="Nenhum pedido encontrado."
              text="Sua primeira venda ou reserva aparecerá aqui, com os itens e valores registrados."
            />
          )}
          {orders.map((o) => (
            <details className="shop-order" key={o.id}>
              <summary>
                <span className="shop-order-code">
                  {o.code}
                  <small>{shopDate(o.created)} · Brasília</small>
                </span>
                <span className="shop-order-person">
                  {o.memberName}
                  <small>{methods[o.method].label}</small>
                </span>
                <span className={`shop-order-status ${o.status}`}>
                  {shopOrderLabel(o)}
                </span>
                <strong>{money(shopTotal(o.lines))}</strong>
                <Plus size={18} />
              </summary>
              <div className="shop-order-detail">
                <ul>
                  {o.lines.map((l) => (
                    <li key={l.productId}>
                      <span>
                        <strong>
                          {l.quantity} × {l.name}
                        </strong>
                        <small>{money(l.cents)} por unidade</small>
                      </span>
                      <strong>{money(l.quantity * l.cents)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="shop-order-actions">
                  {o.status === "reserved" && (
                    <>
                      <button
                        className="wf-button"
                        onClick={() => action(o.id, "to-cash")}
                      >
                        Registrar recebimento
                      </button>
                      <button
                        className="wf-button secondary"
                        onClick={() => action(o.id, "to-pix")}
                      >
                        Aguardar Pix
                      </button>
                      <button
                        className="wf-button secondary"
                        onClick={() => action(o.id, "to-book")}
                      >
                        Anotar na caderneta
                      </button>
                    </>
                  )}
                  {o.status === "pending" && o.method === "pix" && (
                    <button
                      className="wf-button secondary"
                      onClick={() => setPixOrder(o.id)}
                    >
                      Ver Pix do pedido
                    </button>
                  )}
                  {o.status === "pending" && (
                    <button
                      className="wf-button"
                      onClick={() => action(o.id, "receive")}
                    >
                      Confirmar recebimento
                    </button>
                  )}
                  {o.status === "paid" && (
                    <>
                      {!o.delivered && (
                        <button
                          className="wf-button"
                          onClick={() => action(o.id, "deliver")}
                        >
                          Marcar como entregue
                        </button>
                      )}
                      <button
                        className="wf-button secondary"
                        onClick={() => action(o.id, "reopen")}
                      >
                        Reabrir recebimento
                      </button>
                    </>
                  )}
                  {["pending", "reserved"].includes(o.status) &&
                    !o.delivered && (
                      <button
                        className="shop-text-button danger"
                        onClick={() => action(o.id, "cancel")}
                      >
                        Cancelar pedido
                      </button>
                    )}
                </div>
                {o.received && (
                  <p>
                    Recebimento registrado em {shopDate(o.received)} · Brasília.
                  </p>
                )}
                {o.status === "cancelled" && (
                  <p>
                    Pedido cancelado; quantidades devolvidas ao estoque
                    disponível.
                  </p>
                )}
              </div>
            </details>
          ))}
        </section>
      )}
      <StorePixDialog orderId={pixOrder} onClose={() => setPixOrder(null)} />
      <HouseStateTools mode={mode} onChange={setMode} />
      {count > 0 && !bagOpen && (
        <button className="shop-mobile-bag" onClick={openBag}>
          <ShoppingBag size={20} />
          <span>
            Ver sacola · {count} {count === 1 ? "item" : "itens"}
          </span>
          <strong>{money(total)}</strong>
        </button>
      )}

      <WorkflowDialog
        open={!!draft}
        onOpenChange={(open) => !open && setDraft(null)}
        title={
          state.products.some((p) => p.id === draft?.id)
            ? "Editar produto"
            : "Novo produto"
        }
        description="Cadastre os dados e a foto do produto."
      >
        {draft && (
          <form className="shop-form" onSubmit={save}>
            <label className="wf-field">
              Nome do produto
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="wf-field">
              Descrição
              <textarea
                maxLength={400}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="wf-pair">
              <label className="wf-field">
                Categoria
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as ShopProduct["category"],
                    })
                  }
                >
                  {shopCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="wf-field">
                Preço (R$)
                <input
                  required
                  inputMode="decimal"
                  placeholder="45,00"
                  value={draft.price}
                  onChange={(e) =>
                    setDraft({ ...draft, price: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="wf-pair">
              <label className="wf-field">
                Disponível para venda
                <input
                  inputMode="numeric"
                  required
                  value={draft.stock}
                  onChange={(e) =>
                    setDraft({ ...draft, stock: e.target.value })
                  }
                />
              </label>
              <label className="wf-field">
                Alerta de estoque mínimo
                <input
                  inputMode="numeric"
                  required
                  value={draft.minimum}
                  onChange={(e) =>
                    setDraft({ ...draft, minimum: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="shop-form-note">
              Informe o estoque livre, além das unidades já separadas em
              pedidos. Editar não muda pedidos existentes.
            </p>
            <LocalFileField
              kind="image"
              file={draft.file}
              onChange={(file) =>
                setDraft((current) =>
                  current ? { ...current, file } : current,
                )
              }
              onBusy={setFileBusy}
            />
            <p className="shop-form-note">
              A foto será enviada ao salvar. Pedidos anteriores preservam seus
              itens e valores.
            </p>
            {error && (
              <p role="alert" className="shop-error">
                {error}
              </p>
            )}
            <button
              className="wf-button"
              type="submit"
              disabled={fileBusy || busy}
            >
              {busy ? "Salvando produto…" : "Salvar produto"}
              <Check size={17} />
            </button>
          </form>
        )}
      </WorkflowDialog>

      <Dialog.Root
        open={bagOpen}
        onOpenChange={(open) => {
          setBagOpen(open);
          if (!open) setError("");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="shop-bag"
            onOpenAutoFocus={() => {
              opener.current = document.activeElement as HTMLElement;
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (opener.current?.isConnected) opener.current.focus();
              else
                document
                  .querySelector<HTMLElement>("#main-content h1")
                  ?.focus();
            }}
          >
            <header>
              <div>
                <span className="shop-eyebrow">LOJA DA CASA</span>
                <Dialog.Title>
                  {review ? "Confira seu pedido" : "Sua sacola"}
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label="Fechar sacola">
                  <X size={21} />
                </button>
              </Dialog.Close>
            </header>
            <Dialog.Description>
              {review
                ? "Confira os itens, o membro e a forma de registro antes de confirmar."
                : "Separe as peças e escolha como registrar o pedido."}
            </Dialog.Description>
            <div className="shop-bag-content">
              {!lines.length ? (
                <WorkflowEmpty
                  title="A sacola está vazia."
                  text="Escolha uma peça no catálogo para começar."
                />
              ) : (
                <>
                  <ul className="shop-bag-lines">
                    {lines.map((l) => (
                      <li key={l.productId}>
                        <div>
                          <strong>{l.name}</strong>
                          <small>{money(l.cents)} por unidade</small>
                          {review ? (
                            <span>{l.quantity} unidades</span>
                          ) : (
                            <div className="shop-quantity">
                              <button
                                aria-label={`Diminuir ${l.name}`}
                                onClick={async () =>
                                  await changeQty(l.productId, l.quantity - 1)
                                }
                              >
                                <Minus size={16} />
                              </button>
                              <span aria-live="polite">{l.quantity}</span>
                              <button
                                aria-label={`Aumentar ${l.name}`}
                                disabled={
                                  l.quantity >=
                                  Math.min(
                                    state.products.find(
                                      (p) => p.id === l.productId,
                                    )?.stock || 0,
                                    99,
                                  )
                                }
                                onClick={async () =>
                                  await changeQty(l.productId, l.quantity + 1)
                                }
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                className="shop-remove"
                                onClick={async () =>
                                  await changeQty(l.productId, 0)
                                }
                              >
                                Remover
                              </button>
                            </div>
                          )}
                        </div>
                        <strong>{money(l.cents * l.quantity)}</strong>
                      </li>
                    ))}
                  </ul>
                  {review ? (
                    <div className="shop-review">
                      <span>Destinatário</span>
                      <strong>
                        {members.find((m) => m.id === memberId)?.name ||
                          "Venda avulsa"}
                      </strong>
                      <span>Registro do pedido</span>
                      <strong>{methods[method].label}</strong>
                      <p>{methods[method].help}</p>
                    </div>
                  ) : (
                    <>
                      <label className="wf-field">
                        Destinatário
                        <select
                          value={memberId}
                          onChange={(e) => {
                            setMemberId(e.target.value);
                            setError("");
                          }}
                        >
                          <option value="">Venda avulsa</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <fieldset className="shop-methods">
                        <legend>Como registrar?</legend>
                        {(Object.keys(methods) as ShopMethod[]).map((value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="shop-method"
                              value={value}
                              checked={method === value}
                              onChange={() => {
                                setMethod(value);
                                setError("");
                              }}
                            />
                            <span>{methods[value].label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <p className="shop-method-help">{methods[method].help}</p>
                    </>
                  )}
                </>
              )}
              {error && (
                <p className="shop-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer>
              <div>
                <span>Total do pedido</span>
                <strong>{money(total)}</strong>
              </div>
              {review ? (
                <>
                  <button
                    className="wf-button"
                    disabled={busy}
                    onClick={checkout}
                  >
                    {busy ? "Registrando pedido…" : "Confirmar pedido"}
                    <Check size={18} />
                  </button>
                  <button
                    className="shop-text-button"
                    onClick={() => {
                      setReview(null);
                      setError("");
                    }}
                  >
                    Voltar para ajustar
                  </button>
                </>
              ) : (
                <button
                  className="wf-button"
                  disabled={!lines.length}
                  onClick={prepare}
                >
                  Revisar pedido
                  <ArrowRight size={18} />
                </button>
              )}
              <small>Registro real no estoque e no financeiro da casa</small>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <WorkflowDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction ? actionText[pendingAction.action] : "Pedido"}
        description={
          currentAction
            ? `Pedido ${currentAction.code} · ${currentAction.memberName} · ${money(shopTotal(currentAction.lines))}`
            : ""
        }
      >
        <p>
          {pendingAction?.action === "cancel"
            ? "As quantidades voltam ao estoque livre. O pedido permanece no histórico."
            : pendingAction?.action === "reopen"
              ? "A entrada sai do caixa da casa e volta a ficar pendente. Isso não devolve dinheiro pelo banco. A entrega permanece registrada."
              : pendingAction?.action === "deliver"
                ? "Confirme apenas se os produtos deste pedido já foram entregues."
                : "Esta ação atualiza o pedido e o financeiro da casa. Isso não transfere dinheiro pelo banco."}
        </p>
        {error && (
          <p role="alert" className="shop-error">
            {error}
          </p>
        )}
        <div className="wf-confirm-actions">
          <button
            className="wf-button secondary"
            onClick={() => setPendingAction(null)}
          >
            Voltar
          </button>
          <button className="wf-button" disabled={busy} onClick={applyAction}>
            {busy ? "Processando…" : "Confirmar ação"}
          </button>
        </div>
      </WorkflowDialog>
    </div>
  );
}
