import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import {
  assertUserCanAccessTenant,
  assertZeladorTenantAccess,
  normalizeQueryTenantId,
  resolveLeaderId,
} from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (id: string) => Promise<string>;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registerStoreCheckoutRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin, resolveLeaderId: resolveLeader } = deps;

  app.post("/api/v1/store/checkout", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const { tenantId, filhoId, method, items } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!tid || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "tenantId e itens são obrigatórios" });
    }

    const ok = await assertUserCanAccessTenant(supabaseAdmin, user, tid);
    if (!ok) return res.status(403).json({ error: "Acesso negado" });

    const role = String(user.user_metadata?.role || "").toLowerCase();
    const isFilho = role === "filho";

    let effectiveFilhoId: string | null = isFilho ? String(filhoId || "").trim() : null;
    if (isFilho) {
      const { data: filhoRow } = await supabaseAdmin
        .from("filhos_de_santo")
        .select("id, nome, lider_id, tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!filhoRow?.id) return res.status(403).json({ error: "Filho não vinculado" });
      if (effectiveFilhoId && effectiveFilhoId !== filhoRow.id) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      effectiveFilhoId = filhoRow.id;
    } else {
      const zeladorOk = await assertZeladorTenantAccess(supabaseAdmin, user.id, tid);
      if (!zeladorOk) return res.status(403).json({ error: "Acesso negado" });
    }

    const tenantPk = await resolveLeader(tid);
    const payMethod = method === "reserva" ? "mensalidade" : String(method || "mensalidade");
    const cartItems = items.map((item: { produto_id?: string; id?: string; quantidade?: number }) => ({
      produto_id: String(item.produto_id || item.id || ""),
      quantidade: Number(item.quantidade) || 1,
    }));

    try {
      const { data, error } = await supabaseAdmin.rpc("processar_checkout", {
        p_tenant_id: tenantPk,
        p_filho_id: isFilho ? effectiveFilhoId : null,
        p_metodo_pagamento: payMethod,
        p_itens: cartItems,
      });
      if (error) throw error;

      if (isFilho && effectiveFilhoId) {
        const tipoPedido = method === "reserva" ? "reserva" : "compra";
        const metodoGravar = method === "reserva" ? "reserva" : String(method || "mensalidade");
        const resumo = items
          .map((i: { quantidade?: number; nome?: string }) => `${i.quantidade || 1}× ${i.nome || "item"}`)
          .join(", ");
        const valorTotal = items.reduce(
          (acc: number, i: { quantidade?: number; preco?: number }) =>
            acc + (Number(i.quantidade) || 1) * (Number(i.preco) || 0),
          0
        );
        const { data: filhoNomeRow } = await supabaseAdmin
          .from("filhos_de_santo")
          .select("nome")
          .eq("id", effectiveFilhoId)
          .maybeSingle();

        await supabaseAdmin.from("loja_pedidos").insert({
          tenant_id: tenantPk,
          filho_id: effectiveFilhoId,
          filho_nome: filhoNomeRow?.nome || "Filho de santo",
          tipo: tipoPedido,
          metodo_pagamento: metodoGravar,
          resumo_itens: resumo,
          valor_total: valorTotal,
        });

        if (metodoGravar === "mensalidade" && valorTotal > 0) {
          let dueDate = todayYmd();
          const { data: mensalidadeBase, error: mensalidadeLookupErr } = await supabaseAdmin
            .from("financeiro")
            .select("data")
            .eq("tenant_id", tenantPk)
            .eq("filho_id", effectiveFilhoId)
            .eq("categoria", "Mensalidade")
            .eq("status", "pendente")
            .order("data", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!mensalidadeLookupErr && mensalidadeBase?.data) {
            dueDate = String(mensalidadeBase.data).slice(0, 10);
          }

          const financeRow: Record<string, unknown> = {
            tipo: "entrada",
            valor: Number(valorTotal.toFixed(2)),
            categoria: "Loja",
            data: dueDate,
            descricao: `Loja - ${filhoNomeRow?.nome || "Filho de santo"} - ${resumo} (ID:${effectiveFilhoId})`,
            tenant_id: tenantPk,
            lider_id: tenantPk,
            filho_id: effectiveFilhoId,
            status: "pendente",
          };

          let { error: financeiroError } = await supabaseAdmin.from("financeiro").insert([financeRow]);
          if (financeiroError && String(financeiroError.message || "").toLowerCase().includes("status")) {
            delete financeRow.status;
            const retry = await supabaseAdmin.from("financeiro").insert([financeRow]);
            financeiroError = retry.error;
          }
          if (financeiroError && String(financeiroError.message || "").includes("filho_id")) {
            delete financeRow.filho_id;
            const retry = await supabaseAdmin.from("financeiro").insert([financeRow]);
            financeiroError = retry.error;
          }
          if (financeiroError) {
            console.error("[store checkout] financeiro insert:", financeiroError);
          }
        }
      }

      res.json({ success: true, data });
    } catch (e: unknown) {
      console.error("[store checkout]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao processar checkout.") });
    }
  });
}
