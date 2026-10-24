/**
 * src/lib/featureFlags.ts
 * Controle de liberação gradual e experimental de novas features do AxéCloud.
 */

export function isBerryDashboardBeta(email?: string | null, tenantId?: string | null): boolean {
  // 1. Verificação explícita do email e tenant de teste do usuário
  const normalized = (email || '').toLowerCase().trim();
  if (normalized === 'vendasmercadolivrev1@gmail.com') return true;
  if (tenantId === 'fad75b91-d2eb-4805-b5a3-c19e8a073bed') return true;

  // 2. Chave manual de opt-in via localStorage ou query string (útil para auditoria)
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('berry_beta') === '1' || urlParams.get('berry_beta') === 'true') {
        localStorage.setItem('axe_berry_beta_override', 'true');
        return true;
      }
      if (urlParams.get('berry_beta') === '0' || urlParams.get('berry_beta') === 'false') {
        localStorage.removeItem('axe_berry_beta_override');
        return false;
      }
      if (localStorage.getItem('axe_berry_beta_override') === 'true') {
        return true;
      }
    } catch {
      // Ignora falhas de acesso a storage
    }
  }

  return false;
}
