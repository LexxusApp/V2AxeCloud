import React, { useMemo, useState } from 'react';
import { cn } from '../lib/utils';

interface AvatarProps {
  /** URL da foto. Se ausente ou se falhar ao carregar, renderiza o fallback. */
  src?: string | null;
  /** Nome usado para gerar iniciais e cor determinística do fallback. */
  name?: string | null;
  /** Texto alternativo. Se omitido, usa `name`. */
  alt?: string;
  /** Classes extras aplicadas ao wrapper (controle de tamanho, borda, etc.). */
  className?: string;
  /** Forma do avatar. Padrão: 'circle'. */
  shape?: 'circle' | 'rounded' | 'square';
  /** Tamanho da fonte do fallback (Tailwind, ex.: 'text-sm'). Padrão: 'text-base'. */
  textSize?: string;
}

/** Paleta de cores escuras e suaves com bom contraste para texto branco/dourado. */
const PALETTE: ReadonlyArray<{ bg: string; ring: string }> = [
  { bg: 'bg-gradient-to-br from-amber-500 to-amber-700', ring: 'ring-amber-400/30' },
  { bg: 'bg-gradient-to-br from-rose-500 to-rose-700', ring: 'ring-rose-400/30' },
  { bg: 'bg-gradient-to-br from-violet-500 to-violet-700', ring: 'ring-violet-400/30' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', ring: 'ring-emerald-400/30' },
  { bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700', ring: 'ring-cyan-400/30' },
  { bg: 'bg-gradient-to-br from-fuchsia-500 to-fuchsia-700', ring: 'ring-fuchsia-400/30' },
  { bg: 'bg-gradient-to-br from-orange-500 to-orange-700', ring: 'ring-orange-400/30' },
  { bg: 'bg-gradient-to-br from-teal-500 to-teal-700', ring: 'ring-teal-400/30' },
  { bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', ring: 'ring-indigo-400/30' },
];

function pickPaletteIndex(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return idx;
}

function getInitials(name: string | null | undefined): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const first = parts[0];
    return first.slice(0, 2).toUpperCase();
  }
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return (first + last).toUpperCase();
}

/**
 * Considera URL "utilizável" só quando vem em http(s) ou data:. Strings vazias e literais
 * "null"/"undefined" caem no fallback de iniciais para evitar imagem quebrada na UI.
 */
function isUsableSrc(src: string | null | undefined): src is string {
  if (!src) return false;
  const s = String(src).trim();
  if (!s) return false;
  if (s === 'null' || s === 'undefined') return false;
  return /^(https?:|data:|blob:|\/)/i.test(s);
}

export function Avatar({
  src,
  name,
  alt,
  className,
  shape = 'circle',
  textSize = 'text-base',
}: AvatarProps) {
  const [errored, setErrored] = useState(false);

  const shapeClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'rounded'
      ? 'rounded-2xl'
      : 'rounded-md';

  const showImage = !errored && isUsableSrc(src);

  const palette = useMemo(() => {
    const seed = String(name || alt || 'sem-nome');
    return PALETTE[pickPaletteIndex(seed)] || PALETTE[0]!;
  }, [name, alt]);

  const initials = useMemo(() => getInitials(name || alt), [name, alt]);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden select-none',
        shapeClass,
        className
      )}
      aria-label={alt || name || 'Avatar'}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt || name || 'Avatar'}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center font-black text-white tracking-wider',
            palette.bg,
            textSize
          )}
        >
          <span aria-hidden="true">{initials}</span>
        </div>
      )}
    </div>
  );
}

export default Avatar;
