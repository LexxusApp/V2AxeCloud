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
  if (Object.keys(patch).length === 0) return event;
  const { data } = await sb
    .from("calendario_axe")
    .update(patch)
    .eq("id", event.id)
    .select("*")
    .single();
  return data || { ...event, ...patch };
}

export function buildCheckinPublicUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/checkin/${encodeURIComponent(token)}`;
}

export function buildSenhasPublicUrl(token: string): string {
  const base = resolvePublicAppUrl().replace(/\/$/, "");
  return `${base}/senhas/${encodeURIComponent(token)}`;
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

      const confirmed = (data || []).filter((p) =>
        ["confirmado", "presente"].includes(String(p.status))
      ).length;
      const present = (data || []).filter((p) => String(p.status) === "presente").length;

      res.json({
        data: data || [],
        event: updatedEvent,
        stats: {
          total: (data || []).length,
          confirmados: confirmed,
          presentes: present,
          vagas_maximas: event.vagas_maximas ?? null,
          vagas_restantes:
            event.vagas_maximas != null
              ? Math.max(0, Number(event.vagas_maximas) - confirmed)
              : null,
        },
        checkinUrl: updatedEvent.checkin_qr_token
          ? buildCheckinPublicUrl(String(updatedEvent.checkin_qr_token))
          : null,
        senhasUrl:
          updatedEvent.senhas_ativas && updatedEvent.senhas_public_token
            ? buildSenhasPublicUrl(String(updatedEvent.senhas_public_token))
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

  app.post("/api/v1/events/:eventId/participantes/checkin", async (req: Request, res: Response) => {
    try {
      const user = await requireAuthenticatedUser(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
      if (!tenantId) return res.status(400).json({ error: "tenantId required" });

      const eventId = String(req.params.eventId || "");
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

      const { data, error } = await sb
        .from("evento_participantes")
        .update({
          status: "presente",
          checked_in_at: new Date().toISOString(),
        })
        .eq("event_id", eventId)
        .eq("filho_id", filhoId)
        .select("*")
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro no check-in." });
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
        const presentes = rows.filter((r) => r.status === "presente").length;
        const confirmados = rows.filter((r) => ["confirmado", "presente"].includes(String(r.status))).length;
        const total = rows.length;
        const assiduidade = total > 0 ? Math.round((presentes / total) * 100) : 0;
        return {
          filho_id: f.id,
          nome: f.nome,
          cargo: f.cargo,
          foto_url: f.foto_url,
          total_eventos: total,
          confirmados,
          presentes,
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

      const status = String(req.body?.status || "");
      const patch: Record<string, unknown> = {};
      if (["aguardando", "chamado", "atendido", "cancelado"].includes(status)) {
        patch.status = status;
        if (status === "chamado") patch.called_at = new Date().toISOString();
        if (status === "atendido") patch.attended_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from("evento_senhas")
        .update(patch)
        .eq("id", req.params.senhaId)
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

  // ── Público: check-in QR ──
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

      res.json({
        eventId: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        tipo: event.tipo,
        terreiroName,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar check-in." });
    }
  });

  app.post("/api/v1/public/checkin/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
      const telefone = String(req.body?.telefone || "").replace(/\D/g, "");
      const checkinToken = String(req.body?.checkinToken || "").trim();

      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, tenant_id")
        .eq("checkin_qr_token", token)
        .maybeSingle();
      if (!event) return res.status(404).json({ error: "QR inválido." });

      if (checkinToken) {
        const { data: part } = await sb
          .from("evento_participantes")
          .select("id, filhos_de_santo(nome)")
          .eq("checkin_token", checkinToken)
          .eq("event_id", event.id)
          .maybeSingle();
        if (!part) return res.status(404).json({ error: "Token de check-in inválido." });
        await sb
          .from("evento_participantes")
          .update({ status: "presente", checked_in_at: new Date().toISOString() })
          .eq("id", part.id);
        const nome =
          (part as { filhos_de_santo?: { nome?: string } }).filhos_de_santo?.nome || "Participante";
        return res.json({ success: true, nome, eventTitle: event.titulo });
      }

      if (!cpf && !telefone) {
        return res.status(400).json({ error: "Informe CPF ou telefone." });
      }

      const leaderId = await resolveLeader(String(event.tenant_id));
      let filhoQuery = sb.from("filhos_de_santo").select("id, nome");
      if (cpf) filhoQuery = filhoQuery.eq("cpf", cpf);
      else filhoQuery = filhoQuery.eq("whatsapp_phone", telefone);

      const { data: filho } = await filhoQuery
        .or(
          `tenant_id.eq.${event.tenant_id},tenant_id.eq.${leaderId},lider_id.eq.${event.tenant_id},lider_id.eq.${leaderId}`
        )
        .maybeSingle();

      if (!filho) return res.status(404).json({ error: "Filho não encontrado nesta casa." });

      await syncParts(String(event.id), String(event.tenant_id));
      const { error } = await sb
        .from("evento_participantes")
        .update({ status: "presente", checked_in_at: new Date().toISOString() })
        .eq("event_id", event.id)
        .eq("filho_id", filho.id);
      if (error) throw error;

      res.json({ success: true, nome: filho.nome, eventTitle: event.titulo });
    } catch (e: unknown) {
      console.error("[public checkin]", e);
      res.status(500).json({ error: "Erro no check-in." });
    }
  });

  // ── Público: senhas de gira ──
  app.get("/api/v1/public/senhas/:token", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, data, hora, senhas_ativas, tenant_id, lider_id")
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

      res.json({
        eventId: event.id,
        titulo: event.titulo,
        data: event.data,
        hora: event.hora,
        terreiroName,
        senhasEmitidas: count ?? 0,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao carregar gira." });
    }
  });

  app.post("/api/v1/public/senhas/:token/emitir", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ error: "Nome obrigatório." });

      const { data: event } = await sb
        .from("calendario_axe")
        .select("id, titulo, senhas_ativas, tenant_id")
        .eq("senhas_public_token", token)
        .maybeSingle();
      if (!event || !event.senhas_ativas) {
        return res.status(404).json({ error: "Emissão indisponível." });
      }

      const { data: last } = await sb
        .from("evento_senhas")
        .select("numero")
        .eq("event_id", event.id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      const numero = (last?.numero ?? 0) + 1;

      const { data, error } = await sb
        .from("evento_senhas")
        .insert({
          event_id: event.id,
          tenant_id: event.tenant_id,
          numero,
          nome,
          telefone: req.body?.telefone ? String(req.body.telefone).replace(/\D/g, "") : null,
        })
        .select("*")
        .single();
      if (error) throw error;

      res.json({
        success: true,
        senha: data.numero,
        nome: data.nome,
        eventTitle: event.titulo,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: "Erro ao emitir senha." });
    }
  });
}
