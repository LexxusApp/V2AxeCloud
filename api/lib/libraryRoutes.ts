import type { Express } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { canReadLibraryMaterial, libraryMaterialResponse } from '../../lib/libraryAudience.js';
import { canReadLibraryPath, libraryHouseRefs, resolveLibraryReader, validateLibraryRecipients } from './libraryAudienceAccess.js';
import { requireApiUser } from './routeAuthHelpers.js';
import { requireAuthOrRespond } from './requireAuth.js';
import { requireTenantReadAccess } from './secureRoutes.js';
import { assertUserCanAccessTenant, assertZeladorOrGlobalAdmin, normalizeQueryTenantId, normalizeFilhoRequestTenantId, resolveLeaderId as resolveLeaderIdForClient } from './tenantAccess.js';
import { safeErrorMessage } from './safeError.js';

type Dependencies = { supabaseAdmin: SupabaseClient; slugifyStoragePath: (value: string) => string };
/** Actual application handlers, isolated so HTTP authorization can be tested without starting jobs. */
export function registerLibraryRoutes(app: Express, { supabaseAdmin, slugifyStoragePath }: Dependencies) {
  const resolveLeaderId = (id: string) => resolveLeaderIdForClient(supabaseAdmin, id);
  app.get("/api/v1/library/materials", async (req, res) => {
    const access = await requireTenantReadAccess(supabaseAdmin, req, res, req.query.tenantId);
    if (!access) return;

    try {
      const refs = await libraryHouseRefs(supabaseAdmin, access.tenantId);
      const { data, error } = await supabaseAdmin
        .from('biblioteca')
        .select('*')
        .in('tenant_id', refs)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reader = await resolveLibraryReader(supabaseAdmin, access.user, access.tenantId);
      const enriched = (data || []).filter(row => canReadLibraryMaterial(row, reader)).map(row => libraryMaterialResponse(row, reader));

      res.json({ data: enriched, capabilities: { individualAudience: true, authenticatedDownloads: true } });
    } catch (err: any) {
      console.error("[SERVER] Erro ao buscar materiais:", err.message || err);
      res.status(500).json({ error: safeErrorMessage(err, "Erro ao buscar materiais") });
    }
  });

  app.post("/api/v1/library/upload-url", async (req, res) => {
    const { fileName, contentType, categoria, tenantId } = req.body;
    if (!fileName || !tenantId) {
      return res.status(400).json({ error: "Unauthorized or missing data" });
    }
    const mime = String(contentType || "application/pdf").toLowerCase();
    if (mime !== "application/pdf") {
      return res.status(400).json({ error: "Apenas PDF (application/pdf) é permitido" });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const ok = await assertZeladorOrGlobalAdmin(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const reader = await resolveLibraryReader(supabaseAdmin, user, String(tenantId));
      if (!reader.manager) return res.status(403).json({ error: 'Apenas a gestão pode publicar materiais.' });

      const safeCategoria = slugifyStoragePath(categoria || 'geral');
      const safeFileName = slugifyStoragePath(fileName);
      const storagePath = `${tenantId}/acervo/${safeCategoria}/${randomUUID()}_${safeFileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from('biblioteca_estudos')
        .createSignedUploadUrl(storagePath);

      if (error) throw error;
      res.json({
        path: storagePath,
        token: data.token,
        contentType: contentType || 'application/pdf',
        audienceVersion: 1,
      });
    } catch (error: any) {
      console.error("[SERVER] Erro ao criar URL de upload:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao preparar upload") });
    }
  });

  app.post("/api/v1/library/complete-upload", async (req, res) => {
    const { storagePath, titulo, categoria, tenantId } = req.body;
    if (!storagePath || !titulo || !tenantId) {
      return res.status(400).json({ error: "Unauthorized or missing data" });
    }

    try {
      const user = await requireApiUser(supabaseAdmin, req, res);
      if (!user) return;

      const ok = await assertZeladorOrGlobalAdmin(supabaseAdmin, user, String(tenantId));
      if (!ok) return res.status(403).json({ error: "Acesso negado" });

      const normalizedPath = String(storagePath || "").replace(/\\/g, "/");
      if (!normalizedPath.startsWith(`${tenantId}/`) || normalizedPath.split('/').some(segment => segment === '..' || segment === '.') || normalizedPath.includes('\0')) {
        return res.status(400).json({ error: "storagePath inválido para este tenant" });
      }

      const reader = await resolveLibraryReader(supabaseAdmin, user, String(tenantId));
      if (!reader.manager) return res.status(403).json({ error: 'Apenas a gestão pode publicar materiais.' });
      let audience;
      try { audience = await validateLibraryRecipients(supabaseAdmin, String(tenantId), req.body); }
      catch (error: any) { return res.status(400).json({ error: error.message || 'Revise os destinatários.' }); }

      const { data: uploadedPdf, error: pdfError } = await supabaseAdmin.storage.from('biblioteca_estudos').download(normalizedPath);
      if (pdfError || !uploadedPdf || uploadedPdf.size > 50 * 1024 * 1024 || await uploadedPdf.slice(0, 5).text() !== '%PDF-') {
        return res.status(400).json({ error: 'O arquivo não é um PDF válido de até 50 MB. Envie o PDF novamente.' });
      }

      const { data: savedMaterial, error: dbError } = await supabaseAdmin.rpc('finalizar_material_biblioteca', {
        p_tenant: tenantId, p_path: normalizedPath, p_title: String(titulo).trim(),
        p_category: String(categoria || 'Geral').trim(),
        p_visibility: audience.visibilidade, p_recipients: audience.destinatarios,
      });

      if (dbError?.code === '23505') return res.status(409).json({ error: dbError.message });
      if (dbError) throw dbError;
      const saved = Array.isArray(savedMaterial) ? savedMaterial[0] : savedMaterial;
      if (!saved?.id) throw Error('O banco não confirmou a publicação. Tente novamente.');
      res.json({ success: true, id: saved.id, visibilidade: saved.visibilidade });
    } catch (error: any) {
      console.error("[SERVER] Erro ao finalizar upload:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro interno ao salvar material") });
    }
  });

  app.delete("/api/v1/library/material/:id", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const materialId = String(req.params.id || "").trim();
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!materialId || !tenantId) {
      return res.status(400).json({ error: "id e tenantId são obrigatórios" });
    }

    try {
      const reader = await resolveLibraryReader(supabaseAdmin, user, tenantId);
      if (!reader.manager) return res.status(403).json({ error: "Acesso negado" });
      const resolvedId = await resolveLeaderId(tenantId);
      const { data: row, error: fetchErr } = await supabaseAdmin
        .from("biblioteca")
        .select("id, tenant_id, storage_path")
        .eq("id", materialId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) return res.status(404).json({ error: "Material não encontrado" });

      const rowTenant = String(row.tenant_id || "");
      if (await resolveLeaderId(rowTenant) !== resolvedId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const storagePath = String(row.storage_path || "").replace(/\\/g, "/");
      if (storagePath) {
        const { error: removeError } = await supabaseAdmin.storage.from("biblioteca_estudos").remove([storagePath]);
        if (removeError) throw removeError;
      }

      const { error: delErr } = await supabaseAdmin.from("biblioteca").delete().eq("id", materialId);
      if (delErr) throw delErr;

      res.json({ success: true });
    } catch (error: any) {
      console.error("[SERVER] Erro ao excluir material:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Erro ao excluir material") });
    }
  });

  // API Route: PDF Proxy — path+tenantId autenticado (sem modo ?url=)
  app.get("/api/v1/library/pdf-proxy", async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const pathRaw = typeof req.query.path === "string" ? req.query.path : "";
    const tenantIdRaw = normalizeQueryTenantId(req.query.tenantId);

    if (!pathRaw || !tenantIdRaw) {
      return res.status(400).json({ error: "path e tenantId são obrigatórios" });
    }

    const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tenantIdRaw);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
    const normalizedPath = pathRaw.replace(/\\/g, "/");
    const effectiveTenant = await normalizeFilhoRequestTenantId(supabaseAdmin, user, tenantIdRaw);
    const pathTenant = normalizedPath.split('/')[0];
    const allowedPrefixes = new Set([tenantIdRaw, effectiveTenant, await resolveLeaderId(effectiveTenant)]);
    if (!allowedPrefixes.has(pathTenant) || normalizedPath.split('/').some(segment => segment === '..' || segment === '.') || normalizedPath.includes('\0')) {
      return res.status(403).json({ error: "Caminho inválido" });
    }
    const isObrigacaoPdf = normalizedPath.startsWith(`${pathTenant}/obrigacoes/`);
    if (isObrigacaoPdf) {
      const { assertObrigacaoPdfStorageAccess } = await import("./tenantAccess.js");
      const obrigacaoOk = await assertObrigacaoPdfStorageAccess(
        supabaseAdmin,
        user,
        pathTenant,
        normalizedPath
      );
      if (!obrigacaoOk) return res.status(403).json({ error: "Acesso negado" });
    } else if (!(await canReadLibraryPath(supabaseAdmin, user, pathTenant, normalizedPath))) {
      return res.status(403).json({ error: 'Você não tem acesso a este material.' });
    }

      const { data, error } = await supabaseAdmin.storage
        .from("biblioteca_estudos")
        .download(normalizedPath);
      if (error || !data) {
        return res.status(404).send("PDF não encontrado");
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      res.set({
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      });
      return res.send(buffer);
    } catch (err: any) {
      console.error("[PDF-PROXY] storage:", err?.message || err);
      return res.status(500).send("Erro interno");
    }
  });

}
