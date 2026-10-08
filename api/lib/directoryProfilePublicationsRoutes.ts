import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, sensitiveActionRateLimit } from "./rateLimit.js";
import { requireAuthOrRespond } from "./requireAuth.js";

type Deps = { supabaseAdmin: SupabaseClient };

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

async function ownerDirectory(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("terreiros_diretorio")
    .select("id, slug")
    .eq("claimed_by_tenant_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function registerDirectoryProfilePublicationsRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  app.get(
    "/api/v1/public/diretorio/terreiro/:slug/publicacoes",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = String(req.params.slug || "").trim().toLowerCase().slice(0, 200);
        if (!slug) return res.status(400).json({ error: "Perfil inválido." });
        const { data: terreiro, error } = await sb
          .from("terreiros_diretorio")
          .select("id, publicacao_status")
          .eq("slug", slug)
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
      const terreiro = await ownerDirectory(sb, user.id);
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
      const terreiro = await ownerDirectory(sb, user.id);
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });
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
      const terreiro = await ownerDirectory(sb, user.id);
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });
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
      const terreiro = await ownerDirectory(sb, user.id);
      if (!terreiro) return res.status(403).json({ error: "Nenhum perfil reivindicado nesta conta." });
      const { error } = await sb.from(TABLE).delete().eq("id", id).eq("terreiro_id", terreiro.id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error: unknown) {
      console.error("[settings/directory-publications/delete]", error);
      return res.status(500).json({ error: "Erro ao excluir publicação." });
    }
  });
}
