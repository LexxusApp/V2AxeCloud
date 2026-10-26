import type { Express, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthOrRespond } from './requireAuth.js';
import { assertUserCanAccessTenant, assertZeladorTenantAccess, isValidUuid, normalizeFilhoRequestTenantId, normalizeQueryTenantId, resolveAuthenticatedFilho } from './tenantAccess.js';
import { safeErrorMessage } from './safeError.js';
import { buildPixPayload } from './pixPayload.js';

type Deps = { supabaseAdmin: SupabaseClient; resolveLeaderId: (id: string) => Promise<string> };

export function registerStoreCheckoutRoutes(app: Express, deps: Deps) {
  const sb = deps.supabaseAdmin;
  async function access(req: Request, res: Response) {
    const user = await requireAuthOrRespond(sb, req, res);
    if (!user) return null;
    const raw = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
    if (!isValidUuid(raw)) { res.status(400).json({ error: 'Terreiro inválido.' }); return null; }
    if (!await assertUserCanAccessTenant(sb, user, raw)) { res.status(403).json({ error: 'Acesso negado.' }); return null; }
    const tenant = await deps.resolveLeaderId(await normalizeFilhoRequestTenantId(sb, user, raw));
    let child = await resolveAuthenticatedFilho(sb, user.id);
    if (!child && user.email) {
      const {data,error}=await sb.from('filhos_de_santo').select('id,user_id,tenant_id,lider_id').eq('email',user.email.trim().toLowerCase()).maybeSingle();
      if(error) throw error;
      if(data) child=data;
    }
    const manager = !child && await assertZeladorTenantAccess(sb, user.id, tenant);
    if (!child && !manager) { res.status(403).json({ error: 'Perfil não autorizado.' }); return null; }
    return { user, tenant, child, manager };
  }
  function fail(res: Response, error: any) {
    const status = ['P0001','22P02','22023'].includes(String(error?.code || '')) ? 400 : 500;
    return res.status(status).json({ error: safeErrorMessage(error, 'Não foi possível concluir o pedido. Tente novamente com o mesmo carrinho.') });
  }
  async function pixFor(order: any) {
    if (order.metodo_pagamento !== 'pix' || order.status !== 'pendente') return null;
    const { data, error } = await sb.from('configuracoes_pix').select('chave_pix,tipo_chave,nome_beneficiario').eq('terreiro_id', order.tenant_id).maybeSingle();
    if (error) throw error;
    if (!data?.chave_pix) return null;
    const keyType=String(data.tipo_chave || '').toLowerCase();
    let key=String(data.chave_pix).trim();
    if(['cpf','cnpj'].includes(keyType)) key=key.replace(/\D/g,'');
    if(['telefone','celular','phone'].includes(keyType)) {
      const digits=key.replace(/\D/g,'');key='+'+([10,11].includes(digits.length)?'55'+digits:digits);
    }
    if(keyType==='email')key=key.toLowerCase();
    if(!key || key.length>77)throw new Error('Revise a chave Pix da casa.');
    const config={...data,chave_pix:key};
    const txid = String(order.id).replace(/-/g, '').slice(0, 25);
    return { ...config, cidade: 'BRASIL', txid, payload: buildPixPayload(config, Number(order.total), txid, ''), confirmacao: 'responsavel' };
  }
  app.get('/api/v1/store/me', async (req,res) => {
    try {
      const ctx=await access(req,res); if(!ctx)return;
      let name='';
      if(ctx.child){const {data,error}=await sb.from('filhos_de_santo').select('nome').eq('id',ctx.child.id).maybeSingle();if(error)throw error;name=data?.nome || '';}
      res.setHeader('Cache-Control','private, no-store');res.json({memberId:ctx.child?.id || null,memberName:name,manager:ctx.manager});
    }catch(error){return fail(res,error);}
  });
  app.post('/api/v1/store/checkout', async (req, res) => {
    try {
      const ctx = await access(req, res); if (!ctx) return;
      const { items, method, checkoutId, filhoId } = req.body || {};
      if (!isValidUuid(checkoutId) || !['mensalidade','pix','reserva','dinheiro'].includes(method)
        || !Array.isArray(items) || !items.length || items.length > 100
        || items.some((item: any) => !item || !isValidUuid(item.produto_id || item.id) || !Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 10000)) {
        return res.status(400).json({ error: 'Carrinho inválido. Recarregue a página e confira os produtos e quantidades.' });
      }
      if (!ctx.manager && method === 'dinheiro') return res.status(403).json({ error: 'Somente o responsável pode registrar recebimento em dinheiro.' });
      if (ctx.child && filhoId && filhoId !== ctx.child.id) return res.status(403).json({ error: 'Não é possível comprar em nome de outro membro.' });
      const member = ctx.child?.id || (ctx.manager && filhoId ? String(filhoId) : null);
      if (member && !isValidUuid(member)) return res.status(400).json({ error: 'Membro inválido.' });
      if (method === 'mensalidade' && !member) return res.status(400).json({ error: 'Selecione um membro para comprar na caderneta.' });
      const { data: order, error } = await sb.rpc('checkout_loja_seguro', {
        p_tenant_id: ctx.tenant, p_filho_id: member, p_metodo_pagamento: method,
        p_itens: items.map((i: any) => ({ produto_id: i.produto_id || i.id, quantidade: i.quantidade })),
        p_checkout_id: checkoutId,
      });
      if (error) throw error;
      if (!order?.id) throw new Error('O banco não confirmou o pedido.');
      const pix = await pixFor(order).catch(() => null);
      res.json({ success: true, data: order.id, order, pix });
    } catch (error) { return fail(res, error); }
  });
  app.get('/api/v1/store/orders', async (req, res) => {
    try {
      const ctx = await access(req, res); if (!ctx) return;
      let query = sb.from('loja_pedidos').select('id,pedido_id,created_at,filho_nome,tipo,metodo_pagamento,resumo_itens,valor_total,pedido:pedidos!pedido_id(id,status,metodo_pagamento,total,checkout_id,financeiro_id)').eq('tenant_id', ctx.tenant);
      if (ctx.child) query = query.eq('filho_id', ctx.child.id);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      res.setHeader('Cache-Control','private, no-store');
      res.json({ orders: data || [] });
    } catch (error) { return fail(res, error); }
  });
  app.get('/api/v1/store/orders/:id/pix', async (req, res) => {
    try {
      const ctx = await access(req, res); if (!ctx) return;
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error: 'Pedido inválido.' });
      let query = sb.from('pedidos').select('*').eq('id', req.params.id).eq('tenant_id', ctx.tenant);
      if (ctx.child) query = query.eq('filho_id', ctx.child.id);
      const { data: order, error } = await query.maybeSingle();
      if (error) throw error;
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
      const pix = await pixFor(order);
      if (!pix) return res.status(409).json({ error: 'Este pedido não aguarda Pix ou a chave não está configurada.' });
      res.setHeader('Cache-Control','private, no-store');
      res.json({ order, pix });
    } catch (error) { return fail(res, error); }
  });
  app.post('/api/v1/store/orders/:id/action', async (req, res) => {
    try {
      const ctx = await access(req, res); if (!ctx) return;
      if (!ctx.manager) return res.status(403).json({ error: 'Somente o responsável pode confirmar, cancelar ou estornar pedidos.' });
      const action = req.body?.action;
      if (!isValidUuid(req.params.id) || !['confirmar','cancelar','estornar','converter_pix','converter_mensalidade','converter_dinheiro'].includes(action)) return res.status(400).json({ error: 'Ação inválida.' });
      const { data: order, error } = await sb.rpc('acao_pedido_loja', { p_tenant_id: ctx.tenant, p_actor_id: ctx.user.id, p_pedido_id: req.params.id, p_acao: action });
      if (error) throw error;
      res.json({ success: true, order });
    } catch (error) { return fail(res, error); }
  });
}
