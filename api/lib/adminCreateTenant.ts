import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  CONSOLE_ADMIN_INSTANCE_NAME,
  sendEvolutionTextByInstance,
} from "../../src/services/evolution.service.js";
import {
  loadWelcomeMessageConfig,
  normalizeBrazilMsisdn,
  renderWelcomeMessage,
} from "./welcomeMessage.js";
import { createAuditLog } from "./createAuditLog.js";
import { logEvent } from "./auditLog.js";
import { safeErrorMessage } from "./safeError.js";

export type CreateTenantBody = {
  email?: string;
  password?: string;
  nome_terreiro?: string;
  nome_zelador?: string;
  whatsapp?: string;
  plan?: string;
  observacao?: string;
};

export async function runCreateTenant(
  supabaseAdmin: SupabaseClient,
  user: User,
  req: any,
  body: CreateTenantBody
): Promise<{ status: number; body: Record<string, unknown> }> {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const nome_terreiro = String(body.nome_terreiro || "").trim();
  const nome_zelador = String(body.nome_zelador || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();
  const plan = String(body.plan || "").trim();
  const observacao = String(body.observacao || "").trim();

  if (!email || !password) {
    return { status: 400, body: { error: "email e password são obrigatórios" } };
  }

  let targetUser;
  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_terreiro, nome_zelador, whatsapp, plan, observacao },
  });

  if (createError) {
    if (!String(createError.message || "").toLowerCase().includes("registered")) {
      throw createError;
    }
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError || !listData) throw listError || new Error("Falha ao listar usuários");
    const existingUser = (listData.users as { id: string; email?: string }[]).find((u) => u.email === email);
    if (!existingUser) throw new Error("Erro ao recuperar usuário existente.");
    const { data: updatedUser, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        password,
        user_metadata: { nome_terreiro, nome_zelador, whatsapp, plan, observacao },
      }
    );
    if (updateAuthError) throw updateAuthError;
    targetUser = updatedUser.user;
  } else {
    targetUser = createdUser!.user;
  }

  if (plan && plan !== "free") {
    const planSlug = String(plan).toLowerCase().trim();
    const isLifetime = planSlug === "vita" || planSlug === "cortesia";
    const expiresAt: string | null = isLifetime
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: subError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        id: targetUser.id,
        plan: planSlug,
        status: "active",
        expires_at: expiresAt,
      },
      { onConflict: "id" }
    );
    if (subError) {
      return {
        status: 500,
        body: { error: safeErrorMessage(subError, `Falha ao gravar assinatura (${planSlug})`) },
      };
    }
  }

  const { error: profileError } = await supabaseAdmin.from("perfil_lider").upsert(
    {
      id: targetUser.id,
      email,
      nome_terreiro,
      cargo: nome_zelador,
      role: "admin",
      tenant_id: targetUser.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) console.error("[adminCreateTenant] profile:", profileError);

  let welcomeStatus: "skipped" | "queued" | "no-phone" | "disabled" = "skipped";
  try {
    const cfg = await loadWelcomeMessageConfig(supabaseAdmin);
    if (!cfg.enabled) {
      welcomeStatus = "disabled";
    } else {
      const msisdn = normalizeBrazilMsisdn(whatsapp || "");
      if (!msisdn) {
        welcomeStatus = "no-phone";
      } else {
        const text = renderWelcomeMessage(cfg.template, {
          nome_terreiro,
          nome_zelador,
          email,
          senha: password,
          site: cfg.loginUrl,
          assinatura: cfg.signature,
        });
        welcomeStatus = "queued";
        void sendEvolutionTextByInstance(CONSOLE_ADMIN_INSTANCE_NAME, msisdn, text).catch((err) =>
          console.error("[adminCreateTenant] welcome WA:", err?.message || err)
        );
      }
    }
  } catch (welErr: unknown) {
    console.error("[adminCreateTenant] welcome setup:", welErr);
  }

  void logEvent(supabaseAdmin, {
    eventType: "tenant.created",
    userId: user.id,
    userEmail: user.email,
    targetType: "tenant",
    targetId: targetUser.id,
    tenantId: targetUser.id,
    description: `Terreiro "${nome_terreiro}" criado para ${email} (plano ${plan || "free"}).`,
    metadata: { email, nome_terreiro, nome_zelador, plan, welcome: welcomeStatus },
    req,
  });
  void createAuditLog(supabaseAdmin, req, "tenant.created", "success", targetUser.id, {
    userId: user.id,
    email: user.email,
    emailTenant: email,
    nome_terreiro,
    nome_zelador,
    plan,
    welcome: welcomeStatus,
  });

  return {
    status: 200,
    body: {
      success: true,
      user: { id: targetUser.id, email: targetUser.email, password },
      welcome: { status: welcomeStatus },
    },
  };
}
