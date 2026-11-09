import {resolveDelegatedModuleTenant} from './delegatedAccess.js';
import { parseDiretorioSlugVariants } from "./diretorioSlug.js";
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";

type Deps = { supabaseAdmin: SupabaseClient; resolveLeaderId?: (id: string) => Promise<string> };

const TABLE = "terreiro_publicacoes";
const SELECT = "id, titulo, conteudo, imagem_url, status, publicado_em, created_at, updated_at";
const MAX_PUBLICACOES = 30;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function imageUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString().slice(0, 1000) : null;
  } catch {
    return null;
  }
}

function parsePublication(body: Record<string, unknown>) {
  const titulo = String(body.titulo || "").trim().slice(0, 140);
  const conteudo = String(body.conteudo || "").trim().slice(0, 3000);
  const imagemUrl = imageUrl(body.imagemUrl);
  const status = String(body.status || "publicado").trim().toLowerCase() === "rascunho"
    ? "rascunho"
    : "publicado";
  return { titulo, conteudo, imagemUrl, status };
}

async function ownerDirectory(sb: SupabaseClient, userId: string, resolveLeaderId?: (id: string) => Promise<string>, level: 'visualizar'|'gerenciar'='visualizar', create=false) {
  const managementTenant=await resolveDelegatedModuleTenant(sb,userId,'radar',level);
  const leaderId = resolveLeaderId ? await resolveLeaderId(managementTenant) : managementTenant;
  let { data, error } = await sb
    .from("terreiros_diretorio")
    .select("id, slug")
    .eq("claimed_by_tenant_id", leaderId)
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data && create) {
    const { data: leader } = await sb
      .from("perfil_lider")
      .select("nome_terreiro, cidade_publica, estado_publico, public_slug")
      .eq("id", leaderId)
      .maybeSingle();
    if (leader) {
      const baseSlug = String(leader.nome_terreiro || "terreiro").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const newSlug = leader.public_slug || `${baseSlug}-${leaderId.replace(/-/g, "").slice(0, 8)}`;
      const { data: created } = await sb
        .from("terreiros_diretorio")
        .insert({
          nome: leader.nome_terreiro || "Terreiro",
          cidade: leader.cidade_publica || "São Paulo",
          estado: leader.estado_publico || "SP",
          tipo: "terreiro",
          slug: newSlug,
          claimed_by_tenant_id: leaderId,
          publicacao_status: "rascunho",
        })
        .select("id, slug")
        .maybeSingle();
      if (created) data = created;
    }
  }
  return data;
}

export function registerDirectoryProfilePublicationsRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin: sb, resolveLeaderId } = deps;
  app.get(
    "/api/v1/public/diretorio/terreiro/:slug/publicacoes",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const variants = parseDiretorioSlugVariants(String(req.params.slug || ""));
        if (!variants.length) return res.status(400).json({ error: "Perfil inválido." });
        const { data: terreiro, error } = await sb
          .from("terreiros_diretorio")
          .select("id, publicacao_status")
          .in("slug", variants)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!terreiro || String(terreiro.publicacao_status || "publicado") !== "publicado") {
          return res.status(404).json({ error: "Perfil não encontrado." });
        }
        const { data, error: publicationsError } = await sb
          .from(TABLE)
          .select(SELECT)
          .eq("terreiro_id", terreiro.id)
          .eq("status", "publicado")
          .order("publicado_em", { ascending: false })
          .limit(20);
        if (publicationsError) throw publicationsError;
        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=180");
        return res.json({ publicacoes: data || [] });
      } catch (error: unknown) {
        console.error("[public/directory-publications/get]", error);
        return res.status(500).json({ error: "Erro ao carregar publicações." });
      }
    },
  );

  app.get("/api/v1/settings/directory-publicacoes", apiReadRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const terreiro = await ownerDirectory(sb, user.id, resolveLeaderId);
      if (!terreiro) return res.json({ claimed: false, publicacoes: [] });
      const { data, error } = await sb
        .from(TABLE)
        .select(SELECT)
        .eq("terreiro_id", terreiro.id)
        .order("publicado_em", { ascending: false })
        .limit(MAX_PUBLICACOES);
      if (error) throw error;
      return res.json({ claimed: true, publicacoes: data || [] });
    } catch (error: unknown) {
      console.error("[settings/directory-publications/get]", error);
      return res.status(500).json({ error: "Erro ao carregar publicações." });
    }
  });

  app.post("/api/v1/settings/directory-publicacoes", sensitiveActionRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const terreiro = await ownerDirectory(sb, user.id, resolveLeaderId,'gerenciar',true);
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });
      const { count, error: countError } = await sb.from(TABLE).select("id", { count: "exact", head: true }).eq("terreiro_id", terreiro.id);
      if (countError) throw countError;
      if ((count || 0) >= MAX_PUBLICACOES) return res.status(400).json({ error: `Limite de ${MAX_PUBLICACOES} publicações atingido.` });
      const parsed = parsePublication(req.body && typeof req.body === "object" ? req.body : {});
      if (parsed.titulo.length < 3) return res.status(400).json({ error: "Informe um título com pelo menos 3 caracteres." });
      if (parsed.conteudo.length < 3) return res.status(400).json({ error: "Escreva o conteúdo da publicação." });
      if (req.body?.imagemUrl && !parsed.imagemUrl) return res.status(400).json({ error: "Imagem inválida." });
      const { data, error } = await sb.from(TABLE).insert({
        terreiro_id: terreiro.id,
        titulo: parsed.titulo,
        conteudo: parsed.conteudo,
        imagem_url: parsed.imagemUrl,
        status: parsed.status,
        publicado_em: new Date().toISOString(),
      }).select(SELECT).single();
      if (error) throw error;
      return res.status(201).json({ success: true, publicacao: data });
    } catch (error: unknown) {
      console.error("[settings/directory-publications/post]", error);
      return res.status(500).json({ error: "Erro ao criar publicação." });
    }
  });

  app.patch("/api/v1/settings/directory-publicacoes/:id", sensitiveActionRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const id = String(req.params.id || "");
      if (!isUuid(id)) return res.status(400).json({ error: "Publicação inválida." });
      const terreiro = await ownerDirectory(sb, user.id, resolveLeaderId,'gerenciar');
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });
      const parsed = parsePublication(req.body && typeof req.body === "object" ? req.body : {});
      if (parsed.titulo.length < 3 || parsed.conteudo.length < 3) return res.status(400).json({ error: "Preencha título e conteúdo." });
      if (req.body?.imagemUrl && !parsed.imagemUrl) return res.status(400).json({ error: "Imagem inválida." });
      const { data, error } = await sb.from(TABLE).update({
        titulo: parsed.titulo,
        conteudo: parsed.conteudo,
        imagem_url: parsed.imagemUrl,
        status: parsed.status,
        publicado_em: parsed.status === "publicado" ? new Date().toISOString() : undefined,
      }).eq("id", id).eq("terreiro_id", terreiro.id).select(SELECT).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Publicação não encontrada." });
      return res.json({ success: true, publicacao: data });
    } catch (error: unknown) {
      console.error("[settings/directory-publications/patch]", error);
      return res.status(500).json({ error: "Erro ao atualizar publicação." });
    }
  });

  app.delete("/api/v1/settings/directory-publicacoes/:id", sensitiveActionRateLimit, async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return;
    try {
      const id = String(req.params.id || "");
      if (!isUuid(id)) return res.status(400).json({ error: "Publicação inválida." });
      const terreiro = await ownerDirectory(sb, user.id, resolveLeaderId,'gerenciar');
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil da casa nesta conta." });
      const { error } = await sb.from(TABLE).delete().eq("id", id).eq("terreiro_id", terreiro.id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error: unknown) {
      console.error("[settings/directory-publications/delete]", error);
      return res.status(500).json({ error: "Erro ao excluir publicação." });
    }
  });
}
