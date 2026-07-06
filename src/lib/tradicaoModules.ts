export type TradicaoSlug = 'umbanda' | 'candomble' | 'jurema' | 'mista' | 'outra';

export function normalizeTradicao(raw?: string | null): TradicaoSlug {
  const t = String(raw || 'mista').toLowerCase().trim();
  if (t === 'umbanda' || t === 'candomble' || t === 'jurema' || t === 'mista' || t === 'outra') return t;
  return 'mista';
}

/** Módulos extras visíveis conforme a tradição configurada na casa. */
export function showAtendimentosModule(tradicao?: string | null): boolean {
  const t = normalizeTradicao(tradicao);
  return t === 'candomble' || t === 'jurema' || t === 'mista' || t === 'outra';
}

export const TRADICAO_OPTIONS = [
  { value: 'umbanda', label: 'Umbanda' },
  { value: 'candomble', label: 'Candomblé' },
  { value: 'jurema', label: 'Jurema' },
  { value: 'mista', label: 'Tradição mista' },
  { value: 'outra', label: 'Outra' },
] as const;
