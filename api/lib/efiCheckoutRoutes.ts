import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import {
  efiCreateCardSubscriptionOneStep,
  efiGetCharge,
  efiGetSubscription,
  resolveEfiEnv,
  resolveEfiPayeeCode,
} from "./efiPay.js";
import {
  EFI_CARD_PIX_FALLBACK_MESSAGE,
  isEfiCardProcessingFailure,
} from "../../lib/efiCardCheckoutError.js";
import { EFI_CARD_CHECKOUT_ENABLED } from "../../lib/checkoutPaymentMethods.js";
import {
  efiPixCreateImmediateCharge,
  efiPixGetCob,
  getEfiPixSetupDiagnostics,
  resolveEfiPixEnv,
} from "./efiPixApi.js";
import { formatAmountLabelFromCents } from "./plansCatalog.js";
import {
  activateTenantSubscription,
  efiNotificationUrl,
  resolvePremiumOnboardingAmountCents,
} from "./tenantOnboarding.js";
import {
  ensurePendingSubscriptionRow,
  updateSubscriptionResilient,
} from "./subscriptionDb.js";
import { checkoutRateLimit, apiReadRateLimit } from "./rateLimit.js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";
import { verifyUser } from "./verifyUser.js";
import { getBearerToken } from "./requireAuth.js";
import { assertUserCanAccessTenant } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

async function resolveTenantFromAuth(
  supabaseAdmin: SupabaseClient,
  req: Request,
  bodyTenantId?: string
): Promise<{ tenantId: string; email: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const { user, error } = await verifyUser(supabaseAdmin, token);
  if (error || !user) return null;

  const requested = String(req.query.tenantId || bodyTenantId || user.id).trim();
  const ok = await assertUserCanAccessTenant(supabaseAdmin, user, requested);
  if (!ok) return null;

  return { tenantId: requested, email: user.email || "" };
}

async function assertPendingSubscription(
  supabaseAdmin: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await ensurePendingSubscriptionRow(supabaseAdmin, tenantId);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, expires_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (isSubscriptionAccessActive(sub)) {
    return { ok: false, status: 200, error: "already_active" };
  }
  return { ok: true };
}

export function registerEfiCheckoutRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.get("/api/v1/checkout/efi/config", apiReadRateLimit, async (req: Request, res: Response) => {
    const efi = resolveEfiEnv();
    const pix = resolveEfiPixEnv();
    const payeeCode = resolveEfiPayeeCode();

    if (!efi) {
      return res.status(503).json({ error: "EFI Cobranças não configurado." });
    }

    res.setHeader("Cache-Control", "private, no-store, must-revalidate");

    const tenant = await resolveTenantFromAuth(supabaseAdmin, req);
    const amountCents = await resolvePremiumOnboardingAmountCents(
      supabaseAdmin,
      tenant?.tenantId
    );
    const publicConfig = {
      amountCents,
      amountLabel: formatAmountLabelFromCents(amountCents),
      pixAvailable: !!pix,
      cardAvailable: EFI_CARD_CHECKOUT_ENABLED,
      cardTokenizationReady: EFI_CARD_CHECKOUT_ENABLED && !!payeeCode,
    };

    if (!tenant) {
      return res.json(publicConfig);
    }

    const pixDiagnostics = pix ? undefined : getEfiPixSetupDiagnostics();
    res.json({
      ...publicConfig,
      sandbox: efi.sandbox,
      payeeCode: payeeCode || null,
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
  });

  app.get("/api/v1/checkout/efi/context", async (req: Request, res: Response) => {
    const tenant = await resolveTenantFromAuth(supabaseAdmin, req);
    if (!tenant) return res.status(401).json({ error: "Não autorizado" });

    const { data: profile } = await supabaseAdmin
      .from("perfil_lider")
      .select("nome_terreiro, cargo, email")
      .eq("id", tenant.tenantId)
      .maybeSingle();

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status, efi_charge_id, efi_pix_txid, efi_subscription_id")
      .eq("id", tenant.tenantId)
      .maybeSingle();

    res.json({
      tenantId: tenant.tenantId,
      email: profile?.email || tenant.email,
      nomeTerreiro: profile?.nome_terreiro || "",
      nomeZelador: profile?.cargo || "",
      subscriptionStatus: sub?.status || "pending",
      active: sub?.status === "active",
      efiPixTxid: sub?.efi_pix_txid || null,
      efiSubscriptionId: sub?.efi_subscription_id || null,
    });
  });

  app.post("/api/v1/checkout/efi/pix", checkoutRateLimit, async (req: Request, res: Response) => {
    try {
      const pixEnv = resolveEfiPixEnv();
      if (!pixEnv) {
        return res.status(503).json({
          error:
            "PIX indisponível. Configure EFI_PIX_KEY e o certificado (.p12) em EFI_PIX_CERT_BASE64 ou EFI_PIX_CERT_PATH.",
        });
      }

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req, req.body?.tenantId);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });

      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId);
      if (pending.ok === false) {
        if (pending.error === "already_active") {
          return res.json({
            alreadyActive: true,
            message: "Assinatura já está ativa. Acesse o painel.",
          });
        }
        return res.status(pending.status).json({ error: pending.error });
      }

      const { data: profile } = await supabaseAdmin
        .from("perfil_lider")
        .select("nome_terreiro, cargo, email")
        .eq("id", tenant.tenantId)
        .maybeSingle();

      const payerName = String(req.body?.payerName || profile?.cargo || profile?.nome_terreiro || "Cliente").trim();
      const payerCpf = String(req.body?.cpf || "").trim();

      const amountCents = await resolvePremiumOnboardingAmountCents(supabaseAdmin, tenant.tenantId);
      const charge = await efiPixCreateImmediateCharge(pixEnv, {
        tenantId: tenant.tenantId,
        amountCents,
        payerName,
        payerCpf: payerCpf || undefined,
        description: `AxéCloud Premium — ${profile?.nome_terreiro || "Terreiro"}`,
      });

      const qrCodeDataUrl = await QRCode.toDataURL(charge.copyPaste, {
        margin: 2,
        width: 280,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const { error: subUpErr } = await updateSubscriptionResilient(supabaseAdmin, tenant.tenantId, {
        efi_pix_txid: charge.txid,
        efi_charge_id: `pix:${charge.txid}`,
        payment_provider: "efi_pix",
        status: "pending",
        updated_at: new Date().toISOString(),
      });
      if (subUpErr) {
        console.error("[checkout/pix] subscription update:", subUpErr.message);
      }

      if (!charge.copyPaste?.trim()) {
        return res.status(502).json({ error: "EFI Pix: código copia e cola ausente na resposta." });
      }

      res.json({
        txid: charge.txid,
        copyPaste: charge.copyPaste,
        qrCodeDataUrl,
        status: charge.status,
        expiresIn: 3600,
      });
    } catch (err: any) {
      console.error("[checkout/pix]", err?.response?.data || err?.message || err);
      res.status(500).json({
        error: safeErrorMessage(err, "Erro ao gerar PIX."),
      });
    }
  });

  app.get("/api/v1/checkout/efi/pix/:txid/status", async (req: Request, res: Response) => {
    try {
      const pixEnv = resolveEfiPixEnv();
      if (!pixEnv) return res.status(503).json({ error: "PIX não configurado." });

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });

      const txid = String(req.params.txid || "").trim();
      if (!txid) return res.status(400).json({ error: "txid obrigatório" });

      const { data: subRow } = await supabaseAdmin
        .from("subscriptions")
        .select("efi_pix_txid")
        .eq("id", tenant.tenantId)
        .maybeSingle();

      if (!subRow?.efi_pix_txid || String(subRow.efi_pix_txid) !== txid) {
        return res.status(403).json({ error: "Cobrança não pertence a esta conta." });
      }

      const cob = await efiPixGetCob(pixEnv, txid);

      if (cob.paid) {
        await activateTenantSubscription(supabaseAdmin, tenant.tenantId, {
          provider: "efi_pix",
        });
        return res.json({ status: cob.status, paid: true, active: true });
      }

      res.json({ status: cob.status, paid: false, active: false });
    } catch (err: any) {
      console.error("[checkout/pix/status]", err?.message || err);
      res.status(500).json({ error: safeErrorMessage(err, "Erro ao consultar PIX.") });
    }
  });

  app.post("/api/v1/checkout/efi/card", checkoutRateLimit, async (req: Request, res: Response) => {
    if (!EFI_CARD_CHECKOUT_ENABLED) {
      return res.status(403).json({
        error: "Pagamento com cartão está desativado. Utilize PIX para ativar sua assinatura.",
        suggestPix: true,
      });
    }
    try {
      const efi = resolveEfiEnv();
      if (!efi) return res.status(503).json({ error: "EFI não configurado." });

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req, req.body?.tenantId);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });

      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId);
      if (pending.ok === false) {
        if (pending.error === "already_active") {
          return res.json({
            alreadyActive: true,
            message: "Assinatura já está ativa. Acesse o painel.",
          });
        }
        return res.status(pending.status).json({ error: pending.error });
      }

      const paymentToken = String(req.body?.payment_token || "").trim();
      if (!paymentToken) {
        return res.status(400).json({ error: "payment_token obrigatório." });
      }

      const customer = req.body?.customer || {};
      const billing = req.body?.billing_address || req.body?.billingAddress || {};

      const cpf = String(customer.cpf || "").replace(/\D/g, "");
      if (cpf.length !== 11) {
        return res.status(400).json({ error: "CPF do titular inválido (11 dígitos)." });
      }

      const zipcode = String(billing.zipcode || "").replace(/\D/g, "");
      if (zipcode.length !== 8) {
        return res.status(400).json({ error: "CEP inválido." });
      }

      const { data: profile } = await supabaseAdmin
        .from("perfil_lider")
        .select("nome_terreiro, cargo, email")
        .eq("id", tenant.tenantId)
        .maybeSingle();

      const nome = String(customer.name || profile?.cargo || profile?.nome_terreiro || "Cliente").trim();
      const email = String(customer.email || profile?.email || tenant.email).trim();

      const amountCents = await resolvePremiumOnboardingAmountCents(supabaseAdmin, tenant.tenantId);
      const result = await efiCreateCardSubscriptionOneStep(efi, {
        tenantId: tenant.tenantId,
        email,
        nome,
        cpf,
        phoneNumber: String(customer.phone_number || customer.phone || ""),
        paymentToken,
        amountCents,
        notificationUrl: efiNotificationUrl(),
        billingAddress: {
          street: String(billing.street || "").trim(),
          number: String(billing.number || "S/N").trim(),
          neighborhood: String(billing.neighborhood || "").trim(),
          zipcode,
          city: String(billing.city || "").trim(),
          state: String(billing.state || "").trim(),
          complement: String(billing.complement || "").trim(),
        },
      });

      await supabaseAdmin
        .from("subscriptions")
        .update({
          efi_subscription_id: String(result.subscriptionId),
          efi_charge_id: result.chargeId ? String(result.chargeId) : null,
          payment_provider: "efi_card",
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.tenantId);

      let active = result.status.toLowerCase() === "active";

      if (result.chargeId) {
        const charge = await efiGetCharge(efi, result.chargeId);
        if (charge.paid) active = true;
      }

      if (!active) {
        const sub = await efiGetSubscription(efi, result.subscriptionId);
        active = sub.active;
      }

      if (active) {
        await activateTenantSubscription(supabaseAdmin, tenant.tenantId, {
          chargeId: result.chargeId,
          provider: "efi_card",
        });
      }

      res.json({
        subscriptionId: result.subscriptionId,
        chargeId: result.chargeId,
        status: result.status,
        active,
      });
    } catch (err: unknown) {
      console.error("[checkout/card]", (err as { response?: { data?: unknown } })?.response?.data || err);
      const httpStatus = (err as { response?: { status?: number } })?.response?.status;
      const status =
        httpStatus === 400 || httpStatus === 422 || httpStatus === 412 ? 400 : 500;
      const suggestPix = isEfiCardProcessingFailure(err, { httpStatus });
      res.status(status).json({
        error: suggestPix ? EFI_CARD_PIX_FALLBACK_MESSAGE : safeErrorMessage(err, "Erro ao processar cartão."),
        suggestPix,
      });
    }
  });
}
