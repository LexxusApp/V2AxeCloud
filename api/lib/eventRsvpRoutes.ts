import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO, startOfDay } from "date-fns";
import { apiReadRateLimit } from "./rateLimit.js";
import { resolvePublicAppUrl } from "./tenantOnboarding.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
};

export type RsvpAction = "confirmar" | "declinar";

export function buildEventRsvpPublicUrl(token: string, action: RsvpAction): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/convite/${encodeURIComponent(token)}/${action}`;
}

function mapActionToStatus(action: RsvpAction): "Confirmado" | "Recusado" {
  return action === "confirmar" ? "Confirmado" : "Recusado";
}

function isTokenExpired(eventDateYmd: string | null | undefined): boolean {
  if (!eventDateYmd) return false;
  try {
    const eventDay = startOfDay(parseISO(String(eventDateYmd).slice(0, 10)));
    const deadline = addDays(eventDay, 2);
    return startOfDay(new Date()) > deadline;
  } catch {
    return false;
  }
}

export async function processEventGuestRsvp(
  sb: SupabaseClient,
  token: string,
  action: RsvpAction
): Promise<
  | {
      ok: true;
      status: "Confirmado" | "Recusado";
      alreadyResponded: boolean;
      guestName: string;
      eventTitle: string;
      eventDate: string | null;
      eventTime: string | null;
      terreiroName: string;
    }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "INVALID"; message: string }
> {
  const cleanToken = String(token || "").trim().toLowerCase();
  if (!cleanToken || cleanToken.length < 16) {
    return { ok: false, code: "INVALID", message: "Link de convite inválido." };
  }
  if (action !== "confirmar" && action !== "declinar") {
    return { ok: false, code: "INVALID", message: "Resposta inválida." };
  }

  const { data: guest, error } = await sb
    .from("convidados_eventos")
    .select("id, nome, status, rsvp_token, rsvp_responded_at, event_id")
    .eq("rsvp_token", cleanToken)
    .maybeSingle();

  if (error || !guest?.id || !guest.event_id) {
    return { ok: false, code: "NOT_FOUND", message: "Convite não encontrado ou já expirado." };
  }

  const { data: event } = await sb
    .from("calendario_axe")
    .select("titulo, data, hora, tenant_id, lider_id")
    .eq("id", guest.event_id)
    .maybeSingle();

  if (!event) {
    return { ok: false, code: "NOT_FOUND", message: "Evento não encontrado." };
  }

  if (isTokenExpired(event.data)) {
    return { ok: false, code: "EXPIRED", message: "Este convite já expirou." };
  }

  const leaderId = String(event.lider_id || event.tenant_id || "");
  let terreiroName = "Terreiro";
  if (leaderId) {
    const { data: profile } = await sb
      .from("perfil_lider")
      .select("nome_terreiro")
      .eq("id", leaderId)
      .maybeSingle();
    if (profile?.nome_terreiro) terreiroName = String(profile.nome_terreiro);
  }

  const targetStatus = mapActionToStatus(action);
  const previousStatus = String(guest.status || "");
  const alreadyResponded =
    previousStatus === "Confirmado" || previousStatus === "Recusado" || Boolean(guest.rsvp_responded_at);

  if (previousStatus !== targetStatus || !guest.rsvp_responded_at) {
    const { error: updErr } = await sb
      .from("convidados_eventos")
      .update({
        status: targetStatus,
        rsvp_responded_at: new Date().toISOString(),
      })
      .eq("id", guest.id);
    if (updErr) {
      console.error("[event-rsvp] update:", updErr.message);
      return { ok: false, code: "INVALID", message: "Não foi possível registrar sua resposta." };
    }
  }

  return {
    ok: true,
    status: targetStatus,
    alreadyResponded,
    guestName: String(guest.nome || "Convidado"),
    eventTitle: String(event.titulo || "Evento"),
    eventDate: event.data ? String(event.data).slice(0, 10) : null,
    eventTime: event.hora ? String(event.hora) : null,
    terreiroName,
  };
}

export function registerEventRsvpRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin: sb } = deps;

  app.get("/api/v1/public/convite/rsvp/:token/:acao", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "");
      const acao = String(req.params.acao || "").trim().toLowerCase() as RsvpAction;
      if (acao !== "confirmar" && acao !== "declinar") {
        return res.status(400).json({ error: "Ação inválida. Use confirmar ou declinar." });
      }

      const result = await processEventGuestRsvp(sb, token, acao);
      if (result.ok === false) {
        const status = result.code === "NOT_FOUND" ? 404 : result.code === "EXPIRED" ? 410 : 400;
        return res.status(status).json({ error: result.message, code: result.code });
      }

      res.json({
        success: true,
        status: result.status,
        alreadyResponded: result.alreadyResponded,
        guestName: result.guestName,
        eventTitle: result.eventTitle,
        eventDate: result.eventDate,
        eventTime: result.eventTime,
        terreiroName: result.terreiroName,
      });
    } catch (e: unknown) {
      console.error("[public/convite/rsvp]", e);
      res.status(500).json({ error: "Erro ao processar resposta do convite." });
    }
  });
}
