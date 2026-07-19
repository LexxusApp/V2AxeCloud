import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Express, Request, Response } from "express";
import { CONSOLE_ADMIN_INSTANCE_NAME } from "../../src/services/evolution.service.js";
import { sendEvolutionTextQueued } from "./evolutionSendQueue.js";
import { logEvent } from "./auditLog.js";
import { normalizeBrazilMsisdn } from "./welcomeMessage.js";
import { resolveAuthenticatedFilho } from "./tenantAccess.js";
import { sensitiveActionRateLimit } from "./rateLimit.js";
import { safeErrorMessage } from "./safeError.js";
import { humanizePasswordPolicyError, validateStrongPassword } from "../../lib/passwordPolicy.js";
import { rejectCompromisedPassword } from "./pwnedPassword.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type OtpEntry = {
  userId: string;
  whatsapp: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

const otpByUserId = new Map<string, OtpEntry>();

type Deps = { supabaseAdmin: SupabaseClient };

function hashOtp(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
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
        const expiresAt = Date.now() + OTP_TTL_MS;
        otpByUserId.set(authUser.id, {
          userId: authUser.id,
          whatsapp: whatsappInput,
          codeHash: hashOtp(code, authUser.id),
          expiresAt,
          attempts: 0,
        });

        const text =
          `🔐 *AxéCloud — recuperação de senha*\n\n` +
          `Seu código para redefinir a senha do login *${loginEmail}*:\n\n` +
          `*${code}*\n\n` +
          `Válido por 10 minutos. Se não solicitou, ignore esta mensagem.`;

        void sendEvolutionTextQueued(CONSOLE_ADMIN_INSTANCE_NAME, whatsappInput, text, {
          category: "critical",
          tipo: "forgot_password",
          skipSendWindow: true,
          sb: supabaseAdmin,
        }).catch((err) => {
          console.error("[forgot-password/request] WhatsApp:", err?.message || err);
        });

        void logEvent(supabaseAdmin, {
          eventType: "account.password-reset-requested",
          userId: authUser.id,
          userEmail: loginEmail,
          targetType: "account",
          targetId: authUser.id,
          description: "Código de recuperação de senha solicitado via WhatsApp.",
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

        const entry = otpByUserId.get(authUser.id);
        if (!entry || entry.expiresAt < Date.now()) {
          otpByUserId.delete(authUser.id);
          return res.status(400).json({ error: "Código expirado. Solicite um novo código." });
        }

        entry.attempts += 1;
        if (entry.attempts > OTP_MAX_ATTEMPTS) {
          otpByUserId.delete(authUser.id);
          return res.status(429).json({ error: "Muitas tentativas. Solicite um novo código." });
        }

        if (entry.codeHash !== hashOtp(code, authUser.id)) {
          return res.status(400).json({ error: "Código incorreto. Verifique o WhatsApp e tente de novo." });
        }

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: newPassword,
        });
        if (updErr) {
          return res.status(400).json({
            error: humanizePasswordPolicyError(updErr, safeErrorMessage(updErr, "Erro ao alterar senha.")),
          });
        }

        otpByUserId.delete(authUser.id);

        void logEvent(supabaseAdmin, {
          eventType: "account.password-reset-completed",
          userId: authUser.id,
          userEmail: loginEmail,
          targetType: "account",
          targetId: authUser.id,
          description: "Senha redefinida via código WhatsApp.",
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
