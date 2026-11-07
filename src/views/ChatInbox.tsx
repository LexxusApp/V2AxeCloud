import { AppPageShell } from '../components/app/AppTopNav';
import { AxePageHeader, AxeButton, AxeBadge, AxeEmptyState } from '../components/shared/AxePageScaffold';
import { Loader2, MessageCircle, Plus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ChatThread } from '../components/chat/ChatThread';
import { ChatContactRow } from '../components/chat/ChatContactRow';
import Avatar from '../components/Avatar';
import { authFetch } from '../lib/authenticatedFetch';
import type { ChatContact, ChatConversationSummary } from '../lib/chatTypes';
import { formatChatTime } from '../lib/chatTypes';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import FilhoChatExperience from '../components/filho/FilhoChatExperience';

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

  if (!isZelador) {
    return (
      <FilhoChatExperience
        tenantId={tenantId}
        userId={userId}
        conversations={conversations}
        contacts={filteredContacts}
        selected={selected}
        selectedId={selectedId}
        loading={loading}
        creating={creating}
        showNewChat={showNewChat}
        contactSearch={contactSearch}
        totalUnread={totalUnread}
        onSelect={setSelectedId}
        onToggleNewChat={() => setShowNewChat((value) => !value)}
        onContactSearch={setContactSearch}
        onTalkToLeader={() => void openConversation({ withZelador: true })}
        onTalkToContact={(filhoId) => void openConversation({ targetFilhoId: filhoId })}
        onMessageSent={() => void loadConversations()}
        onRead={(conversationId) => {
          setConversations((previous) => previous.map((conversation) => (
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
          )));
          void loadConversations();
        }}
      />
    );
  }

  return (
    <AppPageShell>
      <div className="space-y-5">
        <AxePageHeader
          kicker="Comunicação em Tempo Real"
          title={isZelador ? 'Mensagens da Corrente' : 'Conversas da Casa'}
          description={
            isZelador
              ? 'Converse diretamente com os membros da corrente em tempo real com envio seguro de texto, fotos, vídeos e mensagens de voz.'
              : 'Fale com o zelador(a) e com seus irmãos de fé com privacidade e respeito litúrgico.'
          }
          actions={
            totalUnread > 0 ? (
              <AxeBadge variant="amber" size="md">
                {totalUnread} {totalUnread === 1 ? 'não lida' : 'não lidas'}
              </AxeBadge>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Conversation List */}
          <div
            className={cn(
              'flex flex-col overflow-hidden rounded-lg border border-[#E6DFD3] bg-white shadow-[0_2px_8px_rgba(28,37,31,0.03)] lg:col-span-5',
              selectedId && 'hidden lg:flex',
            )}
          >
            <div className="flex items-center justify-between border-b border-[#E6DFD3] bg-[#FAF7F2]/60 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#1F5942]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#17251D]">
                  {isZelador ? 'Caixa de Entrada' : 'Suas conversas'}
                </span>
              </div>
              <AxeButton
                type="button"
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setShowNewChat((v) => !v)}
              >
                Nova
              </AxeButton>
            </div>

            {showNewChat && (
              <div className="border-b border-[#E6DFD3] bg-[#FAF7F2] p-3 space-y-2">
                {!isZelador && (
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void openConversation({ withZelador: true })}
                    className="w-full rounded-xl border border-[#1F5942]/30 bg-[#E8F5EE] px-3.5 py-2.5 text-left text-xs font-black text-[#1F5942] hover:bg-[#D8EDE2] disabled:opacity-50 transition-colors"
                  >
                    Falar com Zelador(a)
                  </button>
                )}
                {isZelador && (
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void openConversation({ type: 'group', title: 'Corrente' })}
                    className="flex w-full items-center gap-2 rounded-xl border border-[#D8CDBA] bg-white px-3.5 py-2.5 text-left text-xs font-bold text-[#17251D] hover:bg-[#FAF7F2] disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <Users className="h-4 w-4 text-[#1F5942]" />
                    Criar grupo da corrente
                  </button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A958E]" />
                  <input
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder={isZelador ? 'Buscar filho de santo...' : 'Buscar irmão(ã)...'}
                    className="w-full rounded-xl border border-[#D8CDBA] bg-white py-2 pl-9 pr-3 text-xs text-[#17251D] placeholder:text-[#8A958E] focus:border-[#1F5942] focus:outline-none"
                  />
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
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

            <div className="max-h-[540px] flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1F5942]" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-[#D8CDBA]" />
                  <p className="text-sm font-bold text-[#59655E]">Nenhuma conversa ainda.</p>
                  <p className="mt-1 text-xs text-[#8A958E]">Toque em Nova para iniciar um diálogo.</p>
                </div>
              ) : (
                conversations.map((c) => {
                  const title =
                    c.type === 'group' ? c.title || 'Corrente' : c.peer?.nome || 'Conversa';
                  const preview = c.lastMessagePreview || 'Sem mensagens';
                  const isSelected = selectedId === c.id;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                        isSelected
                          ? 'bg-[#E8F5EE] border-l-4 border-l-[#1F5942]'
                          : 'hover:bg-[#FAF7F2]',
                      )}
                    >
                      {c.type === 'group' ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#1F5942]">
                          <Users className="h-5 w-5" />
                        </div>
                      ) : (
                        <Avatar
                          src={c.peer?.fotoUrl}
                          name={title}
                          shape="circle"
                          textSize="text-sm"
                          className="h-11 w-11 shrink-0 border border-[#E6DFD3]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-[#17251D]">{title}</p>
                          <span className="shrink-0 text-[10px] font-semibold text-[#8A958E]">
                            {formatChatTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <p className="truncate text-xs font-medium text-[#59655E]">{preview}</p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#1F5942] px-1.5 text-[10px] font-black text-white">
                          {c.unreadCount > 99 ? '99+' : c.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Thread */}
          <div className={cn('lg:col-span-7', !selectedId && 'hidden lg:block')}>
            {selected ? (
              <ChatThread
                conversation={selected}
                tenantId={tenantId}
                userId={userId}
                onBack={() => setSelectedId(null)}
                onMessageSent={() => void loadConversations()}
                onRead={() => {
                  setConversations((prev) =>
                    prev.map((c) => (c.id === selected.id ? { ...c, unreadCount: 0 } : c)),
                  );
                  void loadConversations();
                }}
              />
            ) : (
              <AxeEmptyState
                icon={MessageCircle}
                title="Selecione uma conversa"
                description="Escolha um filho de santo na lista ao lado para ver o histórico e enviar novas mensagens."
              />
            )}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
