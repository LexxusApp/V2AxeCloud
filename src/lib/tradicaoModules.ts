export type TradicaoSlug = 'umbanda' | 'candomble' | 'jurema' | 'mista' | 'outra';

/**
 * Área antiga de pedidos de reza pausada enquanto o novo fluxo de
 * atendimentos é consolidado dentro de Rotinas da casa.
 */
export const PEDIDOS_REZA_MODULE_ENABLED = false;

export function normalizeTradicao(raw?: string | null): TradicaoSlug {
  const t = String(raw || 'mista').toLowerCase().trim();
  if (t === 'umbanda' || t === 'candomble' || t === 'jurema' || t === 'mista' || t === 'outra') return t;
  return 'mista';
}

/** Módulos extras visíveis conforme a tradição configurada na casa. */
export function showAtendimentosModule(tradicao?: string | null): boolean {
  if (!PEDIDOS_REZA_MODULE_ENABLED) return false;
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
