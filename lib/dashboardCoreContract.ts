export const DASHBOARD_CORE_SCHEMA = 1;
export const DASHBOARD_CORE_RESOURCES = ['children', 'transactions', 'events', 'notices'] as const;
export type DashboardCoreResource = typeof DASHBOARD_CORE_RESOURCES[number];
export type DashboardCoreResult = { data: any[]; error?: never } | { data?: never; error: string };
export type DashboardCoreResponse = {
  schemaVersion: typeof DASHBOARD_CORE_SCHEMA;
  resources: Record<DashboardCoreResource, DashboardCoreResult>;
};

export function isDashboardCoreResponse(value: unknown): value is DashboardCoreResponse {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<DashboardCoreResponse>;
  return payload.schemaVersion === DASHBOARD_CORE_SCHEMA && Boolean(payload.resources)
    && DASHBOARD_CORE_RESOURCES.every((key) => {
      const item = payload.resources?.[key];
      return item && (Array.isArray(item.data) && item.error === undefined
        || typeof item.error === 'string' && item.error.length > 0 && item.data === undefined);
    });
}
