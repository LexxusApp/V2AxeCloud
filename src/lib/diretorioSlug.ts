/** Slug para URLs do diretório SEO — espelho de api/lib/diretorioSlug.ts */

export function slugifyDiretorioText(raw: string, maxLen = 80): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

export function diretorioCityPath(estado: string | null | undefined, cidadeSlug: string): string {
  const uf = String(estado || "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  const city = slugifyDiretorioText(cidadeSlug, 60);
  return uf ? `/terreiros/${uf}/${city}` : `/terreiros/br/${city}`;
}

export function diretorioTerreiroPath(slug: string): string {
  return `/terreiro/${encodeURIComponent(slugifyDiretorioText(slug, 80))}`;
}

const VALID_UF = new Set([
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr',
  'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to', 'br',
]);

export function isValidDiretorioUf(uf: string): boolean {
  return VALID_UF.has(String(uf || '').trim().toLowerCase());
}
