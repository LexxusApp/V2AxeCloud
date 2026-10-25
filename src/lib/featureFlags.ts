/**
 * src/lib/featureFlags.ts
 * Controle de liberação gradual e experimental de novas features do AxéCloud.
 */

export function isBerryDashboardBeta(_email?: string | null, _tenantId?: string | null): boolean {
  // Reversão solicitada: usar a dashboard original em todos os dispositivos.
  // Preferências salvas e parâmetros antigos não podem reativar o protótipo.
  return false;
}
