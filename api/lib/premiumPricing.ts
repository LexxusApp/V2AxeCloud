import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_PRICE_FOUNDER_CENTS } from "../../lib/planPricing.js";
import { getFounderHouseStatusForLeader } from "./founderProgramAdmin.js";
import {
  formatAmountLabelFromCents,
  resolvePremiumAmountCents,
} from "./plansCatalog.js";

/** Valor em centavos para cobrança EFI — desconto fundador quando inscrição aceita. */
export async function resolveTenantPremiumAmountCents(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null
): Promise<number> {
  const id = String(tenantId || "").trim();
  if (id) {
    const founder = await getFounderHouseStatusForLeader(supabaseAdmin, id);
    if (founder.isFounderHouse) return PLAN_PRICE_FOUNDER_CENTS;
  }
  return resolvePremiumAmountCents(supabaseAdmin);
}

export async function resolveTenantPremiumAmountLabel(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null
): Promise<string> {
  const cents = await resolveTenantPremiumAmountCents(supabaseAdmin, tenantId);
  return formatAmountLabelFromCents(cents);
}
