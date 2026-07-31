import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTenantReadAccess } from "./secureRoutes.js";
import {
  assertZeladorOrGlobalAdmin,
  resolveAuthenticatedFilho,
} from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = { supabaseAdmin: SupabaseClient };

const CATEGORIES = new Set(["banhos", "ervas", "rituais", "defumacoes", "firmezas", "fundamentos", "outros"]);
const ACCESS_LEVELS = new Set(["corrente", "cargo", "individual", "zeladoria"]);
const STATUSES = new Set(["rascunho", "publicado", "arquivado"]);

function cleanText(value: unknown, max = 50000): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return cleanText(value, 180)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanList(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 100)).filter(Boolean))].slice(0, max);
}

async function loadHouseTradition(supabaseAdmin: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("perfil_lider")
    .select("tradicao")
    .or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`)
    .limit(1)
    .maybeSingle();
  return normalize(data?.tradicao || "todas");
}

async function loadChild(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{ id: string; cargo: string; status: string } | null> {
  const ref = await resolveAuthenticatedFilho(supabaseAdmin, userId);
  if (!ref?.id) return null;
  const { data } = await supabaseAdmin
    .from("filhos_de_santo")
    .select("id, cargo, status")
    .eq("id", ref.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    cargo: cleanText(data.cargo, 100),
    status: normalize(data.status),
  };
}

async function allowedForChild(
  supabaseAdmin: SupabaseClient,
  item: Record<string, any>,
  child: { id: string; cargo: string; status: string },
  houseTradition: string,
): Promise<boolean> {
  if (item.status !== "publicado" || item.nivel_acesso === "zeladoria") return false;
  if (child.status && child.status !== "ativo" && child.status !== "active") return false;

  const itemTradition = normalize(item.tradicao || "todas");
  if (itemTradition !== "todas" && houseTradition !== itemTradition) return false;

  if (item.nivel_acesso === "corrente") return true;
  if (item.nivel_acesso === "cargo") {
    const cargo = normalize(child.cargo);
    return (item.cargos_permitidos || []).some((value: string) => normalize(value) === cargo);
  }
  if (item.nivel_acesso === "individual") {
    const { data } = await supabaseAdmin
      .from("fundamentos_acessos")
      .select("id")
      .eq("fundamento_id", item.id)
      .eq("filho_id", child.id)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

async function resolveContext(
  supabaseAdmin: SupabaseClient,
  req: Request,
  res: Response,
  tenantRaw: unknown,
) {
  const access = await requireTenantReadAccess(supabaseAdmin, req, res, tenantRaw);
  if (!access) return null;
  const isManager = await assertZeladorOrGlobalAdmin(supabaseAdmin, access.user, access.tenantId);
  const child = isManager ? null : await loadChild(supabaseAdmin, access.user.id);
  if (!isManager && !child) {
    res.status(403).json({ error: "Perfil de filho de santo não encontrado." });
    return null;
  }
  return { ...access, isManager, child };
}

async function syncIndividualAccess(
  supabaseAdmin: SupabaseClient,
  itemId: string,
  tenantId: string,
  userId: string,
  childIds: string[],
) {
  await supabaseAdmin.from("fundamentos_acessos").delete().eq("fundamento_id", itemId).eq("tenant_id", tenantId);
  if (!childIds.length) return;
  const { error } = await supabaseAdmin.from("fundamentos_acessos").insert(
    childIds.map((filhoId) => ({
      fundamento_id: itemId,
      tenant_id: tenantId,
      filho_id: filhoId,
      concedido_por: userId,
    })),
  );
  if (error) throw error;
}

function itemPayload(body: Record<string, unknown>) {
  const categoria = cleanText(body.categoria, 40).toLowerCase();
  const nivel = cleanText(body.nivel_acesso, 30).toLowerCase();
  const status = cleanText(body.status, 30).toLowerCase();
  if (!CATEGORIES.has(categoria)) throw new Error("Categoria inválida.");
  if (!ACCESS_LEVELS.has(nivel)) throw new Error("Nível de acesso inválido.");
  if (!STATUSES.has(status)) throw new Error("Status inválido.");
  const titulo = cleanText(body.titulo, 140);
  const conteudo = cleanText(body.conteudo);
  if (titulo.length < 3 || conteudo.length < 3) throw new Error("Informe título e conteúdo.");
  return {
    titulo,
    resumo: cleanText(body.resumo, 500) || null,
    conteudo,
    categoria,
    tradicao: cleanText(body.tradicao, 100) || "todas",
    nivel_acesso: nivel,
    cargos_permitidos: nivel === "cargo" ? cleanList(body.cargos_permitidos, 30) : [],
    status,
    publicado_em: status === "publicado" ? new Date().toISOString() : null,
  };
}

export function registerFundamentosRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin } = deps;

  app.get("/api/v1/fundamentos", async (req: Request, res: Response) => {
    const ctx = await resolveContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    try {
      let query = supabaseAdmin
        .from("fundamentos_acervo")
        .select("id, tenant_id, titulo, resumo, categoria, tradicao, nivel_acesso, cargos_permitidos, status, publicado_em, created_at, updated_at")
        .eq("tenant_id", ctx.tenantId)
        .order("updated_at", { ascending: false });
      if (!ctx.isManager) query = query.eq("status", "publicado");
      const { data, error } = await query;
      if (error) throw error;

      if (ctx.isManager) {
        const ids = (data || []).map((item) => item.id);
        const { data: grants } = ids.length
          ? await supabaseAdmin.from("fundamentos_acessos").select("fundamento_id, filho_id").in("fundamento_id", ids)
          : { data: [] as any[] };
        return res.json({
          data: (data || []).map((item) => ({
            ...item,
            filhos_permitidos: (grants || []).filter((grant) => grant.fundamento_id === item.id).map((grant) => grant.filho_id),
          })),
          role: "manager",
        });
      }

      const tradition = await loadHouseTradition(supabaseAdmin, ctx.tenantId);
      const permitted = [];
      for (const item of data || []) {
        if (await allowedForChild(supabaseAdmin, item, ctx.child!, tradition)) permitted.push(item);
      }
      return res.json({ data: permitted, role: "filho" });
    } catch (error) {
      console.error("[fundamentos list]", error);
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar o acervo.") });
    }
  });

  app.get("/api/v1/fundamentos/options", async (req: Request, res: Response) => {
    const ctx = await resolveContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    if (!ctx.isManager) return res.status(403).json({ error: "Acesso restrito à zeladoria." });
    try {
      const [{ data: children, error }, tradition] = await Promise.all([
        supabaseAdmin
          .from("filhos_de_santo")
          .select("id, nome, cargo, status, foto_url")
          .or(`tenant_id.eq.${ctx.tenantId},lider_id.eq.${ctx.tenantId}`)
          .order("nome"),
        loadHouseTradition(supabaseAdmin, ctx.tenantId),
      ]);
      if (error) throw error;
      return res.json({ children: children || [], tradition: tradition || "todas" });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar opções.") });
    }
  });

  app.get("/api/v1/fundamentos/:id", async (req: Request, res: Response) => {
    const ctx = await resolveContext(supabaseAdmin, req, res, req.query.tenantId);
    if (!ctx) return;
    try {
      const { data: item, error } = await supabaseAdmin
        .from("fundamentos_acervo")
        .select("*")
        .eq("id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!item) return res.status(404).json({ error: "Fundamento não encontrado." });
      if (!ctx.isManager) {
        const tradition = await loadHouseTradition(supabaseAdmin, ctx.tenantId);
        if (!(await allowedForChild(supabaseAdmin, item, ctx.child!, tradition))) {
          return res.status(403).json({ error: "Este fundamento não foi liberado para o seu acesso." });
        }
      }
      await supabaseAdmin.from("fundamentos_audit_logs").insert({
        fundamento_id: item.id,
        tenant_id: ctx.tenantId,
        user_id: ctx.user.id,
        filho_id: ctx.child?.id || null,
        acao: "abriu",
      });
      return res.json({ data: item });
    } catch (error) {
      return res.status(500).json({ error: safeErrorMessage(error, "Erro ao abrir o fundamento.") });
    }
  });

  app.post("/api/v1/fundamentos", async (req: Request, res: Response) => {
    const tenantId = cleanText(req.body?.tenantId, 50);
    const ctx = await resolveContext(supabaseAdmin, req, res, tenantId);
    if (!ctx) return;
    if (!ctx.isManager) return res.status(403).json({ error: "Acesso restrito à zeladoria." });
    try {
      const payload = itemPayload(req.body || {});
      const { data, error } = await supabaseAdmin
        .from("fundamentos_acervo")
        .insert({ ...payload, tenant_id: ctx.tenantId, autor_id: ctx.user.id })
        .select("*")
        .single();
      if (error) throw error;
      await syncIndividualAccess(supabaseAdmin, data.id, ctx.tenantId, ctx.user.id, cleanList(req.body?.filhos_permitidos));
      await supabaseAdmin.from("fundamentos_audit_logs").insert({
        fundamento_id: data.id,
        tenant_id: ctx.tenantId,
        user_id: ctx.user.id,
        acao: payload.status === "publicado" ? "publicou" : "criou",
      });
      return res.status(201).json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao criar fundamento.") });
    }
  });

  app.patch("/api/v1/fundamentos/:id", async (req: Request, res: Response) => {
    const tenantId = cleanText(req.body?.tenantId || req.query.tenantId, 50);
    const ctx = await resolveContext(supabaseAdmin, req, res, tenantId);
    if (!ctx) return;
    if (!ctx.isManager) return res.status(403).json({ error: "Acesso restrito à zeladoria." });
    try {
      const payload = itemPayload(req.body || {});
      const { data, error } = await supabaseAdmin
        .from("fundamentos_acervo")
        .update(payload)
        .eq("id", req.params.id)
        .eq("tenant_id", ctx.tenantId)
        .select("*")
        .single();
      if (error) throw error;
      await syncIndividualAccess(supabaseAdmin, data.id, ctx.tenantId, ctx.user.id, cleanList(req.body?.filhos_permitidos));
      await supabaseAdmin.from("fundamentos_audit_logs").insert({
        fundamento_id: data.id,
        tenant_id: ctx.tenantId,
        user_id: ctx.user.id,
        acao: payload.status === "arquivado" ? "arquivou" : payload.status === "publicado" ? "publicou" : "editou",
      });
      return res.json({ data });
    } catch (error) {
      return res.status(400).json({ error: safeErrorMessage(error, "Erro ao atualizar fundamento.") });
    }
  });
}
