import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConsoleGlobalAdmin } from "./consoleAdmin.js";
import { getBearerToken } from "./requireAuth.js";
import { safeErrorMessage } from "./safeError.js";
import { sendMetaCloudTemplate } from "./metaCloudSend.js";

type GrowthDeps = {
  supabaseAdmin: SupabaseClient;
  verifyUser: (token: string) => Promise<{ user: { id: string; email?: string | null } | null; error: unknown }>;
};

type QueueInput = {
  id?: unknown;
  terreiroSlug?: unknown;
  terreiroNome?: unknown;
  phone?: unknown;
  cidade?: unknown;
  bairro?: unknown;
  sourceUrl?: unknown;
  consentAt?: unknown;
  consentSource?: unknown;
  scheduledAt?: unknown;
};

const INITIAL_TEMPLATE = "axecloud_prospeccao_inicial";
const FOLLOWUP_1_TEMPLATE = "axecloud_prospeccao_retorno_1";
const FOLLOWUP_2_TEMPLATE = "axecloud_prospeccao_retorno_final";

function normalizePhone(value: unknown): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : "";
}

function isUuid(value: unknown): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function clean(value: unknown, max = 180): string {
  return String(value || "").trim().slice(0, max);
}

async function requireGrowthAdmin(deps: GrowthDeps, req: Request, res: Response) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Não autorizado" });
    return null;
  }
  const { user, error } = await deps.verifyUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  if (!(await isConsoleGlobalAdmin(deps.supabaseAdmin, user))) {
    res.status(403).json({ error: "Acesso restrito ao administrador global" });
    return null;
  }
  return user;
}

function toClientQueue(row: any) {
  const prospect = Array.isArray(row.growth_prospects) ? row.growth_prospects[0] : row.growth_prospects;
  return {
    id: row.id,
    terreiroSlug: prospect?.terreiro_slug || "",
    terreiroNome: prospect?.terreiro_nome || "",
    phone: prospect?.phone_e164 || "",
    scheduledAt: row.scheduled_at,
    status: row.status,
    sentAt: row.sent_at || undefined,
    error: row.error || undefined,
    lastInboundAt: row.last_inbound_at || undefined,
    lastInboundPreview: row.last_inbound_preview || undefined,
    optOut: Boolean(prospect?.opt_out_at),
    followupCount: Number(row.followup_count || 0),
  };
}

export function registerGrowthProspectingRoutes(app: Express, deps: GrowthDeps) {
  app.get("/api/admin-console/growth/status", async (req, res) => {
    if (!(await requireGrowthAdmin(deps, req, res))) return;
    const enabled = String(process.env.GROWTH_PROSPECTING_ENABLED || "false").toLowerCase() === "true";
    const testMode = String(process.env.GROWTH_PROSPECTING_TEST_MODE || "true").toLowerCase() !== "false";
    res.json({
      enabled,
      testMode,
      serverManaged: true,
      consentRequired: true,
      dailyLimit: Math.min(30, Math.max(1, Number(process.env.GROWTH_PROSPECTING_DAILY_LIMIT || 10))),
      templates: {
        initial: process.env.WA_META_TEMPLATE_GROWTH_INITIAL || INITIAL_TEMPLATE,
        followup1: process.env.WA_META_TEMPLATE_GROWTH_FOLLOWUP_1 || FOLLOWUP_1_TEMPLATE,
        followup2: process.env.WA_META_TEMPLATE_GROWTH_FOLLOWUP_2 || FOLLOWUP_2_TEMPLATE,
      },
    });
  });

  app.get("/api/admin-console/growth/queue", async (req, res) => {
    if (!(await requireGrowthAdmin(deps, req, res))) return;
    try {
      const { data, error } = await deps.supabaseAdmin
        .from("growth_outreach_queue")
        .select("*,growth_prospects(terreiro_slug,terreiro_nome,phone_e164,opt_out_at)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      res.json({ queue: (data || []).map(toClientQueue) });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar fila de prospecção") });
    }
  });

  app.post("/api/admin-console/growth/queue/batch", async (req, res) => {
    const user = await requireGrowthAdmin(deps, req, res);
    if (!user) return;
    const items = Array.isArray(req.body?.items) ? (req.body.items as QueueInput[]).slice(0, 30) : [];
    let accepted = 0;
    const rejected: Array<{ id: string; reason: string }> = [];
    try {
      for (const raw of items) {
        const id = clean(raw.id, 40);
        const slug = clean(raw.terreiroSlug);
        const name = clean(raw.terreiroNome);
        const phone = normalizePhone(raw.phone);
        const scheduledAt = new Date(String(raw.scheduledAt || ""));
        const consentAt = raw.consentAt ? new Date(String(raw.consentAt)) : null;
        if (!isUuid(id) || !slug || !name || !phone || Number.isNaN(scheduledAt.getTime())) {
          rejected.push({ id, reason: "dados inválidos" });
          continue;
        }
        if (!consentAt || Number.isNaN(consentAt.getTime())) {
          rejected.push({ id, reason: "opt-in do WhatsApp ainda não registrado" });
          continue;
        }

        const { data: prospect, error: prospectError } = await deps.supabaseAdmin
          .from("growth_prospects")
          .upsert(
            {
              terreiro_slug: slug,
              terreiro_nome: name,
              phone_e164: phone,
              cidade: clean(raw.cidade, 80) || "Suzano",
              bairro: clean(raw.bairro, 100) || null,
              source_url: clean(raw.sourceUrl, 500) || null,
              consent_at: consentAt.toISOString(),
              consent_source: clean(raw.consentSource, 120) || "registrado pelo administrador",
              status: "fila",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "terreiro_slug" },
          )
          .select("id,opt_out_at")
          .single();
        if (prospectError) throw prospectError;
        if (prospect.opt_out_at) {
          rejected.push({ id, reason: "contato bloqueado por opt-out" });
          continue;
        }

        const { error: queueError } = await deps.supabaseAdmin.from("growth_outreach_queue").insert({
          id,
          prospect_id: prospect.id,
          scheduled_at: scheduledAt.toISOString(),
          status: "agendado",
          template_name: process.env.WA_META_TEMPLATE_GROWTH_INITIAL || INITIAL_TEMPLATE,
        });
        if (queueError) {
          if (String(queueError.code) === "23505") rejected.push({ id, reason: "já está na fila" });
          else throw queueError;
          continue;
        }
        accepted += 1;
        await deps.supabaseAdmin.from("growth_outreach_events").insert({
          queue_id: id,
          prospect_id: prospect.id,
          event_type: "queued",
          payload: { adminUserId: user.id },
        });
      }
      res.status(201).json({ accepted, rejected });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao criar fila de prospecção"), accepted, rejected });
    }
  });

  app.post("/api/admin-console/growth/queue/:id/cancel", async (req, res) => {
    if (!(await requireGrowthAdmin(deps, req, res))) return;
    const id = clean(req.params.id, 40);
    if (!isUuid(id)) return res.status(400).json({ error: "Identificador inválido" });
    const { error } = await deps.supabaseAdmin
      .from("growth_outreach_queue")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["agendado", "pronto"]);
    if (error) return res.status(500).json({ error: safeErrorMessage(error, "Erro ao cancelar envio") });
    res.json({ success: true });
  });
}

function optedOut(text: string): boolean {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(sair|pare|parar|remover|nao quero|nao envie|sem interesse|cancelar mensagens)\b/.test(value);
}

async function reconcileReplies(supabase: SupabaseClient): Promise<number> {
  const { data: rows, error } = await supabase
    .from("growth_outreach_queue")
    .select("id,prospect_id,sent_at,last_inbound_at,growth_prospects(phone_e164)")
    .in("status", ["enviado", "respondido"])
    .not("sent_at", "is", null)
    .limit(100);
  if (error) throw error;
  let replies = 0;
  for (const row of rows || []) {
    const prospect = Array.isArray((row as any).growth_prospects) ? (row as any).growth_prospects[0] : (row as any).growth_prospects;
    const phone = String(prospect?.phone_e164 || "");
    if (!phone) continue;
    const { data: conversation } = await supabase
      .from("admin_whatsapp_conversations")
      .select("id")
      .eq("phone_e164", phone)
      .maybeSingle();
    if (!conversation?.id) continue;
    const { data: message } = await supabase
      .from("admin_whatsapp_messages")
      .select("body,created_at")
      .eq("conversation_id", conversation.id)
      .eq("direction", "inbound")
      .gt("created_at", row.sent_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!message || message.created_at === row.last_inbound_at) continue;
    const isOptOut = optedOut(String(message.body || ""));
    await supabase.from("growth_outreach_queue").update({
      status: isOptOut ? "bloqueado" : "respondido",
      last_inbound_at: message.created_at,
      last_inbound_preview: String(message.body || "").slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    await supabase.from("growth_prospects").update({
      status: isOptOut ? "bloqueado" : "respondeu",
      opt_out_at: isOptOut ? message.created_at : null,
      updated_at: new Date().toISOString(),
    }).eq("id", row.prospect_id);
    await supabase.from("growth_outreach_events").insert({
      queue_id: row.id,
      prospect_id: row.prospect_id,
      event_type: isOptOut ? "opt_out" : "reply",
      payload: { preview: String(message.body || "").slice(0, 200) },
    });
    replies += 1;
  }
  return replies;
}

export async function runGrowthProspectingTick(supabase: SupabaseClient) {
  const enabled = String(process.env.GROWTH_PROSPECTING_ENABLED || "false").toLowerCase() === "true";
  const testMode = String(process.env.GROWTH_PROSPECTING_TEST_MODE || "true").toLowerCase() !== "false";
  const limit = Math.min(30, Math.max(1, Number(process.env.GROWTH_PROSPECTING_DAILY_LIMIT || 10)));
  const replies = await reconcileReplies(supabase);
  if (!enabled || testMode) return { enabled, testMode, sent: 0, replies };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("growth_outreach_events")
    .select("id", { count: "exact", head: true })
    .in("event_type", ["sent", "followup"])
    .gte("created_at", start.toISOString());
  let remaining = Math.max(0, limit - Number(count || 0));
  if (!remaining) return { enabled, testMode, sent: 0, replies, dailyLimitReached: true };

  const { data: due, error } = await supabase
    .from("growth_outreach_queue")
    .select("id,prospect_id,template_name,attempts,growth_prospects(terreiro_nome,phone_e164,consent_at,opt_out_at)")
    .eq("status", "agendado")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(remaining);
  if (error) throw error;

  let sent = 0;
  for (const row of due || []) {
    const prospect = Array.isArray((row as any).growth_prospects) ? (row as any).growth_prospects[0] : (row as any).growth_prospects;
    if (!prospect?.consent_at || prospect?.opt_out_at) {
      await supabase.from("growth_outreach_queue").update({ status: "bloqueado", error: "Opt-in ausente ou contato opt-out", updated_at: new Date().toISOString() }).eq("id", row.id);
      continue;
    }
    try {
      const result = await sendMetaCloudTemplate(
        prospect.phone_e164,
        row.template_name || process.env.WA_META_TEMPLATE_GROWTH_INITIAL || INITIAL_TEMPLATE,
        "pt_BR",
        [{ type: "body", parameters: [{ type: "text", text: String(prospect.terreiro_nome).slice(0, 120) }] }],
      );
      const now = new Date().toISOString();
      await supabase.from("growth_outreach_queue").update({ status: "enviado", sent_at: now, external_id: result.messageId || null, attempts: Number(row.attempts || 0) + 1, updated_at: now }).eq("id", row.id);
      await supabase.from("growth_prospects").update({ status: "contatado", updated_at: now }).eq("id", row.prospect_id);
      await supabase.from("growth_outreach_events").insert({ queue_id: row.id, prospect_id: row.prospect_id, event_type: "sent", payload: { externalId: result.messageId || null } });
      sent += 1;
      remaining -= 1;
      if (!remaining) break;
    } catch (sendError) {
      await supabase.from("growth_outreach_queue").update({ status: "falhou", attempts: Number(row.attempts || 0) + 1, error: safeErrorMessage(sendError, "Falha no envio").slice(0, 500), updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }

  if (remaining > 0) {
    const { data: followups, error: followupError } = await supabase
      .from("growth_outreach_queue")
      .select("id,prospect_id,sent_at,followup_count,growth_prospects(terreiro_nome,phone_e164,consent_at,opt_out_at)")
      .eq("status", "enviado")
      .lt("followup_count", 2)
      .order("sent_at", { ascending: true })
      .limit(100);
    if (followupError) throw followupError;
    for (const row of followups || []) {
      if (!remaining || !row.sent_at) break;
      const followupCount = Number(row.followup_count || 0);
      const dueDays = followupCount === 0 ? 3 : 7;
      if (Date.now() < Date.parse(row.sent_at) + dueDays * 86_400_000) continue;
      const prospect = Array.isArray((row as any).growth_prospects) ? (row as any).growth_prospects[0] : (row as any).growth_prospects;
      if (!prospect?.consent_at || prospect?.opt_out_at) continue;
      const templateName = followupCount === 0
        ? process.env.WA_META_TEMPLATE_GROWTH_FOLLOWUP_1 || FOLLOWUP_1_TEMPLATE
        : process.env.WA_META_TEMPLATE_GROWTH_FOLLOWUP_2 || FOLLOWUP_2_TEMPLATE;
      try {
        const result = await sendMetaCloudTemplate(
          prospect.phone_e164,
          templateName,
          "pt_BR",
          [{ type: "body", parameters: [{ type: "text", text: String(prospect.terreiro_nome).slice(0, 120) }] }],
        );
        const nextCount = followupCount + 1;
        await supabase.from("growth_outreach_queue").update({
          followup_count: nextCount,
          external_id: result.messageId || null,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        await supabase.from("growth_outreach_events").insert({
          queue_id: row.id,
          prospect_id: row.prospect_id,
          event_type: "followup",
          payload: { number: nextCount, externalId: result.messageId || null },
        });
        sent += 1;
        remaining -= 1;
      } catch (sendError) {
        await supabase.from("growth_outreach_events").insert({
          queue_id: row.id,
          prospect_id: row.prospect_id,
          event_type: "followup_failed",
          payload: { number: followupCount + 1, error: safeErrorMessage(sendError, "Falha no retorno").slice(0, 300) },
        });
      }
    }
  }
  return { enabled, testMode, sent, replies };
}
