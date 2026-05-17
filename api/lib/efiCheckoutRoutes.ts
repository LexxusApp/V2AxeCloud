import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import {
  efiCreateCardSubscriptionOneStep,
  efiGetCharge,
  efiGetSubscription,
  resolveEfiEnv,
} from "./efiPay.js";
import { efiPixCreateImmediateCharge, efiPixGetCob, resolveEfiPixEnv } from "./efiPixApi.js";
import {
  activateTenantSubscription,
  efiNotificationUrl,
  premiumOnboardingAmountCents,
} from "./tenantOnboarding.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

async function resolveTenantFromAuth(
  supabaseAdmin: SupabaseClient,
  req: Request,
  bodyTenantId?: string
): Promise<{ tenantId: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  const queryTenant = String(req.query.tenantId || bodyTenantId || "").trim();

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && userData?.user?.id) {
      return {
        tenantId: userData.user.id,
        email: userData.user.email || "",
      };
    }
  }

  if (queryTenant) {
    const { data: profile } = await supabaseAdmin
      .from("perfil_lider")
      .select("email")
      .eq("id", queryTenant)
      .maybeSingle();
    return { tenantId: queryTenant, email: profile?.email || "" };
  }

  return null;
}

async function assertPendingSubscription(
  supabaseAdmin: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("id", tenantId)
    .maybeSingle();

  if (sub?.status === "active") {
    return { ok: false, status: 200, error: "already_active" };
  }
  return { ok: true };
}

export function registerEfiCheckoutRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.get("/api/v1/checkout/efi/config", async (_req: Request, res: Response) => {
    const efi = resolveEfiEnv();
    const pix = resolveEfiPixEnv();
    const payeeCode = String(process.env.EFI_PAYEE_CODE || process.env.EFI_ACCOUNT_ID || "").trim();

    if (!efi) {
      return res.status(503).json({ error: "EFI Cobranças não configurado." });
    }

    res.json({
      sandbox: efi.sandbox,
      payeeCode: payeeCode || null,
      amountCents: premiumOnboardingAmountCents(),
      amountLabel: `R$ ${(premiumOnboardingAmountCents() / 100).toFixed(2).replace(".", ",")}`,
      pixAvailable: !!pix,
      cardAvailable: !!payeeCode,
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

  app.post("/api/v1/checkout/efi/pix", async (req: Request, res: Response) => {
    try {
      const pixEnv = resolveEfiPixEnv();
      if (!pixEnv) {
        return res.status(503).json({
          error:
            "PIX indisponível. Configure EFI_PIX_KEY e o certificado (.p12) em EFI_PIX_CERT_PATH.",
        });
      }

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req, req.body?.tenantId);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });

      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId);
      if (pending.ok === false) {
        if (pending.error === "already_active") {
          return res.json({ alreadyActive: true });
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

      const charge = await efiPixCreateImmediateCharge(pixEnv, {
        tenantId: tenant.tenantId,
        amountCents: premiumOnboardingAmountCents(),
        payerName,
        payerCpf: payerCpf || undefined,
        description: `AxéCloud Premium — ${profile?.nome_terreiro || "Terreiro"}`,
      });

      const qrCodeDataUrl = await QRCode.toDataURL(charge.copyPaste, {
        margin: 2,
        width: 280,
        color: { dark: "#000000", light: "#ffffff" },
      });

      await supabaseAdmin
        .from("subscriptions")
        .update({
          efi_pix_txid: charge.txid,
          efi_charge_id: `pix:${charge.txid}`,
          payment_provider: "efi_pix",
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.tenantId);

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
        error: err?.response?.data?.mensagem || err?.message || "Erro ao gerar PIX.",
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
      res.status(500).json({ error: err?.message || "Erro ao consultar PIX." });
    }
  });

  app.post("/api/v1/checkout/efi/card", async (req: Request, res: Response) => {
    try {
      const efi = resolveEfiEnv();
      if (!efi) return res.status(503).json({ error: "EFI não configurado." });

      const tenant = await resolveTenantFromAuth(supabaseAdmin, req, req.body?.tenantId);
      if (!tenant) return res.status(401).json({ error: "Não autorizado" });

      const pending = await assertPendingSubscription(supabaseAdmin, tenant.tenantId);
      if (pending.ok === false) {
        if (pending.error === "already_active") {
          return res.json({ alreadyActive: true });
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

      const result = await efiCreateCardSubscriptionOneStep(efi, {
        tenantId: tenant.tenantId,
        email,
        nome,
        cpf,
        phoneNumber: String(customer.phone_number || customer.phone || ""),
        paymentToken,
        amountCents: premiumOnboardingAmountCents(),
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
    } catch (err: any) {
      console.error("[checkout/card]", err?.response?.data || err?.message || err);
      const efiMsg =
        err?.response?.data?.error_description ||
        err?.response?.data?.message ||
        err?.response?.data?.error;
      res.status(500).json({
        error: efiMsg || err?.message || "Erro ao processar cartão.",
      });
    }
  });
}
