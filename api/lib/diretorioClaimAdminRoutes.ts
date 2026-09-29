import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "./auditLog.js";
import { safeErrorMessage } from "./safeError.js";

type AdminContext = { user: { id: string; email?: string | null } };
type RequireAdmin = (req: Request, res: Response) => Promise<AdminContext | null>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalTrackingRows<T>(result: { data?: T[] | null; error?: { message?: string } | null }): T[] {
  if (!result.error) return result.data || [];
  if (/terreiro_claim_activation_events|whatsapp_deliveries|schema cache|does not exist/i.test(String(result.error.message || ""))) {
    return [];
  }
  throw result.error;
}

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
      const [{ data: claims, error }, { data: summaryRows, error: summaryError }] = await Promise.all([
        query,
        deps.supabaseAdmin
          .from("terreiro_claim_requests")
          .select("id, status, claimed_tenant_id, reviewed_at")
          .limit(5000),
      ]);
      if (error) throw error;
      if (summaryError) throw summaryError;

      const terreiroIds = [...new Set((claims || []).map((row) => String(row.terreiro_id || "")).filter(Boolean))];
      const tenantIds = [...new Set((claims || []).map((row) => String(row.claimed_tenant_id || "")).filter(Boolean))];
      const claimIds = (claims || []).map((row) => String(row.id));
      const [terreirosResult, tenantsResult, activationResult, deliveryResult, allActivationResult] = await Promise.all([
        terreiroIds.length
          ? deps.supabaseAdmin
              .from("terreiros_diretorio")
              .select("id, nome, slug, cidade, estado, endereco, verified_at, claimed_by_tenant_id")
              .in("id", terreiroIds)
          : Promise.resolve({ data: [], error: null }),
        tenantIds.length
          ? deps.supabaseAdmin.from("perfil_lider").select("id, nome_terreiro, email").in("id", tenantIds)
          : Promise.resolve({ data: [], error: null }),
        claimIds.length
          ? deps.supabaseAdmin
              .from("terreiro_claim_activation_events")
              .select("claim_id, event_type, created_at")
              .in("claim_id", claimIds)
          : Promise.resolve({ data: [], error: null }),
        claimIds.length
          ? deps.supabaseAdmin
              .from("whatsapp_deliveries")
              .select("source_id, status, template_name, created_at, delivered_at, read_at")
              .eq("source", "directory_claim")
              .in("source_id", claimIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        deps.supabaseAdmin
          .from("terreiro_claim_activation_events")
          .select("claim_id, event_type, created_at")
          .limit(10000),
      ]);
      if (terreirosResult.error) throw terreirosResult.error;
      if (tenantsResult.error) throw tenantsResult.error;
      const activationRows = optionalTrackingRows(activationResult);
      const deliveryRows = optionalTrackingRows(deliveryResult);
      const allActivationRows = optionalTrackingRows(allActivationResult);

      const terreiroById = new Map((terreirosResult.data || []).map((row) => [String(row.id), row]));
      const tenantById = new Map((tenantsResult.data || []).map((row) => [String(row.id), row]));
      const activationByClaim = new Map<string, Record<string, string>>();
      for (const event of activationRows) {
        const id = String(event.claim_id || "");
        const current = activationByClaim.get(id) || {};
        current[String(event.event_type || "")] = String(event.created_at || "");
        activationByClaim.set(id, current);
      }
      const deliveryByClaim = new Map<string, (typeof deliveryRows)[number]>();
      for (const delivery of deliveryRows) {
        const id = String(delivery.source_id || "");
        if (id && !deliveryByClaim.has(id)) deliveryByClaim.set(id, delivery);
      }
      const rows = (claims || []).map((claim) => ({
        ...claim,
        terreiro: terreiroById.get(String(claim.terreiro_id)) || null,
        tenant: claim.claimed_tenant_id ? tenantById.get(String(claim.claimed_tenant_id)) || null : null,
        activation: activationByClaim.get(String(claim.id)) || {},
        latestDelivery: deliveryByClaim.get(String(claim.id)) || null,
      }));

      const allEventsByClaim = new Map<string, Set<string>>();
      for (const event of allActivationRows) {
        const id = String(event.claim_id || "");
        if (!allEventsByClaim.has(id)) allEventsByClaim.set(id, new Set());
        allEventsByClaim.get(id)?.add(String(event.event_type || ""));
      }
      const stalledBefore = Date.now() - 72 * 60 * 60 * 1000;
      const summary = (summaryRows || []).reduce(
        (result, row) => {
          const itemStatus = String(row.status || "");
          const events = allEventsByClaim.get(String(row.id)) || new Set<string>();
          result.total += 1;
          if (itemStatus === "pending") result.pending += 1;
          if (itemStatus === "approved") result.approved += 1;
          if (itemStatus === "rejected") result.rejected += 1;
          if (row.claimed_tenant_id || events.has("activation_completed")) result.linked += 1;
          if (events.has("activation_opened")) result.opened += 1;
          if (events.has("activation_started")) result.started += 1;
          if (itemStatus === "approved" && !row.claimed_tenant_id) {
            result.awaitingActivation += 1;
            const reviewedAt = new Date(String(row.reviewed_at || "")).getTime();
            if (reviewedAt > 0 && reviewedAt <= stalledBefore && !events.has("activation_completed")) result.stalled += 1;
          }
          return result;
        },
        { total: 0, pending: 0, approved: 0, rejected: 0, linked: 0, awaitingActivation: 0, opened: 0, started: 0, stalled: 0 },
      );

      res.json({ rows, status, summary });
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

      const { data: claimRow } = await deps.supabaseAdmin
        .from("terreiro_claim_requests")
        .select("id, requester_name, requester_phone, terreiro_id")
        .eq("id", claimId)
        .maybeSingle();
      const claim = claimRow || (data && typeof data === "object" ? (data as Record<string, unknown>) : {});
      let notify: {
        sent: boolean;
        reason?: string;
        error?: string;
        phoneMasked?: string;
        registerUrl?: string;
        deliveryId?: string;
        template?: string;
      } | null = null;
      if (status === "approved") {
        const { notifyApprovedTerreiroClaim } = await import("./diretorioClaimNotify.js");
        let terreiroNome = "";
        const terreiroId = String(claim.terreiro_id || "").trim();
        if (terreiroId) {
          const { data: terreiro } = await deps.supabaseAdmin
            .from("terreiros_diretorio")
            .select("nome")
            .eq("id", terreiroId)
            .maybeSingle();
          terreiroNome = String(terreiro?.nome || "").trim();
        }
        notify = await notifyApprovedTerreiroClaim(deps.supabaseAdmin, {
          claimId,
          requesterName: String(claim.requester_name || ""),
          requesterPhone: String(claim.requester_phone || ""),
          terreiroNome,
          linkedTenantId: tenantId,
          requestedBy: ctx.user.id,
        });
        const { recordClaimActivationEvent } = await import("./directoryClaimActivation.js");
        await recordClaimActivationEvent(deps.supabaseAdmin, claimId, "approved", {
          metadata: { linkedTenantId: tenantId },
        });
        if (notify.sent) {
          await recordClaimActivationEvent(deps.supabaseAdmin, claimId, "notification_sent", {
            deliveryId: notify.deliveryId,
            metadata: { template: notify.template },
          });
        }
      }

      void logEvent(deps.supabaseAdmin, {
        eventType: `directory.claim.${status}`,
        userId: ctx.user.id,
        userEmail: ctx.user.email || undefined,
        targetType: "directory-claim",
        targetId: claimId,
        tenantId: tenantId || undefined,
        description: status === "approved"
          ? tenantId
            ? "Reivindicação aprovada e vinculada à conta."
            : "Reivindicação aprovada, aguardando criação da conta."
          : "Reivindicação de terreiro recusada.",
        metadata: { claimId, tenantId, adminNotes, notify },
        req,
      });

      res.json({ success: true, claim: data, notify });
    } catch (error: unknown) {
      console.error("[admin-console/diretorio-claims/review]", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao analisar reivindicação.") });
    }
  });

  app.post("/api/admin-console/diretorio-claims/:id/resend-notification", async (req, res) => {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const claimId = String(req.params.id || "").trim();
    if (!UUID_PATTERN.test(claimId)) return res.status(400).json({ error: "Solicitação inválida." });

    try {
      const { data: claim, error } = await deps.supabaseAdmin
        .from("terreiro_claim_requests")
        .select("id, status, requester_name, requester_phone, terreiro_id, claimed_tenant_id")
        .eq("id", claimId)
        .maybeSingle();
      if (error) throw error;
      if (!claim) return res.status(404).json({ error: "Reivindicação não encontrada." });
      if (String(claim.status) !== "approved") {
        return res.status(409).json({ error: "A notificação só pode ser enviada após a aprovação." });
      }

      let terreiroNome = "";
      if (claim.terreiro_id) {
        const { data: terreiro } = await deps.supabaseAdmin
          .from("terreiros_diretorio")
          .select("nome")
          .eq("id", claim.terreiro_id)
          .maybeSingle();
        terreiroNome = String(terreiro?.nome || "").trim();
      }

      const { notifyApprovedTerreiroClaim } = await import("./diretorioClaimNotify.js");
      const notify = await notifyApprovedTerreiroClaim(deps.supabaseAdmin, {
        claimId,
        requesterName: String(claim.requester_name || ""),
        requesterPhone: String(claim.requester_phone || ""),
        terreiroNome,
        linkedTenantId: claim.claimed_tenant_id ? String(claim.claimed_tenant_id) : null,
        requestedBy: ctx.user.id,
        notificationKind: "manual_resend",
      });

      void logEvent(deps.supabaseAdmin, {
        eventType: "directory.claim.notification_resend",
        userId: ctx.user.id,
        userEmail: ctx.user.email || undefined,
        targetType: "directory-claim",
        targetId: claimId,
        tenantId: claim.claimed_tenant_id || undefined,
        description: notify.sent
          ? "Notificação da reivindicação enviada ou já confirmada."
          : "Tentativa de reenvio da notificação da reivindicação falhou.",
        metadata: { claimId, notify },
        req,
      });

      res.status(notify.sent ? 200 : 422).json({ success: notify.sent, notify });
    } catch (error: unknown) {
      console.error("[admin-console/diretorio-claims/resend-notification]", error);
      res.status(500).json({
        error: safeErrorMessage(error, "Erro ao reenviar a notificação da reivindicação."),
      });
    }
  });}
