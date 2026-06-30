import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatAttachMenu } from './ChatAttachMenu';
import { ChatMessageBubble } from './ChatMessageBubble';
import { authFetch } from '../../lib/authenticatedFetch';
import type { ChatConversationSummary, ChatMessage, ChatParticipantSummary } from '../../lib/chatTypes';
import { readStaleCache, writeStaleCache } from '../../lib/staleCache';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import Avatar from '../Avatar';

function guessChatMimeType(file: File): string {
  const direct = String(file.type || '').trim();
  if (direct && direct !== 'application/octet-stream') return direct;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
  };
  return map[ext] || 'application/octet-stream';
}

function newClientMessageId(): string {
  return `opt-${crypto.randomUUID()}`;
}

function buildOwnMessage(
  conversation: ChatConversationSummary,
  tenantId: string,
  userId: string,
  partial: Pick<ChatMessage, 'id' | 'body' | 'messageType' | 'mediaUrl' | 'mediaMime' | 'mediaDurationSec'> & {
    pending?: boolean;
  },
): ChatMessage {
  const selfPeer = conversation.participants.find((p) => p.userId === userId);
  return {
    id: partial.id,
    conversationId: conversation.id,
    tenantId,
    senderUserId: userId,
    senderFilhoId: selfPeer?.filhoId || null,
    senderNome: 'Você',
    senderFotoUrl: selfPeer?.fotoUrl || null,
    body: partial.body,
    messageType: partial.messageType,
    mediaUrl: partial.mediaUrl,
    mediaMime: partial.mediaMime,
    mediaDurationSec: partial.mediaDurationSec,
    createdAt: new Date().toISOString(),
    isOwn: true,
    pending: partial.pending,
  };
}

function rowToChatMessage(
  row: {
    id: string;
    conversation_id: string;
    tenant_id: string;
    sender_user_id: string;
    sender_filho_id: string | null;
    body: string | null;
    message_type: string;
    media_url: string | null;
    media_mime: string | null;
    media_duration_sec: number | null;
    created_at: string;
  },
  userId: string,
  participants: ChatParticipantSummary[],
): ChatMessage {
  const isOwn = row.sender_user_id === userId;
  const peer = participants.find((p) => p.userId === row.sender_user_id);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    senderUserId: row.sender_user_id,
    senderFilhoId: row.sender_filho_id,
    senderNome: peer?.nome || (isOwn ? 'Você' : 'Participante'),
    senderFotoUrl: peer?.fotoUrl || null,
    body: row.body,
    messageType: row.message_type as ChatMessage['messageType'],
    mediaUrl: row.media_url,
    mediaMime: row.media_mime,
    mediaDurationSec: row.media_duration_sec,
    createdAt: row.created_at,
    isOwn,
  };
}

function stripOwnPending(prev: ChatMessage[]): ChatMessage[] {
  return prev.filter((m) => !(m.isOwn && m.pending));
}

type ChatThreadProps = {
  conversation: ChatConversationSummary;
  tenantId: string;
  userId: string;
  onBack: () => void;
  onMessageSent?: () => void;
  variant?: 'page' | 'floating';
};

export function ChatThread({
  conversation,
  tenantId,
  userId,
  onBack,
  onMessageSent,
  variant = 'page',
}: ChatThreadProps) {
  const messagesCacheKey = `chat_msgs_${conversation.id}`;
  const cachedMessages = readStaleCache<ChatMessage[]>(messagesCacheKey);
  const [messages, setMessages] = useState<ChatMessage[]>(cachedMessages || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(!cachedMessages);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const applyMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        writeStaleCache(messagesCacheKey, next);
        return next;
      });
    },
    [messagesCacheKey],
  );

  const displayTitle =
    conversation.type === 'group'
      ? conversation.title || 'Corrente'
      : conversation.peer?.nome || 'Conversa';

  const loadMessages = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/v1/chat/conversations/${conversation.id}/messages?limit=80`,
      );
      if (!res.ok) throw new Error('Falha ao carregar mensagens');
      const data = await res.json();
      const next = data.messages || [];
      setMessages(next);
      writeStaleCache(messagesCacheKey, next);
    } catch (e) {
      console.error('[ChatThread] load:', e);
    } finally {
      setLoading(false);
    }
  }, [conversation.id, messagesCacheKey]);

  const markRead = useCallback(async () => {
    try {
      await authFetch(`/api/v1/chat/conversations/${conversation.id}/read`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }, [conversation.id]);

  useEffect(() => {
    const cached = readStaleCache<ChatMessage[]>(messagesCacheKey);
    setMessages(cached || []);
    setLoading(!cached);
    void loadMessages();
    void markRead();
  }, [loadMessages, markRead, messagesCacheKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-thread:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            tenant_id: string;
            sender_user_id: string;
            sender_filho_id: string | null;
            body: string | null;
            message_type: string;
            media_url: string | null;
            media_mime: string | null;
            media_duration_sec: number | null;
            created_at: string;
          };

          applyMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            let base = prev;
            if (row.sender_user_id === userId) {
              base = stripOwnPending(prev);
            }
            const incoming = rowToChatMessage(row, userId, conversation.participants);
            return [...base, incoming];
          });

          if (row.sender_user_id !== userId) void markRead();
        },
      );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, conversation.participants, userId, markRead, applyMessages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    bottomRef.current?.scrollIntoView({
      behavior: last?.isOwn ? 'auto' : 'smooth',
    });
  }, [messages]);

  const confirmSentMessage = (clientId: string, serverId: string, createdAt: string) => {
    applyMessages((prev) =>
      prev.map((m) =>
        m.id === clientId
          ? { ...m, id: serverId, createdAt, pending: false }
          : m,
      ),
    );
  };

  const sendText = () => {
    const text = input.trim();
    if (!text) return;

    const clientId = newClientMessageId();
    applyMessages((prev) => [
      ...prev,
      buildOwnMessage(conversation, tenantId, userId, {
        id: clientId,
        body: text,
        messageType: 'text',
        mediaUrl: null,
        mediaMime: null,
        mediaDurationSec: null,
        pending: true,
      }),
    ]);
    setInput('');
    onMessageSent?.();

    void (async () => {
      try {
        const res = await authFetch(`/api/v1/chat/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: text, messageType: 'text' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erro ao enviar');
        }
        const data = await res.json();
        const serverId = String(data?.message?.id || '').trim();
        const createdAt = String(data?.message?.createdAt || new Date().toISOString());
        if (serverId) {
          applyMessages((prev) => {
            if (prev.some((m) => m.id === serverId)) {
              return stripOwnPending(prev.filter((m) => m.id !== clientId));
            }
            return prev.map((m) =>
              m.id === clientId ? { ...m, id: serverId, createdAt, pending: false } : m,
            );
          });
        } else {
          confirmSentMessage(clientId, clientId, createdAt);
        }
      } catch (e) {
        console.error('[ChatThread] send:', e);
        applyMessages((prev) => prev.filter((m) => m.id !== clientId));
        setInput(text);
        alert(e instanceof Error ? e.message : 'Erro ao enviar mensagem');
      }
    })();
  };

  const uploadAndSend = async (file: File, durationSec?: number) => {
    if (uploading) return;
    const contentType = guessChatMimeType(file);
    const mediaType = contentType.startsWith('video/')
      ? 'video'
      : contentType.startsWith('audio/')
        ? 'audio'
        : 'image';
    const clientId = newClientMessageId();

    applyMessages((prev) => [
      ...prev,
      buildOwnMessage(conversation, tenantId, userId, {
        id: clientId,
        body: null,
        messageType: mediaType,
        mediaUrl: URL.createObjectURL(file),
        mediaMime: contentType,
        mediaDurationSec: durationSec ?? null,
        pending: true,
      }),
    ]);
    setUploading(true);

    try {
      const resUrl = await authFetch(`/api/v1/chat/conversations/${conversation.id}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-File-Name': encodeURIComponent(file.name || 'file'),
          'X-Tenant-Id': tenantId,
        },
        body: file,
      });
      if (!resUrl.ok) {
        const err = await resUrl.json().catch(() => ({}));
        throw new Error(err.error || 'Erro no upload');
      }
      const { storageKey, publicUrl, messageType, contentType: storedType } = await resUrl.json();

      const resMsg = await authFetch(`/api/v1/chat/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType,
          mediaUrl: publicUrl,
          mediaPath: storageKey,
          mediaMime: storedType || contentType,
          mediaSizeBytes: file.size,
          mediaDurationSec: durationSec ?? null,
        }),
      });
      if (!resMsg.ok) throw new Error('Erro ao registrar mensagem');
      const data = await resMsg.json();
      const serverId = String(data?.message?.id || '').trim();
      const createdAt = String(data?.message?.createdAt || new Date().toISOString());
      applyMessages((prev) => {
        const pending = prev.find((m) => m.id === clientId);
        if (pending?.mediaUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(pending.mediaUrl);
        }
        if (serverId && prev.some((m) => m.id === serverId)) {
          return stripOwnPending(prev.filter((m) => m.id !== clientId));
        }
        return prev.map((m) =>
          m.id === clientId
            ? {
                ...m,
                id: serverId || clientId,
                createdAt,
                mediaUrl: publicUrl,
                mediaMime: storedType || contentType,
                pending: false,
              }
            : m,
        );
      });
      onMessageSent?.();
    } catch (e) {
      console.error('[ChatThread] upload:', e);
      applyMessages((prev) => {
        const pending = prev.find((m) => m.id === clientId);
        if (pending?.mediaUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(pending.mediaUrl);
        }
        return prev.filter((m) => m.id !== clientId);
      });
      alert(e instanceof Error ? e.message : 'Erro ao enviar mídia');
    } finally {
      setUploading(false);
    }
  };

  const isFloating = variant === 'floating';

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D] shadow-2xl',
        isFloating ? 'h-[min(72dvh,420px)] w-full' : 'h-full min-h-[480px]',
      )}
    >
      <div className="flex items-center gap-3 border-b border-[#1E242B] bg-[#12161A] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'rounded-lg p-2 text-[#94A3B8] hover:bg-white/5 hover:text-white',
            !isFloating && 'lg:hidden',
          )}
          aria-label="Fechar conversa"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conversation.type === 'group' ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-black text-primary">
            {(displayTitle.charAt(0) || 'C').toUpperCase()}
          </div>
        ) : (
          <Avatar
            src={conversation.peer?.fotoUrl}
            name={displayTitle}
            shape="circle"
            textSize="text-sm"
            className="h-10 w-10"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-black text-white">{displayTitle}</h2>
          {conversation.peer?.cargo && (
            <p className="truncate text-[10px] text-[#64748B]">{conversation.peer.cargo}</p>
          )}
        </div>
      </div>

      <div ref={listRef} className="relative flex-1 space-y-3 overflow-y-auto p-4">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#64748B]">
            Nenhuma mensagem ainda. Envie um axé!
          </p>
        ) : (
          messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#1E242B] bg-[#12161A] p-3">
        {uploading && (
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-primary">
            Enviando mídia...
          </p>
        )}
        <div className="flex items-end gap-2">
          <ChatAttachMenu
            disabled={uploading}
            onPick={(f) => void uploadAndSend(f)}
            onRecorded={(file, dur) => void uploadAndSend(file, dur)}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="max-h-28 min-h-[42px] min-w-0 flex-1 resize-none rounded-xl border border-[#1E242B] bg-[#0F1318] px-3 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:border-primary/50 focus:outline-none"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={sendText}
            disabled={!input.trim() || uploading}
            className={cn(
              'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-black transition-opacity',
              (!input.trim() || uploading) && 'opacity-40',
            )}
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
