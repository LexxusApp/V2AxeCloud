import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEfiEnv } from "./efiPay.js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";
import {
  activateTenantSubscription,
  registerApprovedClaimTenant,
  processEfiNotificationToken,
  registerNewTenant,
  resolvePublicAppUrl,
} from "./tenantOnboarding.js";
import { requireAuthUser } from "./requireAuth.js";
import { secureCompare } from "./secureCompare.js";
import { assertUserCanAccessTenant } from "./tenantAccess.js";
import { apiReadRateLimit, authRateLimit, webhookRateLimit } from "./rateLimit.js";
import { verifyEfiWebhook } from "./secureRoutes.js";
import { safeErrorMessage } from "./safeError.js";
import { checkPasswordExposure } from "./pwnedPassword.js";
import { validateStrongPassword } from "../../lib/passwordPolicy.js";
import { createAuditLog, extractClientIp, extractUserAgent } from "./createAuditLog.js";
import { recordPaymentEvent, paymentEventKey } from "./paymentEvents.js";
import { normalizeBillingCycle } from "./plansCatalog.js";
import { sendMetaCloudTemplate } from "./metaCloudSend.js";
import { resolveMetaTemplateLanguage } from "./whatsappMetaCloud.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

export function registerOnboardingRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.get("/api/v1/public/cep/:cep", apiReadRateLimit, async (req: Request, res: Response) => {
    const cep = String(req.params.cep || "").replace(/\D/g, "").slice(0, 8);
    if (!/^\d{8}$/.test(cep)) return res.status(400).json({ error: "Informe um CEP com 8 números." });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "AxeCloudRegister/1.0 (https://axecloud.com.br)" },
      });
      if (!response.ok) return res.status(502).json({ error: "Não foi possível consultar o CEP agora." });
      const address = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (address.erro) return res.status(404).json({ error: "CEP não encontrado. Confira os números." });
      return res.set("Cache-Control", "public, max-age=86400").json({
        cep,
        logradouro: String(address.logradouro || "").trim(),
        bairro: String(address.bairro || "").trim(),
        cidade: String(address.localidade || "").trim(),
        estado: String(address.uf || "").trim().toUpperCase().slice(0, 2),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        return res.status(504).json({ error: "A consulta do CEP demorou demais. Tente novamente." });
      }
      return res.status(502).json({ error: "Não foi possível consultar o CEP agora." });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post("/api/v1/auth/password/check", authRateLimit, async (req: Request, res: Response) => {
    const password = String(req.body?.password || "");
    const policy = validateStrongPassword(password);
    if (policy.ok === false) return res.status(400).json({ error: policy.message });
    const exposure = await checkPasswordExposure(password);
    if (exposure === "compromised") {
      return res.status(400).json({
        error: "Esta senha já apareceu em vazamentos conhecidos. Escolha uma senha diferente.",
      });
    }
    // Indisponibilidade externa não bloqueia a conta; a política local continua obrigatória.
    return res.json({ safe: true, exposureCheck: exposure });
  });

  app.post("/api/v1/auth/check-restored-account", authRateLimit, async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return res.json({ isRestored: false });
      }

      let userId = "";
      let zeladorName = "";
      let terreiroName = "";

      const { data: perfil } = await supabaseAdmin
        .from("perfil_lider")
        .select("id, email, zelador, nome_terreiro")
        .ilike("email", email)
        .maybeSingle();

      if (perfil) {
        userId = perfil.id;
        zeladorName = perfil.zelador || "";
        terreiroName = perfil.nome_terreiro || "";
      } else {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === email);
        if (found) {
          userId = found.id;
          zeladorName = found.user_metadata?.nome_zelador || "";
          terreiroName = found.user_metadata?.nome_terreiro || "";
        }
      }

      if (!userId) {
        return res.json({ isRestored: false });
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userErr || !userData?.user) {
        return res.json({ isRestored: false });
      }

      const meta = userData.user.user_metadata || {};
      const isPending = Boolean(meta.restored_pending_password_setup);

      if (!isPending) {
        return res.json({ isRestored: false });
      }

      const finalZelador = zeladorName || meta.nome_zelador || "Zelador(a)";
      const finalTerreiro = terreiroName || meta.nome_terreiro || "Sua Casa de Santo";

      return res.json({
        isRestored: true,
        email: userData.user.email,
        nomeZelador: finalZelador,
        nomeTerreiro: finalTerreiro,
      });
    } catch (err: unknown) {
      console.error("[CHECK-RESTORED-ACCOUNT] Erro ao verificar conta restaurada:", err);
      return res.json({ isRestored: false });
    }
  });

  app.post("/api/v1/auth/setup-restored-password", authRateLimit, async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const newPassword = String(req.body?.newPassword || "");

      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "E-mail inválido." });
      }

      const policy = validateStrongPassword(newPassword);
      if (policy.ok === false) {
        return res.status(400).json({ error: policy.message });
      }

      const exposure = await checkPasswordExposure(newPassword);
      if (exposure === "compromised") {
        return res.status(400).json({
          error: "Esta senha já apareceu em vazamentos conhecidos. Escolha uma senha diferente.",
        });
      }

      let userId = "";
      const { data: perfil } = await supabaseAdmin
        .from("perfil_lider")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (perfil) {
        userId = perfil.id;
      } else {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const found = usersData?.users?.find((u) => u.email?.toLowerCase() === email);
        if (found) userId = found.id;
      }

      if (!userId) {
        return res.status(404).json({ error: "Conta não encontrada." });
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userErr || !userData?.user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      const meta = userData.user.user_metadata || {};
      if (!meta.restored_pending_password_setup) {
        return res.status(400).json({ error: "Esta conta não possui redefinição pendente de restauração." });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
        user_metadata: {
          ...meta,
          restored_pending_password_setup: false,
          restored_password_setup_at: new Date().toISOString(),
        },
      });

      if (updateError) {
        return res.status(500).json({ error: updateError.message || "Falha ao definir nova senha." });
      }

      try {
        await createAuditLog(supabaseAdmin, {
          tenant_id: userId,
          user_id: userId,
          actor_user_id: userId,
          action: "auth.restored_password_setup",
          status: "success",
          surface: "auth",
          route: "/api/v1/auth/setup-restored-password",
          ip: extractClientIp(req),
          user_agent: extractUserAgent(req),
          details: { email },
        });
      } catch {
        /* auditoria best-effort */
      }

      return res.json({
        success: true,
        message: "Senha atualizada com sucesso!",
      });
    } catch (err: unknown) {
      console.error("[SETUP-RESTORED-PASSWORD] Erro:", err);
      return res.status(500).json({ error: safeErrorMessage(err, "Erro ao configurar nova senha.") });
    }
  });

  app.post("/api/v1/auth/register", authRateLimit, async (req: Request, res: Response) => {
    try {
      const {
        email,
        password,
        nome_terreiro,
        nome_zelador,
        whatsapp,
        billingCycle,
        conversion,
        claimId,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        descricao_publica,
        publicar_no_mapa,
      } = req.body || {};
      const approvedClaimId = String(claimId || "").trim();
      const claimActivation = Boolean(approvedClaimId);
      const result = claimActivation
        ? await registerApprovedClaimTenant(
            supabaseAdmin,
            { claimId: approvedClaimId, password, billingCycle },
            resolveEfiEnv(),
          )
        : await registerNewTenant(
            supabaseAdmin,
            {
              email,
              password,
              nome_terreiro,
              nome_zelador,
              whatsapp,
              billingCycle,
              cep,
              endereco,
              numero,
              complemento,
              bairro,
              cidade,
              estado,
              descricao_publica,
              publicar_no_mapa,
            },
            resolveEfiEnv(),
          );
      const claimLinked = claimActivation;

      try {
        const { insertConversionEvent } = await import('./publicConversionTracking.js');
        await insertConversionEvent(
          supabaseAdmin,
          req,
          {
            ...(conversion || {}),
            eventName: 'register_completed',
            metadata: {
              registrationSource: claimActivation ? 'directory-claim-activation' : 'public-register',
              claimId: approvedClaimId || undefined,
            },
          },
          { allowCompleted: true, tenantId: result.tenantId },
        );
      } catch (metricError) {
        console.warn('[register] conversion metric failed:', metricError);
      }

      if (claimActivation) {
        const { recordClaimActivationEvent } = await import("./directoryClaimActivation.js");
        await recordClaimActivationEvent(supabaseAdmin, approvedClaimId, "activation_completed", {
          metadata: { tenantId: result.tenantId },
        });
        try {
          const { insertConversionEvent } = await import("./publicConversionTracking.js");
          await insertConversionEvent(
            supabaseAdmin,
            req,
            {
              ...(conversion || {}),
              eventName: "claim_activation_completed",
              metadata: { claimId: approvedClaimId },
            },
            { allowCompleted: true, tenantId: result.tenantId },
          );
        } catch (metricError) {
          console.warn("[claim-activation] conversion metric failed:", metricError);
        }
      }

      void createAuditLog(supabaseAdmin, req, "auth.register_completed", "success", result.tenantId, {
        surface: "app",
        mode: "zelador",
        source: claimActivation ? "directory-claim-activation" : "public-register",
        email: result.email,
        userId: result.userId,
      });

      if (!claimActivation && !resolveEfiEnv()) {
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
        claimLinked,
        radarPublished: result.radarPublished,
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
        .select("status, expires_at, efi_charge_id")
        .eq("id", userId)
        .maybeSingle();

      if (isSubscriptionAccessActive(sub)) {
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
      // 1. Webhook oficial Pix Efí (Banco Central)
      if (req.body && Array.isArray(req.body.pix)) {
        const pixList = req.body.pix as Array<Record<string, unknown>>;
        if (pixList.length === 0) {
          // Handshake de validação da URL da Efí
          return res.status(200).send("OK");
        }

        for (const pixItem of pixList) {
          const txid = String(pixItem?.txid || "").trim();
          if (!txid) continue;

          console.log(`[EFI PIX WEBHOOK] Processando Pix txid=${txid}`);
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("id, status, plan, expires_at, billing_cycle, pending_billing_cycle, efi_pix_txid, last_activated_charge_id")
            .or(`efi_pix_txid.eq.${txid},efi_charge_id.eq.pix:${txid}`)
            .maybeSingle();

          if (sub && String(sub.last_activated_charge_id || "") !== `pix:${txid}`) {
            const billingCycle = normalizeBillingCycle(sub.pending_billing_cycle || sub.billing_cycle);
            const valorNum = Number(pixItem?.valor) || 0;
            const amountCents = valorNum > 0 ? Math.round(valorNum * 100) : 6990;

            await activateTenantSubscription(supabaseAdmin, sub.id, {
              chargeId: `pix:${txid}`,
              provider: "efi_pix",
              billingCycle,
            });

            await recordPaymentEvent(supabaseAdmin, {
              provider: "efi_pix",
              externalId: paymentEventKey([txid, "status", "paid"]),
              tenantId: sub.id,
              eventType: "payment_confirmed",
              status: "paid",
              paymentMethod: "pix",
              amountCents,
              billingCycle,
              chargeId: txid,
              message: "Pagamento PIX confirmado via webhook da Efí.",
              metadata: { pixItem },
            });

            // Envia template WhatsApp de confirmação
            try {
              const { data: leader } = await supabaseAdmin
                .from("perfil_lider")
                .select("cargo, nome_terreiro, whatsapp, whatsapp_publico")
                .eq("id", sub.id)
                .maybeSingle();

              let phone = String(leader?.whatsapp || leader?.whatsapp_publico || "").replace(/\D/g, "");
              if (phone) {
                if (phone.length === 10) phone = `${phone.slice(0, 2)}9${phone.slice(2)}`;
                if (!phone.startsWith("55")) phone = `55${phone}`;

                const { data: updatedSub } = await supabaseAdmin
                  .from("subscriptions")
                  .select("expires_at")
                  .eq("id", sub.id)
                  .single();

                const expDate = new Date(updatedSub?.expires_at || Date.now() + 30 * 86400000);
                const validadeFormatada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(expDate);

                const nomeZelador = String(leader?.cargo || "Zelador").trim();
                const valorLabel = `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`;

                await sendMetaCloudTemplate(
                  phone,
                  "confirmacao_assinatura_pix_axecloud",
                  resolveMetaTemplateLanguage(),
                  [
                    {
                      type: "body",
                      parameters: [
                        { type: "text", text: nomeZelador },
                        { type: "text", text: valorLabel },
                        { type: "text", text: String(leader?.nome_terreiro || "Terreiro") },
                        { type: "text", text: validadeFormatada },
                      ],
                    },
                  ],
                  {
                    tenantId: sub.id,
                    recipientName: nomeZelador,
                    source: "billing",
                    sourceId: sub.id,
                  }
                );
              }
            } catch (waErr) {
              console.warn("[EFI PIX WEBHOOK] Notificação WhatsApp falhou:", waErr);
            }
          }
        }

        return res.status(200).send("OK");
      }

      // 2. Fluxo legado (Boleto/Cartão com token de notificação)
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
