import type { Express } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchGiraWhatsApp } from "./cronWhatsAppJobs.js";
import { requireApiUser } from "./routeAuthHelpers.js";
import { safeErrorMessage } from "./safeError.js";
import { isSubscriptionAccessActive } from "./subscriptionAccess.js";
import { userCanModifyCalendarEvent } from "./calendarAccess.js";
import { whatsappBroadcastRateLimit } from "./rateLimit.js";

export function registerEventNotificationRoutes(app: Express, supabaseAdmin: SupabaseClient): void {
  app.post("/api/events/:id/notify-whatsapp", whatsappBroadcastRateLimit, async (req, res) => {
    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const [{ data: sub }, { data: profile }] = await Promise.all([
        supabaseAdmin
          .from("subscriptions")
          .select("plan, status, expires_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("perfil_lider")
          .select("is_admin_global, tenant_id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const isGlobalAdmin = Boolean(profile?.is_admin_global);
      const role = String(user.user_metadata?.role || "").toLowerCase();
      if (role === "filho") return res.status(403).json({ error: "Acesso negado" });
      if (!isGlobalAdmin && !isSubscriptionAccessActive(sub)) {
        return res.status(403).json({ error: "Assinatura inativa" });
      }

      const access = await userCanModifyCalendarEvent(supabaseAdmin, user, req.params.id);
      if (access.notFound) return res.status(404).json({ error: "Evento não encontrado." });
      if (!access.allowed) return res.status(403).json({ error: "Acesso negado" });

      const { data: event, error: eventErr } = await supabaseAdmin
        .from("calendario_axe")
        .select("id, titulo, data, hora, banner_url, tenant_id, lider_id")
        .eq("id", req.params.id)
        .maybeSingle();
      if (eventErr) throw eventErr;
      if (!event) return res.status(404).json({ error: "Evento não encontrado." });

      const tenantId = String(event.tenant_id || event.lider_id || profile?.tenant_id || user.id);
      const whatsapp = await dispatchGiraWhatsApp(supabaseAdmin, tenantId, {
        id: String(event.id),
        titulo: String(event.titulo || ""),
        data: String(event.data || ""),
        hora: String(event.hora || ""),
        banner_url: event.banner_url || null,
      }, { notifyZeladorSummary: true });

      res.json({ success: true, whatsapp });
    } catch (error: unknown) {
      console.error("[SERVER] Error notify-whatsapp:", error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar aviso no WhatsApp") });
    }
  });
}
