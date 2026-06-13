import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { S3Client } from "@aws-sdk/client-s3";
import { permanentDeleteZeladorAccount } from "../permanentAccountDelete.js";
import { createAuditLog } from "./createAuditLog.js";
import { logEvent } from "./auditLog.js";

export type ManageTenantBody = {
  targetUserId?: string;
  action?: string;
  newPlan?: string;
  amount?: string;
  unit?: string;
};

export async function runManageTenant(
  supabaseAdmin: SupabaseClient,
  user: User,
  req: any,
  body: ManageTenantBody,
  r2?: { client: S3Client; bucket: string }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const targetUserId = String(body.targetUserId || "").trim();
  const action = String(body.action || "").trim();
  if (!targetUserId || !action) {
    return { status: 400, body: { error: "targetUserId e action são obrigatórios" } };
  }

  let logDescription = "";
  let logMetadata: Record<string, unknown> = {};

  switch (action) {
    case "block":
      await supabaseAdmin.from("perfil_lider").update({ is_blocked: true }).eq("id", targetUserId);
      logDescription = `Terreiro ${targetUserId} bloqueado.`;
      break;
    case "unblock":
      await supabaseAdmin.from("perfil_lider").update({ is_blocked: false }).eq("id", targetUserId);
      logDescription = `Terreiro ${targetUserId} desbloqueado.`;
      break;
    case "delete":
      await supabaseAdmin
        .from("perfil_lider")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", targetUserId);
      logDescription = `Terreiro ${targetUserId} marcado como excluído (soft delete).`;
      break;
    case "permanent-delete": {
      const result = await permanentDeleteZeladorAccount(
        {
          supabaseAdmin,
          r2,
          beforeDbPurge: async () => {
            /* canal oficial único — sem instância Baileys por terreiro */
          },
        },
        targetUserId
      );
      if (result.ok === false) {
        return { status: result.status, body: { error: result.message } };
      }
      logDescription = `Terreiro ${targetUserId} excluído permanentemente (Postgres, storage, auth).`;
      break;
    }
    case "change-plan": {
      if (!body.newPlan) return { status: 400, body: { error: "Novo plano é obrigatório" } };
      const newPlanSlug = String(body.newPlan).toLowerCase().trim();
      const lifetimeChange = newPlanSlug === "vita" || newPlanSlug === "cortesia";
      const changePayload: Record<string, unknown> = {
        id: targetUserId,
        plan: newPlanSlug,
        status: "active",
      };
      if (lifetimeChange) changePayload.expires_at = null;
      await supabaseAdmin.from("subscriptions").upsert(changePayload, { onConflict: "id" });
      logDescription = `Plano do terreiro alterado para "${newPlanSlug}".`;
      logMetadata = { newPlan: newPlanSlug, lifetime: lifetimeChange };
      break;
    }
    case "renew": {
      if (!body.amount || !body.unit) {
        return { status: 400, body: { error: "Quantidade e unidade são obrigatórios para renovação" } };
      }
      const { data: currentSub } = await supabaseAdmin
        .from("subscriptions")
        .select("expires_at")
        .eq("id", targetUserId)
        .maybeSingle();
      let baseDate = new Date();
      if (currentSub?.expires_at && new Date(String(currentSub.expires_at)) > new Date()) {
        baseDate = new Date(String(currentSub.expires_at));
      }
      if (body.unit === "days") {
        baseDate.setDate(baseDate.getDate() + parseInt(String(body.amount), 10));
      } else if (body.unit === "months") {
        baseDate.setMonth(baseDate.getMonth() + parseInt(String(body.amount), 10));
      } else {
        return { status: 400, body: { error: "Unidade inválida (days ou months)" } };
      }
      await supabaseAdmin.from("subscriptions").upsert(
        {
          id: targetUserId,
          expires_at: baseDate.toISOString(),
          status: "active",
        },
        { onConflict: "id" }
      );
      logDescription = `Assinatura renovada (+${body.amount} ${body.unit}) até ${baseDate.toISOString().split("T")[0]}.`;
      logMetadata = { amount: body.amount, unit: body.unit, newExpiresAt: baseDate.toISOString() };
      break;
    }
    case "set-lifetime":
      await supabaseAdmin.from("subscriptions").upsert(
        {
          id: targetUserId,
          plan: "vita",
          status: "active",
          expires_at: null,
        },
        { onConflict: "id" }
      );
      logDescription = "Terreiro marcado como Vitalício (sem expiração).";
      break;
    default:
      return { status: 400, body: { error: "Ação inválida" } };
  }

  void logEvent(supabaseAdmin, {
    eventType: `tenant.${action}`,
    userId: user.id,
    userEmail: user.email,
    targetType: "tenant",
    targetId: targetUserId,
    tenantId: targetUserId,
    description: logDescription,
    metadata: logMetadata,
    req,
  });
  void createAuditLog(supabaseAdmin, req, `tenant.${action}`, "success", targetUserId, {
    userId: user.id,
    email: user.email,
    description: logDescription,
    targetUserId,
    ...logMetadata,
  });

  return { status: 200, body: { success: true, message: "Comando enviado com sucesso" } };
}
