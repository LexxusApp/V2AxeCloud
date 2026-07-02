import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit } from "./rateLimit.js";
import { requireTenantReadAccess, requireAuthenticatedUser } from "./secureRoutes.js";
import {
  assertZeladorTenantAccess,
  normalizeQueryTenantId,
  resolveLeaderId,
} from "./tenantAccess.js";
import { resolvePublicAppUrl } from "./tenantOnboarding.js";
import { getOfficialWhatsAppStatus } from "../../src/services/evolution.service.js";
import {
  buildWhatsAppDeliverableText,
  buildWhatsAppMessage,
  logAndSendWhatsApp,
  resolveTerreiroWhatsAppContext,
} from "./whatsappSendCore.js";

function normalizeBrPhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (tenantId: string) => Promise<string>;
};

export function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

const VELAS_VALIDAS = new Set([
  "Branca",
  "Vermelha",
  "Azul",
  "Verde",
  "Amarela",
  "Preta",
  "Nenhuma",
]);

type ParticipanteStatus = "pendente" | "confirmado" | "recusado" | "presente";

async function loadEventForTenant(
  sb: SupabaseClient,
  resolveLeader: (tenantId: string) => Promise<string>,
  eventId: string,
  tenantId: string
) {
  const leaderId = await resolveLeader(tenantId);
  const ids = Array.from(new Set([tenantId, leaderId].filter(Boolean)));
  const { data, error } = await sb
    .from("calendario_axe")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const tid = String(row.tenant_id || "");
  const lid = String(row.lider_id || "");
  if (!ids.includes(tid) && !ids.includes(lid)) return null;
  return row;
}

async function countConfirmedParticipants(sb: SupabaseClient, eventId: string): Promise<number> {
  const { count } = await sb
    .from("evento_participantes")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["confirmado", "presente"]);
  return count ?? 0;
}

async function resolveFilhoForUser(
  sb: SupabaseClient,
  resolveLeader: (tenantId: string) => Promise<string>,
  userId: string,
  tenantId: string
): Promise<{ id: string; nome: string } | null> {
  const leaderId = await resolveLeader(tenantId);
  const { data } = await sb
    .from("filhos_de_santo")
    .select("id, nome")
    .eq("user_id", userId)
    .or(`tenant_id.eq.${tenantId},tenant_id.eq.${leaderId},lider_id.eq.${tenantId},lider_id.eq.${leaderId}`)
    .maybeSingle();
  if (!data?.id) return null;
  return { id: String(data.id), nome: String(data.nome || "Filho") };
}

async function syncEventParticipants(
  sb: SupabaseClient,
  resolveLeader: (tenantId: string) => Promise<string>,
  eventId: string,
  tenantId: string
): Promise<void> {
  const leaderId = await resolveLeader(tenantId);
  const { data: filhos } = await sb
    .from("filhos_de_santo")
    .select("id")
    .or(`tenant_id.eq.${tenantId},tenant_id.eq.${leaderId},lider_id.eq.${tenantId},lider_id.eq.${leaderId}`)
    .neq("status", "Inativo");

  if (!filhos?.length) return;

  const rows = filhos.map((f) => ({
    event_id: eventId,
    filho_id: f.id,
    tenant_id: tenantId,
    checkin_token: newPublicToken(),
  }));

  await sb.from("evento_participantes").upsert(rows, {
    onConflict: "event_id,filho_id",
    ignoreDuplicates: true,
  });
}

async function ensureEventTokens(sb: SupabaseClient, event: Record<string, unknown>) {
  const patch: Record<string, string> = {};
  if (!event.checkin_qr_token) patch.checkin_qr_token = newPublicToken();
  if (event.senhas_ativas && !event.senhas_public_token) {
    patch.senhas_public_token = newPublicToken();
  }
  if (event.evento_publico && !event.evento_public_token) {
    patch.evento_public_token = newPublicToken();
  }
  if (Object.keys(patch).length === 0) return event;
  const { data } = await sb
    .from("calendario_axe")
    .update(patch)
    .eq("id", event.id)
    .select("*")
    .single();
  return data || { ...event, ...patch };
}

export async function emitirSenhaVisitante(
  sb: SupabaseClient,
  event: Record<string, unknown>,
  nome: string,
  telefone: string,
): Promise<{ data: Record<string, unknown>; numero: number }> {
  const eventId = String(event.id);
  const tenantId = String(event.tenant_id);

  const senhasMaximas =
    event.senhas_maximas != null && Number(event.senhas_maximas) > 0
      ? Number(event.senhas_maximas)
      : null;

  if (senhasMaximas != null) {
    const { count } = await sb
      .from("evento_senhas")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= senhasMaximas) {
      throw Object.assign(new Error("Todas as senhas deste evento já foram emitidas."), { statusCode: 409 });
    }
  }

  const phoneDigits = telefone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    throw Object.assign(new Error("WhatsApp inválido."), { statusCode: 400 });
  }

  const { data: existingPhone } = await sb
    .from("evento_senhas")
    .select("id")
    .eq("event_id", eventId)
    .eq("telefone", phoneDigits)
    .maybeSingle();
  if (existingPhone) {
    throw Object.assign(new Error("Este WhatsApp já recebeu uma senha para este evento."), { statusCode: 409 });
  }

  const { data: last } = await sb
    .from("evento_senhas")
    .select("numero")
    .eq("event_id", eventId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  const numero = (last?.numero ?? 0) + 1;
  const checkinToken = newPublicToken();

  const { data, error } = await sb
    .from("evento_senhas")
    .insert({
      event_id: eventId,
      tenant_id: tenantId,
      numero,
      nome,
      telefone: phoneDigits,
      checkin_token: checkinToken,
    })
    .select("*")
    .single();
  if (error) throw error;

  return { data: data as Record<string, unknown>, numero };
}

export async function sendSenhaVisitanteWhatsApp(
  sb: SupabaseClient,
  event: Record<string, unknown>,
  senha: Record<string, unknown>,
): Promise<void> {
  try {
    const tenantId = String(event.tenant_id);
    const leaderId = String(event.lider_id || tenantId);
    const phone = String(senha.telefone || "");
    if (phone.replace(/\D/g, "").length < 10) return;

    const st = await getOfficialWhatsAppStatus();
    if (st.status !== "CONNECTED") return;

    const ctx = await resolveTerreiroWhatsAppContext(sb, leaderId, tenantId);
    const { data: waCfg } = await sb
      .from("whatsapp_config")
      .select("templates")
      .eq("tenant_id", leaderId)
      .maybeSingle();

    const linkCheckin = buildPresencaPublicUrl(String(senha.checkin_token));
    const variables: Record<string, string | number> = {
      nome_visitante: String(senha.nome),
      numero_senha: Number(senha.numero),
      nome_evento: String(event.titulo || ""),
      data_evento: String(event.data || ""),
      hora_evento: String(event.hora || ""),
      nome_terreiro: ctx.nomeTerreiro,
      link_checkin: linkCheckin,
    };

    const message = buildWhatsAppMessage(waCfg?.templates, "senha_evento_visitante", variables);
    const deliverableText = buildWhatsAppDeliverableText(
      waCfg?.templates,
      "senha_evento_visitante",
      String(senha.nome),
      ctx.nomeTerreiro,
      variables,
      ctx.zelador,
    );

    await logAndSendWhatsApp(sb, {
      tenantId,
      tipo: "senha_evento_visitante",
      phone: normalizeBrPhone(phone),
      message,
      deliverableText,
      nomeMembro: String(senha.nome),
      nomeTerreiro: ctx.nomeTerreiro,
      idTerreiro: ctx.idTerreiro,
      zelador: ctx.zelador,
      variables,
    });
  } catch (err) {
    console.error("[senha-visitante-whatsapp]", err);
  }
}

export function buildCheckinPortariaUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/checkin-portaria/${encodeURIComponent(token)}`;
}

/** @deprecated Use buildCheckinPortariaUrl — mantido para compatibilidade de imports */
export function buildCheckinPublicUrl(token: string): string {
  return buildCheckinPortariaUrl(token);
}

export function buildSenhasPublicUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/senhas/${encodeURIComponent(token)}`;
}

export function buildEventoPublicUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/evento/${encodeURIComponent(token)}`;
}

export function buildPresencaPublicUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/presenca/${encodeURIComponent(token)}`;
}

function extractVenueTokenFromScan(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.replace(/\/+$/, "").split("/");
    const idx = parts.indexOf("checkin-portaria");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    /* not a URL */
  }
  return trimmed;
}

export function registerGiraOperationsRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin: sb, resolveLeaderId: resolveLeader } = deps;

  const loadEvent = (eventId: string, tenantId: string) =>
    loadEventForTenant(sb, resolveLeader, eventId, tenantId);
  const syncParts = (eventId: string, tenantId: string) =>
    syncEventParticipants(sb, resolveLeader, eventId, tenantId);
  const resolveFilho = (userId: string, tenantId: string) =>
    resolveFilhoForUser(sb, resolveLeader, userId, tenantId);

  // Participações do filho logado (calendário)
  app.get("/api/v1/participacoes", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const role = String(access.user.user_metadata?.role || "").toLowerCase();
      const { start, end } = req.query;
      let filhoId = String(req.query.filhoId || "").trim();

      if (role === "filho") {
        const filho = await resolveFilho(access.user.id, access.tenantId);
        if (!filho) return res.json({ data: [] });
        filhoId = filho.id;
      } else if (!filhoId) {
        return res.status(400).json({ error: "filhoId required" });
      }

      const leaderId = await resolveLeader(access.tenantId);
      const ids = Array.from(new Set([access.tenantId, leaderId].filter(Boolean)));
      const tenantFilters = ids.flatMap((id) => [`tenant_id.eq.${id}`, `lider_id.eq.${id}`]).join(",");

      let eventQuery = sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, tipo, vagas_maximas, confirmacao_automatica")
        .or(tenantFilters);
      if (start) eventQuery = eventQuery.gte("data", String(start));
      if (end) eventQuery = eventQuery.lte("data", String(end));

      const { data: events, error: evErr } = await eventQuery;
      if (evErr) throw evErr;
      const eventIds = (events || []).map((e) => e.id);
      if (eventIds.length === 0) return res.json({ data: [] });

      const { data: parts, error } = await sb
        .from("evento_participantes")
        .select("*")
        .eq("filho_id", filhoId)
        .in("event_id", eventIds);
      if (error) throw error;

      const eventMap = new Map((events || []).map((e) => [e.id, e]));
      const merged = (parts || []).map((p) => ({
        ...p,
        evento: eventMap.get(p.event_id) || null,
      }));

      res.json({ data: merged });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar participações." });
    }
  });

  // ── Atualizar config da gira (vagas, senhas, confirmação) ──
  app.patch("/api/v1/events/:eventId/gira-config", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const event = await loadEvent(eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      const patch: Record<string, unknown> = {};
      if (req.body?.vagas_maximas !== undefined) {
        const v = req.body.vagas_maximas;
        patch.vagas_maximas = v === null || v === "" ? null : Math.max(0, Number(v) || 0);
      }
      if (typeof req.body?.confirmacao_automatica === "boolean") {
        patch.confirmacao_automatica = req.body.confirmacao_automatica;
      }
      if (typeof req.body?.senhas_ativas === "boolean") {
        patch.senhas_ativas = req.body.senhas_ativas;
        if (req.body.senhas_ativas && !event.senhas_public_token) {
          patch.senhas_public_token = newPublicToken();
        }
      }
      if (req.body?.senhas_maximas !== undefined) {
        const v = req.body.senhas_maximas;
        patch.senhas_maximas = v === null || v === "" ? null : Math.max(1, Number(v) || 0);
      }
      if (event.evento_publico && !event.evento_public_token) {
        patch.evento_public_token = newPublicToken();
      }
      if (!event.checkin_qr_token) patch.checkin_qr_token = newPublicToken();

      const { data, error } = await sb
        .from("calendario_axe")
        .update(patch)
        .eq("id", eventId)
        .select("*")
        .single();
      if (error) throw error;

      res.json({ success: true, data });
    } catch (e: unknown) {
      console.error("[gira-config]", e);
      res.status(500).json({ error: "Erro ao atualizar configuração da gira." });
    }
  });

  // ── Participantes / frequência ──
  app.get("/api/v1/events/confirmados-resumo", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const leaderId = await resolveLeader(access.tenantId);
      const scopeIds = Array.from(new Set([access.tenantId, leaderId].filter(Boolean)));
      const orFilter = scopeIds
        .flatMap((id) => [`tenant_id.eq.${id}`, `lider_id.eq.${id}`])
        .join(",");

      const { data: events, error: evErr } = await sb
        .from("calendario_axe")
        .select("id")
        .or(orFilter);
      if (evErr) throw evErr;

      const eventIds = (events || []).map((e) => String((e as { id: string }).id));
      if (eventIds.length === 0) {
        return res.json({ data: {} });
      }

      const { data: parts, error } = await sb
        .from("evento_participantes")
        .select("event_id, filho_id, filhos_de_santo(nome, foto_url)")
        .in("event_id", eventIds)
        .in("status", ["confirmado", "presente"])
        .order("responded_at", { ascending: true });
      if (error) throw error;

      const grouped: Record<
        string,
        Array<{ filho_id: string; nome: string; foto_url: string | null }>
      > = {};

      for (const row of parts || []) {
        const r = row as {
          event_id: string;
          filho_id: string;
          filhos_de_santo?: { nome?: string; foto_url?: string | null } | null;
        };
        const eventId = String(r.event_id);
        if (!grouped[eventId]) grouped[eventId] = [];
        grouped[eventId].push({
          filho_id: String(r.filho_id),
          nome: String(r.filhos_de_santo?.nome || "Filho"),
          foto_url: r.filhos_de_santo?.foto_url ?? null,
        });
      }

      res.json({ data: grouped });
    } catch (e: unknown) {
      console.error("[confirmados-resumo]", e);
      res.status(500).json({ error: "Erro ao carregar confirmações." });
    }
  });

  app.get("/api/v1/events/:eventId/participantes", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const eventId = String(req.params.eventId || "");
      const event = await loadEvent(eventId, access.tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      await syncParts(eventId, access.tenantId);
      const updatedEvent = await ensureEventTokens(sb, event);

      const { data, error } = await sb
        .from("evento_participantes")
        .select("*, filhos_de_santo(nome, cargo, foto_url, whatsapp_phone)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const confirmed = (data || []).filter((p) => String(p.status) === "confirmado").length;

      res.json({
        data: data || [],
        event: updatedEvent,
        stats: {
          total: (data || []).length,
          confirmados: confirmed,
          presentes: 0,
          vagas_maximas: event.vagas_maximas ?? null,
          vagas_restantes:
            event.vagas_maximas != null
              ? Math.max(0, Number(event.vagas_maximas) - confirmed)
              : null,
        },
        checkinUrl: updatedEvent.checkin_qr_token
          ? buildCheckinPortariaUrl(String(updatedEvent.checkin_qr_token))
          : null,
        senhasUrl:
          updatedEvent.senhas_ativas && updatedEvent.senhas_public_token
            ? buildSenhasPublicUrl(String(updatedEvent.senhas_public_token))
            : null,
        eventoPublicUrl:
          updatedEvent.evento_publico && updatedEvent.evento_public_token
            ? buildEventoPublicUrl(String(updatedEvent.evento_public_token))
            : null,
      });
    } catch (e: unknown) {
      console.error("[participantes GET]", e);
      res.status(500).json({ error: "Erro ao carregar participantes." });
    }
  });

  app.post("/api/v1/events/:eventId/participantes/respond", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });

      const eventId = String(req.params.eventId || "");
      const action = String(req.body?.action || "").toLowerCase();
      if (action !== "confirmar" && action !== "declinar") {
        return res.status(400).json({ error: "Ação inválida." });
      }

      const event = await loadEvent(eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      let filhoId = String(req.body?.filhoId || "").trim();
      const role = String(user.user_metadata?.role || "").toLowerCase();
      if (role === "filho") {
        const filho = await resolveFilho(user.id, tenantId);
        if (!filho) return res.status(403).json({ error: "Filho não encontrado." });
        filhoId = filho.id;
      } else {
        const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
        if (!ok) return res.status(403).json({ error: "Acesso negado" });
        if (!filhoId) return res.status(400).json({ error: "filhoId required" });
      }

      await syncParts(eventId, tenantId);

      if (action === "confirmar" && event.vagas_maximas != null) {
        const confirmed = await countConfirmedParticipants(sb, eventId);
        const { data: current } = await sb
          .from("evento_participantes")
          .select("status")
          .eq("event_id", eventId)
          .eq("filho_id", filhoId)
          .maybeSingle();
        const alreadyIn = ["confirmado", "presente"].includes(String(current?.status || ""));
        if (!alreadyIn && confirmed >= Number(event.vagas_maximas)) {
          return res.status(409).json({ error: "Vagas esgotadas para esta gira." });
        }
        if (!event.confirmacao_automatica && role === "filho") {
          // filho solicita — fica pendente até zelador aprovar (status pendente com flag)
          const { error } = await sb
            .from("evento_participantes")
            .update({
              status: "pendente",
              responded_at: new Date().toISOString(),
              justificativa: "Aguardando aprovação",
            })
            .eq("event_id", eventId)
            .eq("filho_id", filhoId);
          if (error) throw error;
          return res.json({ success: true, status: "pendente", awaitingApproval: true });
        }
      }

      const targetStatus: ParticipanteStatus =
        action === "confirmar" ? "confirmado" : "recusado";

      const { data, error } = await sb
        .from("evento_participantes")
        .update({
          status: targetStatus,
          responded_at: new Date().toISOString(),
          justificativa: action === "declinar" ? String(req.body?.justificativa || "") : null,
        })
        .eq("event_id", eventId)
        .eq("filho_id", filhoId)
        .select("*")
        .single();
      if (error) throw error;

      res.json({ success: true, data });
    } catch (e: unknown) {
      console.error("[participantes respond]", e);
      res.status(500).json({ error: "Erro ao registrar resposta." });
    }
  });

  app.post("/api/v1/events/:eventId/participantes/:participanteId/approve", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const participanteId = String(req.params.participanteId || "");
      const event = await loadEvent(eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      if (event.vagas_maximas != null) {
        const confirmed = await countConfirmedParticipants(sb, eventId);
        if (confirmed >= Number(event.vagas_maximas)) {
          return res.status(409).json({ error: "Vagas esgotadas." });
        }
      }

      const { data, error } = await sb
        .from("evento_participantes")
        .update({ status: "confirmado", responded_at: new Date().toISOString(), justificativa: null })
        .eq("id", participanteId)
        .eq("event_id", eventId)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao aprovar participação." });
    }
  });

  // Relatório de frequência geral
  app.get("/api/v1/frequencia", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const leaderId = await resolveLeader(access.tenantId);
      const { data: filhos } = await sb
        .from("filhos_de_santo")
        .select("id, nome, cargo, foto_url, status")
        .or(
          `tenant_id.eq.${access.tenantId},tenant_id.eq.${leaderId},lider_id.eq.${access.tenantId},lider_id.eq.${leaderId}`
        )
        .neq("status", "Inativo");

      const { data: participacoes } = await sb
        .from("evento_participantes")
        .select("filho_id, status, event_id, calendario_axe(data, titulo, tipo)")
        .eq("tenant_id", access.tenantId);

      const byFilho = (filhos || []).map((f) => {
        const rows = (participacoes || []).filter((p) => p.filho_id === f.id);
        const confirmados = rows.filter((r) => String(r.status) === "confirmado").length;
        const total = rows.length;
        const assiduidade = total > 0 ? Math.round((confirmados / total) * 100) : 0;
        return {
          filho_id: f.id,
          nome: f.nome,
          cargo: f.cargo,
          foto_url: f.foto_url,
          total_eventos: total,
          confirmados,
          presentes: confirmados,
          faltas: rows.filter((r) => r.status === "recusado").length,
          assiduidade_pct: assiduidade,
        };
      });

      res.json({ data: byFilho.sort((a, b) => b.assiduidade_pct - a.assiduidade_pct) });
    } catch (e: unknown) {
      console.error("[frequencia]", e);
      res.status(500).json({ error: "Erro ao carregar frequência." });
    }
  });

  // ── Senhas de gira ──
  app.get("/api/v1/events/:eventId/senhas", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const eventId = String(req.params.eventId || "");
      const event = await loadEventForTenant(sb, resolveLeader, eventId, access.tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });
      const { data, error } = await sb
        .from("evento_senhas")
        .select("*")
        .eq("event_id", eventId)
        .order("numero", { ascending: true });
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar senhas." });
    }
  });

  app.post("/api/v1/events/:eventId/senhas", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const event = await loadEventForTenant(sb, resolveLeader, eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ error: "Nome obrigatório." });

      const { data: last } = await sb
        .from("evento_senhas")
        .select("numero")
        .eq("event_id", eventId)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      const numero = (last?.numero ?? 0) + 1;

      const { data, error } = await sb
        .from("evento_senhas")
        .insert({
          event_id: eventId,
          tenant_id: tenantId,
          numero,
          nome,
          telefone: req.body?.telefone ? String(req.body.telefone).replace(/\D/g, "") : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao emitir senha." });
    }
  });

  app.patch("/api/v1/events/:eventId/senhas/:senhaId", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const event = await loadEventForTenant(sb, resolveLeader, eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      const status = String(req.body?.status || "");
      const patch: Record<string, unknown> = {};
      if (["aguardando", "presente", "chamado", "atendido", "cancelado"].includes(status)) {
        patch.status = status;
        if (status === "chamado") patch.called_at = new Date().toISOString();
        if (status === "atendido") patch.attended_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from("evento_senhas")
        .update(patch)
        .eq("id", req.params.senhaId)
        .eq("event_id", eventId)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao atualizar senha." });
    }
  });

  // ── Mapa de velas ──
  app.get("/api/v1/events/:eventId/mapa-velas", async (req: Request, res: Response) => {
    const access = await requireTenantReadAccess(sb, req, res, req.query.tenantId);
    if (!access) return;
    try {
      const eventId = String(req.params.eventId || "");
      await syncParts(eventId, access.tenantId);

      const leaderId = await resolveLeader(access.tenantId);
      const { data: filhos } = await sb
        .from("filhos_de_santo")
        .select("id, nome, cargo, foto_url")
        .or(
          `tenant_id.eq.${access.tenantId},tenant_id.eq.${leaderId},lider_id.eq.${access.tenantId},lider_id.eq.${leaderId}`
        )
        .neq("status", "Inativo");

      const { data: velas, error } = await sb
        .from("gira_velas")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;

      const map = new Map((velas || []).map((v) => [v.filho_id, v]));
      const merged = (filhos || []).map((f) => {
        const existing = map.get(f.id);
        return {
          filho_id: f.id,
          nome: f.nome,
          cargo: f.cargo,
          foto_url: f.foto_url,
          vela: existing?.vela ?? null,
          quantidade: existing?.quantidade ?? 1,
          entregue: existing?.entregue ?? false,
          observacao: existing?.observacao ?? "",
          id: existing?.id ?? null,
        };
      });

      res.json({ data: merged });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar mapa de velas." });
    }
  });

  app.put("/api/v1/events/:eventId/mapa-velas", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const event = await loadEventForTenant(sb, resolveLeader, eventId, tenantId);
      if (!event) return res.status(404).json({ error: "Evento não encontrado" });

      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const rows = items
        .filter((i: { filho_id?: string; vela?: string }) => i.filho_id && i.vela && VELAS_VALIDAS.has(i.vela))
        .map((i: { filho_id: string; vela: string; quantidade?: number; observacao?: string; entregue?: boolean }) => ({
          event_id: eventId,
          tenant_id: tenantId,
          filho_id: i.filho_id,
          vela: i.vela,
          quantidade: Math.max(1, Number(i.quantidade) || 1),
          observacao: i.observacao || null,
          entregue: Boolean(i.entregue),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length === 0) return res.status(400).json({ error: "Nenhum item válido." });

      const { error } = await sb.from("gira_velas").upsert(rows, { onConflict: "event_id,filho_id" });
      if (error) throw error;
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao salvar mapa de velas." });
    }
  });

  app.patch("/api/v1/events/:eventId/mapa-velas/:velaId", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });
      const ok = await assertZeladorTenantAccess(sb, user.id, tenantId);
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const eventId = String(req.params.eventId || "");
      const { data: velaRow } = await sb
        .from("gira_velas")
        .select("id, event_id, tenant_id")
        .eq("id", req.params.velaId)
        .maybeSingle();
      if (!velaRow) return res.status(404).json({ error: "Vela não encontrada" });
      const event = await loadEventForTenant(sb, resolveLeader, String(velaRow.event_id), tenantId);
      if (!event || String(velaRow.tenant_id) !== tenantId) {
        return res.status(404).json({ error: "Vela não encontrada" });
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof req.body?.entregue === "boolean") patch.entregue = req.body.entregue;
      if (req.body?.vela && VELAS_VALIDAS.has(req.body.vela)) patch.vela = req.body.vela;

      const { data, error } = await sb
        .from("gira_velas")
        .update(patch)
        .eq("id", req.params.velaId)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao atualizar vela." });
    }
  });

  // ── Público: QR da portaria (kiosk) ──
  app.get("/api/v1/public/checkin-portaria/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, tipo, tenant_id, lider_id")
        .eq("checkin_qr_token", token)
        .maybeSingle();
      if (!event) return res.status(404).json({ error: "QR inválido ou expirado." });

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

      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        eventId: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        tipo: event.tipo,
        terreiroName,
        venueToken: token,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar check-in." });
    }
  });

  // Legado: mesma resposta do QR da portaria
  app.get("/api/v1/public/checkin/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, tipo, tenant_id, lider_id")
        .eq("checkin_qr_token", token)
        .maybeSingle();
      if (!event) return res.status(404).json({ error: "QR inválido ou expirado." });

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

      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        eventId: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        tipo: event.tipo,
        terreiroName,
        venueToken: token,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar check-in." });
    }
  });

  app.post("/api/v1/public/checkin/:token", apiReadRateLimit, async (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Check-in de filhos de santo foi descontinuado. Visitantes devem usar o link recebido no WhatsApp.",
    });
  });

  // ── Público: presença do visitante (link do WhatsApp) ──
  app.get("/api/v1/public/presenca/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const { data: senha } = await sb
        .from("evento_senhas")
        .select("id, numero, nome, checked_in_at, status, event_id")
        .eq("checkin_token", token)
        .maybeSingle();
      if (!senha) return res.status(404).json({ error: "Link inválido ou expirado." });

      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, tenant_id, lider_id")
        .eq("id", senha.event_id)
        .maybeSingle();
      if (!event) return res.status(404).json({ error: "Evento não encontrado." });

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

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        senha: senha.numero,
        nome: senha.nome,
        checkedIn: Boolean(senha.checked_in_at),
        eventTitle: event.titulo,
        data: event.data,
        hora: event.hora,
        terreiroName,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar presença." });
    }
  });

  app.post("/api/v1/public/presenca/:token/confirmar", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const venueToken = extractVenueTokenFromScan(String(req.body?.venueToken || ""));

      if (!venueToken) {
        return res.status(400).json({ error: "QR da portaria inválido." });
      }

      const { data: senha } = await sb
        .from("evento_senhas")
        .select("*")
        .eq("checkin_token", token)
        .maybeSingle();
      if (!senha) return res.status(404).json({ error: "Link inválido." });

      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, checkin_qr_token")
        .eq("id", senha.event_id)
        .maybeSingle();
      if (!event || String(event.checkin_qr_token) !== venueToken) {
        return res.status(400).json({ error: "QR não corresponde a este evento." });
      }

      if (senha.checked_in_at) {
        return res.json({
          success: true,
          alreadyCheckedIn: true,
          senha: senha.numero,
          nome: senha.nome,
          eventTitle: event.titulo,
        });
      }

      const now = new Date().toISOString();
      const { error } = await sb
        .from("evento_senhas")
        .update({ checked_in_at: now, status: "presente" })
        .eq("id", senha.id);
      if (error) throw error;

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        success: true,
        senha: senha.numero,
        nome: senha.nome,
        eventTitle: event.titulo,
      });
    } catch (e: unknown) {
      console.error("[public presenca confirmar]", e);
      res.status(500).json({ error: "Erro ao confirmar presença." });
    }
  });

  // ── Público: senhas de gira ──
  app.get("/api/v1/public/senhas/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, senhas_ativas, senhas_maximas, tenant_id, lider_id")
        .eq("senhas_public_token", token)
        .maybeSingle();
      if (!event || !event.senhas_ativas) {
        return res.status(404).json({ error: "Emissão de senhas não disponível." });
      }

      const { count } = await sb
        .from("evento_senhas")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);

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

      const emitidas = count ?? 0;
      const max =
        event.senhas_maximas != null && Number(event.senhas_maximas) > 0
          ? Number(event.senhas_maximas)
          : null;

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        eventId: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        terreiroName,
        senhasEmitidas: emitidas,
        senhasMaximas: max,
        senhasRestantes: max != null ? Math.max(0, max - emitidas) : null,
        esgotado: max != null && emitidas >= max,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar gira." });
    }
  });

  app.post("/api/v1/public/senhas/:token/emitir", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const nome = String(req.body?.nome || "").trim();
      const telefone = String(req.body?.telefone || "").trim();
      if (!nome) return res.status(400).json({ error: "Nome obrigatório." });
      if (!telefone) return res.status(400).json({ error: "WhatsApp obrigatório." });

      const { data: event } = await sb
        .from("calendario_axe")
        .select("*")
        .eq("senhas_public_token", token)
        .maybeSingle();
      if (!event || !event.senhas_ativas) {
        return res.status(404).json({ error: "Emissão indisponível." });
      }

      let senhaRow: Record<string, unknown>;
      let numero: number;
      try {
        const result = await emitirSenhaVisitante(sb, event, nome, telefone);
        senhaRow = result.data;
        numero = result.numero;
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number };
        return res.status(e.statusCode || 500).json({ error: e.message || "Erro ao emitir senha." });
      }

      void sendSenhaVisitanteWhatsApp(sb, event, senhaRow);

      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        success: true,
        senha: numero,
        nome: senhaRow.nome,
        eventTitle: event.titulo,
        whatsappEnviado: true,
      });
    } catch (e: unknown) {
      console.error("[public senhas emitir]", e);
      res.status(500).json({ error: "Erro ao emitir senha." });
    }
  });
}
