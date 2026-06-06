import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_PRICE_STANDARD_CENTS, PLAN_PRICE_STANDARD_REAIS } from "../../lib/planPricing.js";
import { loadGlobalSettingPayload, saveGlobalSettingPayload } from "./globalSettings.js";

/**
 * Catálogo global de planos (global_settings.id = "plans").
 * O produto comercial tem apenas Premium (renovável) e Vita (vitalício).
 */
export type PlanCatalogEntry = {
  name: string;
  /** Preço em reais (ex.: 5 = R$ 5,00). */
  price: number;
  description: string;
  /** Opcional: valor em centavos (ex.: 500). Tem prioridade sobre `price` na cobrança EFI. */
  price_cents?: number;
};

export const PLANS_CATALOG_KEYS = ["premium", "vita"] as const;
export type PlanCatalogKey = (typeof PLANS_CATALOG_KEYS)[number];

/** Fallback de cobrança EFI quando o catálogo no banco não define preço. */
export const PREMIUM_CHECKOUT_FALLBACK_CENTS = PLAN_PRICE_STANDARD_CENTS;

/** Fallback de exibição no catálogo (UI) quando o banco não responde. */
export const PLANS_CATALOG_DEFAULT: Record<PlanCatalogKey, PlanCatalogEntry> = {
  premium: {
    name: "Premium",
    price: PLAN_PRICE_STANDARD_REAIS,
    description: "Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.",
  },
  vita: {
    name: "Plano Vita",
    price: 49.9,
    description: "Vitalício — acesso completo sem expiração.",
  },
};

function parseNumericField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mergeEntry(base: PlanCatalogEntry, src: Record<string, unknown> | null | undefined): PlanCatalogEntry {
  if (!src || typeof src !== "object") return base;
  const name = typeof src.name === "string" && src.name.trim() ? src.name.trim() : base.name;
  let price = base.price;
  const parsedPrice = parseNumericField(src.price);
  if (parsedPrice != null && parsedPrice > 0) price = parsedPrice;

  let price_cents = base.price_cents;
  const parsedCents = parseNumericField(src.price_cents);
  if (parsedCents != null && parsedCents > 0) price_cents = Math.round(parsedCents);

  const description =
    typeof src.description === "string" && src.description.trim() ? src.description.trim() : base.description;
  return { name, price, description, ...(price_cents != null ? { price_cents } : {}) };
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

export function formatAmountLabelFromCents(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  return `R$ ${(safe / 100).toFixed(2).replace(".", ",")}`;
}

function getPremiumRowFromRaw(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const row = raw.find((x: unknown) => {
      if (!x || typeof x !== "object") return false;
      const id = String((x as Record<string, unknown>).id || "").toLowerCase();
      return id === "premium";
    });
    return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
  }
  if (typeof raw === "object") {
    const premium = (raw as Record<string, unknown>).premium;
    if (premium && typeof premium === "object") return premium as Record<string, unknown>;
  }
  return null;
}

/** Lê centavos do payload real do Supabase (sem aplicar defaults de catálogo). */
export function extractPremiumAmountCentsFromPlansPayload(raw: unknown): number | null {
  const row = getPremiumRowFromRaw(raw);
  if (!row) return null;

  const centsField = parseNumericField(row.price_cents);
  if (centsField != null && centsField > 0) return Math.round(centsField);

  const priceReais = parseNumericField(row.price);
  if (priceReais != null && priceReais > 0) return planPriceToCents(priceReais);

  return null;
}

export function premiumEntryToAmountCents(entry: PlanCatalogEntry): number {
  if (typeof entry.price_cents === "number" && entry.price_cents > 0) {
    return Math.round(entry.price_cents);
  }
  return planPriceToCents(entry.price);
}

export type PlansCatalogLoadResult = {
  plans: Record<PlanCatalogKey, PlanCatalogEntry>;
  fromDatabase: boolean;
  updatedAt: string | null;
};

/** Lê catálogo de planos em global_settings (id = plans). */
export async function loadPlansCatalog(
  supabaseAdmin: SupabaseClient
): Promise<Record<PlanCatalogKey, PlanCatalogEntry>> {
  const loaded = await loadPlansCatalogWithMeta(supabaseAdmin);
  return loaded.plans;
}

export async function loadPlansCatalogWithMeta(
  supabaseAdmin: SupabaseClient
): Promise<PlansCatalogLoadResult> {
  const raw = await loadGlobalSettingPayload(supabaseAdmin, "plans");
  const { data: metaRow } = await supabaseAdmin
    .from("global_settings")
    .select("updated_at")
    .eq("id", "plans")
    .maybeSingle();

  const fromDatabase = raw != null;
  return {
    plans: normalizePlansCatalog(raw),
    fromDatabase,
    updatedAt: (metaRow as { updated_at?: string } | null)?.updated_at ?? null,
  };
}

/** Persiste catálogo — alterações no painel admin refletem no checkout EFI. */
export async function savePlansCatalog(
  supabaseAdmin: SupabaseClient,
  plans: Record<PlanCatalogKey, PlanCatalogEntry>
): Promise<void> {
  await saveGlobalSettingPayload(supabaseAdmin, "plans", plans);
}

/**
 * Valor em centavos para cobrança EFI (Pix/cartão) do plano Premium.
 * Ordem: global_settings.plans (premium.price / premium.price_cents) → EFI_PREMIUM_AMOUNT_CENTS → R$ 5,00.
 */
export async function resolvePremiumAmountCents(supabaseAdmin: SupabaseClient): Promise<number> {
  const raw = await loadGlobalSettingPayload(supabaseAdmin, "plans");
  const fromDb = extractPremiumAmountCentsFromPlansPayload(raw);
  if (fromDb != null && fromDb > 0) return fromDb;

  const envRaw = process.env.EFI_PREMIUM_AMOUNT_CENTS;
  if (envRaw != null && String(envRaw).trim() !== "") {
    const fromEnv = Number(envRaw);
    if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  }

  return PREMIUM_CHECKOUT_FALLBACK_CENTS;
}

export async function resolvePremiumAmountLabel(supabaseAdmin: SupabaseClient): Promise<string> {
  const cents = await resolvePremiumAmountCents(supabaseAdmin);
  return formatAmountLabelFromCents(cents);
}
