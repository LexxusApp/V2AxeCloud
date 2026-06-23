import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEfiEnv } from "./efiPay.js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";
import {
  activateTenantSubscription,
  processEfiNotificationToken,
  registerNewTenant,
  resolvePublicAppUrl,
} from "./tenantOnboarding.js";
import { requireAuthUser } from "./requireAuth.js";
import { secureCompare } from "./secureCompare.js";
import { assertUserCanAccessTenant } from "./tenantAccess.js";
import { authRateLimit, webhookRateLimit } from "./rateLimit.js";
import { verifyEfiWebhook } from "./secureRoutes.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

export function registerOnboardingRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.post("/api/v1/auth/register", authRateLimit, async (req: Request, res: Response) => {
    try {
      const { email, password, nome_terreiro, nome_zelador, whatsapp } = req.body || {};
      const result = await registerNewTenant(
        supabaseAdmin,
        { email, password, nome_terreiro, nome_zelador, whatsapp },
        resolveEfiEnv()
      );

      if (!resolveEfiEnv()) {
        return res.status(503).json({
          error:
            "Cadastro criado, mas o checkout EFI não está disponível. Configure EFI_CLIENT_ID e EFI_CLIENT_SECRET.",
          tenantId: result.tenantId,
          subscriptionStatus: result.subscriptionStatus,
        });
      }

      res.status(201).json({
        success: true,
        tenantId: result.tenantId,
        userId: result.userId,
        email: result.email,
        checkoutPath: result.checkoutPath,
        subscriptionStatus: result.subscriptionStatus,
        trialEndsAt: result.trialEndsAt,
        trialDays: result.trialDays,
        loginUrl: resolvePublicAppUrl(),
        dashboardPath: '/dashboard',
      });
    } catch (err: any) {
      const status = Number(err?.status) || 500;
      console.error("[register]", err?.message || err);
      res.status(status).json({ error: safeErrorMessage(err, "Erro ao cadastrar terreiro.") });
    }
  });

  app.post("/api/v1/checkout/efi/resume", async (req: Request, res: Response) => {
    try {
      const auth = await requireAuthUser(supabaseAdmin, req);
      if ("error" in auth) return res.status(auth.status).json({ error: auth.error });

      const userId = auth.user.id;
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("status, efi_charge_id")
        .eq("id", userId)
        .maybeSingle();

      if (sub?.status === "active") {
        return res.json({ alreadyActive: true });
      }

      if (!resolveEfiEnv()) {
        return res.status(503).json({ error: "EFI não configurado no servidor." });
      }

      res.json({ checkoutPath: `/checkout?tenant=${userId}` });
    } catch (err: any) {
      console.error("[checkout/resume]", err?.message || err);
      res.status(500).json({ error: safeErrorMessage(err, "Erro ao gerar checkout.") });
    }
  });

  app.post("/api/webhooks/efi", webhookRateLimit, async (req: Request, res: Response) => {
    try {
      if (!verifyEfiWebhook(req)) {
        console.warn("[EFI WEBHOOK] secret inválido ou ausente");
        return res.status(401).send("Unauthorized");
      }

      const token =
        (typeof req.body?.notification === "string" && req.body.notification) ||
        (typeof req.query?.notification === "string" && req.query.notification) ||
        "";

      if (!token) {
        console.warn("[EFI WEBHOOK] notification token ausente");
        return res.status(200).send("OK");
      }

      const result = await processEfiNotificationToken(supabaseAdmin, token);
      if (!result.ok) {
        console.error("[EFI WEBHOOK]", result.message);
        return res.status(422).json({ error: "Falha ao processar notificação de pagamento" });
      }

      console.log("[EFI WEBHOOK]", result.message);
      res.status(200).send("OK");
    } catch (err: any) {
      console.error("[EFI WEBHOOK]", err?.message || err);
      res.status(500).json({ error: "Erro ao processar notificação EFI" });
    }
  });

  app.get("/api/v1/onboarding/status", async (req: Request, res: Response) => {
    const auth = await requireAuthUser(supabaseAdmin, req);
    if ("error" in auth) return res.status(auth.status).json({ error: auth.error });

    const tenantId = String(req.query.tenantId || auth.user.id).trim();
    if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });

    const ok = await assertUserCanAccessTenant(supabaseAdmin, auth.user, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("status, plan, expires_at")
      .eq("id", tenantId)
      .maybeSingle();

    res.json({
      status: sub?.status || "unknown",
      plan: sub?.plan || "premium",
      expires_at: sub?.expires_at,
      active: isSubscriptionAccessActive(sub),
    });
  });

  app.post("/api/v1/onboarding/activate", async (req: Request, res: Response) => {
    const secret = process.env.ONBOARDING_ACTIVATE_SECRET;
    if (!secret || !secureCompare(String(req.headers["x-onboarding-secret"] || ""), secret)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const tenantId = String(req.body?.tenantId || "").trim();
    if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });

    try {
      const out = await activateTenantSubscription(supabaseAdmin, tenantId, { provider: "efi" });
      res.json({ success: true, ...out });
    } catch (err: any) {
      res.status(500).json({ error: safeErrorMessage(err, "Erro ao ativar") });
    }
  });
}
