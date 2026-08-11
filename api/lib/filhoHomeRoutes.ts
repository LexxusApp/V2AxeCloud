import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertUserCanAccessTenant, assertZeladorTenantAccess, normalizeQueryTenantId, resolveLeaderId } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";
import { assertSafeImageBuffer, SAFE_IMAGE_MIME_TYPES } from "./imageUpload.js";
import { digitsOnlyCpf, isValidCpf } from "../../lib/brCpf.js";

const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type FilhoRecord = {
  id: string;
  nome?: string | null;
  foto_url?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  lider_id?: string | null;
  cpf?: string | null;
};

function extFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("heic") || ct.includes("heif")) return "heic";
  return "jpg";
}

/** Carrega o registro filhos_de_santo do usuário autenticado (com id). */
async function loadFilhoRecordForUser(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<FilhoRecord | null> {
  const selectCols = "id, nome, foto_url, tenant_id, user_id, email, lider_id, cpf";

  let { data: child } = await supabaseAdmin
    .from("filhos_de_santo")
    .select(selectCols)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!child) {
    let email = String(user.email || "").trim().toLowerCase();
    if (!email) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(user.id);
        email = String(data?.user?.email || "").trim().toLowerCase();
      } catch {
        /* ignore */
      }
    }

    if (email) {
      const { data: emailChild } = await supabaseAdmin
        .from("filhos_de_santo")
        .select(selectCols)
        .ilike("email", email)
        .maybeSingle();

      if (emailChild) {
        if (!emailChild.user_id) {
          await supabaseAdmin
            .from("filhos_de_santo")
            .update({ user_id: user.id })
            .eq("id", emailChild.id)
            .is("user_id", null);
          emailChild.user_id = user.id;
        }
        child = emailChild;
      }
    }
  }

  return child as FilhoRecord | null;
}

type Deps = {
  supabaseAdmin: SupabaseClient;
};

export function registerFilhoHomeRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin } = deps;

  async function libraryMaterialScope(materialId: string, tenantId: string) {
    const resolved = await resolveLeaderId(supabaseAdmin, tenantId);
    const { data } = await supabaseAdmin.from("biblioteca").select("id,tenant_id").eq("id", materialId).in("tenant_id", [tenantId, resolved]).maybeSingle();
    return data ? { materialId: String(data.id), tenantId: String(data.tenant_id) } : null;
  }

  app.get("/api/v1/library/material/:id/comments", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res); if (!user) return;
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!tenantId || !(await assertUserCanAccessTenant(supabaseAdmin, user, tenantId))) return res.status(403).json({ error: "Acesso negado" });
    try {
      const scope = await libraryMaterialScope(String(req.params.id), tenantId);
      if (!scope) return res.status(404).json({ error: "Material não encontrado." });
      const commentTenantIds = [...new Set([tenantId, scope.tenantId])];
      const { data, error } = await supabaseAdmin.from("biblioteca_comentarios").select("id,arquivo_id,user_id,tenant_id,texto,parent_id,created_at").eq("arquivo_id", scope.materialId).in("tenant_id", commentTenantIds).order("created_at");
      if (error) throw error;
      const userIds = [...new Set((data || []).map((row) => String(row.user_id || "")).filter(Boolean))];
      const [{ data: profiles }, { data: children }, { data: leaders }] = await Promise.all([
        userIds.length ? supabaseAdmin.from("profiles").select("id,full_name,avatar_url,role").in("id", userIds) : Promise.resolve({ data: [] }),
        userIds.length ? supabaseAdmin.from("filhos_de_santo").select("user_id,nome,foto_url").in("user_id", userIds) : Promise.resolve({ data: [] }),
        userIds.length ? supabaseAdmin.from("perfil_lider").select("id,nome,foto_url").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      const items = (data || []).map((row) => {
        const profile = (profiles || []).find((p) => p.id === row.user_id);
        const child = (children || []).find((p) => p.user_id === row.user_id);
        const leader = (leaders || []).find((p) => p.id === row.user_id);
        return { ...row, authorName: profile?.full_name || child?.nome || leader?.nome || "Membro da casa", authorPhoto: profile?.avatar_url || child?.foto_url || leader?.foto_url || "", leadership: ["admin","zelador","lider"].includes(String(profile?.role || "").toLowerCase()) || Boolean(leader) };
      });
      res.json({ items, currentUserId: user.id, manager: await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId) });
    } catch (error) { res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar comentários.") }); }
  });

  app.post("/api/v1/library/material/:id/comments", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res); if (!user) return;
    const tenantId = normalizeQueryTenantId(req.body?.tenantId);
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    const parentId = String(req.body?.parentId || "").trim() || null;
    if (!tenantId || !text || !(await assertUserCanAccessTenant(supabaseAdmin, user, tenantId))) return res.status(400).json({ error: "Dados inválidos." });
    try {
      const scope = await libraryMaterialScope(String(req.params.id), tenantId);
      if (!scope) return res.status(404).json({ error: "Material não encontrado." });
      if (parentId) {
        const { data: parent } = await supabaseAdmin.from("biblioteca_comentarios").select("id").eq("id", parentId).eq("arquivo_id", scope.materialId).maybeSingle();
        if (!parent) return res.status(400).json({ error: "Comentário original não encontrado." });
      }
      const { data, error } = await supabaseAdmin.from("biblioteca_comentarios").insert({ arquivo_id: scope.materialId, user_id: user.id, tenant_id: tenantId, texto: text, parent_id: parentId }).select("id").single();
      if (error) throw error;
      if (!parentId && String(user.user_metadata?.role || "").toLowerCase() === "filho") await supabaseAdmin.from("notificacoes").insert({ tenant_id: tenantId, tipo: "biblioteca_duvida", mensagem: `Nova dúvida na Biblioteca: ${text.slice(0, 80)}`, link: "library", lida: false });
      res.status(201).json({ id: data.id });
    } catch (error) { res.status(500).json({ error: safeErrorMessage(error, "Erro ao enviar comentário.") }); }
  });

  app.delete("/api/v1/library/comments/:id", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res); if (!user) return;
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!tenantId || !(await assertUserCanAccessTenant(supabaseAdmin, user, tenantId))) return res.status(403).json({ error: "Acesso negado" });
    try {
      const { data: row } = await supabaseAdmin.from("biblioteca_comentarios").select("id,user_id,tenant_id").eq("id", req.params.id).maybeSingle();
      if (!row) return res.status(404).json({ error: "Comentário não encontrado." });
      const resolvedTenantId = await resolveLeaderId(supabaseAdmin, tenantId);
      if (![tenantId, resolvedTenantId].includes(String(row.tenant_id))) return res.status(404).json({ error: "Comentário não encontrado." });
      const manager = await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId);
      if (row.user_id !== user.id && !manager) return res.status(403).json({ error: "Acesso negado" });
      const { error } = await supabaseAdmin.from("biblioteca_comentarios").delete().eq("id", row.id); if (error) throw error;
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: safeErrorMessage(error, "Erro ao excluir comentário.") }); }
  });

  app.get("/api/v1/filho/profile", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const ref = await loadFilhoRecordForUser(supabaseAdmin, user);
      if (!ref?.id) return res.status(404).json({ error: "Perfil de filho de santo não encontrado." });
      const { data, error } = await supabaseAdmin.from("filhos_de_santo").select("*").eq("id", ref.id).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Perfil não encontrado." });
      const { notas_sigilosas: _privateNotes, ...safeProfile } = data as Record<string, unknown>;
      res.json({ data: safeProfile });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar perfil.") });
    }
  });

  app.patch("/api/v1/filho/profile", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const ref = await loadFilhoRecordForUser(supabaseAdmin, user);
      if (!ref?.id) return res.status(404).json({ error: "Perfil de filho de santo não encontrado." });
      const body = req.body || {};
      const update: Record<string, unknown> = {};
      for (const key of ["telefone", "whatsapp", "endereco"] as const) {
        if (body[key] !== undefined) update[key] = String(body[key] || "").trim().slice(0, key === "endereco" ? 500 : 30) || null;
      }

      if (body.cpf !== undefined) {
        const next = digitsOnlyCpf(String(body.cpf || ""));
        if (!isValidCpf(next)) {
          return res.status(400).json({ error: "Informe um CPF completo válido (11 dígitos)." });
        }
        const { data: currentRow, error: currentErr } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("cpf")
          .eq("id", ref.id)
          .maybeSingle();
        if (currentErr) throw currentErr;
        const current = digitsOnlyCpf(String(currentRow?.cpf || ""));
        if (current.length === 11 && current !== next) {
          return res.status(400).json({
            error: "Seu CPF já está completo. Peça ao zelador se precisar corrigir.",
          });
        }
        if (current.length === 6 && !next.startsWith(current)) {
          return res.status(400).json({
            error: "Os 6 primeiros dígitos precisam ser os mesmos da sua senha de acesso.",
          });
        }
        if (current.length > 0 && current.length !== 6 && current.length !== 11 && !next.startsWith(current.slice(0, Math.min(6, current.length)))) {
          return res.status(400).json({
            error: "CPF não confere com o cadastro. Fale com o zelador da casa.",
          });
        }
        update.cpf = next;
      }

      if (!Object.keys(update).length) return res.status(400).json({ error: "Nada para atualizar." });
      const { data, error } = await supabaseAdmin.from("filhos_de_santo").update(update).eq("id", ref.id).select("*").single();
      if (error) throw error;
      const { notas_sigilosas: _privateNotes, ...safeProfile } = data as Record<string, unknown>;
      res.json({ data: safeProfile });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao atualizar perfil.") });
    }
  });

  app.get("/api/v1/filho/obligations", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    try {
      const child = await loadFilhoRecordForUser(supabaseAdmin, user);
      if (!child?.id || !child.tenant_id) {
        return res.status(404).json({ error: "Perfil de filho de santo não encontrado." });
      }

      const marker = `FILHO_ID:${child.id}`;
      const { data, error } = await supabaseAdmin
        .from("calendario_axe")
        .select("id,titulo,data,hora,descricao,status_confirmacao,pdf_storage_path")
        .eq("tenant_id", child.tenant_id)
        .eq("tipo", "Obrigação")
        .like("descricao", `%${marker}%`)
        .order("data", { ascending: false });
      if (error) throw error;

      const obligations = (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id || ""),
        title: String(row.titulo || "Obrigação"),
        date: String(row.data || ""),
        time: String(row.hora || ""),
        description: String(row.descricao || "").split("\n\n=== METADADOS ===")[0].trim(),
        status: String(row.status_confirmacao || ""),
        hasDocument: Boolean(row.pdf_storage_path),
        documentPath: String(row.pdf_storage_path || ""),
      }));
      res.json({ data: obligations });
    } catch (error) {
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao carregar obrigações.") });
    }
  });

  app.get("/api/v1/filho/home", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const tenantIdQ = normalizeQueryTenantId(req.query.tenantId);

    try {
      const child = await loadFilhoRecordForUser(supabaseAdmin, user);

      if (!child) {
        return res.json({ child: null, financialStatus: "pago", notices: [] });
      }

      const effectiveTenant = tenantIdQ || child.tenant_id;
      if (effectiveTenant) {
        const ok = await assertUserCanAccessTenant(supabaseAdmin, user, String(effectiveTenant));
        if (!ok) return res.status(403).json({ error: "Acesso negado" });
      }

      let financialStatus = "pago";
      const { data: finData } = await supabaseAdmin
        .from("financeiro")
        .select("id, status, data_vencimento, filho_id")
        .eq("filho_id", child.id)
        .order("data_vencimento", { ascending: false })
        .limit(1);

      if (finData?.length) {
        financialStatus = String(finData[0].status || "pago");
      }

      const noticeTenant = tenantIdQ || child.tenant_id;
      let notices: unknown[] = [];
      if (noticeTenant) {
        const { data: noticesData } = await supabaseAdmin
          .from("mural_avisos")
          .select("id, titulo, data_publicacao, tenant_id")
          .eq("tenant_id", noticeTenant)
          .order("data_publicacao", { ascending: false })
          .limit(2);
        notices = noticesData || [];
      }

      res.json({ child, financialStatus, notices });
    } catch (e: unknown) {
      console.error("[filho home GET]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao carregar início.") });
    }
  });

  app.post("/api/v1/filho/profile-photo", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const { fileData, contentType } = req.body || {};
    if (!fileData) {
      return res.status(400).json({ error: "Dados da imagem ausentes." });
    }

    const mime = String(contentType || "image/jpeg").toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.has(mime) || !SAFE_IMAGE_MIME_TYPES.has(mime)) {
      return res.status(400).json({ error: "Formato de imagem não suportado." });
    }

    try {
      const filho = await loadFilhoRecordForUser(supabaseAdmin, user);
      if (!filho?.id) {
        return res.status(403).json({ error: "Perfil de filho de santo não encontrado." });
      }

      const buffer = Buffer.from(String(fileData), "base64");
      assertSafeImageBuffer(buffer, mime);
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Imagem maior que 5 MB." });
      }

      const ext = extFromContentType(mime);
      const safeName = `${user.id}-filho-${Date.now()}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("perfil_fotos")
        .upload(safeName, buffer, {
          contentType: mime,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("perfil_fotos").getPublicUrl(safeName);

      const { error: dbError } = await supabaseAdmin
        .from("filhos_de_santo")
        .update({ foto_url: publicUrl })
        .eq("id", filho.id);

      if (dbError) throw dbError;

      res.json({ publicUrl });
    } catch (e: unknown) {
      console.error("[filho profile-photo POST]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao atualizar foto de perfil.") });
    }
  });
}
