/**
 * Catálogo global de planos (global_settings.id = "plans").
 * O produto comercial tem apenas Premium (renovável) e Vita (vitalício).
 */
export type PlanCatalogEntry = { name: string; price: number; description: string };

export const PLANS_CATALOG_KEYS = ["premium", "vita"] as const;
export type PlanCatalogKey = (typeof PLANS_CATALOG_KEYS)[number];

export const PLANS_CATALOG_DEFAULT: Record<PlanCatalogKey, PlanCatalogEntry> = {
  premium: {
    name: "Premium",
    price: 149.9,
    description: "Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.",
  },
  vita: {
    name: "Plano Vita",
    price: 49.9,
    description: "Vitalício — acesso completo sem expiração.",
  },
};

function mergeEntry(base: PlanCatalogEntry, src: Record<string, unknown> | null | undefined): PlanCatalogEntry {
  if (!src || typeof src !== "object") return base;
  const name = typeof src.name === "string" && src.name.trim() ? src.name.trim() : base.name;
  const price = typeof src.price === "number" && Number.isFinite(src.price) ? src.price : base.price;
  const description =
    typeof src.description === "string" && src.description.trim() ? src.description.trim() : base.description;
  return { name, price, description };
}

/** Aceita objecto `{ premium, vita }` ou legado em array `[{ id: "premium", ... }]`. Ignora outros planos. */
export function normalizePlansCatalog(raw: unknown): Record<PlanCatalogKey, PlanCatalogEntry> {
  const out: Record<PlanCatalogKey, PlanCatalogEntry> = {
    premium: { ...PLANS_CATALOG_DEFAULT.premium },
    vita: { ...PLANS_CATALOG_DEFAULT.vita },
  };
  if (raw == null) return out;

  if (Array.isArray(raw)) {
    for (const key of PLANS_CATALOG_KEYS) {
      const row = raw.find((x: unknown) => {
        if (!x || typeof x !== "object") return false;
        const id = String((x as Record<string, unknown>).id || "").toLowerCase();
        return id === key;
      }) as Record<string, unknown> | undefined;
      if (row) out[key] = mergeEntry(out[key], row);
    }
    return out;
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of PLANS_CATALOG_KEYS) {
      const row = o[key];
      if (row && typeof row === "object") out[key] = mergeEntry(out[key], row as Record<string, unknown>);
    }
  }
  return out;
}
