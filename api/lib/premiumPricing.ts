import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAmountLabelFromCents,
  normalizeBillingCycle,
  resolvePremiumBillingAmountCents,
  type BillingCycle,
} from "./plansCatalog.js";

/** Conta de teste do Lucas — PIX mensal de R$ 15. Demais clientes seguem o catálogo. */
export const CHECKOUT_TEST_EMAIL = "testeanual@axecloud.com";
export const CHECKOUT_TEST_MONTHLY_CENTS = 1500;

export function checkoutTestOverrideCents(opts: {
  billingCycle: BillingCycle;
  email?: string | null;
}): number | null {
  if (normalizeBillingCycle(opts.billingCycle) !== "monthly") return null;
  const email = String(opts.email || "").trim().toLowerCase();
  if (email === CHECKOUT_TEST_EMAIL) return CHECKOUT_TEST_MONTHLY_CENTS;
  return null;
}

async function loadTenantCheckoutEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string
): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("perfil_lider")
    .select("email")
    .eq("id", tenantId)
    .maybeSingle();
  const profileEmail = String(profile?.email || "").trim().toLowerCase();
  if (profileEmail) return profileEmail;

  const authUser = await supabaseAdmin.auth.admin.getUserById(tenantId).catch(() => null);
  return String(authUser?.data?.user?.email || "").trim().toLowerCase();
}

/** Valor em centavos para cobrança EFI (plano Premium padrão). */
export async function resolveTenantPremiumAmountCents(
  supabaseAdmin: SupabaseClient,
  tenantId?: string | null,
  billingCycle: BillingCycle = "monthly"
): Promise<number> {
  const cycle = normalizeBillingCycle(billingCycle);
  const tid = String(tenantId || "").trim();
  if (tid && cycle === "monthly") {
    const email = await loadTenantCheckoutEmail(supabaseAdmin, tid);
    const override = checkoutTestOverrideCents({ billingCycle: cycle, email });
    if (override != null) return override;
  }

  return resolvePremiumBillingAmountCents(supabaseAdmin, cycle);
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
