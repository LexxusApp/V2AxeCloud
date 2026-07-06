import { Loader2, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../lib/chatTypes';
import { formatChatTime } from '../../lib/chatTypes';
import { authFetch } from '../../lib/authenticatedFetch';
import { resolveChatMediaAccess } from '../../lib/chatMediaUrl';
import { canPlayAudioMime, normalizeAudioMime } from '../../lib/microphoneAccess';
import { cn } from '../../lib/utils';

type AuthMediaState = {
  src: string | null;
  loading: boolean;
  failed: boolean;
  ensureLoaded: () => Promise<string | null>;
};

function normalizeMediaContentType(contentType: string, mimeHint?: string | null): string {
  const raw = String(contentType || mimeHint || '').trim().toLowerCase();
  if (raw.startsWith('audio/')) return normalizeAudioMime(raw);
  if (raw.startsWith('video/') || raw.startsWith('image/')) return raw.split(';')[0] || raw;
  if (mimeHint) return normalizeAudioMime(mimeHint);
  return contentType || 'application/octet-stream';
}

async function fetchAuthMediaBlobUrl(
  raw: string,
  mimeHint?: string | null,
): Promise<string | null> {
  const res = await authFetch(raw);
  if (!res.ok) return null;

  const contentType = normalizeMediaContentType(res.headers.get('content-type') || '', mimeHint);
  const blob = await res.blob();
  const typedBlob =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob
      : new Blob([blob], { type: contentType });
  return URL.createObjectURL(typedBlob);
}

function useAuthMediaUrl(
  url: string | null | undefined,
  mimeHint?: string | null,
  options?: { lazy?: boolean },
): AuthMediaState {
  const lazy = options?.lazy === true;
  const raw = String(url || '').trim();
  const { directSrc, fetchUrl } = resolveChatMediaAccess(raw);

  const objectUrlRef = useRef<string | null>(null);
  const loadPromiseRef = useRef<Promise<string | null> | null>(null);

  const [state, setState] = useState(() => ({
    src: directSrc,
    loading: Boolean(fetchUrl && !lazy),
    failed: false,
  }));

  const ensureLoaded = useCallback(async (): Promise<string | null> => {
    if (!raw) return null;
    if (directSrc) return directSrc;
    if (!fetchUrl) return null;
    if (objectUrlRef.current) return objectUrlRef.current;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    setState((prev) => ({ ...prev, loading: true, failed: false }));

    loadPromiseRef.current = (async () => {
      try {
        const nextUrl = await fetchAuthMediaBlobUrl(fetchUrl, mimeHint);
        if (!nextUrl) {
          setState((prev) => ({ ...prev, loading: false, failed: true, src: null }));
          return null;
        }
        objectUrlRef.current = nextUrl;
        setState((prev) => ({ ...prev, src: nextUrl, loading: false, failed: false }));
        return nextUrl;
      } catch {
        setState((prev) => ({ ...prev, loading: false, failed: true, src: null }));
        return null;
      } finally {
        loadPromiseRef.current = null;
      }
    })();

    return loadPromiseRef.current;
  }, [raw, directSrc, fetchUrl, mimeHint]);

  useEffect(() => {
    if (!raw) {
      setState((prev) => ({ ...prev, src: null, loading: false, failed: false }));
      return;
    }

    if (directSrc) {
      setState((prev) => ({ ...prev, src: directSrc, loading: false, failed: false }));
      return;
    }

    if (!fetchUrl) {
      setState((prev) => ({ ...prev, src: null, loading: false, failed: true }));
      return;
    }

    if (lazy) {
      setState((prev) => ({ ...prev, src: null, loading: false, failed: false }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, src: null, loading: true, failed: false }));

    void (async () => {
      try {
        const nextUrl = await fetchAuthMediaBlobUrl(fetchUrl, mimeHint);
        if (cancelled) {
          if (nextUrl) URL.revokeObjectURL(nextUrl);
          return;
        }
        if (!nextUrl) {
          setState((prev) => ({ ...prev, src: null, loading: false, failed: true }));
          return;
        }
        objectUrlRef.current = nextUrl;
        setState((prev) => ({ ...prev, src: nextUrl, loading: false, failed: false }));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, src: null, loading: false, failed: true }));
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      loadPromiseRef.current = null;
    };
  }, [raw, directSrc, fetchUrl, mimeHint, lazy]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [raw]);

  return { ...state, ensureLoaded };
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
  return <video src={src} controls className="max-h-64 w-full rounded-xl" preload="none" playsInline />;
}

let activeChatAudio: HTMLAudioElement | null = null;

function pauseOtherChatAudio(current: HTMLAudioElement) {
  if (activeChatAudio && activeChatAudio !== current && !activeChatAudio.paused) {
    activeChatAudio.pause();
  }
  activeChatAudio = current;
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
  const userTriedPlayRef = useRef(false);
  const { src, loading, failed, ensureLoaded } = useAuthMediaUrl(url, mimeHint, { lazy: true });
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec ?? 0);
  const [playError, setPlayError] = useState<string | null>(null);

  const unsupportedFormat = Boolean(mimeHint && src && !canPlayAudioMime(mimeHint));

  useEffect(() => {
    setPlaying(false);
    setCurrentSec(0);
    setPlayError(null);
    userTriedPlayRef.current = false;
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
    const onPlay = () => {
      pauseOtherChatAudio(el);
      setPlaying(true);
      setPlayError(null);
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentSec(0);
      if (activeChatAudio === el) activeChatAudio = null;
    };
    const onError = () => {
      setPlaying(false);
      if (userTriedPlayRef.current) {
        setPlayError(
          unsupportedFormat
            ? 'Formato não suportado neste dispositivo'
            : 'Erro ao reproduzir',
        );
      }
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
      if (activeChatAudio === el) activeChatAudio = null;
      el.pause();
    };
  }, [src, unsupportedFormat]);

  const progress = totalSec > 0 ? Math.min(100, (currentSec / totalSec) * 100) : 0;
  const fetchBlocked = failed;
  const playBlocked = failed || unsupportedFormat;

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (unsupportedFormat) {
      userTriedPlayRef.current = true;
      setPlayError('Formato não suportado neste dispositivo');
      return;
    }

    userTriedPlayRef.current = true;
    setPlayError(null);

    if (playing) {
      el.pause();
      return;
    }

    try {
      const playableSrc = src || (await ensureLoaded());
      if (!playableSrc) {
        setPlayError('Não foi possível carregar');
        return;
      }

      if (el.src !== playableSrc) {
        el.src = playableSrc;
      }

      if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
        el.load();
      }
      pauseOtherChatAudio(el);
      await el.play();
    } catch {
      setPlaying(false);
      setPlayError('Erro ao reproduzir');
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !totalSec || playBlocked || playError) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * totalSec;
    setCurrentSec(el.currentTime);
  };

  const statusLabel = loading
    ? 'Carregando...'
    : failed
      ? 'Não foi possível carregar'
      : playError
        ? playError
        : unsupportedFormat
          ? 'Formato não suportado'
          : timeLabel(playing, currentSec, totalSec);

  return (
    <div className="min-w-[200px] space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
            isOwn ? 'bg-black/15 text-black' : 'bg-white/10 text-white',
            loading && 'opacity-40',
            playing && !loading && 'ring-2 ring-current/30',
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
              (playBlocked || playError) && 'cursor-not-allowed opacity-50',
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
            {statusLabel}
          </span>
        </div>
      </div>

      <audio ref={audioRef} src={src || undefined} preload="none" className="hidden" />
    </div>
  );
}

function timeLabel(playing: boolean, currentSec: number, totalSec: number): string {
  if (playing || currentSec > 0) {
    return `${formatAudioTime(currentSec)} / ${formatAudioTime(totalSec)}`;
  }
  if (totalSec > 0) return formatAudioTime(totalSec);
  return 'Áudio';
}
