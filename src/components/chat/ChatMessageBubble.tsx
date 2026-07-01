import { Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../lib/chatTypes';
import { formatChatTime } from '../../lib/chatTypes';
import { authFetch } from '../../lib/authenticatedFetch';
import { cn } from '../../lib/utils';

type AuthMediaState = {
  src: string | null;
  loading: boolean;
  failed: boolean;
};

function useAuthMediaUrl(url: string | null | undefined, mimeHint?: string | null): AuthMediaState {
  const raw = String(url || '').trim();
  const needsAuth = raw.includes('/api/v1/chat/media');

  const [state, setState] = useState<AuthMediaState>(() => ({
    src: !raw || needsAuth ? null : raw,
    loading: Boolean(raw && needsAuth),
    failed: false,
  }));

  useEffect(() => {
    if (!raw) {
      setState({ src: null, loading: false, failed: false });
      return;
    }

    if (!needsAuth) {
      setState({ src: raw, loading: false, failed: false });
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ src: null, loading: true, failed: false });

    void (async () => {
      try {
        const res = await authFetch(raw);
        if (!res.ok || cancelled) {
          if (!cancelled) setState({ src: null, loading: false, failed: true });
          return;
        }

        const contentType =
          res.headers.get('content-type') ||
          mimeHint ||
          'application/octet-stream';
        const blob = await res.blob();
        if (cancelled) return;

        const typedBlob =
          blob.type && blob.type !== 'application/octet-stream'
            ? blob
            : new Blob([blob], { type: contentType });
        objectUrl = URL.createObjectURL(typedBlob);
        setState({ src: objectUrl, loading: false, failed: false });
      } catch {
        if (!cancelled) setState({ src: null, loading: false, failed: true });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [raw, needsAuth, mimeHint]);

  return state;
}

function formatAudioTime(totalSec: number): string {
  const safe = Number.isFinite(totalSec) && totalSec > 0 ? Math.floor(totalSec) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
          message.pending && 'opacity-80',
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
          <ChatMediaImage url={message.mediaUrl} mimeHint={message.mediaMime} />
        )}

        {message.messageType === 'video' && message.mediaUrl && (
          <ChatMediaVideo url={message.mediaUrl} mimeHint={message.mediaMime} />
        )}

        {message.messageType === 'audio' && message.mediaUrl && (
          <ChatAudioPlayer
            url={message.mediaUrl}
            mimeHint={message.mediaMime}
            durationSec={message.mediaDurationSec}
            isOwn={isOwn}
          />
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

function ChatMediaImage({ url, mimeHint }: { url: string; mimeHint?: string | null }) {
  const { src, loading, failed } = useAuthMediaUrl(url, mimeHint);
  if (loading) return <p className="text-xs text-[#94A3B8]">Carregando imagem...</p>;
  if (failed || !src) return <p className="text-xs text-[#94A3B8]">Não foi possível carregar a imagem.</p>;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt="Imagem enviada" className="max-h-64 rounded-xl object-cover" loading="lazy" />
    </a>
  );
}

function ChatMediaVideo({ url, mimeHint }: { url: string; mimeHint?: string | null }) {
  const { src, loading, failed } = useAuthMediaUrl(url, mimeHint);
  if (loading) return <p className="text-xs text-[#94A3B8]">Carregando vídeo...</p>;
  if (failed || !src) return <p className="text-xs text-[#94A3B8]">Não foi possível carregar o vídeo.</p>;
  return <video src={src} controls className="max-h-64 w-full rounded-xl" preload="metadata" />;
}

function ChatAudioPlayer({
  url,
  mimeHint,
  durationSec,
  isOwn,
}: {
  url: string;
  mimeHint?: string | null;
  durationSec: number | null;
  isOwn: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { src, loading, failed } = useAuthMediaUrl(url, mimeHint);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec ?? 0);
  const [playError, setPlayError] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentSec(0);
    setPlayError(false);
    if (durationSec && durationSec > 0) setTotalSec(durationSec);
  }, [src, durationSec]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;

    const onTimeUpdate = () => setCurrentSec(el.currentTime);
    const onLoadedMetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalSec(Math.ceil(el.duration));
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentSec(0);
    };
    const onError = () => {
      setPlaying(false);
      setPlayError(true);
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [src]);

  const progress = totalSec > 0 ? Math.min(100, (currentSec / totalSec) * 100) : 0;
  const disabled = loading || failed || !src || playError;

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || disabled) return;

    setPlayError(false);
    if (playing) {
      el.pause();
      return;
    }

    try {
      await el.play();
    } catch {
      setPlaying(false);
      setPlayError(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !totalSec || disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * totalSec;
    setCurrentSec(el.currentTime);
  };

  const timeLabel =
    playing || currentSec > 0
      ? `${formatAudioTime(currentSec)} / ${formatAudioTime(totalSec)}`
      : totalSec > 0
        ? formatAudioTime(totalSec)
        : 'Áudio';

  return (
    <div className="min-w-[200px] space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={disabled}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
            isOwn ? 'bg-black/15 text-black' : 'bg-white/10 text-white',
            disabled && 'opacity-40',
            playing && !disabled && 'ring-2 ring-current/30',
          )}
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div
            role="slider"
            aria-label="Progresso do áudio"
            aria-valuemin={0}
            aria-valuemax={totalSec}
            aria-valuenow={Math.floor(currentSec)}
            onClick={seek}
            className={cn(
              'group h-1.5 cursor-pointer overflow-hidden rounded-full',
              isOwn ? 'bg-black/15' : 'bg-white/10',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-150',
                isOwn ? 'bg-black/50' : 'bg-primary',
                playing && 'animate-pulse',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={cn('text-[11px] font-medium tabular-nums', isOwn ? 'text-black/70' : 'text-[#CBD5E1]')}>
            {loading ? 'Carregando...' : failed || playError ? 'Erro ao reproduzir' : timeLabel}
          </span>
        </div>
      </div>

      {src ? <audio ref={audioRef} src={src} preload="metadata" className="hidden" /> : null}
    </div>
  );
}
