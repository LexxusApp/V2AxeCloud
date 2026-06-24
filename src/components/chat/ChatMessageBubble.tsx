import { Play, Pause } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../lib/chatTypes';
import { formatChatTime } from '../../lib/chatTypes';
import { cn } from '../../lib/utils';

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
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={message.mediaUrl}
              alt="Imagem enviada"
              className="max-h-64 rounded-xl object-cover"
              loading="lazy"
            />
          </a>
        )}

        {message.messageType === 'video' && message.mediaUrl && (
          <video
            src={message.mediaUrl}
            controls
            className="max-h-64 w-full rounded-xl"
            preload="metadata"
          />
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
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isOwn ? 'bg-black/15 text-black' : 'bg-white/10 text-white',
        )}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <span className="text-xs font-medium">
        {durationSec ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : 'Áudio'}
      </span>
    </div>
  );
}
