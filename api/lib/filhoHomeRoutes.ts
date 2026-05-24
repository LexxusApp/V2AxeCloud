import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertUserCanAccessTenant, normalizeQueryTenantId } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

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
      let { data: child } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("id, nome, foto_url, tenant_id, user_id, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!child && user.email) {
        const email = String(user.email).trim().toLowerCase();
        const { data: emailChild } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("id, nome, foto_url, tenant_id, user_id, email")
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
}
