import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Express, Request, Response } from "express";
import { logEvent } from "./auditLog.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveAuthenticatedFilho } from "./tenantAccess.js";
import { sensitiveActionRateLimit } from "./rateLimit.js";
import { safeErrorMessage } from "./safeError.js";
import { humanizePasswordPolicyError, validateStrongPassword } from "../../lib/passwordPolicy.js";
import { rejectCompromisedPassword } from "./pwnedPassword.js";
import {
  isMetaCloudDirectConfigured,
  isTemplateRequiredMetaError,
  sendMetaCloudTemplate,
  sendMetaCloudText,
} from "./metaCloudSend.js";
import {
  buildForgotPasswordFreeText,
  buildForgotPasswordOtpComponents,
  buildForgotPasswordPackedInAvisoGeralComponents,
  resolveForgotPasswordTemplateName,
  resolveMetaTemplateLanguage,
} from "./whatsappMetaCloud.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type OtpEntry = {
  user_id: string;
  whatsapp: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
};

type Deps = { supabaseAdmin: SupabaseClient };

function otpHmacSecret(): string {
  const secret = String(
    process.env.WA_META_APP_SECRET ||
      process.env.META_APP_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();
  if (!secret) throw new Error("Segredo do servidor ausente para proteger o OTP.");
  return secret;
}

function hashOtp(code: string, userId: string): string {
  return createHmac("sha256", otpHmacSecret()).update(`${userId}:${code}`).digest("hex");
}

function otpHashesMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    receivedBuffer.length > 0 &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

async function findAuthUserByEmail(sb: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data?.users ?? []).find((u) => (u.email || "").toLowerCase() === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 200) break;
    page += 1;
  }
  return null;
}

function resolveZeladorWhatsapp(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const raw = String(user.user_metadata?.whatsapp || "").trim();
  return normalizeBrazilMsisdn(raw);
}

function phonesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b;
}

const GENERIC_OK =
  "Se o e-mail de login e o WhatsApp coincidirem com o cadastro, enviamos um código de 6 dígitos.";

/**
 * Envia OTP de recuperação via Meta Cloud API (sem Evolution).
 * Ordem: template dedicado → aviso_geral empacotado → texto livre (janela 24h).
 */
async function sendForgotPasswordOtpViaMeta(
  phone: string,
  loginEmail: string,
  code: string
): Promise<{ messageId?: string; channel: "template" | "aviso_geral" | "text" }> {
  if (!isMetaCloudDirectConfigured()) {
    throw new Error("WhatsApp Meta Cloud API não configurada (WA_META_TOKEN / WA_PHONE_NUMBER_ID).");
  }

  const language = resolveMetaTemplateLanguage();
  const dedicatedName = resolveForgotPasswordTemplateName();
  const packedName = String(process.env.WA_META_TEMPLATE_DEFAULT || "aviso_geral_axecloud").trim();
  const freeText = buildForgotPasswordFreeText(loginEmail, code);

  try {
    const out = await sendMetaCloudTemplate(
      phone,
      dedicatedName,
      language,
      buildForgotPasswordOtpComponents(loginEmail, code)
    );
    console.log(`[forgot-password] template Meta (${dedicatedName}) → ${phone.slice(0, 4)}…`);
    return { ...out, channel: "template" };
  } catch (err) {
    console.warn(
      `[forgot-password] template ${dedicatedName} indisponível:`,
      err instanceof Error ? err.message : err
    );
  }

  try {
    const out = await sendMetaCloudTemplate(
      phone,
      packedName,
      language,
      buildForgotPasswordPackedInAvisoGeralComponents(loginEmail, code)
    );
    console.log(`[forgot-password] pack Meta (${packedName}) → ${phone.slice(0, 4)}…`);
    return { ...out, channel: "aviso_geral" };
  } catch (err) {
    console.warn(
      `[forgot-password] pack ${packedName} falhou:`,
      err instanceof Error ? err.message : err
    );
  }

  try {
    const out = await sendMetaCloudText(phone, freeText);
    console.log(`[forgot-password] texto Meta (janela 24h) → ${phone.slice(0, 4)}…`);
    return { ...out, channel: "text" };
  } catch (err) {
    if (isTemplateRequiredMetaError(err)) {
      throw new Error(
        "Não foi possível enviar o código fora da janela de 24h. " +
          `Aprove o template ${dedicatedName} na Meta (WA_META_TEMPLATE_FORGOT_PASSWORD).`
      );
    }
    throw err;
  }
}

export function registerForgotPasswordWhatsappRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.post(
    "/api/v1/auth/forgot-password/request",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      try {
        const loginEmail = String((req.body || {}).loginEmail || "")
          .trim()
          .toLowerCase();
        const whatsappRaw = String((req.body || {}).whatsapp || "").trim();
        const whatsappInput = normalizeBrazilMsisdn(whatsappRaw);

        if (!loginEmail || !loginEmail.includes("@")) {
          return res.status(400).json({ error: "Informe o e-mail de login cadastrado." });
        }
        if (!whatsappInput) {
          return res.status(400).json({ error: "Informe um WhatsApp válido com DDD." });
        }

        const authUser = await findAuthUserByEmail(supabaseAdmin, loginEmail);
        if (!authUser?.id) {
          return res.json({ success: true, message: GENERIC_OK });
        }

        const filho = await resolveAuthenticatedFilho(supabaseAdmin, authUser.id);
        if (filho) {
          return res.json({ success: true, message: GENERIC_OK });
        }

        const storedWhatsapp = resolveZeladorWhatsapp(authUser);
        if (!phonesMatch(storedWhatsapp, whatsappInput)) {
          return res.json({ success: true, message: GENERIC_OK });
        }

        const code = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
        const { error: otpStoreError } = await supabaseAdmin
          .from("password_reset_whatsapp_otp")
          .upsert({
            user_id: authUser.id,
            whatsapp: whatsappInput,
            code_hash: hashOtp(code, authUser.id),
            expires_at: expiresAt,
            attempts: 0,
            created_at: new Date().toISOString(),
          });
        if (otpStoreError) throw otpStoreError;

        try {
          await sendForgotPasswordOtpViaMeta(whatsappInput, loginEmail, code);
        } catch (err) {
          await supabaseAdmin.from("password_reset_whatsapp_otp").delete().eq("user_id", authUser.id);
          console.error("[forgot-password/request] WhatsApp Meta:", err instanceof Error ? err.message : err);
          return res.status(502).json({
            error: safeErrorMessage(err, "Não foi possível enviar o código no WhatsApp. Tente novamente em instantes."),
          });
        }

        void logEvent(supabaseAdmin, {
          eventType: "account.password-reset-requested",
          userId: authUser.id,
          userEmail: loginEmail,
          targetType: "account",
          targetId: authUser.id,
          description: "Código de recuperação de senha solicitado via WhatsApp (Meta Cloud).",
          req,
        });

        return res.json({ success: true, message: GENERIC_OK });
      } catch (error: unknown) {
        console.error("[forgot-password/request]", error);
        return res.status(500).json({ error: safeErrorMessage(error, "Erro ao solicitar recuperação.") });
      }
    }
  );

  app.post(
    "/api/v1/auth/forgot-password/confirm",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      try {
        const loginEmail = String((req.body || {}).loginEmail || "")
          .trim()
          .toLowerCase();
        const whatsappRaw = String((req.body || {}).whatsapp || "").trim();
        const whatsappInput = normalizeBrazilMsisdn(whatsappRaw);
        const code = String((req.body || {}).code || "").replace(/\D/g, "").trim();
        const newPassword = String((req.body || {}).newPassword || "");
        const confirmPassword = String((req.body || {}).confirmPassword || "");

        if (!loginEmail || !whatsappInput || !code) {
          return res.status(400).json({ error: "Preencha e-mail, WhatsApp e código." });
        }
        if (code.length !== 6) {
          return res.status(400).json({ error: "O código deve ter 6 dígitos." });
        }
        if (!newPassword || !confirmPassword) {
          return res.status(400).json({ error: "Informe e confirme a nova senha." });
        }
        const passwordCheck = validateStrongPassword(newPassword);
        if (passwordCheck.ok === false) {
          return res.status(400).json({ error: passwordCheck.message });
        }
        if (newPassword !== confirmPassword) {
          return res.status(400).json({ error: "A confirmação da nova senha não confere." });
        }
        await rejectCompromisedPassword(newPassword);

        const authUser = await findAuthUserByEmail(supabaseAdmin, loginEmail);
        if (!authUser?.id) {
          return res.status(400).json({ error: "Código inválido ou expirado. Solicite um novo." });
        }

        const filho = await resolveAuthenticatedFilho(supabaseAdmin, authUser.id);
        if (filho) {
          return res.status(403).json({ error: "Filhos de santo não usam este fluxo de recuperação." });
        }

        const storedWhatsapp = resolveZeladorWhatsapp(authUser);
        if (!phonesMatch(storedWhatsapp, whatsappInput)) {
          return res.status(400).json({ error: "Código inválido ou expirado. Solicite um novo." });
        }

        const { data: rawEntry, error: otpReadError } = await supabaseAdmin
          .from("password_reset_whatsapp_otp")
          .select("user_id, whatsapp, code_hash, expires_at, attempts")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (otpReadError) throw otpReadError;
        const entry = rawEntry as OtpEntry | null;
        if (!entry || new Date(entry.expires_at).getTime() < Date.now()) {
          await supabaseAdmin.from("password_reset_whatsapp_otp").delete().eq("user_id", authUser.id);
          return res.status(400).json({ error: "Código expirado. Solicite um novo código." });
        }

        if (entry.whatsapp !== whatsappInput) {
          return res.status(400).json({ error: "Código inválido ou expirado. Solicite um novo." });
        }

        const nextAttempts = entry.attempts + 1;
        if (nextAttempts > OTP_MAX_ATTEMPTS) {
          await supabaseAdmin.from("password_reset_whatsapp_otp").delete().eq("user_id", authUser.id);
          return res.status(429).json({ error: "Muitas tentativas. Solicite um novo código." });
        }

        if (!otpHashesMatch(hashOtp(code, authUser.id), entry.code_hash)) {
          const { error: attemptError } = await supabaseAdmin
            .from("password_reset_whatsapp_otp")
            .update({ attempts: nextAttempts })
            .eq("user_id", authUser.id)
            .eq("attempts", entry.attempts);
          if (attemptError) throw attemptError;
          return res.status(400).json({ error: "Código incorreto. Verifique o WhatsApp e tente de novo." });
        }

        const { data: consumedOtp, error: consumeError } = await supabaseAdmin
          .from("password_reset_whatsapp_otp")
          .delete()
          .eq("user_id", authUser.id)
          .eq("code_hash", entry.code_hash)
          .select("user_id")
          .maybeSingle();
        if (consumeError) throw consumeError;
        if (!consumedOtp) {
          return res.status(400).json({ error: "Código inválido ou já utilizado. Solicite um novo." });
        }

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: newPassword,
        });
        if (updErr) {
          return res.status(400).json({
            error: humanizePasswordPolicyError(updErr, safeErrorMessage(updErr, "Erro ao alterar senha.")),
          });
        }
        void logEvent(supabaseAdmin, {
          eventType: "account.password-reset-completed",
          userId: authUser.id,
          userEmail: loginEmail,
          targetType: "account",
          targetId: authUser.id,
          description: "Senha redefinida via código WhatsApp (Meta Cloud).",
          req,
        });

        return res.json({ success: true, message: "Senha redefinida com sucesso. Faça login com a nova senha." });
      } catch (error: unknown) {
        console.error("[forgot-password/confirm]", error);
        const status = Number((error as { status?: number })?.status) || 500;
        return res.status(status).json({ error: safeErrorMessage(error, "Erro ao redefinir senha.") });
      }
    }
  );
}
