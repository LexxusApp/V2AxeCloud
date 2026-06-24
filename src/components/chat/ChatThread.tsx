import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatAudioRecorder } from './ChatAudioRecorder';
import { ChatMediaPicker } from './ChatMediaPicker';
import { ChatMessageBubble } from './ChatMessageBubble';
import { authFetch } from '../../lib/authenticatedFetch';
import type { ChatConversationSummary, ChatMessage } from '../../lib/chatTypes';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

type ChatThreadProps = {
  conversation: ChatConversationSummary;
  tenantId: string;
  userId: string;
  onBack: () => void;
  onMessageSent?: () => void;
};

export function ChatThread({ conversation, tenantId, userId, onBack, onMessageSent }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const displayTitle =
    conversation.type === 'group'
      ? conversation.title || 'Corrente'
      : conversation.peer?.nome || 'Conversa';

  const displayPhoto = conversation.type === 'group' ? null : conversation.peer?.fotoUrl;

  const loadMessages = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/v1/chat/conversations/${conversation.id}/messages?limit=80`,
      );
      if (!res.ok) throw new Error('Falha ao carregar mensagens');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error('[ChatThread] load:', e);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  const markRead = useCallback(async () => {
    try {
      await authFetch(`/api/v1/chat/conversations/${conversation.id}/read`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  }, [conversation.id]);

  useEffect(() => {
    setLoading(true);
    void loadMessages();
    void markRead();
  }, [loadMessages, markRead]);

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

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const isOwn = row.sender_user_id === userId;
            const peer = conversation.participants.find((p) => p.userId === row.sender_user_id);
            return [
              ...prev,
              {
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
              },
            ];
          });

          if (row.sender_user_id !== userId) void markRead();
        },
      );

    const t = setTimeout(() => {
      void channel.subscribe();
    }, 0);

    return () => {
      clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, conversation.participants, userId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
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
      setInput('');
      onMessageSent?.();
    } catch (e) {
      console.error('[ChatThread] send:', e);
      alert(e instanceof Error ? e.message : 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (file: File, durationSec?: number) => {
    if (uploading) return;
    setUploading(true);
    try {
      const resUrl = await authFetch('/api/v1/chat/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          conversationId: conversation.id,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!resUrl.ok) {
        const err = await resUrl.json().catch(() => ({}));
        throw new Error(err.error || 'Erro no upload');
      }
      const { uploadUrl, storageKey, publicUrl, messageType, contentType } = await resUrl.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error('Falha ao enviar arquivo');

      const resMsg = await authFetch(`/api/v1/chat/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType,
          mediaUrl: publicUrl,
          mediaPath: storageKey,
          mediaMime: contentType,
          mediaSizeBytes: file.size,
          mediaDurationSec: durationSec ?? null,
        }),
      });
      if (!resMsg.ok) throw new Error('Erro ao registrar mensagem');
      onMessageSent?.();
    } catch (e) {
      console.error('[ChatThread] upload:', e);
      alert(e instanceof Error ? e.message : 'Erro ao enviar mídia');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D]">
      <div className="flex items-center gap-3 border-b border-[#1E242B] bg-[#12161A] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-[#94A3B8] hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {displayPhoto ? (
          <img src={displayPhoto} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-black text-primary">
            {displayTitle.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-black text-white">{displayTitle}</h2>
          {conversation.peer?.cargo && (
            <p className="truncate text-[10px] text-[#64748B]">{conversation.peer.cargo}</p>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
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
        {(uploading || sending) && (
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-primary">
            {uploading ? 'Enviando mídia...' : 'Enviando...'}
          </p>
        )}
        <div className="flex items-end gap-2">
          <ChatMediaPicker disabled={sending || uploading} onPick={(f) => void uploadAndSend(f)} />
          <ChatAudioRecorder
            disabled={sending || uploading}
            onRecorded={(file, dur) => void uploadAndSend(file, dur)}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendText();
              }
            }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-[#1E242B] bg-[#0F1318] px-3 py-2.5 text-sm text-white placeholder:text-[#64748B] focus:border-primary/50 focus:outline-none"
            disabled={sending || uploading}
          />
          <button
            type="button"
            onClick={() => void sendText()}
            disabled={!input.trim() || sending || uploading}
            className={cn(
              'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-black transition-opacity',
              (!input.trim() || sending || uploading) && 'opacity-40',
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
