/**
 * Fallback no cliente (JWT do usuário): recupera tenant vinculado ao login
 * quando `tenantData.tenant_id` e o cache local estão vazios.
 */
import { supabase } from './supabase';

export async function resolveTenantFromSupabase(
  userId: string,
  email?: string | null
): Promise<string> {
  if (!userId) return '';

  const { data: byId } = await supabase
    .from('perfil_lider')
    .select('tenant_id, id')
    .eq('id', userId)
    .maybeSingle();

  if (byId) {
    const tid = String(byId.tenant_id || '').trim() || String(byId.id || '').trim();
    if (tid) return tid;
  }

  const em = String(email || '').trim().toLowerCase();
  if (em) {
    const shadowF = em.match(/^f_([0-9a-f-]{36})@axecloud\.internal$/i);
    if (shadowF?.[1]) {
      const { data: byShadow } = await supabase
        .from('filhos_de_santo')
        .select('lider_id, tenant_id')
        .eq('id', shadowF[1])
        .maybeSingle();
      if (byShadow) {
        const leaderRef = String(byShadow.lider_id || byShadow.tenant_id || '').trim();
        if (leaderRef) {
          const { data: leader } = await supabase
            .from('perfil_lider')
            .select('tenant_id, id')
            .eq('id', leaderRef)
            .maybeSingle();
          if (leader) {
            const tid = String(leader.tenant_id || '').trim() || String(leader.id || '').trim();
            if (tid) return tid;
          }
          return leaderRef;
        }
      }
    }

    const { data: byEmail } = await supabase
      .from('perfil_lider')
      .select('tenant_id, id')
      .eq('email', em)
      .maybeSingle();
    if (byEmail) {
      const tid = String(byEmail.tenant_id || '').trim() || String(byEmail.id || '').trim();
      if (tid) return tid;
    }
  }

  const { data: child } = await supabase
    .from('filhos_de_santo')
    .select('lider_id, tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!child) return '';

  const leaderRef = String(child.lider_id || child.tenant_id || '').trim();
  if (leaderRef) {
    const { data: leader } = await supabase
      .from('perfil_lider')
      .select('tenant_id, id')
      .eq('id', leaderRef)
      .maybeSingle();
    if (leader) {
      const tid = String(leader.tenant_id || '').trim() || String(leader.id || '').trim();
      if (tid) return tid;
    }
  }

  const ct = String(child.tenant_id || '').trim();
  if (ct) {
    const { data: rows } = await supabase
      .from('perfil_lider')
      .select('tenant_id, id')
      .eq('tenant_id', ct)
      .limit(1);
    const row = rows?.[0];
    if (row) {
      const tid = String(row.tenant_id || '').trim() || String(row.id || '').trim();
      if (tid) return tid;
    }
    return ct;
  }

  return '';
}

/** Resolve o nome do terreiro a partir do id do líder/tenant (fallback quando tenant-info falha). */
export async function resolveTerreiroNomeFromSupabase(
  tenantId: string
): Promise<string> {
  const tid = String(tenantId || '').trim();
  if (!tid) return 'Meu Terreiro';

  const { data: byId } = await supabase
    .from('perfil_lider')
    .select('nome_terreiro')
    .eq('id', tid)
    .maybeSingle();

  const nomeById = String(byId?.nome_terreiro || '').trim();
  if (nomeById) return nomeById;

  const { data: byTenant } = await supabase
    .from('perfil_lider')
    .select('nome_terreiro')
    .eq('tenant_id', tid)
    .limit(1)
    .maybeSingle();

  const nomeByTenant = String(byTenant?.nome_terreiro || '').trim();
  return nomeByTenant || 'Meu Terreiro';
}
