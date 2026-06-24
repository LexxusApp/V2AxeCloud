import { Loader2, MessageCircle, Plus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ChatThread } from '../components/chat/ChatThread';
import { ChatContactRow } from '../components/chat/ChatContactRow';
import { authFetch } from '../lib/authenticatedFetch';
import type { ChatContact, ChatConversationSummary } from '../lib/chatTypes';
import { formatChatTime } from '../lib/chatTypes';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

type ChatInboxProps = {
  tenantData?: { tenant_id?: string; id?: string } | null;
  userId: string;
  userRole?: string | null;
  setActiveTab?: (tab: string) => void;
};

export default function ChatInbox({ tenantData, userId, userRole }: ChatInboxProps) {
  const tenantId = String(tenantData?.tenant_id || tenantData?.id || '').trim();
  const isZelador = userRole !== 'filho';

  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await authFetch(`/api/v1/chat/conversations?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) throw new Error('Falha ao carregar conversas');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error('[ChatInbox] load:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await authFetch(
        `/api/v1/chat/contacts?tenantId=${encodeURIComponent(tenantId)}&userRole=${encodeURIComponent(userRole || 'filho')}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      /* ignore */
    }
  }, [tenantId, userRole]);

  useEffect(() => {
    void loadConversations();
    void loadContacts();
  }, [loadConversations, loadContacts]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`chat-inbox:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void loadConversations();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void loadConversations();
        },
      );

    const t = setTimeout(() => {
      void channel.subscribe();
    }, 0);

    return () => {
      clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, loadConversations]);

  const openConversation = async (opts: {
    targetFilhoId?: string;
    withZelador?: boolean;
    type?: 'group';
    title?: string;
  }) => {
    if (!tenantId || creating) return;
    setCreating(true);
    try {
      const res = await authFetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...opts }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao abrir conversa');
      }
      const data = await res.json();
      setShowNewChat(false);
      setContactSearch('');
      await loadConversations();
      setSelectedId(data.conversationId);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao criar conversa');
    } finally {
      setCreating(false);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.nome.toLowerCase().includes(contactSearch.toLowerCase()),
  );

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  if (!tenantId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8 text-center text-sm text-[#64748B]">
        Terreiro não identificado. Recarregue a página.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-white">
            {isZelador ? 'Mensagens' : 'Conversas'}
          </h1>
          <p className="text-sm text-[#64748B]">
            {isZelador
              ? 'Converse com os filhos da corrente em tempo real.'
              : 'Fale com o zelador e com os irmãos de fé.'}
          </p>
        </div>
        {totalUnread > 0 && (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-black">
            {totalUnread} não {totalUnread === 1 ? 'lida' : 'lidas'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Lista */}
        <div
          className={cn(
            'flex flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] lg:col-span-5',
            selectedId && 'hidden lg:flex',
          )}
        >
          <div className="flex items-center justify-between border-b border-[#1E242B] bg-[#12161A] p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-[#F1F5F9]">
                {isZelador ? 'Inbox' : 'Suas conversas'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNewChat((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-1.5 text-[10px] font-bold uppercase text-primary hover:bg-primary/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova
            </button>
          </div>

          {showNewChat && (
            <div className="border-b border-[#1E242B] bg-[#0F1318] p-3">
              {!isZelador && (
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void openConversation({ withZelador: true })}
                  className="mb-2 w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left text-sm font-bold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  Falar com Zelador(a)
                </button>
              )}
              {isZelador && (
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void openConversation({ type: 'group', title: 'Corrente' })}
                  className="mb-2 flex w-full items-center gap-2 rounded-xl border border-[#1E242B] bg-[#1A1F26] px-3 py-2.5 text-left text-sm font-bold text-white hover:bg-[#222830] disabled:opacity-50"
                >
                  <Users className="h-4 w-4 text-primary" />
                  Criar grupo da corrente
                </button>
              )}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder={isZelador ? 'Buscar filho...' : 'Buscar irmão(ã)...'}
                  className="w-full rounded-xl border border-[#1E242B] bg-[#13171D] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#64748B] focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {filteredContacts.map((c) => (
                  <ChatContactRow
                    key={c.filhoId}
                    contact={c}
                    disabled={creating}
                    avatarSize="sm"
                    onClick={() => void openConversation({ targetFilhoId: c.filhoId })}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[520px] flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-[#334155]" />
                <p className="text-sm text-[#64748B]">Nenhuma conversa ainda.</p>
                <p className="mt-1 text-xs text-[#475569]">Toque em Nova para começar.</p>
              </div>
            ) : (
              conversations.map((c) => {
                const title =
                  c.type === 'group' ? c.title || 'Corrente' : c.peer?.nome || 'Conversa';
                const photo = c.type === 'group' ? null : c.peer?.fotoUrl;
                const preview = c.lastMessagePreview || 'Sem mensagens';

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                      selectedId === c.id ? 'bg-primary/15' : 'hover:bg-white/5',
                    )}
                  >
                    {photo ? (
                      <img src={photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white">
                        {c.type === 'group' ? <Users className="h-5 w-5 text-primary" /> : title.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white">{title}</p>
                        <span className="shrink-0 text-[10px] text-[#64748B]">
                          {formatChatTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#64748B]">{preview}</p>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-black">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={cn('lg:col-span-7', !selectedId && 'hidden lg:block')}>
          {selected ? (
            <ChatThread
              conversation={selected}
              tenantId={tenantId}
              userId={userId}
              onBack={() => setSelectedId(null)}
              onMessageSent={() => void loadConversations()}
            />
          ) : (
            <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#1E242B] bg-[#13171D]/50 p-8 text-center">
              <MessageCircle className="mb-4 h-12 w-12 text-[#334155]" />
              <p className="text-sm font-medium text-[#64748B]">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
