import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import geoip from "geoip-lite";
import { requireApiUser, requireApiGlobalAdmin } from "./routeAuthHelpers.js";
import { sensitiveActionRateLimit } from "./rateLimit.js";

type Deps = { supabaseAdmin: SupabaseClient };

/** B1: rotas admin/metrics partilhadas entre api/index.ts (prod) e server.ts (dev). */
export function registerAdminMetricsRoutes(app: Express, { supabaseAdmin }: Deps) {
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
        user_id: user.id,
        ip: ip || null,
        city: geoData?.city || null,
        region: geoData?.region || null,
        country: geoData?.country || null,
        ll: geoData?.ll || null,
        user_agent: req.headers["user-agent"] || null,
        created_at: new Date().toISOString(),
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

      const { data: accessLogs, error: accessError } = await supabaseAdmin
        .from("access_logs")
        .select("created_at, city, ll")
        .gte("created_at", thirtyDaysAgo.toISOString());
      if (accessError) throw accessError;

      const dailyAccess: Record<string, number> = {};
      (accessLogs || []).forEach((log: { created_at?: string }) => {
        const date = String(log.created_at || "").split("T")[0];
        if (!date) return;
        dailyAccess[date] = (dailyAccess[date] || 0) + 1;
      });

      res.json({
        childrenPerTenant,
        dailyAccess,
        geoActivity:
          (accessLogs || [])
            .filter((l: { ll?: number[] | null }) => Array.isArray(l.ll) && l.ll.length >= 2)
            .map((l: { city?: string | null; ll?: number[] }) => ({
              city: l.city,
              lat: l.ll![0],
              lon: l.ll![1],
            })) || [],
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
