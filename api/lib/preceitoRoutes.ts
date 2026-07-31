import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { requireTenantReadAccess } from "./secureRoutes.js";
import {
  assertZeladorOrGlobalAdmin,
  resolveAuthenticatedFilho,
} from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = { supabaseAdmin: SupabaseClient };
type ChildRow = {
  id: string;
  nome?: string | null;
  cargo?: string | null;
  status?: string | null;
  user_id?: string | null;
  foto_url?: string | null;
};

const AUDIENCES = new Set(["corrente", "cargo", "individual"]);
const CYCLE_STATUSES = new Set(["rascunho", "ativo", "encerrado", "cancelado"]);
const PARTICIPANT_STATUSES = new Set(["pendente", "ciente", "dispensado", "orientacao_solicitada"]);

let pushConfigured = false;

function text(value: unknown, max = 30000): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return text(value, 160)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function list(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max);
}

function validActiveStatus(value: unknown): boolean {
  const status = normalize(value);
  return !status || status === "ativo" || status === "active";
}

function configurePush(): boolean {
  if (pushConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:contato@axecloud.com.br", publicKey, privateKey);
  pushConfigured = true;
  return true;
}

async function notifyUsers(
  supabaseAdmin: SupabaseClient,
  userIds: string[],
  payload: { title: string; body: string; url: string },
): Promise<number> {
  const targets = [...new Set(userIds.filter(Boolean))];
  if (!targets.length || !configurePush()) return 0;
  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription_object")
    .in("user_id", targets);
  let sent = 0;
  await Promise.all(
    (subscriptions || []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription_object, JSON.stringify(payload));
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          const endpoint = row.subscription_object?.endpoint;
          if (endpoint) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("subscription_object->>endpoint", endpoint);
          }
        }
      }
    }),
  );
  return sent;
}

async function context(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Response,
  tenantRaw: unknown,
) {
  const access = await requireTenantReadAccess(supabaseAdmin, req, res, tenantRaw);
  if (!access) return null;
  const isManager = await assertZeladorOrGlobalAdmin(supabaseAdmin, access.user, access.tenantId);
  return { ...access, isManager };
}

async function managerContext(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Response,
  tenantRaw: unknown,
) {
  const ctx = await context(supabaseAdmin, req, res, tenantRaw);
  if (!ctx) return null;
  if (!ctx.isManager) {
    res.status(403).json({ error: "Acesso restrito à zeladoria." });
    return null;
  }
  return ctx;
}

async function childrenForTenant(supabaseAdmin: SupabaseClient, tenantId: string): Promise<ChildRow[]> {
  const { data, error } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, nome, cargo, status, user_id, foto_url")
    .or(`tenant_id.eq.${tenantId},lider_id.eq.${tenantId}`)
    .order("nome");
  if (error) throw error;
  return (data || []) as ChildRow[];
}

function cyclePayload(body: Record<string, unknown>) {
  const titulo = text(body.titulo, 140);
  const orientacoes = text(body.orientacoes);
  const publico = text(body.publico_alvo, 30).toLowerCase();
  const tipo = text(body.tipo, 30).toLowerCase() === "restrito" ? "restrito" : "coletivo";
  const status = text(body.status, 30).toLowerCase() || "rascunho";
  const inicio = new Date(text(body.inicio_em, 60));
  const fim = new Date(text(body.fim_em, 60));
  const cargos = list(body.cargos_alvo, 40);

  if (titulo.length < 3 || orientacoes.length < 3) throw new Error("Informe título e orientações.");
  if (!AUDIENCES.has(publico)) throw new Error("Público-alvo inválido.");
  if (!CYCLE_STATUSES.has(status)) throw new Error("Status inválido.");
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio) {
    throw new Error("Informe um período válido.");
  }
  if (publico === "cargo" && !cargos.length) throw new Error("Selecione ao menos uma função.");

  return {
    titulo,
    motivo: text(body.motivo, 500) || null,
    orientacoes,
    tipo,
    publico_alvo: publico,
    cargos_alvo: publico === "cargo" ? cargos : [],
    fundamento_id: text(body.fundamento_id, 50) || null,
    inicio_em: inicio.toISOString(),
    fim_em: fim.toISOString(),
    status,
    ativado_em: status === "ativo" ? new Date().toISOString() : null,
  };
}

function selectParticipants(
  children: ChildRow[],
  audience: string,
  cargos: string[],
  selectedIds: string[],
  excludedIds: string[],
): ChildRow[] {
  const excluded = new Set(excludedIds);
  const selected = new Set(selectedIds);
  const normalizedRoles = new Set(cargos.map(normalize));
  return children.filter((child) => {
    if (!validActiveStatus(child.status) || excluded.has(child.id)) return false;
    if (audience === "individual") return selected.has(child.id);
    if (audience === "cargo") return normalizedRoles.has(normalize(child.cargo));
    return true;
  });
}

async function cycleWithStats(supabaseAdmin: SupabaseClient, tenantId: string, cycle: Record<string, any>) {
  const { data: participants, error } = await supabaseAdmin
    .from("preceito_participantes")
    .select("id, filho_id, status, confirmado_em, orientacao_solicitada_em, motivo_dispensa")
    .eq("tenant_id", tenantId)
    .eq("ciclo_id", cycle.id);
  if (error) throw error;
  const rows = participants || [];
  const counts = {
    total: rows.length,
    pendentes: rows.filter((row) => row.status === "pendente").length,
    cientes: rows.filter((row) => row.status === "ciente").length,
    dispensados: rows.filter((row) => row.status === "dispensado").length,
    orientacao: rows.filter((row) => row.status === "orientacao_solicitada").length,
  };
  return { ...cycle, counts, participantes: rows };
}

export function registerPreceitoRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin } = deps;

  app.get("/api/v1/preceitos", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    try {
      await supabaseAdmin
        .from("preceito_ciclos")
        .update({ status: "encerrado", encerrado_em: new Date().toISOString() })
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "ativo")
        .lte("fim_em", new Date().toISOString());
      const { data, error } = await supabaseAdmin
        .from("preceito_ciclos")
        .select("id, tenant_id, titulo, motivo, tipo, publico_alvo, cargos_alvo, fundamento_id, inicio_em, fim_em, status, ativado_em, encerrado_em, created_at, updated_at")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const result = [];
      for (const cycle of data || []) result.push(await cycleWithStats(supabaseAdmin, ctx.tenantId, cycle));
      return res.json({ data: result });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar ciclos.") });
    }
  });

  app.get("/api/v1/preceitos/options", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    try {
      const [children, foundationsResult] = await Promise.all([
        childrenForTenant(supabaseAdmin, ctx.tenantId),
        supabaseAdmin
          .from("fundamentos_acervo")
          .select("id, titulo, categoria, status")
          .eq("tenant_id", ctx.tenantId)
          .eq("status", "publicado")
          .order("titulo"),
      ]);
      if (foundationsResult.error) throw foundationsResult.error;
      return res.json({
        children,
        cargos: [...new Set(children.map((child) => text(child.cargo, 100)).filter(Boolean))].sort(),
        fundamentos: foundationsResult.data || [],
      });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar opções.") });
    }
  });

  app.get("/api/v1/preceitos/current", async (req: Request, res: Response) => {
    const ctx = await context(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    if (ctx.isManager) return res.json({ data: [] });
    try {
      const childRef = await resolveAuthenticatedFilho(supabaseAdmin, ctx.user.id);
      if (!childRef?.id) return res.status(403).json({ error: "Perfil de filho não encontrado." });
      const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from("preceito_participantes")
        .select("id, ciclo_id, status, confirmado_em, orientacao_solicitada_em")
        .eq("tenant_id", ctx.tenantId)
        .eq("filho_id", childRef.id)
        .in("status", ["pendente", "ciente", "orientacao_solicitada"]);
      if (membershipsError) throw membershipsError;
      const cycleIds = (memberships || []).map((row) => row.ciclo_id);
      if (!cycleIds.length) return res.json({ data: [] });
      const { data: cycles, error } = await supabaseAdmin
        .from("preceito_ciclos")
        .select("id, titulo, motivo, orientacoes, tipo, publico_alvo, fundamento_id, inicio_em, fim_em, status, ativado_em")
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "ativo")
        .in("id", cycleIds)
        .order("inicio_em", { ascending: false });
      if (error) throw error;
      const now = Date.now();
      const visible = (cycles || [])
        .filter((cycle) => new Date(cycle.fim_em).getTime() > now)
        .map((cycle) => ({
          ...cycle,
          participacao: memberships?.find((row) => row.ciclo_id === cycle.id) || null,
        }));
      return res.json({ data: visible });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar seu preceito.") });
    }
  });

  app.get("/api/v1/preceitos/:id", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    try {
      const { data: cycle, error } = await supabaseAdmin
        .from("preceito_ciclos")
        .select("*")
        .eq("id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!cycle) return res.status(404).json({ error: "Ciclo não encontrado." });
      const enriched = await cycleWithStats(supabaseAdmin, ctx.tenantId, cycle);
      const children = await childrenForTenant(supabaseAdmin, ctx.tenantId);
      const childMap = new Map(children.map((child) => [child.id, child]));
      return res.json({
        data: {
          ...enriched,
          participantes: enriched.participantes.map((participant: any) => ({
            ...participant,
            filho: childMap.get(participant.filho_id) || null,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao abrir ciclo.") });
    }
  });

  app.post("/api/v1/preceitos", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.body?.tenantId);
    if (!ctx) return;
    try {
      const payload = cyclePayload(req.body || {});
      if (payload.status === "ativo" && payload.publico_alvo === "corrente") {
        const { data: active } = await supabaseAdmin
          .from("preceito_ciclos")
          .select("id")
          .eq("tenant_id", ctx.tenantId)
          .eq("status", "ativo")
          .eq("publico_alvo", "corrente")
          .limit(1);
        if (active?.length) return res.status(409).json({ error: "Já existe um preceito coletivo ativo para a corrente." });
      }

      const children = await childrenForTenant(supabaseAdmin, ctx.tenantId);
      const participants = selectParticipants(
        children,
        payload.publico_alvo,
        payload.cargos_alvo,
        list(req.body?.filhos_alvo),
        list(req.body?.filhos_excluidos),
      );
      if (payload.status === "ativo" && !participants.length) {
        return res.status(400).json({ error: "Nenhuma pessoa ativa corresponde ao público selecionado." });
      }

      const { data: cycle, error } = await supabaseAdmin
        .from("preceito_ciclos")
        .insert({ ...payload, tenant_id: ctx.tenantId, criado_por: ctx.user.id })
        .select("*")
        .single();
      if (error) throw error;

      if (participants.length) {
        const { error: participantError } = await supabaseAdmin.from("preceito_participantes").insert(
          participants.map((child) => ({
            ciclo_id: cycle.id,
            tenant_id: ctx.tenantId,
            filho_id: child.id,
          })),
        );
        if (participantError) {
          await supabaseAdmin.from("preceito_ciclos").delete().eq("id", cycle.id);
          throw participantError;
        }
      }

      const sent = payload.status === "ativo"
        ? await notifyUsers(
            supabaseAdmin,
            participants.map((child) => text(child.user_id, 50)).filter(Boolean),
            {
              title: "Novo ciclo de preceito",
              body: "A zeladoria publicou uma orientação para você. Acesse o AxéCloud para consultar com segurança.",
              url: "/dashboard",
            },
          )
        : 0;
      return res.status(201).json({
        data: await cycleWithStats(supabaseAdmin, ctx.tenantId, cycle),
        notification: { sent, targets: participants.filter((child) => child.user_id).length },
      });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao criar ciclo.") });
    }
  });

  app.patch("/api/v1/preceitos/:id/status", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.body?.tenantId || req.query.tenantId);
    if (!ctx) return;
    const status = text(req.body?.status, 30).toLowerCase();
    if (!["encerrado", "cancelado"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }
    try {
      const { data, error } = await supabaseAdmin
        .from("preceito_ciclos")
        .update({ status, encerrado_em: new Date().toISOString() })
        .eq("id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .select("id, status, encerrado_em")
        .single();
      if (error) throw error;
      return res.json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao encerrar ciclo.") });
    }
  });

  app.patch("/api/v1/preceitos/:id/participantes/:participantId", async (req: Request, res: Response) => {
    const ctx = await managerContext(supabaseAdmin, req, res, req.body?.tenantId || req.query.tenantId);
    if (!ctx) return;
    const status = text(req.body?.status, 40).toLowerCase();
    if (!PARTICIPANT_STATUSES.has(status)) return res.status(400).json({ error: "Status inválido." });
    try {
      const update: Record<string, unknown> = {
        status,
        motivo_dispensa: status === "dispensado" ? text(req.body?.motivo, 500) || null : null,
        dispensado_em: status === "dispensado" ? new Date().toISOString() : null,
        dispensado_por: status === "dispensado" ? ctx.user.id : null,
      };
      const { data, error } = await supabaseAdmin
        .from("preceito_participantes")
        .update(update)
        .eq("id", req.params.participantId)
        .eq("ciclo_id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .select("*")
        .single();
      if (error) throw error;
      return res.json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao atualizar participante.") });
    }
  });

  app.post("/api/v1/preceitos/:id/acknowledge", async (req: Request, res: Response) => {
    const ctx = await context(supabaseAdmin, req, res, req.body?.tenantId || req.query.tenantId);
    if (!ctx) return;
    if (ctx.isManager) return res.status(400).json({ error: "Confirmação disponível somente para participantes." });
    try {
      const child = await resolveAuthenticatedFilho(supabaseAdmin, ctx.user.id);
      if (!child?.id) return res.status(403).json({ error: "Perfil de filho não encontrado." });
      const { data, error } = await supabaseAdmin
        .from("preceito_participantes")
        .update({ status: "ciente", confirmado_em: new Date().toISOString() })
        .eq("ciclo_id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .eq("filho_id", child.id)
        .neq("status", "dispensado")
        .select("*")
        .single();
      if (error) throw error;
      return res.json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao confirmar leitura.") });
    }
  });

  app.post("/api/v1/preceitos/:id/guidance", async (req: Request, res: Response) => {
    const ctx = await context(supabaseAdmin, req, res, req.body?.tenantId || req.query.tenantId);
    if (!ctx) return;
    if (ctx.isManager) return res.status(400).json({ error: "Ação disponível somente para participantes." });
    try {
      const child = await resolveAuthenticatedFilho(supabaseAdmin, ctx.user.id);
      if (!child?.id) return res.status(403).json({ error: "Perfil de filho não encontrado." });
      const { data, error } = await supabaseAdmin
        .from("preceito_participantes")
        .update({ status: "orientacao_solicitada", orientacao_solicitada_em: new Date().toISOString() })
        .eq("ciclo_id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .eq("filho_id", child.id)
        .neq("status", "dispensado")
        .select("*")
        .single();
      if (error) throw error;
      const [{ data: childRow }, { data: cycleRow }] = await Promise.all([
        supabaseAdmin.from("filhos_de_santo").select("nome").eq("id", child.id).maybeSingle(),
        supabaseAdmin.from("preceito_ciclos").select("titulo").eq("id", req.params.id).maybeSingle(),
      ]);
      await supabaseAdmin.from("notificacoes").insert({
        tenant_id: ctx.tenantId,
        tipo: "preceito_orientacao",
        mensagem: `${text(childRow?.nome, 120) || "Um membro"} pediu orientação sobre “${text(cycleRow?.titulo, 140) || "o ciclo de preceito"}”.`,
        link: "dashboard",
        lida: false,
      });
      await notifyUsers(supabaseAdmin, [ctx.user.id], {
        title: "Pedido enviado à zeladoria",
        body: "Seu pedido de orientação foi registrado com discrição.",
        url: "/dashboard",
      });
      return res.json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao solicitar orientação.") });
    }
  });
}
