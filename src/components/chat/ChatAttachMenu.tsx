import { Image, MoreVertical, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

type ChatAttachMenuProps = {
  disabled?: boolean;
  onPick: (file: File) => void;
  placement?: 'header' | 'footer';
};

export function ChatAttachMenu({ disabled, onPick, placement = 'footer' }: ChatAttachMenuProps) {
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPick(file);
    e.target.value = '';
    setOpen(false);
  };

  const isHeader = placement === 'header';

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
          className={cn(
            'absolute z-20 flex min-w-[148px] flex-col gap-0.5 rounded-xl border border-[#1E242B] bg-[#1A1F26] p-1 shadow-xl',
            isHeader ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2',
          )}
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
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-center text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40',
          isHeader
            ? 'rounded-lg p-2'
            : 'h-[42px] w-[42px] rounded-xl',
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
