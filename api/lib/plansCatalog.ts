import type { SupabaseClient } from "@supabase/supabase-js";
import { loadGlobalSettingPayload, saveGlobalSettingPayload } from "./globalSettings.js";

/**
 * Catálogo global de planos (global_settings.id = "plans").
 * O produto comercial tem apenas Premium (renovável) e Vita (vitalício).
 */
export type PlanCatalogEntry = { name: string; price: number; description: string };

export const PLANS_CATALOG_KEYS = ["premium", "vita"] as const;
export type PlanCatalogKey = (typeof PLANS_CATALOG_KEYS)[number];

/** Fallback quando o banco não responde — alinhado ao preço comercial Premium (R$ 89,90). */
export const PLANS_CATALOG_DEFAULT: Record<PlanCatalogKey, PlanCatalogEntry> = {
  premium: {
    name: "Premium",
    price: 89.9,
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
  let price = base.price;
  if (typeof src.price === "number" && Number.isFinite(src.price)) {
    price = src.price;
  } else if (typeof src.price === "string" && src.price.trim()) {
    const parsed = Number(src.price.trim().replace(",", "."));
    if (Number.isFinite(parsed)) price = parsed;
  }
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

export function planPriceToCents(priceReais: number): number {
  const n = Number(priceReais);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** Lê catálogo de planos em global_settings (id = plans). */
export async function loadPlansCatalog(
  supabaseAdmin: SupabaseClient
): Promise<Record<PlanCatalogKey, PlanCatalogEntry>> {
  const raw = await loadGlobalSettingPayload(supabaseAdmin, "plans");
  return normalizePlansCatalog(raw);
}

/** Persiste catálogo — alterações no painel admin refletem no checkout EFI. */
export async function savePlansCatalog(
  supabaseAdmin: SupabaseClient,
  plans: Record<PlanCatalogKey, PlanCatalogEntry>
): Promise<void> {
  await saveGlobalSettingPayload(supabaseAdmin, "plans", plans);
}

/** Valor em centavos para cobrança EFI (Pix/cartão) do plano Premium. */
export async function resolvePremiumAmountCents(supabaseAdmin: SupabaseClient): Promise<number> {
  const plans = await loadPlansCatalog(supabaseAdmin);
  const fromCatalog = planPriceToCents(plans.premium.price);
  if (fromCatalog > 0) return fromCatalog;

  const fromEnv = Number(process.env.EFI_PREMIUM_AMOUNT_CENTS || "8990");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);

  return planPriceToCents(PLANS_CATALOG_DEFAULT.premium.price);
}
