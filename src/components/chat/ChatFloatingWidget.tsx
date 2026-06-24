import { Loader2, MessageCircle, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatThread } from './ChatThread';
import { ChatContactRow } from './ChatContactRow';
import { authFetch } from '../../lib/authenticatedFetch';
import type { ChatContact, ChatConversationSummary, ChatParticipantSummary } from '../../lib/chatTypes';
import { readStaleCache, writeStaleCache } from '../../lib/staleCache';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

type ChatFloatingWidgetProps = {
  tenantData?: { tenant_id?: string; id?: string; cargo?: string | null; foto_url?: string | null } | null;
  userId: string;
  userRole?: string | null;
};

function contactToPeer(contact: ChatContact): ChatParticipantSummary {
  return {
    userId: contact.userId || '',
    participantType: 'filho',
    filhoId: contact.filhoId,
    nome: contact.nome,
    fotoUrl: contact.fotoUrl,
    cargo: contact.cargo,
  };
}

export function ChatFloatingWidget({ tenantData, userId, userRole }: ChatFloatingWidgetProps) {
  const tenantId = String(tenantData?.tenant_id || tenantData?.id || '').trim();
  const isZelador = userRole !== 'filho';

  const rootRef = useRef<HTMLDivElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<ChatConversationSummary | null>(null);
  const contactsCacheKey = `chat_contacts_${tenantId}`;
  const conversationsCacheKey = `chat_conversations_${tenantId}`;

  const [contacts, setContacts] = useState<ChatContact[]>(
    () => readStaleCache<ChatContact[]>(contactsCacheKey) || [],
  );
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    () => readStaleCache<ChatConversationSummary[]>(conversationsCacheKey) || [],
  );
  const [search, setSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [opening, setOpening] = useState(false);
  const contactsFetchRef = useRef<Promise<void> | null>(null);

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations],
  );

  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await authFetch(`/api/v1/chat/conversations?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const next = data.conversations || [];
      setConversations(next);
      writeStaleCache(conversationsCacheKey, next);
    } catch {
      /* ignore */
    }
  }, [tenantId, conversationsCacheKey]);

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await authFetch(
        `/api/v1/chat/contacts?tenantId=${encodeURIComponent(tenantId)}&userRole=${encodeURIComponent(userRole || 'admin')}`,
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        // #region agent log
        console.error("[CHAT-DEBUG cb5e09] contacts fetch failed", res.status, errBody);
        fetch('http://127.0.0.1:7309/ingest/95de0aad-8532-45db-9a8e-839f8db87925',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cb5e09'},body:JSON.stringify({sessionId:'cb5e09',location:'ChatFloatingWidget.tsx:loadContacts',message:'contacts fetch failed',data:{status:res.status,errBody,tenantId},timestamp:Date.now(),hypothesisId:'H-uuid-or'})}).catch(()=>{});
        // #endregion
        return;
      }
      const data = await res.json();
      const next = data.contacts || [];
      setContacts(next);
      writeStaleCache(contactsCacheKey, next);
    } catch {
      /* ignore */
    }
  }, [tenantId, userRole, contactsCacheKey]);

  const refreshContacts = useCallback(
    (showSpinner = false) => {
      if (contactsFetchRef.current) return contactsFetchRef.current;
      if (showSpinner) setLoadingContacts(true);
      contactsFetchRef.current = loadContacts().finally(() => {
        contactsFetchRef.current = null;
        setLoadingContacts(false);
      });
      return contactsFetchRef.current;
    },
    [loadContacts],
  );

  useEffect(() => {
    if (!tenantId) return;
    void loadConversations();
    void refreshContacts(false);
  }, [tenantId, loadConversations, refreshContacts]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`chat-floating:${tenantId}:${userId}`)
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
  }, [tenantId, userId, loadConversations]);

  const closeAll = useCallback(() => {
    setMembersOpen(false);
    setActiveConversation(null);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!membersOpen && !activeConversation) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      closeAll();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [membersOpen, activeConversation, closeAll]);

  const openMembers = () => {
    if (activeConversation) {
      closeAll();
      return;
    }
    const next = !membersOpen;
    setMembersOpen(next);
    if (next) void refreshContacts(contacts.length === 0);
  };

  const findExistingConversation = (opts: { targetFilhoId?: string; withZelador?: boolean }) => {
    if (opts.withZelador) {
      return conversations.find((c) => c.peer?.participantType === 'admin') || null;
    }
    if (opts.targetFilhoId) {
      return conversations.find((c) => c.peer?.filhoId === opts.targetFilhoId) || null;
    }
    return null;
  };

  const resolveConversationSummary = (
    conversationId: string,
    peer: ChatParticipantSummary,
  ): ChatConversationSummary => {
    const existing = conversations.find((c) => c.id === conversationId);
    if (existing) return existing;
    return {
      id: conversationId,
      type: 'direct',
      title: null,
      tenantId,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageType: null,
      unreadCount: 0,
      participants: [peer],
      peer,
    };
  };

  const startChat = async (opts: { targetFilhoId?: string; withZelador?: boolean }) => {
    if (!tenantId || opening) return;

    const existing = findExistingConversation(opts);
    if (existing) {
      setActiveConversation(existing);
      setMembersOpen(false);
      setSearch('');
      return;
    }

    let peer: ChatParticipantSummary;
    if (opts.withZelador) {
      peer = {
        userId: '',
        participantType: 'admin',
        filhoId: null,
        nome: 'Zelador(a)',
        fotoUrl: tenantData?.foto_url || null,
        cargo: tenantData?.cargo || null,
      };
    } else {
      const contact = contacts.find((c) => c.filhoId === opts.targetFilhoId);
      peer = contact
        ? contactToPeer(contact)
        : {
            userId: '',
            participantType: 'filho',
            filhoId: opts.targetFilhoId || null,
            nome: 'Membro',
            fotoUrl: null,
            cargo: null,
          };
    }

    setOpening(true);
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
      setActiveConversation(resolveConversationSummary(data.conversationId, peer));
      setMembersOpen(false);
      setSearch('');
      void loadConversations();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao abrir conversa');
    } finally {
      setOpening(false);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()),
  );

  const unreadByFilho = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations) {
      if (c.type !== 'direct' || !c.peer?.filhoId) continue;
      map.set(c.peer.filhoId, (map.get(c.peer.filhoId) || 0) + (c.unreadCount || 0));
    }
    return map;
  }, [conversations]);

  const zeladorUnread = useMemo(
    () =>
      conversations
        .filter((c) => c.peer?.participantType === 'admin')
        .reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations],
  );

  if (!tenantId) return null;

  return (
    <div ref={rootRef} className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {activeConversation ? (
        <div className="pointer-events-auto w-[min(calc(100vw-2.5rem),380px)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <ChatThread
            variant="floating"
            conversation={activeConversation}
            tenantId={tenantId}
            userId={userId}
            onBack={closeAll}
            onMessageSent={() => void loadConversations()}
          />
        </div>
      ) : null}

      {membersOpen && !activeConversation ? (
        <div
          className="pointer-events-auto flex w-[min(calc(100vw-2.5rem),320px)] max-h-[min(60dvh,420px)] animate-in fade-in slide-in-from-bottom-2 flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl duration-200"
          role="dialog"
          aria-label="Membros disponíveis"
        >
          <div className="flex items-center justify-between border-b border-[#1E242B] bg-[#12161A] px-4 py-3">
            <p className="text-sm font-black text-white">Mensagens</p>
            <button
              type="button"
              onClick={closeAll}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-[#1E242B] p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isZelador ? 'Buscar filho...' : 'Buscar irmão(ã)...'}
                className="w-full rounded-xl border border-[#1E242B] bg-[#0F1318] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#64748B] focus:border-primary/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loadingContacts && contacts.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {!isZelador ? (
                  <button
                    type="button"
                    disabled={opening}
                    onClick={() => void startChat({ withZelador: true })}
                    className="mb-1 flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-left transition-colors hover:bg-primary/15 disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-black text-primary">
                      Z
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-primary">Zelador(a)</p>
                      <p className="text-[10px] text-[#64748B]">Mensagem direta</p>
                    </div>
                    {zeladorUnread > 0 ? (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-black">
                        {zeladorUnread > 99 ? '99+' : zeladorUnread}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {filteredContacts.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-[#64748B]">Nenhum membro encontrado.</p>
                ) : (
                  filteredContacts.map((c) => (
                    <ChatContactRow
                      key={c.filhoId}
                      contact={c}
                      unread={unreadByFilho.get(c.filhoId) || 0}
                      disabled={opening}
                      onClick={() => void startChat({ targetFilhoId: c.filhoId })}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={openMembers}
        className={cn(
          'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary text-black shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95',
          membersOpen && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-[#0D0F12]',
        )}
        aria-label={totalUnread > 0 ? `Mensagens, ${totalUnread} não lidas` : 'Abrir mensagens'}
        title="Mensagens"
      >
        <MessageCircle className="h-6 w-6" strokeWidth={2.25} />
        {totalUnread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#0D0F12] bg-red-500 px-1 text-[10px] font-black leading-none text-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
