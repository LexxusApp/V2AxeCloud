import {isLifetimePlan} from '../../src/constants/plans';
import {getTodayYmd,parseSubscriptionExpiryYmd} from '../../src/lib/subscriptionDue';
import type {LiveSubscription} from './subscription';

// Same binary quota enforced by /api/v1/gallery/upload-url and complete-upload.
export const GALLERY_LIMIT_BYTES=100*1024*1024*1024;
export type GalleryUsage={usedBytes:number;limitBytes:number;fileCount:number};
export function storageSize(bytes:number):string{
 if(bytes===0)return '0 B';
 const units=['B','KB','MB','GB','TB'],unit=Math.min(4,Math.floor(Math.log(bytes)/Math.log(1024)));
 return `${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:unit===0?0:2}).format(bytes/1024**unit)} ${units[unit]}`;
}
export function storageUsageLabel(usage:GalleryUsage):string{return `${storageSize(usage.usedBytes)} de ${storageSize(usage.limitBytes)}`;}
export function accountInitials(name:string):string{return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase()||'Z';}
export function planExpiryLabel(profile:Record<string,unknown>,tenantId:string,subscription?:LiveSubscription|null,now=new Date()):string{
 const live=subscription?.tenantId===tenantId?subscription:undefined;
 if(!live&&profile.tenant_id!==tenantId)return 'Consultar assinatura';
 const plan=live?.plan||String(profile.plan||'');
 if(live?.lifetime||isLifetimePlan(plan))return 'Plano sem vencimento';
 const expiry=parseSubscriptionExpiryYmd(live?live.until:String(profile.expires_at||''));
 if(!expiry||!/^\d{4}-\d{2}-\d{2}$/.test(expiry))return 'Consultar assinatura';
 const [year,month,day]=expiry.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return 'Consultar assinatura';
 const trial=live?live.trial:profile.is_trial===true;
 const formatted=`${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
 return expiry<getTodayYmd(now)?`Plano venceu em ${formatted}`:`${trial?'Teste':'Plano'} até ${formatted}`;
}
