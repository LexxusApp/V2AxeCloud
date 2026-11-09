import type { SupabaseClient } from '@supabase/supabase-js';
import { canReadLibraryMaterial, parseLibraryAudience, type LibraryAudience, type LibraryReader } from '../../lib/libraryAudience.js';
import { assertUserCanAccessTenant, assertZeladorOrGlobalAdmin, resolveFilhoHouseRefs, resolveLeaderId } from './tenantAccess.js';
import { isConsoleGlobalAdmin } from './consoleAdmin.js';
import { libraryStoragePath } from '../../lib/libraryStoragePath.js';
import {readActiveDelegation} from './delegatedAccess.js';
import {grantAllows} from '../../lib/delegatedPolicy.js';

export async function resolveLibraryReader(sb: SupabaseClient, user: { id: string; email?: string | null }, tenantId: string, management=false): Promise<LibraryReader> {
  if (await isConsoleGlobalAdmin(sb, user)) return { manager: true, memberId: null };
  if(management){
    const delegation=await readActiveDelegation(sb,user.id,tenantId);
    if(delegation&&grantAllows(delegation.permissoes,'library','visualizar'))return {manager:true,memberId:null};
  }
  // A shadow member must never inherit management from a stale leader profile.
  const child = await resolveFilhoHouseRefs(sb, user);
  if (child) return { manager: false, memberId: String(child.id || '') || null };
  return { manager: await assertZeladorOrGlobalAdmin(sb, user, tenantId), memberId: null };
}

export async function validateLibraryRecipients(sb: SupabaseClient, tenantId: string, input: { visibilidade?: unknown; destinatarios?: unknown }) {
  const audience = parseLibraryAudience(input);
  if (audience.visibilidade === 'casa') return audience;
  const { data, error } = await sb.from('filhos_de_santo').select('id,tenant_id,lider_id').in('id', audience.destinatarios!);
  if (error) throw error;
  if (!data || data.length !== audience.destinatarios!.length) throw Error('Um dos destinatários não está cadastrado nesta casa.');
  const house = await resolveLeaderId(sb, tenantId);
  for (const child of data) {
    const childHouse = String(child.lider_id || child.tenant_id || '');
    if (!childHouse || await resolveLeaderId(sb, childHouse) !== house) throw Error('Um dos destinatários não pertence a esta casa.');
  }
  return audience;
}

export async function libraryHouseRefs(sb: SupabaseClient, tenantId: string): Promise<string[]> {
  const house = await resolveLeaderId(sb, tenantId);
  const { data: profile, error } = await sb.from('perfil_lider').select('id,tenant_id').or(`id.eq.${house},tenant_id.eq.${house}`).maybeSingle();
  if (error) throw error;
  return [...new Set([house, tenantId, profile?.id, profile?.tenant_id].filter((value): value is string => typeof value === 'string' && Boolean(value)))];
}

export async function canReadLibraryPath(sb: SupabaseClient, user: { id: string; email?: string | null }, tenantId: string, path: string, management=false): Promise<boolean> {
  if (!(await assertUserCanAccessTenant(sb, user, tenantId))) return false;
  const { data, error } = await sb.from('biblioteca').select('*').eq('storage_path', path).maybeSingle();
  if (error) return false;
  const house = await resolveLeaderId(sb, tenantId);
  const reader = await resolveLibraryReader(sb, user, tenantId,management);
  if (data) return await resolveLeaderId(sb, String(data.tenant_id)) === house && canReadLibraryMaterial(data as LibraryAudience, reader);
  // Older rows stored only arquivo_url. Locate them inside this same house and
  // apply the identical audience check instead of trusting the old signed URL.
  const refs = await libraryHouseRefs(sb, tenantId);
  for (let from = 0; from < 100_000; from += 500) {
    const { data: rows, error: loadError } = await sb.from('biblioteca').select('*').in('tenant_id', refs).order('id').range(from, from + 499);
    if (loadError) return false;
    const match = (rows || []).find(row => !row.storage_path && libraryStoragePath(row.arquivo_url || '') === path);
    if (match) return canReadLibraryMaterial(match, reader);
    if (!rows || rows.length < 500) return false;
  }
  return false;
}
