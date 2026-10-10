import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAmountLabelFromCents,
  normalizeBillingCycle,
  resolvePremiumBillingAmountCents,
  type BillingCycle,
} from "./plansCatalog.js";

/** Contas de teste do Lucas — PIX mensal de R$ 6,00. Demais clientes seguem o catálogo. */
export const CHECKOUT_TEST_EMAILS = new Set([
  "testeanual@axecloud.com",
  "vendasmercadolivrev1@gmail.com",
]);
export const CHECKOUT_TEST_TENANT_IDS = new Set([
  "4b167a21-d208-4f36-8b97-692f9c8e44a3",
  "a9da71de-3b31-482f-ad60-e0154b17721d",
]);
export const CHECKOUT_TEST_MONTHLY_CENTS = 600; // R$ 6,00 exclusivo para teste do Lucas

export function checkoutTestOverrideCents(opts: {
  billingCycle: BillingCycle;
  email?: string | null;
  tenantId?: string | null;
}): number | null {
  if (normalizeBillingCycle(opts.billingCycle) !== "monthly") return null;
  const email = String(opts.email || "").trim().toLowerCase();
  const tid = String(opts.tenantId || "").trim();
  if (CHECKOUT_TEST_EMAILS.has(email) || CHECKOUT_TEST_TENANT_IDS.has(tid)) {
    return CHECKOUT_TEST_MONTHLY_CENTS;
  }
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
    const override = checkoutTestOverrideCents({ billingCycle: cycle, email, tenantId: tid });
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
