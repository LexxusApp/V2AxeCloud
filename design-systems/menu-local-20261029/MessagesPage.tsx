import { loadEarlierMessages } from "./remote/chatHistory";
import ChatAttachment from "./ChatAttachment";
import PageLoading from "../shared/PageLoading";
import { useCreateRequest } from "./useCreateRequest";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  Info,
  Mail,
  MailOpen,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import type { DemoMember } from "./MembersPage";
import {
  chatDay,
  chatShortDate,
  chatTime,
  latestMessageDate,
  unreadConversations,
  type LocalConversation,
  type LocalInbox,
  type LocalMessage,
} from "./messages";
import { WorkflowDialog, WorkflowEmpty, textMatch } from "./WorkflowUI";
import { HouseState, HouseStateTools, type HouseMode } from "./HouseStates";
import "./house-shared.css";
import "./messages.css";

type Props = {
  openRequest?: { id: string; version: number };
  members: DemoMember[];
  state: LocalInbox;
  onChange: (state: LocalInbox) => void;
  createRequest: number;
  onCreateHandled: () => void;
};
function LocalAttachment({
  file,
  pending = false,
}: {
  file: File;
  pending?: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const size =
    file.size < 1024 * 1024
      ? `${Math.max(1, Math.round(file.size / 1024))} KB`
      : `${(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return (
    <div className={`ms-attachment ${pending ? "pending" : ""}`}>
      {file.type.startsWith("image/") ? (
        <div className="ms-image-slot">
          {url && <img src={url} alt={`Anexo: ${file.name}`} />}
        </div>
      ) : (
        <FileText size={24} />
      )}
      <span>
        <strong>{file.name}</strong>
        <small>{size} · Anexo local</small>
      </span>
      {!pending && url && (
        <a href={url} download={file.name}>
          Baixar anexo
          <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}
export default function MessagesPage({
  members,
  state,
  onChange,
  createRequest,
  onCreateHandled,
  openRequest,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<HouseMode>("ready");
  const [newOpen, setNewOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [newKind, setNewKind] = useState<"direct" | "group">("direct");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [sending, setSending] = useState(false),
    [loadingEarlier, setLoadingEarlier] = useState(false);
  const keepScroll = useRef<{ height: number; top: number } | null>(null);
  const sendLock = useRef(false),
    createLock = useRef(false);
  const [fileError, setFileError] = useState("");
  const [inThreadSearch, setInThreadSearch] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const request = useRef(createRequest);
  const composer = useRef<HTMLTextAreaElement>(null);
  const threadTitle = useRef<HTMLHeadingElement>(null);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const returningToList = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const nameOf = (c: LocalConversation) =>
    c.kind === "group"
      ? c.title
      : members.find((m) => m.id === c.memberIds[0])?.name ||
        "Membro indisponível";
  const current =
    mode === "empty"
      ? undefined
      : state.conversations.find((c) => c.id === selectedId);
  const peer =
    current?.kind === "direct"
      ? members.find((m) => m.id === current.memberIds[0])
      : undefined;
  const unread = unreadConversations(state);
  const conversations = (mode === "empty" ? [] : state.conversations)
    .filter(
      (c) =>
        (filter === "archived"
          ? c.archived
          : !c.archived && (filter !== "unread" || c.unread)) &&
        textMatch(nameOf(c), query),
    )
    .sort(
      (a, b) =>
        Date.parse(latestMessageDate(b)) - Date.parse(latestMessageDate(a)) ||
        a.id.localeCompare(b.id),
    );
  const draft = current
    ? state.drafts[current.id] || { body: "" }
    : { body: "" };
  const messages =
    current?.messages.filter(
      (m) =>
        !messageQuery.trim() ||
        textMatch(`${m.body} ${m.attachment?.name || ""}`, messageQuery),
    ) || [];
  const participants = current
    ? members.filter((m) => current.memberIds.includes(m.id))
    : [];
  const openNew = () => {
    setNewOpen(true);
    setContactQuery("");
    setCreateError("");
    setGroupTitle("");
    setGroupMembers([]);
    setNewKind("direct");
  };
  useCreateRequest(createRequest, onCreateHandled, () => {
    openNew();
  });
  useEffect(() => {
    const node = history.current;
    if (node) {
      if (keepScroll.current) {
        node.scrollTop =
          keepScroll.current.top +
          node.scrollHeight -
          keepScroll.current.height;
        keepScroll.current = null;
      } else node.scrollTop = node.scrollHeight;
    }
  }, [current?.id, current?.messages.length, messageQuery, threadOpen]);
  useEffect(() => {
    if (threadOpen) {
      threadTitle.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width:920px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
    } else if (returningToList.current) {
      returningToList.current = false;
      listTitle.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [selectedId, threadOpen]);
  const openedRequest = useRef(0),
    reading = useRef(new Set<string>());
  useEffect(() => {
    if (
      openRequest?.id &&
      openRequest.version !== openedRequest.current &&
      state.conversations.some((row) => row.id === openRequest.id)
    ) {
      openedRequest.current = openRequest.version;
      void openConversation(openRequest.id);
    }
  }, [openRequest, state.conversations]);
  useEffect(() => {
    if (threadOpen && current?.unread && !reading.current.has(current.id)) {
      const id = current.id;
      reading.current.add(id);
      Promise.resolve(
        onChange({
          ...state,
          conversations: state.conversations.map((row) =>
            row.id === current.id ? { ...row, unread: false } : row,
          ),
        }),
      )
        .catch(() => setFileError("Não foi possível confirmar a leitura."))
        .finally(() => {
          reading.current.delete(id);
        });
    }
  }, [current?.id, current?.unread, threadOpen, state.conversations]);
  async function openConversation(id: string) {
    setSelectedId(id);
    setThreadOpen(true);
    setNewOpen(false);
    setMessageQuery("");
    setInThreadSearch(false);
    setFileError("");
    setFeedback("");
    setUndoId(null);
    requestAnimationFrame(() =>
      threadTitle.current?.focus({ preventScroll: true }),
    );
  }
  async function updateDraft(patch: { body?: string; attachment?: File }) {
    if (!current) return;
    await onChange({
      ...state,
      drafts: { ...state.drafts, [current.id]: { ...draft, ...patch } },
    });
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (
      !current ||
      current.archived ||
      (!draft.body.trim() && !draft.attachment) ||
      mode !== "ready" ||
      sendLock.current
    )
      return;
    sendLock.current = true;
    setSending(true);
    setFileError("");
    const message: LocalMessage = {
      id: crypto.randomUUID(),
      sender: "self",
      body: draft.body.trim(),
      date: new Date().toISOString(),
      state: "local",
      attachment: draft.attachment,
    };
    try {
      await onChange({
        conversations: state.conversations.map((c) =>
          c.id === current.id
            ? { ...c, messages: [...c.messages, message] }
            : c,
        ),
        drafts: { ...state.drafts, [current.id]: { body: "" } },
      });
      setFeedback("Mensagem enviada.");
      composer.current?.focus();
    } catch (reason) {
      setFileError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar. Seu rascunho foi preservado.",
      );
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  async function archive() {
    if (!current) return;
    const wasArchived = current.archived;
    await onChange({
      ...state,
      conversations: state.conversations.map((c) =>
        c.id === current.id ? { ...c, archived: !c.archived } : c,
      ),
    });
    setFeedback(
      wasArchived
        ? "Conversa restaurada para Todas."
        : "Conversa arquivada. O histórico e o rascunho foram preservados.",
    );
    setUndoId(wasArchived ? null : current.id);
    returningToList.current = true;
    setSelectedId(null);
    setThreadOpen(false);
  }
  async function startDirect(member: DemoMember) {
    if (!member.hasApp || createLock.current) return;
    createLock.current = true;
    setCreateError("");
    try {
      const existing = state.conversations.find(
        (c) => c.kind === "direct" && c.memberIds[0] === member.id,
      );
      if (existing) {
        await onChange({
          ...state,
          conversations: state.conversations.map((c) =>
            c.id === existing.id ? { ...c, archived: false, unread: false } : c,
          ),
        });
        setSelectedId(existing.id);
      } else {
        const conversation: LocalConversation = {
          id: crypto.randomUUID(),
          kind: "direct",
          title: "",
          memberIds: [member.id],
          unread: false,
          archived: false,
          messages: [],
          created: new Date().toISOString(),
        };
        await onChange({
          ...state,
          conversations: [...state.conversations, conversation],
        });
        setSelectedId(conversation.id);
      }
      setMode("ready");
      setFilter("all");
      setQuery("");
      setNewOpen(false);
      setThreadOpen(true);
      setMessageQuery("");
      setInThreadSearch(false);
      setFeedback("");
    } catch (reason) {
      setCreateError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir a conversa.",
      );
    } finally {
      createLock.current = false;
    }
  }
  async function createGroup(e: FormEvent) {
    e.preventDefault();
    if (createLock.current) return;
    const ids = groupMembers.filter((id) =>
      members.some((m) => m.id === id && m.hasApp),
    );
    if (groupTitle.trim().length < 3 || ids.length < 2) {
      setCreateError(
        "Informe um nome com pelo menos três caracteres e escolha dois ou mais membros com acesso.",
      );
      return;
    }
    createLock.current = true;
    setCreateError("");
    try {
      const conversation: LocalConversation = {
        id: crypto.randomUUID(),
        kind: "group",
        title: groupTitle.trim(),
        memberIds: ids,
        unread: false,
        archived: false,
        messages: [],
        created: new Date().toISOString(),
      };
      await onChange({
        ...state,
        conversations: [...state.conversations, conversation],
      });
      setSelectedId(conversation.id);
      setMode("ready");
      setFilter("all");
      setQuery("");
      setNewOpen(false);
      setThreadOpen(true);
      setMessageQuery("");
      setInThreadSearch(false);
      setFeedback("Grupo criado.");
    } catch (reason) {
      setCreateError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o grupo.",
      );
    } finally {
      createLock.current = false;
    }
  }
  return (
    <div className={`messages-page ${threadOpen ? "is-thread" : ""}`}>
      <div className="ms-context">
        <span>
          <MessageCircle size={16} />
          Conversas internas da casa
        </span>
        <p>Mensagens e anexos privados entre os participantes.</p>
      </div>
      <div className="ms-chat-stage">
        {feedback && (
          <div className="ms-feedback" role="status">
            <span>{feedback}</span>
            {undoId && (
              <button
                onClick={async () => {
                  await onChange({
                    ...state,
                    conversations: state.conversations.map((c) =>
                      c.id === undoId ? { ...c, archived: false } : c,
                    ),
                  });
                  setUndoId(null);
                  setFeedback("Conversa restaurada.");
                }}
              >
                Desfazer
              </button>
            )}
            <button
              aria-label="Fechar retorno da conversa"
              onClick={() => {
                setFeedback("");
                setUndoId(null);
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {mode === "loading" ? (
          <PageLoading route="chat" />
        ) : mode === "error" ? (
          <HouseState mode={mode} onReset={() => setMode("ready")} />
        ) : (
          <div className={`ms-workspace ${current ? "has-conversation" : ""}`}>
            <section className="ms-list" aria-label="Lista de conversas">
              <div className="ms-list-heading">
                <div>
                  <h2 ref={listTitle} tabIndex={-1}>
                    Sua caixa de conversas
                  </h2>
                  <p>
                    {mode === "empty" ? 0 : unread}{" "}
                    {mode !== "empty" && unread === 1
                      ? "conversa não lida"
                      : "conversas não lidas"}
                  </p>
                </div>
                <button
                  className="ms-icon"
                  aria-label="Iniciar conversa"
                  onClick={openNew}
                >
                  <Plus size={19} />
                </button>
              </div>
              <label className="wf-search">
                <Search size={17} />
                <input
                  aria-label="Buscar conversa"
                  placeholder="Buscar pessoa ou grupo…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="ms-filters" aria-label="Filtrar conversas">
                {[
                  ["all", "Todas"],
                  ["unread", "Não lidas"],
                  ["archived", "Arquivadas"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={filter === id}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="ms-contacts">
                {conversations.map((c) => {
                  const member = members.find((m) => m.id === c.memberIds[0]);
                  const last = c.messages.at(-1);
                  const hasDraft = !!(
                    state.drafts[c.id]?.body || state.drafts[c.id]?.attachment
                  );
                  return (
                    <button
                      key={c.id}
                      className={`ms-contact ${c.id === current?.id ? "selected" : ""} ${c.unread ? "unread" : ""}`}
                      aria-label={`Abrir conversa: ${nameOf(c)}${c.unread ? ", não lida" : ""}`}
                      aria-current={c.id === current?.id ? "true" : undefined}
                      onClick={async () => await openConversation(c.id)}
                    >
                      <span
                        className={`avatar ${c.kind === "group" ? "ms-group-avatar" : member?.color || "sage"}`}
                        aria-hidden="true"
                      >
                        {c.kind === "group" ? (
                          <Users size={20} />
                        ) : (
                          member?.initials || "?"
                        )}
                      </span>
                      <span className="ms-contact-copy">
                        <strong>{nameOf(c)}</strong>
                        <small>
                          {hasDraft
                            ? "Rascunho: " +
                              (state.drafts[c.id].body || "Anexo selecionado")
                            : last
                              ? `${last.sender === "self" ? "Você: " : ""}${last.body || last.attachment?.name || "Anexo"}`
                              : "Comece uma conversa."}
                        </small>
                      </span>
                      <span className="ms-contact-trailing">
                        <time dateTime={latestMessageDate(c)}>
                          {chatShortDate(latestMessageDate(c))}
                        </time>
                        {c.unread && <span aria-label="Não lida" />}
                        {hasDraft && (
                          <FileText
                            size={12}
                            aria-label="Rascunho salvo na sessão"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
                {!conversations.length && (
                  <WorkflowEmpty
                    title={
                      filter === "unread" && !query
                        ? "Tudo lido por aqui."
                        : query
                          ? "Nenhuma conversa encontrada."
                          : filter === "archived"
                            ? "Nenhuma conversa arquivada."
                            : "A primeira conversa começa aqui."
                    }
                    text={
                      query
                        ? "Busque pelo nome de uma pessoa ou grupo."
                        : "Use o botão de nova conversa para escolher alguém da corrente."
                    }
                  />
                )}
              </div>
              <div className="ms-list-footer">
                <span>
                  {mode === "empty"
                    ? 0
                    : state.conversations.filter((c) => !c.archived)
                        .length}{" "}
                  conversas ativas
                </span>
                <span>Conversas da casa</span>
              </div>
            </section>
            <section
              className="ms-thread"
              aria-label={
                current ? `Conversa: ${nameOf(current)}` : "Área de leitura"
              }
            >
              {current ? (
                <>
                  <header className="ms-thread-heading">
                    <button
                      className="ms-icon ms-back"
                      aria-label="Voltar às conversas"
                      onClick={() => {
                        returningToList.current = true;
                        setThreadOpen(false);
                        setFeedback("");
                      }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <span
                      className={`avatar ${peer?.color || "ms-group-avatar"}`}
                      aria-hidden="true"
                    >
                      {current.kind === "group" ? (
                        <Users size={20} />
                      ) : (
                        peer?.initials || "?"
                      )}
                    </span>
                    <div>
                      <h2 ref={threadTitle} tabIndex={-1}>
                        {nameOf(current)}
                      </h2>
                      <p>
                        {current.kind === "group"
                          ? `${participants.length} membros · grupo da casa`
                          : `${peer?.role || "Membro"} · conversa interna`}
                      </p>
                    </div>
                    <div className="ms-thread-actions">
                      <button
                        ref={searchToggle}
                        className="ms-icon"
                        aria-label="Buscar nesta conversa"
                        aria-expanded={inThreadSearch}
                        onClick={() => {
                          setInThreadSearch(!inThreadSearch);
                          setMessageQuery("");
                        }}
                      >
                        <Search size={18} />
                      </button>
                      <button
                        className="ms-icon"
                        aria-label={
                          current.unread
                            ? "Marcar conversa como lida"
                            : "Marcar conversa como não lida"
                        }
                        onClick={async () => {
                          await onChange({
                            ...state,
                            conversations: state.conversations.map((c) =>
                              c.id === current.id
                                ? { ...c, unread: !c.unread }
                                : c,
                            ),
                          });
                          if (!current.unread) {
                            setThreadOpen(false);
                            setSelectedId(null);
                          }
                          setFeedback(
                            current.unread
                              ? "Conversa marcada como lida."
                              : "Conversa marcada para acompanhar depois.",
                          );
                        }}
                      >
                        {current.unread ? (
                          <MailOpen size={18} />
                        ) : (
                          <Mail size={18} />
                        )}
                      </button>
                      <button
                        className="ms-icon"
                        aria-label="Detalhes da conversa"
                        onClick={() => setDetailsOpen(true)}
                      >
                        <Info size={18} />
                      </button>
                      <button
                        className="ms-icon"
                        aria-label={
                          current.archived
                            ? "Restaurar conversa"
                            : "Arquivar conversa"
                        }
                        onClick={archive}
                      >
                        <Archive size={18} />
                      </button>
                    </div>
                  </header>
                  {inThreadSearch && (
                    <div className="ms-thread-search">
                      <label className="wf-search">
                        <Search size={16} />
                        <input
                          autoFocus
                          aria-label="Buscar mensagem nesta conversa"
                          value={messageQuery}
                          onChange={(e) => setMessageQuery(e.target.value)}
                          placeholder="Buscar no texto e nos anexos…"
                        />
                      </label>
                      <span>{messages.length} resultados</span>
                      <button
                        className="ms-icon"
                        aria-label="Fechar busca de mensagens"
                        onClick={() => {
                          setInThreadSearch(false);
                          setMessageQuery("");
                          searchToggle.current?.focus();
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}
                  <div
                    className="ms-history"
                    ref={history}
                    tabIndex={0}
                    role="log"
                    aria-label={`Histórico de ${nameOf(current)}`}
                    aria-live="polite"
                  >
                    <div className="ms-session-note">Horários de Brasília</div>
                    {current.hasMore && (
                      <button
                        className="button secondary"
                        disabled={loadingEarlier}
                        onClick={async () => {
                          if (loadingEarlier) return;
                          setLoadingEarlier(true);
                          setFileError("");
                          const node = history.current;
                          if (node)
                            keepScroll.current = {
                              height: node.scrollHeight,
                              top: node.scrollTop,
                            };
                          try {
                            await loadEarlierMessages(current.id);
                          } catch (reason) {
                            keepScroll.current = null;
                            setFileError(
                              reason instanceof Error
                                ? reason.message
                                : "Não foi possível carregar as mensagens anteriores.",
                            );
                          } finally {
                            setLoadingEarlier(false);
                          }
                        }}
                      >
                        {loadingEarlier
                          ? "Carregando mensagens…"
                          : "Carregar mensagens anteriores"}
                      </button>
                    )}
                    {messages.length ? (
                      <ol>
                        {messages.map((m, i) => (
                          <li key={m.id}>
                            {(i === 0 ||
                              chatDay(messages[i - 1].date) !==
                                chatDay(m.date)) && (
                              <div className="ms-day">
                                <time dateTime={m.date}>{chatDay(m.date)}</time>
                              </div>
                            )}
                            <article
                              className={`ms-message ${m.sender === "self" ? "self" : "peer"} ${m.state === "failed" ? "failed" : ""}`}
                            >
                              <span className="ms-message-sender">
                                {m.sender === "self"
                                  ? "Você"
                                  : members.find(
                                      (member) => member.id === m.sender,
                                    )?.name || "Membro"}
                              </span>
                              {m.attachment && (
                                <LocalAttachment file={m.attachment} />
                              )}
                              {m.media && <ChatAttachment media={m.media} />}
                              {m.body && <p>{m.body}</p>}
                              <footer>
                                <time dateTime={m.date}>
                                  {chatTime(m.date)}
                                </time>
                                {m.sender === "self" && (
                                  <span>
                                    {m.state === "failed"
                                      ? "Falha simulada"
                                      : m.state === "sent"
                                        ? "Enviada"
                                        : "Aguardando confirmação"}
                                  </span>
                                )}
                              </footer>
                              {m.state === "failed" && (
                                <button
                                  className="ms-retry"
                                  onClick={async () => {
                                    await onChange({
                                      ...state,
                                      conversations: state.conversations.map(
                                        (c) =>
                                          c.id === current.id
                                            ? {
                                                ...c,
                                                messages: c.messages.map(
                                                  (row) =>
                                                    row.id === m.id
                                                      ? {
                                                          ...row,
                                                          state: "local",
                                                        }
                                                      : row,
                                                ),
                                              }
                                            : c,
                                      ),
                                    });
                                    setFeedback(
                                      "Mensagem preparada para uma nova tentativa.",
                                    );
                                  }}
                                >
                                  <CircleAlert size={14} />
                                  Tentar novamente
                                </button>
                              )}
                            </article>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <WorkflowEmpty
                        title={
                          messageQuery
                            ? "Nenhuma mensagem encontrada."
                            : "Um espaço para conversar com cuidado."
                        }
                        text={
                          messageQuery
                            ? "Tente outra palavra ou feche a busca."
                            : "Escreva sua primeira mensagem abaixo."
                        }
                      />
                    )}
                  </div>
                  <form className="ms-composer" onSubmit={send}>
                    {draft.attachment && (
                      <div className="ms-pending-file">
                        <LocalAttachment file={draft.attachment} pending />
                        <button
                          className="ms-icon"
                          type="button"
                          aria-label="Remover anexo da mensagem"
                          onClick={async () =>
                            await updateDraft({ attachment: undefined })
                          }
                        >
                          <X size={17} />
                        </button>
                      </div>
                    )}
                    {fileError && (
                      <p className="wf-error" role="alert">
                        {fileError}
                      </p>
                    )}
                    {current.archived ? (
                      <p className="ms-archived-note">
                        Conversa arquivada. Restaure para continuar.
                      </p>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor="ms-compose">
                          Mensagem para {nameOf(current)}
                        </label>
                        <textarea
                          disabled={sending}
                          ref={composer}
                          id="ms-compose"
                          rows={2}
                          maxLength={2000}
                          value={draft.body}
                          onChange={async (e) =>
                            await updateDraft({ body: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !e.shiftKey &&
                              !e.nativeEvent.isComposing
                            ) {
                              e.preventDefault();
                              e.currentTarget.form?.requestSubmit();
                            }
                          }}
                          placeholder="Escreva uma mensagem…"
                        />
                        <div className="ms-composer-actions">
                          <button
                            className="ms-icon"
                            aria-label="Anexar arquivo local"
                            type="button"
                            disabled={sending}
                            onClick={() => fileInput.current?.click()}
                          >
                            <Paperclip size={19} />
                          </button>
                          <input
                            ref={fileInput}
                            className="sr-only"
                            type="file"
                            tabIndex={-1}
                            accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/ogg,audio/webm,video/mp4,video/webm"
                            aria-label="Selecionar anexo local"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              if (
                                file.size > 5 * 1024 * 1024 ||
                                ![
                                  "image/png",
                                  "image/jpeg",
                                  "image/webp",
                                  "audio/mpeg",
                                  "audio/mp4",
                                  "audio/ogg",
                                  "audio/webm",
                                  "video/mp4",
                                  "video/webm",
                                ].includes(file.type)
                              ) {
                                setFileError(
                                  "Escolha uma imagem PNG, JPG ou WebP, áudio ou vídeo de até 5 MB.",
                                );
                                return;
                              }
                              setFileError("");
                              await updateDraft({ attachment: file });
                            }}
                          />
                          <span className="ms-composer-hint">
                            Enter envia · Shift + Enter quebra linha
                          </span>
                          <small>{draft.body.length}/2000</small>
                          <button
                            className="wf-button"
                            type="submit"
                            disabled={
                              sending ||
                              (!draft.body.trim() && !draft.attachment)
                            }
                          >
                            <Send size={16} />
                            <span>{sending ? "Enviando…" : "Enviar"}</span>
                          </button>
                        </div>
                        <p className="ms-compose-disclaimer">
                          O envio é confirmado pelo servidor. A confirmação não
                          indica que a pessoa já leu.
                        </p>
                      </>
                    )}
                  </form>
                </>
              ) : (
                <div className="ms-welcome">
                  <MessageCircle size={36} strokeWidth={1.25} />
                  <h2>
                    Uma conversa.
                    <br />
                    Um cuidado de cada vez.
                  </h2>
                  <p>
                    Escolha uma pessoa ou um grupo para ler o histórico e enviar
                    mensagens.
                  </p>
                  <button className="wf-button secondary" onClick={openNew}>
                    <Plus size={16} />
                    Iniciar conversa
                  </button>
                  <small>Acesso restrito aos participantes da conversa.</small>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <WorkflowDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title="Nova conversa"
        description="Escolha alguém da corrente ou os participantes do grupo."
      >
        <div className="ms-new-kind">
          <button
            aria-pressed={newKind === "direct"}
            onClick={() => setNewKind("direct")}
          >
            <MessageCircle size={16} />
            Individual
          </button>
          <button
            aria-pressed={newKind === "group"}
            onClick={() => setNewKind("group")}
          >
            <Users size={16} />
            Grupo
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            if (newKind === "group") await createGroup(e);
            else e.preventDefault();
          }}
        >
          {newKind === "group" && (
            <label className="wf-field">
              Nome do grupo
              <input
                maxLength={70}
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Ex.: Organização dos encontros"
              />
            </label>
          )}
          <label className="wf-search">
            <Search size={16} />
            <input
              aria-label="Buscar contato"
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Buscar membro…"
            />
          </label>
          <div className="ms-new-contacts">
            {members
              .filter((m) => textMatch(m.name, contactQuery))
              .map((m) =>
                newKind === "direct" ? (
                  <button
                    type="button"
                    key={m.id}
                    disabled={!m.hasApp}
                    onClick={async () => await startDirect(m)}
                  >
                    <span className={`avatar ${m.color}`}>{m.initials}</span>
                    <span>
                      <strong>{m.name}</strong>
                      <small>{m.hasApp ? m.role : "Sem acesso ao app"}</small>
                    </span>
                    {m.hasApp && <ArrowRight size={15} />}
                  </button>
                ) : (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      disabled={!m.hasApp}
                      checked={groupMembers.includes(m.id)}
                      onChange={(e) =>
                        setGroupMembers(
                          e.target.checked
                            ? [...groupMembers, m.id]
                            : groupMembers.filter((id) => id !== m.id),
                        )
                      }
                    />
                    <span>
                      <strong>{m.name}</strong>
                      <small>{m.hasApp ? m.role : "Sem acesso ao app"}</small>
                    </span>
                  </label>
                ),
              )}
            {!members.some((m) => textMatch(m.name, contactQuery)) && (
              <WorkflowEmpty
                title="Nenhum contato encontrado."
                text="Tente outro nome da corrente."
              />
            )}
          </div>
          {createError && (
            <p className="wf-error" role="alert">
              {createError}
            </p>
          )}
          {newKind === "group" && (
            <button className="wf-button" type="submit">
              <Users size={16} />
              Criar grupo ({groupMembers.length})
            </button>
          )}
        </form>
      </WorkflowDialog>
      <WorkflowDialog
        open={detailsOpen && !!current}
        onOpenChange={setDetailsOpen}
        title="Detalhes da conversa"
        description="Dados e participantes da conversa. Não há indicação de disponibilidade ou confirmação de leitura."
      >
        {current && (
          <div className="ms-details">
            <h3>{nameOf(current)}</h3>
            <p>
              {current.messages.length}{" "}
              {current.messages.length === 1 ? "mensagem" : "mensagens"} ·
              Criada em {chatDay(current.created)}
            </p>
            <h4>
              {current.kind === "group"
                ? "Participantes, além da zeladoria"
                : "Membro"}
            </h4>
            {participants.map((m) => (
              <div key={m.id}>
                <span className={`avatar ${m.color}`}>{m.initials}</span>
                <span>
                  <strong>{m.name}</strong>
                  <small>{m.role}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </WorkflowDialog>
    </div>
  );
}
