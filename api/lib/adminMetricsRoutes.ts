import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import geoip from "geoip-lite";
import { applyDiscreteRouteCors } from "./corsOrigins.js";
import { requireApiUser, requireApiGlobalAdmin } from "./routeAuthHelpers.js";
import { consumeRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { trackPublicSiteVisit } from "./publicSiteTraffic.js";

type Deps = { supabaseAdmin: SupabaseClient };

/** B1: rotas admin/metrics partilhadas entre api/index.ts (prod) e server.ts (dev). */
export function registerAdminMetricsRoutes(app: Express, { supabaseAdmin }: Deps) {
  app.post("/api/metrics/public-visit", async (req, res) => {
    if (applyDiscreteRouteCors(req, res)) return;

    const rl = consumeRateLimit(req, { windowMs: 60 * 60 * 1000, max: 120, keyPrefix: "public-visit" });
    if (!rl.allowed) {
      return res.status(429).json({ error: "Limite de registos excedido." });
    }

    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const visitorId = String(body.visitorId || "").trim();
      const path = String(body.path || "/").trim();
      const referrer = body.referrer != null ? String(body.referrer) : null;

      const result = await trackPublicSiteVisit(supabaseAdmin, req, { visitorId, path, referrer });
      if (!result.ok) {
        return res.status(400).json({ error: "Dados de visita inválidos." });
      }
      res.json({ success: true, duplicate: result.duplicate === true });
    } catch (error) {
      console.error("[METRICS] Error tracking public visit:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/metrics/track-activity", async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const forwarded = req.headers["x-forwarded-for"] as string | undefined;
      const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;

      let geoData: geoip.Lookup | null = null;
      if (ip && ip !== "::1" && ip !== "127.0.0.1") {
        geoData = geoip.lookup(ip) || null;
      }

      await supabaseAdmin.from("access_logs").insert({
        event_type: "session.activity",
        user_id: user.id,
        user_email: user.email ? String(user.email).toLowerCase() : null,
        ip: ip || null,
        city: geoData?.city || null,
        region: geoData?.region || null,
        country: geoData?.country || null,
        metadata: geoData?.ll ? { ll: geoData.ll } : null,
        user_agent: req.headers["user-agent"] || null,
      });

      res.json({ success: true, geo: geoData });
    } catch (error) {
      console.error("[METRICS] Error tracking activity:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/system-stats", async (req, res) => {
    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res, {
        forbiddenMessage: "Forbidden: Admin access required",
      });
      if (!user) return;

      const { data: childrenStats, error: childrenError } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("tenant_id");
      if (childrenError) throw childrenError;

      const childrenPerTenant: Record<string, number> = {};
      (childrenStats || []).forEach((c: { tenant_id?: string | null }) => {
        const tid = String(c.tenant_id || "");
        if (!tid) return;
        childrenPerTenant[tid] = (childrenPerTenant[tid] || 0) + 1;
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { fetchAdminActivityStats } = await import("./adminActivityStats.js");
      const stats = await fetchAdminActivityStats(supabaseAdmin);
      res.json({
        childrenPerTenant: stats.childrenPerTenant,
        dailyAccess: stats.dailyAccess,
        geoActivity: stats.geoActivity,
      });
    } catch (error) {
      console.error("[STATS] Error fetching system stats:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/tenant-usage/:tenantId", async (req, res) => {
    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res, {
        forbiddenMessage: "Forbidden: Admin access required",
      });
      if (!user) return;

      const tenantId = String(req.params.tenantId || "").trim();
      if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: eventsCount } = await supabaseAdmin
        .from("convidados_eventos")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      const { count: childrenCount } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      const storageEstimate = (Math.random() * 2 + (childrenCount || 0) * 0.1).toFixed(2);

      res.json({
        eventsCreated: eventsCount || 0,
        totalChildren: childrenCount || 0,
        storageUsed: parseFloat(storageEstimate),
        storageLimit: 10,
        lastActivity: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[USAGE] Error fetching tenant usage:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/admin/generate-trial", sensitiveActionRateLimit, async (req, res) => {
    const { email, password, nome_terreiro, plan, days } = req.body || {};

    try {
      const user = await requireApiGlobalAdmin(supabaseAdmin, req, res, {
        forbiddenMessage: "Forbidden",
      });
      if (!user) return;

      if (!email || !password || !nome_terreiro || !plan || !days) {
        return res.status(400).json({ error: "email, password, nome_terreiro, plan e days são obrigatórios" });
      }

      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_terreiro, plan, is_trial: true },
      });
      if (createError) throw createError;

      const targetUser = createdUser.user;
      const expiresAt = new Date(
        Date.now() + parseInt(String(days), 10) * 24 * 60 * 60 * 1000
      ).toISOString();

      await supabaseAdmin.from("subscriptions").upsert(
        {
          id: targetUser.id,
          plan: String(plan).toLowerCase(),
          status: "active",
          expires_at: expiresAt,
        },
        { onConflict: "id" }
      );

      await supabaseAdmin.from("perfil_lider").upsert(
        {
          id: targetUser.id,
          email,
          nome_terreiro,
          tenant_id: targetUser.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      res.json({ success: true, email, password, expiresAt });
    } catch (error: any) {
      console.error("[SERVER] Erro ao gerar trial:", error);
      res.status(500).json({ error: error?.message || "Internal Server Error" });
    }
  });
}
