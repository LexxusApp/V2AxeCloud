import {
  hasAxeContextInName,
  isDiretorioListingIndexable,
  isDiretorioPriorityIndexSlug,
  type DiretorioQualityInput,
} from "./diretorioQuality.ts";

export const SEO_PRIORITY_PROFILE_LIMIT = 4000;
export const SEO_PRIORITY_CITY_MIN_PROFILES = 3;

export type DiretorioSeoPriorityInput = DiretorioQualityInput & {
  cidadeSlug?: unknown;
  gerenciada?: unknown;
  descricao?: unknown;
  instagramUrl?: unknown;
  horariosGira?: unknown;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function cityKey(row: DiretorioSeoPriorityInput): string {
  const estado = text(row.estado).toLowerCase();
  const cidadeSlug = text(row.cidadeSlug);
  return estado && cidadeSlug ? `${estado}:${cidadeSlug}` : "";
}

function hasSchedule(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(text(value));
}

export function diretorioSeoPriorityScore(
  row: DiretorioSeoPriorityInput,
  citySize = 1,
): number {
  let score = 0;

  if (isDiretorioPriorityIndexSlug(row.slug)) score += 1000;
  if (Boolean(row.gerenciada)) score += 220;
  if (Boolean(row.verified_at || row.verificada)) score += 160;

  const descricao = text(row.descricao);
  if (descricao.length >= 120) score += 110;
  else if (descricao.length >= 60) score += 75;
  else if (descricao.length >= 20) score += 35;

  if (text(row.telefone).replace(/\D/g, "").length >= 8) score += 35;
  if (text(row.instagramUrl)) score += 24;
  if (hasSchedule(row.horariosGira)) score += 28;
  if (text(row.foto_url || row.fotoUrl || row.owner_photo_url)) score += 18;
  if (text(row.link_maps || row.linkMaps)) score += 18;

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) score += 12;
  if (hasAxeContextInName(row.nome)) score += 24;

  const normalizedCitySize = Math.max(1, Number(citySize) || 1);
  score += Math.min(50, Math.floor(Math.log2(normalizedCitySize + 1) * 10));

  return score;
}

function byPriority<T extends DiretorioSeoPriorityInput>(
  a: T,
  b: T,
  citySizes: Map<string, number>,
): number {
  const scoreB = diretorioSeoPriorityScore(b, citySizes.get(cityKey(b)) || 1);
  const scoreA = diretorioSeoPriorityScore(a, citySizes.get(cityKey(a)) || 1);
  if (scoreA !== scoreB) return scoreB - scoreA;
  return text(a.slug).localeCompare(text(b.slug), "pt-BR");
}

export function selectDiretorioSeoPriorityProfiles<T extends DiretorioSeoPriorityInput>(
  rows: T[],
  options?: {
    limit?: number;
    minCityProfiles?: number;
  },
): Set<string> {
  const limit = Math.max(1, Math.floor(options?.limit || SEO_PRIORITY_PROFILE_LIMIT));
  const minCityProfiles = Math.max(2, Math.floor(options?.minCityProfiles || SEO_PRIORITY_CITY_MIN_PROFILES));
  const eligible = rows.filter((row) => text(row.slug) && isDiretorioListingIndexable(row));

  const groups = new Map<string, T[]>();
  for (const row of eligible) {
    const key = cityKey(row);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const citySizes = new Map([...groups.entries()].map(([key, items]) => [key, items.length]));

  const selected = new Set<string>();
  const add = (row: T | undefined) => {
    const slug = text(row?.slug);
    if (slug) selected.add(slug);
  };

  // Nunca perde perfis oficialmente conectados/verificados nem exceções editoriais.
  for (const row of eligible) {
    if (
      isDiretorioPriorityIndexSlug(row.slug) ||
      Boolean(row.gerenciada) ||
      Boolean(row.verified_at || row.verificada)
    ) {
      add(row);
    }
  }

  // Dá cobertura nacional mínima às cidades com massa crítica.
  for (const items of groups.values()) {
    if (items.length < minCityProfiles) continue;
    add([...items].sort((a, b) => byPriority(a, b, citySizes))[0]);
  }

  // Completa a primeira leva com os perfis mais ricos e mais conectados.
  for (const row of [...eligible].sort((a, b) => byPriority(a, b, citySizes))) {
    if (selected.size >= limit) break;
    add(row);
  }

  return selected;
}

export function isDiretorioSeoPriorityCity<T extends DiretorioSeoPriorityInput>(
  items: T[],
  prioritySlugs: Set<string>,
  minProfiles = SEO_PRIORITY_CITY_MIN_PROFILES,
): boolean {
  const eligible = items.filter((row) => isDiretorioListingIndexable(row));
  return (
    eligible.length >= minProfiles ||
    eligible.some((row) => prioritySlugs.has(text(row.slug)))
  );
}
