import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../lib/chatTypes';
import { formatChatTime } from '../../lib/chatTypes';
import { authFetch } from '../../lib/authenticatedFetch';
import { cn } from '../../lib/utils';

function useAuthMediaUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(url || null);

  useEffect(() => {
    const raw = String(url || '').trim();
    if (!raw) {
      setResolved(null);
      return;
    }
    if (!raw.includes('/api/v1/chat/media')) {
      setResolved(raw);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const res = await authFetch(raw);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      } catch {
        if (!cancelled) setResolved(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return resolved;
}

type ChatMessageBubbleProps = {
  message: ChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isOwn = message.isOwn;

  return (
    <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%]',
          isOwn
            ? 'rounded-br-md bg-primary text-black'
            : 'rounded-bl-md border border-[#1E242B] bg-[#1A1F26] text-[#F1F5F9]',
        )}
      >
        {!isOwn && (
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
            {message.senderNome}
          </p>
        )}

        {message.messageType === 'text' && (
          <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">
            {message.body}
          </p>
        )}

        {message.messageType === 'image' && message.mediaUrl && (
          <ChatMediaImage url={message.mediaUrl} />
        )}

        {message.messageType === 'video' && message.mediaUrl && (
          <ChatMediaVideo url={message.mediaUrl} />
        )}

        {message.messageType === 'audio' && message.mediaUrl && (
          <ChatAudioPlayer url={message.mediaUrl} durationSec={message.mediaDurationSec} isOwn={isOwn} />
        )}

        {message.messageType === 'system' && (
          <p className="text-xs italic text-[#94A3B8]">{message.body}</p>
        )}

        {message.body && message.messageType !== 'text' && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
        )}

        <p
          className={cn(
            'mt-1 text-right text-[10px]',
            isOwn ? 'text-black/60' : 'text-[#64748B]',
          )}
        >
          {formatChatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ChatMediaImage({ url }: { url: string }) {
  const src = useAuthMediaUrl(url);
  if (!src) return <p className="text-xs text-[#94A3B8]">Carregando imagem...</p>;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt="Imagem enviada" className="max-h-64 rounded-xl object-cover" loading="lazy" />
    </a>
  );
}

function ChatMediaVideo({ url }: { url: string }) {
  const src = useAuthMediaUrl(url);
  if (!src) return <p className="text-xs text-[#94A3B8]">Carregando vídeo...</p>;
  return <video src={src} controls className="max-h-64 w-full rounded-xl" preload="metadata" />;
}

function ChatAudioPlayer({
  url,
  durationSec,
  isOwn,
}: {
  url: string;
  durationSec: number | null;
  isOwn: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const resolvedUrl = useAuthMediaUrl(url);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlaying(false);
    el.addEventListener('ended', onEnd);
    return () => el.removeEventListener('ended', onEnd);
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!resolvedUrl}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isOwn ? 'bg-black/15 text-black' : 'bg-white/10 text-white',
          !resolvedUrl && 'opacity-40',
        )}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      {resolvedUrl ? <audio ref={audioRef} src={resolvedUrl} preload="metadata" className="hidden" /> : null}
      <span className="text-xs font-medium">
        {durationSec ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : 'Áudio'}
      </span>
    </div>
  );
}
