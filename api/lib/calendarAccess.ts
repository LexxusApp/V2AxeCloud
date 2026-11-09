import type { SupabaseClient } from "@supabase/supabase-js";
import { assertZeladorOrGlobalAdmin,resolveLeaderId } from "./tenantAccess.js";
import {resolveDelegatedModuleTenant,readActiveDelegation} from './delegatedAccess.js';
import {grantAllows} from '../../lib/delegatedPolicy.js';
import {isSubscriptionAccessActive} from './subscriptionAccess.js';
import {isConsoleGlobalAdmin} from './consoleAdmin.js';

export async function calendarManagementContext(sb:SupabaseClient,user:{id:string;email?:string|null}){
 const managementTenant=await resolveDelegatedModuleTenant(sb,user.id,'giras','gerenciar');
 const {data:profile,error}=await sb.from('perfil_lider').select('id,tenant_id,is_blocked,deleted_at').eq('id',user.id).maybeSingle();
 if(error)throw error;
 if(profile?.is_blocked||profile?.deleted_at)return {error:'Acesso suspenso',status:403} as const;
 const tenantId=managementTenant!==user.id?managementTenant:String(profile?.tenant_id||user.id);
 const isGlobalAdmin=await isConsoleGlobalAdmin(sb,user);
 if(!isGlobalAdmin&&!await assertZeladorOrGlobalAdmin(sb,user,tenantId))return {error:'Acesso negado',status:403} as const;
 const owner=await resolveLeaderId(sb,tenantId);
 const {data:subscription,error:subError}=await sb.from('subscriptions').select('plan,status,expires_at').eq('id',owner).maybeSingle();
 if(subError)throw subError;
 if(!isGlobalAdmin&&!isSubscriptionAccessActive(subscription))return {error:'Assinatura inativa',status:403} as const;
 return {tenantId,isGlobalAdmin};
}

/**
 * Intervalo de lembrete WhatsApp por gira (1–7 dias).
 * null / vazio / 0 / false = desligado.
 */
export function parseWaReminderIntervalDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "" || raw === false) return null;
  if (raw === true) return 2;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 7) return 7;
  return n;
}

/** Valida posse do evento (tenant/lider) antes de mutações destrutivas. */
export async function userCanModifyCalendarEvent(
  supabaseAdmin: SupabaseClient,
  user: { id: string; email?: string | null },
  eventId: string
): Promise<{ allowed: boolean; notFound: boolean }> {
  const id = String(eventId || "").trim();
  if (!id) return { allowed: false, notFound: true };

  const { data: event, error } = await supabaseAdmin
    .from("calendario_axe")
    .select("id, tenant_id, lider_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!event) return { allowed: false, notFound: true };

  const scopeIds = new Set<string>();
  for (const raw of [event.tenant_id || event.lider_id]) {
    const s = String(raw || "").trim();
    if (s) scopeIds.add(s);
  }

  for (const tid of scopeIds) {
    if (await assertZeladorOrGlobalAdmin(supabaseAdmin, user, tid)) {
      const delegation=await readActiveDelegation(supabaseAdmin,user.id,tid);
      if(delegation&&!grantAllows(delegation.permissoes,'giras','gerenciar'))continue;
      return { allowed: true, notFound: false };
    }
  }
  return { allowed: false, notFound: false };
}
