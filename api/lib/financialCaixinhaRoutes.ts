import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertZeladorTenantAccess, normalizeQueryTenantId, resolveLeaderId } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (id: string) => Promise<string>;
};

export function registerFinancialCaixinhaRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin, resolveLeaderId: resolveLeader } = deps;

  app.get("/api/v1/financial/caixinha", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const tenantId = normalizeQueryTenantId(req.query.tenantId);
    if (!tenantId) return res.status(400).json({ error: "tenantId obrigatório" });
    const ok = await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const leaderId = await resolveLeader(tenantId);
      const tenantFilter = leaderId || tenantId;
      const { data: metas, error: mErr } = await supabaseAdmin
        .from("caixinha_metas")
        .select("*")
        .eq("tenant_id", tenantFilter)
        .order("created_at", { ascending: false });
      if (mErr) throw mErr;

      const metaIds = (metas || []).map((m: { id: string }) => m.id);
      let donations: unknown[] = [];
      if (metaIds.length) {
        const { data: dRows, error: dErr } = await supabaseAdmin
          .from("caixinha_doacoes")
          .select("*, filhos_de_santo(nome)")
          .in("meta_id", metaIds)
          .eq("status", "pendente")
          .order("created_at", { ascending: false });
        if (dErr) throw dErr;
        donations = dRows || [];
      }

      res.json({ metas: metas || [], pendingDonations: donations });
    } catch (e: unknown) {
      console.error("[caixinha GET]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao carregar caixinha.") });
    }
  });

  app.post("/api/v1/financial/caixinha/meta", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const { tenantId, titulo, valor_alvo, qr_code_url } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!tid || !titulo) return res.status(400).json({ error: "tenantId e titulo são obrigatórios" });
    const ok = await assertZeladorTenantAccess(supabaseAdmin, user.id, tid);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const leaderId = await resolveLeader(tid);
      const { data, error } = await supabaseAdmin
        .from("caixinha_metas")
        .insert([
          {
            tenant_id: leaderId || tid,
            titulo: String(titulo).trim(),
            valor_alvo: Number(valor_alvo) || 0,
            qr_code_url: qr_code_url || null,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      res.json({ data });
    } catch (e: unknown) {
      console.error("[caixinha meta POST]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao criar meta.") });
    }
  });

  app.post("/api/v1/financial/caixinha/validate-donation", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const { tenantId, donationId, status, valor, metaId, metaTitulo } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!tid || !donationId || !status) {
      return res.status(400).json({ error: "tenantId, donationId e status são obrigatórios" });
    }
    if (status !== "confirmado" && status !== "rejeitado") {
      return res.status(400).json({ error: "status inválido" });
    }
    const ok = await assertZeladorTenantAccess(supabaseAdmin, user.id, tid);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    try {
      const leaderId = await resolveLeader(tid);
      const { data: meta, error: metaErr } = await supabaseAdmin
        .from("caixinha_metas")
        .select("id, tenant_id, valor_atual, titulo")
        .eq("id", metaId)
        .maybeSingle();
      if (metaErr) throw metaErr;
      if (!meta || String(meta.tenant_id) !== String(leaderId || tid)) {
        return res.status(404).json({ error: "Meta não encontrada" });
      }

      const { error: updErr } = await supabaseAdmin
        .from("caixinha_doacoes")
        .update({ status })
        .eq("id", donationId)
        .eq("meta_id", metaId);
      if (updErr) throw updErr;

      if (status === "confirmado") {
        const v = Number(valor) || 0;
        await supabaseAdmin
          .from("caixinha_metas")
          .update({ valor_atual: (Number(meta.valor_atual) || 0) + v })
          .eq("id", metaId);

        await supabaseAdmin.from("financeiro").insert([
          {
            tipo: "entrada",
            valor: v,
            categoria: "Doação Caixinha",
            data: new Date().toISOString().split("T")[0],
            descricao: `Doação Caixinha - Meta: ${metaTitulo || meta.titulo || ""}`,
            tenant_id: tid,
            lider_id: user.id,
          },
        ]);
      }

      res.json({ success: true });
    } catch (e: unknown) {
      console.error("[caixinha validate POST]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao processar doação.") });
    }
  });
}
