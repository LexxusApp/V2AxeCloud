import type { Express } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthOrRespond } from './requireAuth.js';
import { isValidUuid, normalizeQueryTenantId } from './tenantAccess.js';
import { readDashboardCore, resolveDashboardReadScope } from './dashboardCore.js';
import { apiReadRateLimit } from './rateLimit.js';

export function registerDashboardCoreRoutes(app: Express, sb: SupabaseClient) {
  app.get('/api/v1/dashboard/core', apiReadRateLimit, async (req, res) => {
    // Sensitive lists must never enter a public/CDN cache, including error responses.
    res.setHeader('Cache-Control', 'private, no-store');
    const start = performance.now();
    try {
      const user = await requireAuthOrRespond(sb, req, res);
      if (!user) return;
      const tenantId = normalizeQueryTenantId(req.query.tenantId);
      if (!isValidUuid(tenantId)) return res.status(400).json({ error: 'Tenant inválido.' });
      const authDone = performance.now();
      const scope = await resolveDashboardReadScope(sb, user, tenantId);
      if (!scope) return res.status(403).json({ error: 'Acesso negado.' });
      const scopeDone = performance.now();
      const data = await readDashboardCore(sb, scope);
      res.setHeader('Server-Timing', `auth;dur=${(authDone - start).toFixed(1)}, access;dur=${(scopeDone - authDone).toFixed(1)}, data;dur=${(performance.now() - scopeDone).toFixed(1)}`);
      return res.json(data);
    } catch {
      return res.status(503).json({ error: 'Dashboard temporariamente indisponível.' });
    }
  });
}
