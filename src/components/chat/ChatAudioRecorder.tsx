import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  microphoneAccessErrorMessage,
  pickAudioMimeType,
  requestMicrophoneStream,
} from '../../lib/microphoneAccess';
import { cn } from '../../lib/utils';

type ChatAudioRecorderProps = {
  disabled?: boolean;
  onRecorded: (file: File, durationSec: number) => void;
};

export function ChatAudioRecorder({ disabled, onRecorded }: ChatAudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    if (disabled || recording) return;
    try {
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickAudioMimeType();
      if (!mimeType) {
        stream.getTracks().forEach((t) => t.stop());
        alert('Seu navegador não suporta gravação de áudio.');
        return;
      }

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
        onRecorded(file, secondsRef.current);
        setSeconds(0);
        secondsRef.current = 0;
      };

      recorder.start(200);
      setRecording(true);
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          secondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      alert(microphoneAccessErrorMessage(err));
    }
  };

  const formatSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stopRecording : () => void startRecording()}
      className={cn(
        'flex shrink-0 items-center justify-center gap-1 transition-colors disabled:opacity-40',
        recording
          ? 'min-h-[42px] rounded-xl bg-red-500/20 px-2 text-red-400 hover:bg-red-500/30'
          : 'h-[42px] w-[42px] rounded-xl text-[#94A3B8] hover:bg-white/5 hover:text-white',
      )}
      title={recording ? 'Parar gravação' : 'Gravar áudio'}
      aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
    >
      {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
      {recording && <span className="text-xs font-bold tabular-nums">{formatSec(seconds)}</span>}
    </button>
  );
}
