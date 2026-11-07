import useSWR from 'swr';
import { authFetch, getAccessToken } from '../lib/authenticatedFetch';
import { supabase } from '../lib/supabase';
import { fetchConfirmadosResumo } from '../lib/giraOperations';
import { whatsappApiUrl, whatsappRailwayAuthHeaders } from '../lib/whatsappApiUrl';
import {
  createDashboardLoaders, dashboardResourceKey, dashboardSWRConfig,
  normalizeDashboardChildren, normalizeDashboardTransactions,
  type DashboardResource, type DashboardResources, type DashboardScope,
} from '../lib/dashboardResources';
import { fetchDashboardCore, canUseLegacyDashboard, DashboardCoreError } from '../lib/dashboardCoreClient';
import type { DashboardCoreResource } from '../../lib/dashboardCoreContract';

const loaders = createDashboardLoaders({
  authFetch,
  profile: ({ tenantId, userId }) => supabase.from('perfil_lider')
    .select('nome_terreiro,foto_url,whatsapp_publico,cidade_publica,estado_publico,portal_publico_ativo,public_slug')
    .or(`id.eq.${userId},tenant_id.eq.${tenantId}`).maybeSingle(),
  confirmations: fetchConfirmadosResumo,
  whatsappStatus: async (userId) => {
    const token = await getAccessToken();
    if (!token) throw new Error('Status do WhatsApp indisponível.');
    const response = await fetch(whatsappApiUrl('/whatsapp/status'), {
      headers: whatsappRailwayAuthHeaders(token, userId),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Status do WhatsApp indisponível.');
    const payload = await response.json();
    if (typeof payload?.status !== 'string') throw new Error('Status do WhatsApp inválido.');
    return payload.status.toUpperCase() === 'CONNECTED';
  },
});

function useResource<K extends DashboardResource>(resource: K, scope?: DashboardScope) {
  return useSWR<DashboardResources[K]>(
    dashboardResourceKey(resource, scope),
    () => loaders[resource](scope!),
    dashboardSWRConfig,
  );
}

/** Independent subscriptions: a delayed integration never holds another card. */
export function useDashboardResources(scope?: DashboardScope) {
  const core = useSWR(
    scope ? ['berry-dashboard-core-v1', scope.tenantId, scope.userId, scope.userRole] : null,
    () => fetchDashboardCore(scope!, authFetch),
    { ...dashboardSWRConfig, shouldRetryOnError: (error) => !canUseLegacyDashboard(error) },
  );
  // Compatibility for an older/rolled-back backend. Never bypass a 401/403.
  const legacyScope = canUseLegacyDashboard(core.error) ? scope : undefined;
  const legacyChildren = useResource('children', legacyScope);
  const legacyTransactions = useResource('transactions', legacyScope);
  const legacyEvents = useResource('events', legacyScope);
  const legacyNotices = useResource('notices', legacyScope);
  function coreResource<K extends DashboardCoreResource>(name: K) {
    const accessDenied = core.error instanceof DashboardCoreError && [401, 403].includes(core.error.status);
    const result = accessDenied ? undefined : core.data?.resources[name];
    const rows = result?.data;
    const data = rows === undefined ? undefined : name === 'children' ? normalizeDashboardChildren(rows)
      : name === 'transactions' ? normalizeDashboardTransactions(rows) : rows;
    return { data: data as DashboardResources[K] | undefined, error: core.error || (result?.error ? new Error(result.error) : undefined) };
  }
  const children = legacyScope ? legacyChildren : coreResource('children');
  const transactions = legacyScope ? legacyTransactions : coreResource('transactions');
  const events = legacyScope ? legacyEvents : coreResource('events');
  const notices = legacyScope ? legacyNotices : coreResource('notices');
  const pixConfig = useResource('pixConfig', scope);
  const profile = useResource('profile', scope);
  const radar = useResource('radar', scope);
  const whatsappLogs = useResource('whatsappLogs', scope);
  const whatsappConnected = useResource('whatsappConnected', scope);
  const confirmations = useResource('confirmations', scope);
  return { children, transactions, events, notices, pixConfig, profile, radar, whatsappLogs, whatsappConnected, confirmations };
}
