/** Slug para URLs do diretório SEO (/terreiro/:slug, /terreiros/:uf/:cidade). */

export function slugifyDiretorioText(raw: string, maxLen = 80): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

export function slugifyTerreiroNome(nome: string): string {
  const base = slugifyDiretorioText(nome, 80);
  return base || "terreiro";
}

export function slugifyCidadeOnly(cidade: string): string {
  return slugifyDiretorioText(cidade, 60) || "cidade";
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

export function parseDiretorioCityRoute(estado: string, cidadeSlug: string): {
  estado: string;
  cidadeSlug: string;
} | null {
  const uf = String(estado || "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  const city = slugifyDiretorioText(cidadeSlug, 60);
  if (!city || !isValidDiretorioUf(uf)) return null;
  return { estado: uf, cidadeSlug: city };
}

const VALID_UF = new Set([
  "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr",
  "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to", "br",
]);

export function isValidDiretorioUf(uf: string): boolean {
  return VALID_UF.has(String(uf || "").trim().toLowerCase());
}

/** Gera slug único entre os já usados (ex.: nome, nome-2). */
export function uniqueTerreiroSlug(base: string, used: Set<string>): string {
  let slug = slugifyTerreiroNome(base);
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n += 1;
  const finalSlug = `${slug}-${n}`;
  used.add(finalSlug);
  return finalSlug;
}
