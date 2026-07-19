import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertUserCanAccessTenant, normalizeQueryTenantId } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";
import { assertSafeImageBuffer, SAFE_IMAGE_MIME_TYPES } from "./imageUpload.js";

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
  const selectCols = "id, nome, foto_url, tenant_id, user_id, email, lider_id";

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
