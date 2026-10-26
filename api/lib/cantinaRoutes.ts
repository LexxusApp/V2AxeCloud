import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthOrRespond } from "./requireAuth.js";
import { assertZeladorTenantAccess, normalizeQueryTenantId, isValidUuid } from "./tenantAccess.js";
import { safeErrorMessage } from "./safeError.js";
import { randomUUID } from "node:crypto";
import { registerCantinaMenuRoutes } from './cantinaMenuRoutes.js';

type Deps = {
  supabaseAdmin: SupabaseClient;
  resolveLeaderId: (id: string) => Promise<string>;
};

function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function isCantinaTenantAllowed(_tenantId: string, _email?: string | null): boolean {
  // Cantina liberada globalmente para todos os terreiros
  return true;
}

export function registerCantinaRoutes(app: Express, deps: Deps) {
  const { supabaseAdmin, resolveLeaderId: resolveLeader } = deps;
  registerCantinaMenuRoutes(app, deps);

  // GET /api/v1/cantina/data
  app.get("/api/v1/cantina/data", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const tenantIdRaw = normalizeQueryTenantId(req.query.tenantId);
    if (!isValidUuid(tenantIdRaw)) {
      return res.status(400).json({ error: "tenantId é obrigatório" });
    }

    const tenantPk = await resolveLeader(tenantIdRaw);
    if (!isCantinaTenantAllowed(tenantPk, (user as { email?: string }).email)) {
      return res.status(403).json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." });
    }

    const zeladorOk = await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantPk);
    if (!zeladorOk) return res.status(403).json({ error: "Acesso negado" });

    try {
      // 1. Carrega filhos de santo
      const filhos:any[]=[];
      for(let from=0;;from+=1000){
        const {data,error}=await supabaseAdmin.from('filhos_de_santo').select('id,nome,foto_url,cargo,whatsapp_phone,limite_lojinha,bloquear_fiado_loja,status')
          .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`).order('id').range(from,from+999);
        if(error)throw error;filhos.push(...(data || []));if((data || []).length<1000)break;
      }
      filhos.sort((a,b)=>String(a.nome || '').localeCompare(String(b.nome || ''),'pt-BR'));

      // 2. Carrega lançamentos da cantina/loja
      const transacoes: any[] = [];
      for (let from=0;;from+=1000) {
        const {data,error}=await supabaseAdmin.from('financeiro')
          .select('id,data,data_venda,data_pagamento,descricao,valor,status,categoria,tipo,filho_id,created_at,cantina_itens')
          .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`).in('categoria',['Cantina','Loja'])
          .order('id',{ascending:true}).range(from,from+999);
        if(error) throw error;
        transacoes.push(...(data || []));
        if((data || []).length<1000) break;
      }
      transacoes.sort((a,b)=>String(b.created_at || b.data).localeCompare(String(a.created_at || a.data)));

      // 3. Carrega produtos da cantina / loja para catálogo
      const { data: produtos } = await supabaseAdmin
        .from("produtos")
        .select("id, nome, preco, categoria, estoque_atual")
        .eq("tenant_id", tenantPk)
        .order("nome", { ascending: true });

      const currentMonthPrefix = todayYmd().slice(0, 7); // YYYY-MM
      const validTx = (transacoes || []).filter(
        (r: any) => ['pendente','pago'].includes(String(r.status || '').toLowerCase())
      );

      // Agregação por filho
      const historyTx = transacoes.filter((r: any) => String(r.status || '').toLowerCase() !== 'excluido');
      const txByFilho = new Map<string, any[]>();
      for (const tx of historyTx) {
        if (!tx.filho_id) continue;
        const fid = String(tx.filho_id);
        const list = txByFilho.get(fid) || [];
        list.push(tx);
        txByFilho.set(fid, list);
      }

      let totalPendenteGeral = 0;
      let totalRecebidoMesGeral = 0;
      let totalVendasMesGeral = 0;
      let filhosComPendenciaCount = 0;

      const filhosCards = (filhos || []).map((f: any) => {
        const fTx = txByFilho.get(f.id) || [];
        const pendentes = fTx.filter((t: any) => String(t.status || "").toLowerCase() === "pendente");
        const pagosMes = fTx.filter(
          (t: any) =>
            String(t.status || "").toLowerCase() === "pago" &&
            String(t.data_pagamento || t.data || "").startsWith(currentMonthPrefix)
        );

        const saldoPendente = pendentes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
        const totalPagoMes = pagosMes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
        const limite = Number(f.limite_lojinha !== undefined && f.limite_lojinha !== null ? f.limite_lojinha : 100);
        const disponivel = Math.max(0, limite - saldoPendente);
        const bloqueado = Boolean(f.bloquear_fiado_loja || (saldoPendente >= limite && limite > 0));

        totalPendenteGeral += saldoPendente;
        totalRecebidoMesGeral += totalPagoMes;
        if (saldoPendente > 0) filhosComPendenciaCount++;

        return {
          id: f.id,
          nome: f.nome || "Sem nome",
          foto_url: f.foto_url || null,
          cargo: f.cargo || "Filho de Santo",
          whatsapp_phone: f.whatsapp_phone || null,
          limite_lojinha: limite,
          bloquear_fiado_loja: Boolean(f.bloquear_fiado_loja),
          saldo_pendente: Number(saldoPendente.toFixed(2)),
          saldo_disponivel: Number(disponivel.toFixed(2)),
          total_pago_mes: Number(totalPagoMes.toFixed(2)),
          bloqueado,
          historico: fTx.slice(0, 50),
          historico_total: fTx.length,
          pedidos_pendentes: pendentes.slice(0, 10).map((t: any) => ({
            id: t.id,
            data: t.data,
            descricao: t.descricao,
            valor: Number(t.valor) || 0,
            status: t.status,
            cantina_itens: t.cantina_itens,
          })),
        };
      });

      // Vendas do mês: soma de transações da cantina deste mês (pendentes ou pagas)
      const txMes = validTx.filter((t: any) => t.categoria === 'Cantina' && String(t.data_venda || t.created_at || t.data || "").startsWith(currentMonthPrefix));
      totalVendasMesGeral = txMes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
      totalRecebidoMesGeral = validTx.filter((t: any) => t.categoria === 'Cantina' && t.status === 'pago' && String(t.data_pagamento || t.data || '').startsWith(currentMonthPrefix))
        .reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);

      res.json({
        filhos: filhosCards,
        stats: {
          total_pendente: Number(totalPendenteGeral.toFixed(2)),
          total_recebido_mes: Number(totalRecebidoMesGeral.toFixed(2)),
          total_vendas_mes: Number(totalVendasMesGeral.toFixed(2)),
          filhos_com_pendencia: filhosComPendenciaCount,
          total_filhos: (filhos || []).length,
        },
        transactions: historyTx.slice(0, 30),
        produtos: produtos || [],
      });
    } catch (e: unknown) {
      console.error("[cantina GET]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao carregar dados da cantina.") });
    }
  });

  // Comanda e itens são gravados atomicamente no mesmo lançamento financeiro.
  app.post("/api/v1/cantina/consumo", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const { tenantId, filhoId, formaPagamento, itens, comandaId } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!isValidUuid(tid)) return res.status(400).json({ error: "tenantId inválido" });
    if (!["pago", "fiado"].includes(formaPagamento)) {
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }
    if (formaPagamento === "fiado" && !filhoId) {
      return res.status(400).json({ error: "Selecione um membro para anotar na caderneta" });
    }
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 100 || itens.some((item: any) =>
      !item || typeof item.nome !== "string" || !item.nome.trim() ||
      !Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > 10000 ||
      typeof item.preco !== "number" || !Number.isFinite(item.preco) || item.preco <= 0 || item.preco > 1000000 ||
      Math.abs(item.preco * 100 - Math.round(item.preco * 100)) > 0.000001
    )) {
      return res.status(400).json({ error: "Informe nome, quantidade e preço válidos para cada item" });
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((filhoId && !uuid.test(filhoId)) || (comandaId && !uuid.test(comandaId))) {
      return res.status(400).json({ error: "Identificação da comanda ou do membro inválida" });
    }
    try {
      const tenantPk = await resolveLeader(tid);
      if (!await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantPk)) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const { data, error } = await supabaseAdmin.rpc("registrar_consumo_cantina", {
        p_tenant_id: tenantPk,
        p_lider_id: user.id,
        p_filho_id: filhoId || null,
        p_itens: itens.map((item: any) => ({
          nome: item.nome.trim().slice(0, 160), quantidade: item.quantidade, preco: item.preco,
        })),
        p_forma_pagamento: formaPagamento,
        p_comanda_id: comandaId || randomUUID(),
      });
      if (error) {
        if (error.code === "P0001") return res.status(400).json({ error: error.message });
        throw error;
      }
      if (!data?.id) throw new Error("O banco não confirmou o registro da comanda");
      res.json({ success: true, transaction: data, status: data.status });
    } catch (e: unknown) {
      console.error("[cantina POST consumo]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao registrar consumo na cantina.") });
    }
  });
  for (const [path, action] of [['liquidar','liquidar'],['estornar','estornar'],['cancelar','cancelar']] as const) {
    app.post('/api/v1/cantina/' + path, async (req: Request,res: Response) => {
      const user=await requireAuthOrRespond(supabaseAdmin,req,res); if(!user) return;
      const {tenantId,filhoId,transactionId}=req.body || {};
      const tid=normalizeQueryTenantId(tenantId);
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(!uuid.test(tid) || (!filhoId && !transactionId) || (transactionId && !uuid.test(transactionId)) || (filhoId && !uuid.test(filhoId)) || (action !== 'liquidar' && !transactionId)) {
        return res.status(400).json({error:'Informe uma comanda ou um membro válido.'});
      }
      try {
        const tenant=await resolveLeader(tid);
        if(!await assertZeladorTenantAccess(supabaseAdmin,user.id,tenant)) return res.status(403).json({error:'Acesso negado.'});
        const {data,error}=await supabaseAdmin.rpc('pagamento_caderneta',{
          p_tenant_id:tenant,p_actor_id:user.id,p_filho_id:filhoId || null,p_transacao_id:transactionId || null,p_acao:action,
        });
        if(error) throw error;
        res.json({success:true,count:Number(data) || 0});
      } catch(e: any) {
        res.status(e?.code === 'P0001' ? 400 : 500).json({error:safeErrorMessage(e,'Não foi possível atualizar o pagamento.')});
      }
    });
  }

  // PATCH /api/v1/cantina/limite
  app.patch("/api/v1/cantina/limite", async (req: Request, res: Response) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;

    const { tenantId, filhoId, limite_lojinha, bloquear_fiado_loja } = req.body || {};
    const tid = normalizeQueryTenantId(tenantId);
    if (!isValidUuid(tid) || !isValidUuid(filhoId)) return res.status(400).json({ error: "tenantId e filhoId válidos são obrigatórios" });
    if ((limite_lojinha !== undefined && (typeof limite_lojinha !== 'number' || !Number.isFinite(limite_lojinha) || limite_lojinha < 0 || limite_lojinha > 1000000000)) ||
        (bloquear_fiado_loja !== undefined && typeof bloquear_fiado_loja !== 'boolean')) {
      return res.status(400).json({ error: 'Informe um limite válido e uma opção de bloqueio válida.' });
    }

    const tenantPk = await resolveLeader(tid);
    if (!isCantinaTenantAllowed(tenantPk, (user as { email?: string }).email)) {
      return res.status(403).json({ error: "Módulo Cantina disponível apenas no ambiente de testes autorizado." });
    }

    const zeladorOk = await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantPk);
    if (!zeladorOk) return res.status(403).json({ error: "Acesso negado" });

    try {
      const updateData: Record<string, unknown> = {};
      if (limite_lojinha !== undefined) {
        updateData.limite_lojinha = Math.max(0, Number(limite_lojinha) || 0);
      }
      if (bloquear_fiado_loja !== undefined) {
        updateData.bloquear_fiado_loja = Boolean(bloquear_fiado_loja);
      }

      const { data, error } = await supabaseAdmin
        .from("filhos_de_santo")
        .update(updateData)
        .eq("id", filhoId)
        .or(`tenant_id.eq.${tenantPk},lider_id.eq.${tenantPk}`)
        .select("id, nome, limite_lojinha, bloquear_fiado_loja")
        .single();
      if (error) throw error;

      res.json({ success: true, filho: data });
    } catch (e: unknown) {
      console.error("[cantina PATCH limite]", e);
      res.status(500).json({ error: safeErrorMessage(e, "Erro ao atualizar limite do médium.") });
    }
  });
}
