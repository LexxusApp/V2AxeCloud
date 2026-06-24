import { Image, Paperclip, Video } from 'lucide-react';
import { useRef } from 'react';

type ChatMediaPickerProps = {
  disabled?: boolean;
  onPick: (file: File) => void;
};

export function ChatMediaPicker({ disabled, onPick }: ChatMediaPickerProps) {
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPick(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => imageRef.current?.click()}
        className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
        title="Enviar foto"
      >
        <Image className="h-5 w-5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => videoRef.current?.click()}
        className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
        title="Enviar vídeo"
      >
        <Video className="h-5 w-5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className="rounded-lg p-2 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
        title="Enviar áudio"
      >
        <Paperclip className="h-5 w-5" />
      </button>
    </div>
  );
}
