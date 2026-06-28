import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Express, Request, Response } from "express";
import { logEvent } from "./auditLog.js";
import { resolvePerfilLiderEmail } from "./perfilLiderEmail.js";
import { resolveAuthenticatedFilho } from "./tenantAccess.js";
import { requireApiUser } from "./routeAuthHelpers.js";
import { sensitiveActionRateLimit } from "./rateLimit.js";
import { safeErrorMessage } from "./safeError.js";
import { getSupabaseServerAnonKey, getSupabaseServerUrl } from "./supabaseServerEnv.js";
import { humanizePasswordPolicyError, validateStrongPassword } from "../../lib/passwordPolicy.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Deps = { supabaseAdmin: SupabaseClient };

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

async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const url = getSupabaseServerUrl();
  const anon = getSupabaseServerAnonKey();
  if (!url || !anon) throw new Error("Supabase não configurado no servidor.");
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

async function assertZeladorAccount(
  sb: SupabaseClient,
  userId: string,
  res: Response
): Promise<boolean> {
  const filho = await resolveAuthenticatedFilho(sb, userId);
  if (filho) {
    res.status(403).json({ error: "Filhos de santo não podem alterar credenciais de zelador." });
    return false;
  }
  return true;
}

function invalidPasswordMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Senha atual incorreta.";
  }
  return msg;
}

export function registerAccountCredentialsRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.post(
    "/api/v1/account/change-password",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      try {
        const user = await requireApiUser(supabaseAdmin, req, res);
        if (!user) return;
        if (!(await assertZeladorAccount(supabaseAdmin, user.id, res))) return;

        const currentPassword = String((req.body || {}).currentPassword || "");
        const newPassword = String((req.body || {}).newPassword || "");
        const confirmPassword = String((req.body || {}).confirmPassword || "");

        if (!currentPassword || !newPassword || !confirmPassword) {
          return res.status(400).json({ error: "Preencha a senha atual, a nova senha e a confirmação." });
        }
        const passwordCheck = validateStrongPassword(newPassword);
        if (!passwordCheck.ok) {
          return res.status(400).json({ error: passwordCheck.message });
        }
        if (newPassword !== confirmPassword) {
          return res.status(400).json({ error: "A confirmação da nova senha não confere." });
        }
        if (currentPassword === newPassword) {
          return res.status(400).json({ error: "A nova senha deve ser diferente da senha atual." });
        }

        const email = await resolvePerfilLiderEmail(supabaseAdmin, user);
        const passwordOk = await verifyCurrentPassword(email, currentPassword);
        if (!passwordOk) {
          return res.status(401).json({ error: "Senha atual incorreta." });
        }

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });
        if (updErr) {
          return res.status(400).json({
            error: humanizePasswordPolicyError(updErr, invalidPasswordMessage(safeErrorMessage(updErr, "Erro ao alterar senha."))),
          });
        }

        void logEvent(supabaseAdmin, {
          eventType: "account.password-changed",
          userId: user.id,
          userEmail: email,
          targetType: "account",
          targetId: user.id,
          description: "Zelador alterou a senha da conta.",
          req,
        });

        return res.json({ success: true });
      } catch (error: unknown) {
        console.error("[account/change-password]", error);
        return res.status(500).json({ error: safeErrorMessage(error, "Erro interno ao alterar senha.") });
      }
    }
  );

  app.post(
    "/api/v1/account/change-email",
    sensitiveActionRateLimit,
    async (req: Request, res: Response) => {
      try {
        const user = await requireApiUser(supabaseAdmin, req, res);
        if (!user) return;
        if (!(await assertZeladorAccount(supabaseAdmin, user.id, res))) return;

        const newEmailRaw = String((req.body || {}).newEmail || "").trim().toLowerCase();
        const currentPassword = String((req.body || {}).currentPassword || "");

        if (!newEmailRaw || !currentPassword) {
          return res.status(400).json({ error: "Informe o novo e-mail e a senha atual." });
        }
        if (!EMAIL_RE.test(newEmailRaw)) {
          return res.status(400).json({ error: "Informe um e-mail válido." });
        }

        const currentEmail = await resolvePerfilLiderEmail(supabaseAdmin, user);
        if (newEmailRaw === currentEmail) {
          return res.status(400).json({ error: "O novo e-mail é igual ao e-mail atual." });
        }

        const passwordOk = await verifyCurrentPassword(currentEmail, currentPassword);
        if (!passwordOk) {
          return res.status(401).json({ error: "Senha atual incorreta." });
        }

        const existing = await findAuthUserByEmail(supabaseAdmin, newEmailRaw);
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ error: "Este e-mail já está em uso por outra conta." });
        }

        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email: newEmailRaw,
          email_confirm: true,
        });
        if (authErr) {
          return res.status(400).json({ error: safeErrorMessage(authErr, "Erro ao alterar e-mail.") });
        }

        const now = new Date().toISOString();
        const { error: profileErr } = await supabaseAdmin
          .from("perfil_lider")
          .update({ email: newEmailRaw, updated_at: now })
          .eq("id", user.id);
        if (profileErr) {
          console.error("[account/change-email] perfil_lider:", profileErr);
          return res.status(500).json({ error: safeErrorMessage(profileErr, "E-mail alterado no login, mas falhou ao sincronizar o perfil.") });
        }

        void logEvent(supabaseAdmin, {
          eventType: "account.email-changed",
          userId: user.id,
          userEmail: newEmailRaw,
          targetType: "account",
          targetId: user.id,
          description: "Zelador alterou o e-mail da conta.",
          metadata: { previousEmail: currentEmail },
          req,
        });

        return res.json({ success: true, email: newEmailRaw });
      } catch (error: unknown) {
        console.error("[account/change-email]", error);
        return res.status(500).json({ error: safeErrorMessage(error, "Erro interno ao alterar e-mail.") });
      }
    }
  );
}
