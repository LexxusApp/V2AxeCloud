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
  efiPixGetAccessToken,
  efiPixGetCob,
  getEfiPixSetupDiagnostics,
  resolveEfiPixEnv,
} from "./efiPixApi.js";
import {
  formatAmountLabelFromCents,
  normalizeBillingCycle,
  type BillingCycle,
} from "./plansCatalog.js";
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
import { secureCompare } from "./secureCompare.js";
import {
  normalizePaymentStatus,
  paymentEventKey,
  recordPaymentEvent,
} from "./paymentEvents.js";

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
  tenantId: string,
  purpose: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  await ensurePendingSubscriptionRow(supabaseAdmin, tenantId);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, expires_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (purpose !== "renewal" && isSubscriptionAccessActive(sub)) {
    return { ok: false, status: 200, error: "already_active" };
  }
  return { ok: true };
}

export function registerEfiCheckoutRoutes(app: Express, { supabaseAdmin }: Deps) {
  // Health-check público, limitado por IP e sem detalhes sensíveis. Permite que
  // a monitoração detecte falhas de certificado mTLS/OAuth antes do checkout.
  app.get("/api/v1/checkout/efi/health", apiReadRateLimit, async (_req: Request, res: Response) => {
    const pixEnv = resolveEfiPixEnv();
    if (!pixEnv) {
      return res.status(503).json({ status: "unavailable", provider: "efi-pix" });
    }

    try {
      const accessToken = await efiPixGetAccessToken(pixEnv);
      return res.status(accessToken ? 200 : 503).json({
        status: accessToken ? "ok" : "unavailable",
        provider: "efi-pix",
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[EFI_PUBLIC_HEALTH] OAuth/mTLS indisponível:", safeErrorMessage(error));
      return res.status(503).json({
        status: "unavailable",
        provider: "efi-pix",
        checkedAt: new Date().toISOString(),
      });
    }
  });
  // Diagnóstico administrativo e sem efeitos colaterais do canal PIX.
  // Valida certificado mTLS + OAuth na Efí, sem criar cobrança ou alterar assinatura.
  app.get("/api/admin/efi-health", async (req: Request, res: Response) => {
    const expectedSecret = String(process.env.EFI_WEBHOOK_SECRET || "").trim();
    const headerSecret = String(req.headers["x-efi-webhook-secret"] || "").trim();
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const suppliedSecret = headerSecret || bearer;

    if (!expectedSecret || !suppliedSecret || !secureCompare(suppliedSecret, expectedSecret)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const pixEnv = resolveEfiPixEnv();
    if (!pixEnv) {
      return res.status(503).json({
        ok: false,
        configured: false,
        oauth: false,
        error: "efi_pix_not_configured",
      });
    }

    const startedAt = Date.now();
    try {
      const accessToken = await efiPixGetAccessToken(pixEnv);
      return res.json({
        ok: Boolean(accessToken),
        configured: true,
        oauth: Boolean(accessToken),
        sandbox: pixEnv.sandbox,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[EFI_HEALTH] OAuth/mTLS indisponível:", safeErrorMessage(error));
      return res.status(503).json({
        ok: false,
        configured: true,
        oauth: false,
        sandbox: pixEnv.sandbox,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        error: "efi_oauth_unavailable",
      });
    }
  });
  app.get("/api/v1/checkout/efi/config", apiReadRateLimit, async (req: Request, res: Response) => {
    const efi = resolveEfiEnv();
    const pix = resolveEfiPixEnv();
    const payeeCode = resolveEfiPayeeCode();

    if (!efi) {
      return res.status(503).json({ error: "EFI Cobranças não configurado." });
    }

    res.setHeader("Cache-Control", "private, no-store, must-revalidate");

    const tenant = await resolveTenantFromAuth(supabaseAdmin, req);
    const billingCycle = normalizeBillingCycle(req.query.billingCycle);
    const amountCents = await resolvePremiumOnboardingAmountCents(
      supabaseAdmin,
      tenant?.tenantId,
      billingCycle
    );
    const publicConfig = {
      amountCents,
      amountLabel: formatAmountLabelFromCents(amountCents),
      billingCycle,
      periodLabel: billingCycle === "annual" ? "/ano" : "/mês",
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
                "Defina EFI_PAYEE_CODE no .env da VPS (painel Efí → API → Introdução → Identificador de conta).",
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
      .select("status, expires_at, billing_cycle, efi_charge_id, efi_pix_txid, efi_subscription_id")
      .eq("id", tenant.tenantId)
      .maybeSingle();

    res.json({
      tenantId: tenant.tenantId,
      email: profile?.email || tenant.email,
      nomeTerreiro: profile?.nome_terreiro || "",
      nomeZelador: profile?.cargo || "",
      subscriptionStatus: sub?.status || "pending",
      // Trial expirado pode manter status "active" + expires_at passado — não liberar acesso.
      active: isSubscriptionAccessActive(sub),
      billingCycle: normalizeBillingCycle(sub?.billing_cycle),
      efiPixTxid: sub?.efi_pix_txid || null,
      efiSubscriptionId: sub?.efi_subscription_id || null,
    });
  });

  app.post("/api/v1/checkout/efi/pix", checkoutRateLimit, async (req: Request, res: Response) => {
    let auditTenantId: string | null = null;
    let auditBillingCycle: BillingCycle = "monthly";
    let auditAmountCents: number | null = null;
    let auditPhase = "request";
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
      auditTenantId = tenant.tenantId;

      const purpose = String(req.body?.purpose || "onboarding").toLowerCase();
      const billingCycle = normalizeBillingCycle(req.body?.billingCycle);
      auditBillingCycle = billingCycle;
      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId, purpose);
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

      const amountCents = await resolvePremiumOnboardingAmountCents(
        supabaseAdmin,
        tenant.tenantId,
        billingCycle
      );
      auditAmountCents = amountCents;
      await recordPaymentEvent(supabaseAdmin, {
        provider: "efi_pix",
        externalId: paymentEventKey([tenant.tenantId, Date.now(), "requested"]),
        tenantId: tenant.tenantId,
        eventType: "pix_requested",
        status: "processing",
        paymentMethod: "pix",
        amountCents,
        billingCycle,
        message: "Solicitação de PIX iniciada no checkout.",
        metadata: { purpose },
      });
      auditPhase = "provider";
      const charge = await efiPixCreateImmediateCharge(pixEnv, {
        tenantId: tenant.tenantId,
        amountCents,
        payerName,
        payerCpf: payerCpf || undefined,
        description: `AxéCloud Premium ${billingCycle === "annual" ? "Anual" : "Mensal"} — ${profile?.nome_terreiro || "Terreiro"}`,
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
        pending_billing_cycle: billingCycle,
        updated_at: new Date().toISOString(),
      });
      if (subUpErr) {
        console.error("[checkout/pix] subscription update:", subUpErr.message);
      }

      if (!charge.copyPaste?.trim()) {
        return res.status(502).json({ error: "EFI Pix: código copia e cola ausente na resposta." });
      }

      await recordPaymentEvent(supabaseAdmin, {
        provider: "efi_pix",
        externalId: paymentEventKey([charge.txid, "created"]),
        tenantId: tenant.tenantId,
        eventType: "pix_created",
        status: normalizePaymentStatus(charge.status),
        paymentMethod: "pix",
        amountCents,
        billingCycle,
        chargeId: charge.txid,
        message: "PIX gerado e disponibilizado ao cliente.",
        metadata: { expiresIn: 3600, providerStatus: charge.status, purpose },
      });

      res.json({
        txid: charge.txid,
        copyPaste: charge.copyPaste,
        qrCodeDataUrl,
        status: charge.status,
        expiresIn: 3600,
        billingCycle,
      });
    } catch (err: any) {
      console.error("[checkout/pix]", err?.response?.data || err?.message || err);
      const raw = String(err?.message || "");
      if (auditTenantId) {
        await recordPaymentEvent(supabaseAdmin, {
          provider: "efi_pix",
          externalId: paymentEventKey([auditTenantId, Date.now(), auditPhase, "failed"]),
          tenantId: auditTenantId,
          eventType: "pix_failed",
          status: "failed",
          paymentMethod: "pix",
          amountCents: auditAmountCents,
          billingCycle: auditBillingCycle,
          errorCode: String(err?.response?.status || err?.code || "pix_error"),
          message: safeErrorMessage(err, "Erro ao gerar PIX."),
          metadata: { phase: auditPhase },
        });
      }
      const tlsHang =
        /socket hang up|ECONNRESET|ECONNREFUSED|certificate|pfx|pkcs/i.test(raw);
      res.status(500).json({
        error: tlsHang
          ? "Falha na conexão com a Efí (certificado/TLS). Tente novamente em instantes."
          : safeErrorMessage(err, "Erro ao gerar PIX."),
      });
    }
  });

  app.get("/api/v1/checkout/efi/pix/:txid/status", async (req: Request, res: Response) => {
    let auditTenantId: string | null = null;
    let auditTxid = String(req.params.txid || "").trim();
    try {
      const pixEnv = resolveEfiPixEnv();
      if (!pixEnv) return res.status(503).json({ error: "PIX não configurado." });

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });
      auditTenantId = tenant.tenantId;

      const txid = String(req.params.txid || "").trim();
      auditTxid = txid;
      if (!txid) return res.status(400).json({ error: "txid obrigatório" });

      const { data: subRow } = await supabaseAdmin
        .from("subscriptions")
        .select("efi_pix_txid, billing_cycle, pending_billing_cycle")
        .eq("id", tenant.tenantId)
        .maybeSingle();

      if (!subRow?.efi_pix_txid || String(subRow.efi_pix_txid) !== txid) {
        return res.status(403).json({ error: "Cobrança não pertence a esta conta." });
      }

      const cob = await efiPixGetCob(pixEnv, txid);
      const billingCycle = normalizeBillingCycle(subRow.pending_billing_cycle || subRow.billing_cycle);
      const amountCents = await resolvePremiumOnboardingAmountCents(
        supabaseAdmin,
        tenant.tenantId,
        billingCycle
      );
      const normalizedStatus = normalizePaymentStatus(cob.status);
      await recordPaymentEvent(supabaseAdmin, {
        provider: "efi_pix",
        externalId: paymentEventKey([txid, "status", normalizedStatus]),
        tenantId: tenant.tenantId,
        eventType: cob.paid ? "payment_confirmed" : "pix_status_checked",
        status: normalizedStatus,
        paymentMethod: "pix",
        amountCents,
        billingCycle,
        chargeId: txid,
        message: cob.paid ? "Pagamento PIX confirmado." : "Status do PIX consultado.",
        metadata: { providerStatus: cob.status },
      });

      if (cob.paid) {
        await activateTenantSubscription(supabaseAdmin, tenant.tenantId, {
          chargeId: `pix:${txid}`,
          provider: "efi_pix",
          billingCycle,
        });
        return res.json({ status: cob.status, paid: true, active: true });
      }

      res.json({ status: cob.status, paid: false, active: false });
    } catch (err: any) {
      console.error("[checkout/pix/status]", err?.message || err);
      if (auditTenantId && auditTxid) {
        await recordPaymentEvent(supabaseAdmin, {
          provider: "efi_pix",
          externalId: paymentEventKey([auditTxid, Date.now(), "status_failed"]),
          tenantId: auditTenantId,
          eventType: "pix_status_failed",
          status: "failed",
          paymentMethod: "pix",
          chargeId: auditTxid,
          errorCode: String(err?.response?.status || err?.code || "status_error"),
          message: safeErrorMessage(err, "Erro ao consultar PIX."),
        });
      }
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
    let auditTenantId: string | null = null;
    let auditBillingCycle: BillingCycle = "monthly";
    let auditAmountCents: number | null = null;
    try {
      const efi = resolveEfiEnv();
      if (!efi) return res.status(503).json({ error: "EFI não configurado." });

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req, req.body?.tenantId);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });
      auditTenantId = tenant.tenantId;

      const purpose = String(req.body?.purpose || "onboarding").toLowerCase();
      const billingCycle: BillingCycle = normalizeBillingCycle(req.body?.billingCycle);
      auditBillingCycle = billingCycle;
      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId, purpose);
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

      const amountCents = await resolvePremiumOnboardingAmountCents(
        supabaseAdmin,
        tenant.tenantId,
        billingCycle
      );
      auditAmountCents = amountCents;
      await recordPaymentEvent(supabaseAdmin, {
        provider: "efi_card",
        externalId: paymentEventKey([tenant.tenantId, Date.now(), "requested"]),
        tenantId: tenant.tenantId,
        eventType: "card_requested",
        status: "processing",
        paymentMethod: "card",
        amountCents,
        billingCycle,
        message: "Tentativa de pagamento no cartão iniciada.",
        metadata: { purpose },
      });
      const result = await efiCreateCardSubscriptionOneStep(efi, {
        tenantId: tenant.tenantId,
        email,
        nome,
        cpf,
        phoneNumber: String(customer.phone_number || customer.phone || ""),
        paymentToken,
        amountCents,
        billingCycle,
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
          pending_billing_cycle: billingCycle,
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
          billingCycle,
        });
      }

      await recordPaymentEvent(supabaseAdmin, {
        provider: "efi_card",
        externalId: paymentEventKey([result.chargeId || result.subscriptionId, "created"]),
        tenantId: tenant.tenantId,
        eventType: "card_created",
        status: normalizePaymentStatus(result.status),
        paymentMethod: "card",
        amountCents,
        billingCycle,
        chargeId: result.chargeId || result.subscriptionId,
        message: "Cobrança no cartão criada.",
        metadata: { providerStatus: result.status, subscriptionId: result.subscriptionId },
      });
      if (active) {
        await recordPaymentEvent(supabaseAdmin, {
          provider: "efi_card",
          externalId: paymentEventKey([result.chargeId || result.subscriptionId, "paid"]),
          tenantId: tenant.tenantId,
          eventType: "payment_confirmed",
          status: "paid",
          paymentMethod: "card",
          amountCents,
          billingCycle,
          chargeId: result.chargeId || result.subscriptionId,
          message: "Pagamento no cartão confirmado.",
          metadata: { providerStatus: result.status, subscriptionId: result.subscriptionId },
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
      if (auditTenantId) {
        await recordPaymentEvent(supabaseAdmin, {
          provider: "efi_card",
          externalId: paymentEventKey([auditTenantId, Date.now(), "failed"]),
          tenantId: auditTenantId,
          eventType: "card_failed",
          status: "failed",
          paymentMethod: "card",
          amountCents: auditAmountCents,
          billingCycle: auditBillingCycle,
          errorCode: String(httpStatus || (err as any)?.code || "card_error"),
          message: safeErrorMessage(err, "Erro ao processar cartão."),
        });
      }
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
