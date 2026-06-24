import { Image, Mic, MoreVertical, Square, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

type ChatAttachMenuProps = {
  disabled?: boolean;
  onPick: (file: File) => void;
  onRecorded: (file: File, durationSec: number) => void;
};

export function ChatAttachMenu({ disabled, onPick, onRecorded }: ChatAttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPick(file);
    e.target.value = '';
    setOpen(false);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (disabled || recording) return;
    setOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mimeType });
        onRecorded(file, seconds);
        setSeconds(0);
      };

      recorder.start(200);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const formatSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (recording) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={stopRecording}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-red-500/20 px-2 py-2 text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-40"
        title="Parar gravação"
      >
        <Square className="h-5 w-5 fill-current" />
        <span className="text-xs font-bold tabular-nums">{formatSec(seconds)}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {open ? (
        <div
          className="absolute bottom-full left-0 z-10 mb-2 flex min-w-[148px] flex-col gap-0.5 rounded-xl border border-[#1E242B] bg-[#1A1F26] p-1 shadow-xl"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => imageRef.current?.click()}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#E2E8F0] transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <Image className="h-4 w-4 text-[#94A3B8]" />
            Imagem
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => videoRef.current?.click()}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#E2E8F0] transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <Video className="h-4 w-4 text-[#94A3B8]" />
            Vídeo
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => void startRecording()}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#E2E8F0] transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <Mic className="h-4 w-4 text-[#94A3B8]" />
            Áudio
          </button>
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-[42px] w-[42px] items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40',
          open && 'bg-white/5 text-white',
        )}
        aria-label="Anexar mídia"
        aria-expanded={open}
      >
        <MoreVertical className="h-5 w-5" />
      </button>
    </div>
  );
}
