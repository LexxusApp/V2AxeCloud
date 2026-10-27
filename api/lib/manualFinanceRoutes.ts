import type { Express } from 'express';
import { requireAuthOrRespond } from './requireAuth.js';
import { assertZeladorTenantAccess, normalizeQueryTenantId } from './tenantAccess.js';
import { buildManualFinanceEntry } from '../../lib/manualFinance.js';

export function registerManualFinanceRoutes(app: Express, { supabaseAdmin }: { supabaseAdmin: any }) {
  app.post('/api/transactions', async (req, res) => {
    const user = await requireAuthOrRespond(supabaseAdmin, req, res);
    if (!user) return;
    const tenantId = normalizeQueryTenantId(req.body?.tenantId);
    if (!tenantId) return res.status(400).json({ error: 'Selecione o terreiro do lançamento.' });
    if (!(await assertZeladorTenantAccess(supabaseAdmin, user.id, tenantId))) return res.status(403).json({ error: 'Acesso negado.' });
    let payload;
    try { payload = buildManualFinanceEntry(req.body || {}); }
    catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    const requestId = String(req.body?.requestId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return res.status(400).json({ error: 'Atualize a página e tente novamente para identificar o lançamento.' });
    try {
      const { data, error } = await supabaseAdmin.rpc('registrar_lancamento_manual', { p_actor: user.id, p_tenant: tenantId, p_request: requestId, p_payload: payload });
      if (error) {
        const code = String(error.code || '');
        if (['23505','22023','42501'].includes(code)) return res.status(code === '23505' ? 409 : code === '42501' ? 403 : 400).json({ error: error.message });
        throw error;
      }
      const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data;
      if (!row?.id) throw new Error('Registro não confirmado pelo banco.');
      return res.status(201).json({ data: row });
    } catch (error) {
      console.error('[manual finance]', error);
      return res.status(500).json({ error: 'Não foi possível salvar o lançamento. Seus dados continuam no formulário; tente novamente.' });
    }
  });
}
