import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "./auditLog.js";
import { safeErrorMessage } from "./safeError.js";

type AdminContext = { user: { id: string; email?: string | null } };
type RequireAdmin = (req: Request, res: Response) => Promise<AdminContext | null>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerDiretorioClaimAdminRoutes(
  app: Express,
  deps: { supabaseAdmin: SupabaseClient },
  requireAdmin: RequireAdmin,
) {
  app.get("/api/admin-console/diretorio-claims", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    try {
      const requestedStatus = String(req.query.status || "pending").trim().toLowerCase();
      const status = ["pending", "approved", "rejected", "all"].includes(requestedStatus)
        ? requestedStatus
        : "pending";
      let query = deps.supabaseAdmin
        .from("terreiro_claim_requests")
        .select("id, terreiro_id, requester_name, requester_role, requester_email, requester_phone, evidence, message, status, admin_notes, claimed_tenant_id, reviewed_by, reviewed_at, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (status !== "all") query = query.eq("status", status);
      const { data: claims, error } = await query;
      if (error) throw error;

      const terreiroIds = [...new Set((claims || []).map((row) => String(row.terreiro_id || "")).filter(Boolean))];
      const tenantIds = [...new Set((claims || []).map((row) => String(row.claimed_tenant_id || "")).filter(Boolean))];
      const [terreirosResult, tenantsResult] = await Promise.all([
        terreiroIds.length
          ? deps.supabaseAdmin
              .from("terreiros_diretorio")
              .select("id, nome, slug, cidade, estado, endereco, verified_at, claimed_by_tenant_id")
              .in("id", terreiroIds)
          : Promise.resolve({ data: [], error: null }),
        tenantIds.length
          ? deps.supabaseAdmin.from("perfil_lider").select("id, nome_terreiro, email").in("id", tenantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (terreirosResult.error) throw terreirosResult.error;
      if (tenantsResult.error) throw tenantsResult.error;

      const terreiroById = new Map((terreirosResult.data || []).map((row) => [String(row.id), row]));
      const tenantById = new Map((tenantsResult.data || []).map((row) => [String(row.id), row]));
      const rows = (claims || []).map((claim) => ({
        ...claim,
        terreiro: terreiroById.get(String(claim.terreiro_id)) || null,
        tenant: claim.claimed_tenant_id ? tenantById.get(String(claim.claimed_tenant_id)) || null : null,
      }));

      res.json({ rows, status });
    } catch (error: unknown) {
      const message = String((error as { message?: string })?.message || "");
      if (/terreiro_claim_requests|schema cache|does not exist/i.test(message)) {
        return res.status(503).json({ error: "A migration de reivindicações ainda não foi aplicada no Supabase." });
      }
      console.error("[admin-console/diretorio-claims]", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar reivindicações.") });
    }
  });

  app.post("/api/admin-console/diretorio-claims/:id/review", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const claimId = String(req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    const adminNotes = String(req.body?.adminNotes || "").trim().slice(0, 1500) || null;
    const tenantId = String(req.body?.tenantId || "").trim() || null;
    if (!UUID_PATTERN.test(claimId)) return res.status(400).json({ error: "Solicitação inválida." });
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Escolha aprovar ou recusar a solicitação." });
    }
    if (status === "approved" && !tenantId) {
      return res.status(400).json({ error: "Crie ou selecione a conta do terreiro antes de aprovar. Essa conta administrará o perfil." });
    }
    if (tenantId && !UUID_PATTERN.test(tenantId)) return res.status(400).json({ error: "Conta de terreiro inválida." });

    try {
      if (tenantId) {
        const { data: tenant, error: tenantError } = await deps.supabaseAdmin
          .from("perfil_lider")
          .select("id")
          .eq("id", tenantId)
          .maybeSingle();
        if (tenantError) throw tenantError;
        if (!tenant) return res.status(404).json({ error: "A conta escolhida não existe." });
      }

      const { data, error } = await deps.supabaseAdmin.rpc("review_terreiro_claim", {
        p_claim_id: claimId,
        p_status: status,
        p_admin_notes: adminNotes,
        p_tenant_id: status === "approved" ? tenantId : null,
        p_reviewed_by: ctx.user.id,
      });
      if (error) throw error;

      void logEvent(deps.supabaseAdmin, {
        eventType: `directory.claim.${status}`,
        userId: ctx.user.id,
        userEmail: ctx.user.email || undefined,
        targetType: "directory-claim",
        targetId: claimId,
        tenantId: tenantId || undefined,
        description: status === "approved" ? "Reivindicação de terreiro aprovada." : "Reivindicação de terreiro recusada.",
        metadata: { claimId, tenantId, adminNotes },
        req,
      });

      res.json({ success: true, claim: data });
    } catch (error: unknown) {
      console.error("[admin-console/diretorio-claims/review]", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao analisar reivindicação.") });
    }
  });
}
