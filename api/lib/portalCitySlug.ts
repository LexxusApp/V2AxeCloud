/** Slug de cidade para URLs públicas: suzano-sp */
export function slugifyCity(city: string, state?: string | null): string {
  const c = String(city || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const uf = String(state || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 2);
  if (!c) return uf || "";
  return uf ? `${c}-${uf}` : c;
}

export function parseCitySlug(raw: string): { cityPart: string; state?: string } {
  const s = String(raw || "").trim().toLowerCase();
  const m = s.match(/^(.+)-([a-z]{2})$/);
  if (m) return { cityPart: m[1], state: m[2] };
  return { cityPart: s };
}
