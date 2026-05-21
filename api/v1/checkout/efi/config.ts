/**
 * GET /api/v1/checkout/efi/config — preço Premium do banco (global_settings.plans).
 */
import { applyDiscreteRouteCors } from "../../../lib/corsOrigins.js";
import { getDiscreteSupabaseAdmin, sendJson } from "../../../lib/discreteSupabase.js";
import { getSupabaseProjectRef, getSupabaseServerUrl } from "../../../lib/supabaseServerEnv.js";
import { formatAmountLabelFromCents } from "../../../lib/plansCatalog.js";
import { resolveEfiEnv, resolveEfiPayeeCode } from "../../../lib/efiPay.js";
import { getEfiPixSetupDiagnostics, resolveEfiPixEnv } from "../../../lib/efiPixApi.js";
import { EFI_CARD_CHECKOUT_ENABLED } from "../../../../lib/checkoutPaymentMethods.js";
import { resolvePremiumOnboardingAmountCents } from "../../../lib/tenantOnboarding.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const efi = resolveEfiEnv();
  if (!efi) {
    return sendJson(res, 503, { error: "EFI Cobranças não configurado." });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  try {
    const pix = resolveEfiPixEnv();
    const payeeCode = resolveEfiPayeeCode();
    const amountCents = await resolvePremiumOnboardingAmountCents(sb);
    const pixDiagnostics = pix ? undefined : getEfiPixSetupDiagnostics();

    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    return sendJson(res, 200, {
      sandbox: efi.sandbox,
      payeeCode: payeeCode || null,
      amountCents,
      amountLabel: formatAmountLabelFromCents(amountCents),
      projectRef: getSupabaseProjectRef(getSupabaseServerUrl()),
      pixAvailable: !!pix,
      cardAvailable: EFI_CARD_CHECKOUT_ENABLED,
      cardTokenizationReady: EFI_CARD_CHECKOUT_ENABLED && !!payeeCode,
      ...(pixDiagnostics ? { pixSetup: pixDiagnostics } : {}),
      ...(EFI_CARD_CHECKOUT_ENABLED && !payeeCode
        ? {
            cardSetup: {
              issues: [
                "Defina EFI_PAYEE_CODE na Vercel (painel Efí → API → Introdução → Identificador de conta).",
              ],
            },
          }
        : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar configuração de checkout";
    console.error("[checkout/efi/config]", msg);
    return sendJson(res, 500, { error: msg });
  }
}
