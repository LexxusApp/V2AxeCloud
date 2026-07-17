import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Inbox, RefreshCw, Send } from "lucide-react";
import { apiJson, isApiUnreachable } from "@/lib/api";
import { cn } from "@/lib/cn";

type Conversation = {
  id: string;
  phone_e164: string;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  body: string;
  message_type: string;
  status: string | null;
  created_at: string;
};

function formatPhone(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  }
  return raw || "—";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function WhatsAppInboxPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState<"open" | "archived" | "all">("open");
  const [busy, setBusy] = useState<"idle" | "list" | "thread" | "send">("idle");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(async () => {
    setBusy("list");
    try {
      const r = await apiJson<{ conversations: Conversation[]; warning?: string }>(
        `/api/admin-console/whatsapp-inbox/conversations?status=${filter}`
      );
      setConversations(Array.isArray(r.conversations) ? r.conversations : []);
      if (r.warning) setFeedback({ kind: "err", msg: r.warning });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: isApiUnreachable(e)
          ? "Servidor indisponível."
          : e instanceof Error
            ? e.message
            : "Falha ao carregar conversas",
      });
    } finally {
      setBusy("idle");
    }
  }, [filter]);

  const loadMessages = useCallback(async (id: string) => {
    setBusy("thread");
    try {
      const r = await apiJson<{ messages: Message[] }>(
        `/api/admin-console/whatsapp-inbox/conversations/${encodeURIComponent(id)}/messages`
      );
      setMessages(Array.isArray(r.messages) ? r.messages : []);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
      );
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Falha ao carregar mensagens",
      });
    } finally {
      setBusy("idle");
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const t = window.setInterval(() => void loadConversations(), 20000);
    return () => window.clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setBusy("send");
    setFeedback(null);
    try {
      await apiJson(`/api/admin-console/whatsapp-inbox/conversations/${encodeURIComponent(selectedId)}/reply`, {
        method: "POST",
        body: JSON.stringify({ text: reply.trim() }),
      });
      setReply("");
      await loadMessages(selectedId);
      await loadConversations();
      setFeedback({ kind: "ok", msg: "Resposta enviada." });
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Falha ao enviar resposta",
      });
    } finally {
      setBusy("idle");
    }
  }

  async function archiveSelected() {
    if (!selectedId) return;
    try {
      await apiJson(
        `/api/admin-console/whatsapp-inbox/conversations/${encodeURIComponent(selectedId)}/archive`,
        {
          method: "POST",
          body: JSON.stringify({ archived: true }),
        }
      );
      setSelectedId(null);
      await loadConversations();
    } catch (e) {
      setFeedback({
        kind: "err",
        msg: e instanceof Error ? e.message : "Falha ao arquivar",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-panel space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-text)]">
              <Inbox className="h-4 w-4 text-teal-400" />
              Caixa WhatsApp (Meta)
            </h2>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Mensagens recebidas no número oficial Cloud API (+55 11 5295-0746). Respostas usam a janela de 24h.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="admin-input !w-auto !py-1.5 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "open" | "archived" | "all")}
            >
              <option value="open">Abertas</option>
              <option value="archived">Arquivadas</option>
              <option value="all">Todas</option>
            </select>
            <button
              type="button"
              className="admin-btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-xs"
              onClick={() => void loadConversations()}
              disabled={busy === "list"}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy === "list" && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              feedback.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            )}
          >
            {feedback.msg}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="admin-panel flex max-h-[70vh] flex-col overflow-hidden !p-0">
          <div className="border-b border-[var(--admin-border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-muted)]">
            Conversas ({conversations.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-[var(--admin-muted)]">
                Nenhuma mensagem ainda. Peça para alguém enviar um WhatsApp para o número oficial.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "block w-full border-b border-[var(--admin-border)]/60 px-3 py-2.5 text-left transition",
                    selectedId === c.id ? "bg-teal-500/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--admin-text)]">
                      {c.contact_name || formatPhone(c.phone_e164)}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-300">
                        {c.unread_count}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--admin-muted)]">
                    {c.contact_name ? formatPhone(c.phone_e164) : c.last_message_preview || "—"}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--admin-muted)]">{formatWhen(c.last_message_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="admin-panel flex max-h-[70vh] flex-col overflow-hidden !p-0">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--admin-muted)]">
              Selecione uma conversa à esquerda.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--admin-text)]">
                    {selected.contact_name || formatPhone(selected.phone_e164)}
                  </p>
                  <p className="truncate text-[11px] text-[var(--admin-muted)]">
                    {formatPhone(selected.phone_e164)}
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn-secondary inline-flex items-center gap-1 !py-1 text-[11px]"
                  onClick={() => void archiveSelected()}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Arquivar
                </button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {busy === "thread" && messages.length === 0 ? (
                  <p className="text-center text-xs text-[var(--admin-muted)]">Carregando…</p>
                ) : null}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      m.direction === "inbound"
                        ? "bg-white/5 text-[var(--admin-text)]"
                        : "ml-auto bg-teal-500/20 text-teal-50"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-60">
                      {formatWhen(m.created_at)}
                      {m.direction === "outbound" && m.status ? ` · ${m.status}` : ""}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--admin-border)] p-3">
                <div className="flex gap-2">
                  <textarea
                    className="admin-input min-h-[2.75rem] flex-1 resize-y text-sm"
                    rows={2}
                    placeholder="Responder… (só funciona se o contato escreveu nas últimas 24h)"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn-primary inline-flex h-11 items-center gap-1.5 self-end px-3 text-xs"
                    disabled={busy === "send" || !reply.trim()}
                    onClick={() => void sendReply()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
