import type { Express } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthOrRespond } from './requireAuth.js';
import { normalizeQueryTenantId, resolveFilhoHouseRefs, resolveFinanceiroTenantScope as resolveScope } from './tenantAccess.js';
import { resolveFilhoRowIdForFinance } from './resolveFilhoRowIdForFinance.js';
import { fetchFinanceiroRowsForFilho } from './fetchFinanceiroRowsForFilho.js';
import { safeErrorMessage } from './safeError.js';
import {readActiveDelegation} from './delegatedAccess.js';
import {grantAllows} from '../../lib/delegatedPolicy.js';
export function registerTransactionReadRoute(app: Express, { supabaseAdmin }: { supabaseAdmin: SupabaseClient }) {
  const resolveFinanceiroTenantScope = (client: SupabaseClient, userId: string, role: string, tenant: string) => resolveScope(client,userId,role,tenant);
  // API Route: Get Transactions (Bypasses RLS)
  app.get("/api/transactions", async (req, res) => {
    try {
      const authUser = await requireAuthOrRespond(supabaseAdmin, req, res);
      if (!authUser) return;
      const { tenantId, userRole, limit, offset, userEmail: userEmailQ } = req.query;
      const paginated = offset !== undefined;
      const pageOffset = Number(offset || 0), pageSize = Number(limit || 500);
      if (paginated && (!Number.isSafeInteger(pageOffset) || pageOffset < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500)) return res.status(400).json({ error: 'Paginação inválida.' });
      const userId = authUser.id;
      const actualChild = await resolveFilhoHouseRefs(supabaseAdmin, authUser);
      const tenantIdRaw = normalizeQueryTenantId(tenantId);
      const requestedRole=String(userRole||'').toLowerCase();
      const delegation=actualChild&&requestedRole==='admin'&&tenantIdRaw
        ?await readActiveDelegation(supabaseAdmin,userId,tenantIdRaw):null;
      const delegatedFinance=Boolean(delegation&&grantAllows(delegation.permissoes,'finance','visualizar'));
      const userRoleStr = actualChild && !delegatedFinance ? 'filho' : requestedRole;
      const limNum = limit ? Number(limit) : 150;

      if (userRoleStr === "filho") {
        const jwtUid = authUser.id;
        const jwtEm = String(authUser.email || "").trim().toLowerCase();
        let fid: string | null = null;
        try {
          fid = await resolveFilhoRowIdForFinance(supabaseAdmin, {
            queryUserId: userId,
            queryUserEmail: String(userEmailQ || "").trim().toLowerCase(),
            jwtUserId: jwtUid,
            jwtEmail: jwtEm,
          });
        } catch (e: any) {
          console.error("[SERVER] resolveFilhoRowIdForFinance:", e?.message || e);
        }
        if (!fid) {
          return res.json({ data: [] });
        }
        try {
          const rows = await fetchFinanceiroRowsForFilho(supabaseAdmin, fid, limNum);
          const filtered = rows.filter(
            (r: any) => String(r?.status || "").toLowerCase() !== "excluido"
          );
          return res.json({ data: filtered });
        } catch (e: any) {
          console.error("[SERVER] fetchFinanceiroRowsForFilho:", e?.message || e);
          return res.status(500).json({ error: safeErrorMessage(e, "Erro ao listar financeiro") });
        }
      }

      const effectiveTenant = await resolveFinanceiroTenantScope(
        supabaseAdmin,
        userId,
        userRoleStr,
        tenantIdRaw
      );
      if (!effectiveTenant) return res.status(403).json({ error: "Acesso negado" });

      const readRevision = async () => {
        const { data, error } = await supabaseAdmin.from('financeiro_revisoes').select('revisao').eq('tenant_id', effectiveTenant).maybeSingle();
        if (error) throw error;
        return 'v1:' + String(data?.revisao ?? 0);
      };
      let revision = '';
      if (paginated) {
        try { revision = await readRevision(); }
        catch { return res.status(503).json({ error: 'O financeiro está em atualização. Tente novamente mais tarde.', code: 'FINANCE_READER_NOT_READY' }); }
      }

      let query = supabaseAdmin.from('financeiro').select('*').order('data', { ascending: false }).order('id', { ascending: false });
      query = query.or(`tenant_id.eq.${effectiveTenant},lider_id.eq.${effectiveTenant}`);

      if (paginated) {
        query = query.range(pageOffset, pageOffset + pageSize - 1);
      } else if (limit) {
        query = query.limit(Number(limit));
      }

      const { data, error } = await query;
      if (error) throw error;
      if (paginated && await readRevision() !== revision) return res.status(409).json({ error: 'O extrato mudou durante a leitura. Atualize os dados.', code: 'FINANCE_SNAPSHOT_CHANGED' });
      const filtered = (data || []).filter(
        (r: any) => String(r?.status || "").toLowerCase() !== "excluido"
      );
      console.log(
        `[SERVER] GET /api/transactions ok. tenant=${effectiveTenant} rows=${filtered.length}`
      );
      res.json({ data: filtered, ...(paginated ? { hasMore: (data || []).length === pageSize, offset: pageOffset, ledgerRevision: revision } : {}) });
    } catch (error: any) {
      console.error("[SERVER] Error fetching transactions:", error.message || error);
      res.status(500).json({ error: safeErrorMessage(error, "Internal Server Error") });
    }
  });

}
