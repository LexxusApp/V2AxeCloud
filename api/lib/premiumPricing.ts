import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAmountLabelFromCents,
  resolvePremiumAmountCents,
} from "./plansCatalog.js";

/** Valor em centavos para cobrança EFI (plano Premium padrão). */
export async function resolveTenantPremiumAmountCents(
  supabaseAdmin: SupabaseClient,
  _tenantId?: string | null
): Promise<number> {
  return resolvePremiumAmountCents(supabaseAdmin);
}

export async function resolveTenantPremiumAmountLabel(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null
): Promise<string> {
  const cents = await resolveTenantPremiumAmountCents(supabaseAdmin, tenantId);
  return formatAmountLabelFromCents(cents);
}
