/** Regras compartilhadas de qualidade para páginas públicas do diretório. */

export type DiretorioQualityInput = {
  nome?: unknown;
  slug?: unknown;
  cidade?: unknown;
  estado?: unknown;
  endereco?: unknown;
  link_maps?: unknown;
  linkMaps?: unknown;
};

const AXE_CONTEXT_RE =
  /\b(umbanda|candomble|quimbanda|terreiro|tenda|jurema|afro|orixa|caboclo|exu|vodun|nago|axe|ase|ile)\b/i;

const CLEARLY_OUT_OF_SCOPE_RE =
  /\b(racionalismo\s+cristao|allan?\s+kardec|kardecista|paroquia|catolic|evangelic|adventista|igreja\s+sant[ao]|igreja\s+universal|testemunhas?\s+de\s+jeova|ministerio\s+extrema|projeto\s+refugio)\b/i;

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isValidDiretorioName(value: unknown): boolean {
  const nome = String(value || '').trim();
  const meaningful = nome.replace(/[^\p{L}\p{N}]/gu, '');
  return meaningful.length >= 3;
}

export function isClearlyOutsideDiretorioScope(value: unknown): boolean {
  const nome = normalize(value);
  return CLEARLY_OUT_OF_SCOPE_RE.test(nome) && !AXE_CONTEXT_RE.test(nome);
}

/**
 * Evita publicar/indexar registros quebrados ou claramente fora do foco.
 * Registros incompletos, mas plausíveis, continuam visíveis para poderem ser reivindicados.
 */
export function isDiretorioListingPublishable(row: DiretorioQualityInput): boolean {
  const slug = String(row.slug || '').trim();
  const cidade = String(row.cidade || '').trim();
  const estado = String(row.estado || '').trim();
  const endereco = String(row.endereco || '').trim();
  const linkMaps = String(row.link_maps || row.linkMaps || '').trim();

  return Boolean(
    slug &&
      cidade &&
      estado &&
      (endereco || linkMaps) &&
      isValidDiretorioName(row.nome) &&
      !isClearlyOutsideDiretorioScope(row.nome),
  );
}
