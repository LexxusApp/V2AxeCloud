import type { Express, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthOrRespond } from './requireAuth.js';
import { assertZeladorTenantAccess, isValidUuid, normalizeQueryTenantId } from './tenantAccess.js';

export function registerCantinaMenuRoutes(app: Express, deps: { supabaseAdmin: SupabaseClient; resolveLeaderId: (id: string) => Promise<string> }) {
  const sb = deps.supabaseAdmin;
  async function scope(req: Request, res: Response) {
    const user = await requireAuthOrRespond(sb, req, res); if (!user) return null;
    const raw = normalizeQueryTenantId(req.body?.tenantId || req.query.tenantId);
    if (!isValidUuid(raw)) { res.status(400).json({ error: 'Terreiro inválido.' }); return null; }
    const tenant = await deps.resolveLeaderId(raw);
    if (!await assertZeladorTenantAccess(sb, user.id, tenant)) { res.status(403).json({ error: 'Acesso negado.' }); return null; }
    return tenant;
  }
  function values(body: any) {
    const name = String(body?.nome || '').trim();
    const price = body?.preco;
    if (!name || name.length > 160 || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) return null;
    return { nome: name, preco: price, icon: String(body.icon || '☕').slice(0,16), cat: ['bebidas','comidas','liturgia'].includes(body.cat) ? body.cat : 'comidas', badge: body.badge ? String(body.badge).slice(0,60) : null };
  }
  app.get('/api/v1/cantina/cardapio', async (req, res) => {
    try {
      const tenant = await scope(req,res); if (!tenant) return;
      const items:any[]=[];
      for(let from=0;;from+=1000){
        const {data,error}=await sb.from('cantina_cardapio').select('id,nome,preco,icon,cat,badge,updated_at').eq('tenant_id',tenant).eq('ativo',true).order('id').range(from,from+999);
        if(error)throw error;items.push(...(data || []));if((data || []).length<1000)break;
      }
      items.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
      res.setHeader('Cache-Control','private, no-store'); res.json({ items });
    } catch { res.status(500).json({ error:'Não foi possível carregar o cardápio compartilhado.' }); }
  });
  app.post('/api/v1/cantina/cardapio', async (req,res) => {
    try {
      const tenant=await scope(req,res); if (!tenant) return;
      const item=values(req.body); if (!item) return res.status(400).json({ error:'Informe nome e preço maior que zero, com até duas casas decimais.' });
      const { data,error }=await sb.from('cantina_cardapio').insert({ ...item,tenant_id:tenant }).select('id,nome,preco,icon,cat,badge,updated_at').single();
      if(error) throw error; res.json({ item:data });
    } catch { res.status(500).json({ error:'Não foi possível salvar o item. Seu formulário foi mantido.' }); }
  });
  app.patch('/api/v1/cantina/cardapio/:id', async (req,res) => {
    try {
      const tenant=await scope(req,res); if (!tenant) return;
      const item=values(req.body);
      if (!isValidUuid(req.params.id) || !item || typeof req.body.expectedUpdatedAt !== 'string') return res.status(400).json({ error:'Item ou versão inválidos. Recarregue o cardápio.' });
      const { data,error }=await sb.from('cantina_cardapio').update({ ...item,updated_at:new Date().toISOString() }).eq('id',req.params.id).eq('tenant_id',tenant).eq('ativo',true).eq('updated_at',req.body.expectedUpdatedAt).select('id,nome,preco,icon,cat,badge,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ error:'Este item foi alterado em outro aparelho. Atualize o cardápio antes de editar.' });
      res.json({ item:data });
    } catch { res.status(500).json({ error:'Não foi possível atualizar o item.' }); }
  });
  app.delete('/api/v1/cantina/cardapio/:id', async (req,res) => {
    try {
      const tenant=await scope(req,res); if (!tenant) return;
      if (!isValidUuid(req.params.id)) return res.status(400).json({ error:'Item inválido.' });
      const { error }=await sb.from('cantina_cardapio').update({ ativo:false,updated_at:new Date().toISOString() }).eq('id',req.params.id).eq('tenant_id',tenant);
      if(error) throw error; res.json({ success:true });
    } catch { res.status(500).json({ error:'Não foi possível excluir o item.' }); }
  });
  // Importa cadastros antigos uma única vez; não reativa itens excluídos em outro aparelho.
  app.post('/api/v1/cantina/cardapio/importar', async (req,res) => {
    try {
      const tenant=await scope(req,res); if(!tenant) return;
      if (!Array.isArray(req.body.items) || req.body.items.length>300) return res.status(400).json({ error:'Cardápio antigo inválido.' });
      const entries=new Map<string,any>();
      for (const old of req.body.items) {
        const item=values(old), legacy=String(old?.id || '').slice(0,100);
        if (!item || !legacy) return res.status(400).json({ error:'Revise os nomes e preços do cardápio antigo antes de importar.' });
        entries.set(legacy,{ ...item,tenant_id:tenant,legacy_id:legacy });
      }
      if (entries.size) {
        const { error }=await sb.from('cantina_cardapio').upsert([...entries.values()],{ onConflict:'tenant_id,legacy_id',ignoreDuplicates:true });
        if(error) throw error;
      }
      res.json({ success:true });
    } catch { res.status(500).json({ error:'Não foi possível sincronizar o cardápio antigo. Os dados locais foram preservados.' }); }
  });
}
