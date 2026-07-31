import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAmountLabelFromCents,
  normalizeBillingCycle,
  resolvePremiumBillingAmountCents,
  type BillingCycle,
} from "./plansCatalog.js";

/** Valor em centavos para cobrança EFI (plano Premium padrão). */
export async function resolveTenantPremiumAmountCents(
  supabaseAdmin: SupabaseClient,
  _tenantId?: string | null,
  billingCycle: BillingCycle = "monthly"
): Promise<number> {
  return resolvePremiumBillingAmountCents(
    supabaseAdmin,
    normalizeBillingCycle(billingCycle)
  );
}

export async function resolveTenantPremiumAmountLabel(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null,
  billingCycle: BillingCycle = "monthly"
): Promise<string> {
  const cents = await resolveTenantPremiumAmountCents(
    supabaseAdmin,
    tenantId,
    billingCycle
  );
  return formatAmountLabelFromCents(cents);
}
