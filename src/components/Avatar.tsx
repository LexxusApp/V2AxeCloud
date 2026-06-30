import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '../lib/utils';

interface AvatarProps {
  /** URL da foto. Se ausente ou se falhar ao carregar, renderiza avatar ilustrado. */
  src?: string | null;
  /** Nome usado como seed do avatar gerado (determinístico por pessoa). */
  name?: string | null;
  /** Texto alternativo. Se omitido, usa `name`. */
  alt?: string;
  /** Classes extras aplicadas ao wrapper (controle de tamanho, borda, etc.). */
  className?: string;
  /** Forma do avatar. Padrão: 'circle'. */
  shape?: 'circle' | 'rounded' | 'square';
  /** @deprecated Mantido por compatibilidade; o fallback agora é ilustração, não iniciais. */
  textSize?: string;
}

const DICEBEAR_STYLE = 'avataaars';

const FALLBACK_BG_COLORS = ['b6e3f4', 'c0aede', 'ffd5dc', 'ffdfbf', 'd1d4f4', 'c4f0e8'] as const;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** URL de avatar ilustrado (boneco) gerado a partir do nome — mesmo nome, mesmo personagem. */
export function buildGeneratedAvatarUrl(name: string | null | undefined): string {
  const seed = String(name || 'sem-nome').trim() || 'sem-nome';
  const bg = FALLBACK_BG_COLORS[hashSeed(seed) % FALLBACK_BG_COLORS.length];
  return `https://api.dicebear.com/7.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
}

/**
 * Considera URL "utilizável" só quando vem em http(s) ou data:. Strings vazias e literais
 * "null"/"undefined" caem no avatar ilustrado para evitar imagem quebrada na UI.
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
}: AvatarProps) {
  const [photoErrored, setPhotoErrored] = useState(false);
  const [generatedErrored, setGeneratedErrored] = useState(false);

  const label = alt || name || 'Avatar';
  const generatedUrl = useMemo(() => buildGeneratedAvatarUrl(name || alt), [name, alt]);

  useEffect(() => {
    setPhotoErrored(false);
    setGeneratedErrored(false);
  }, [src, name, alt]);

  const shapeClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'rounded'
        ? 'rounded-2xl'
        : 'rounded-md';

  const showPhoto = !photoErrored && isUsableSrc(src);

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden select-none bg-[#1A1F26]',
        shapeClass,
        className,
      )}
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={src as string}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setPhotoErrored(true)}
          draggable={false}
        />
      ) : !generatedErrored ? (
        <img
          src={generatedUrl}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setGeneratedErrored(true)}
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#1E242B] text-[#64748B]">
          <User className="h-[45%] w-[45%]" aria-hidden />
        </div>
      )}
    </div>
  );
}

export default Avatar;
