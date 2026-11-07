import {checked} from './helpers';
import { supabase } from '../../../src/lib/supabase';
import { previewSession, request } from './session';
import { publishValue, readValue, registerLoader, registerWriter, refreshResource } from './runtime';
import type { AccountSetup } from '../completion';
import type { WhatsAppDispatch, DispatchStatus, DispatchKind } from '../whatsappDispatches';
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const photoUploads=new WeakMap<File,string>();
export const fileBase64=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});
registerLoader('account',async()=>{
  const session=previewSession();
  const [{data:p,error},status,config,portal]=await Promise.all([supabase.from('perfil_lider').select('*').eq('id',session.userId).single(),request('/api/whatsapp/status'),request('/api/whatsapp/config'),request('/api/v1/settings/portal-consulente')]);
  if(error||!p)throw new Error(error?.message||'Perfil não encontrado.');
  publishValue('accountRow',p);publishValue('whatsappConfig',config);
  const profile={house:p.nome_terreiro||'',responsible:p.zelador||'',role:p.cargo||'',tradition:({umbanda:'Umbanda',candomble:'Candomblé',jurema:'Jurema',mista:'Mista',outra:'Outra'}as any)[portal.tradicao]||'',city:portal.cidadePublica||'',uf:portal.estadoPublico||'',phone:portal.whatsappPublico||'',email:session.email,photo:null,photoUrl:p.foto_url||''};
  const prefs=config.preferences||{},whatsapp={connected:status.status==='CONNECTED',days:Number(prefs.giraReminderIntervalDays||3),sameDay:!!prefs.notifGiraNoDia,obligations:!!prefs.notifObrigacoes,monthly:!!prefs.notifFinanceiro,cantina:!!prefs.notifCantina};
  const previous=readValue<AccountSetup>('account');publishValue('account',{profile,draft:previous&&!same(previous.profile,previous.draft)?previous.draft:{...profile},whatsapp,whatsDraft:previous&&!same(previous.whatsapp,previous.whatsDraft)?previous.whatsDraft:{...whatsapp}});

});
registerWriter('account',async(next:AccountSetup,before:AccountSetup,operation)=>{
  const session=previewSession();
  if(same(next.profile,before.profile)&&same(next.whatsapp,before.whatsapp)){publishValue('account',next);return;}
  if(!same(next.whatsapp,before.whatsapp)){
    if(next.whatsapp.connected!==before.whatsapp.connected)throw new Error('O WhatsApp usa o canal oficial da plataforma. Este botão não pode simular pareamento nem desligar o serviço compartilhado.');
    const fields=(value:AccountSetup['whatsapp'])=>({days:value.days,sameDay:value.sameDay,obligations:value.obligations,monthly:value.monthly,cantina:value.cantina});
    const result:any=await checked(supabase.rpc('piloto_configurar_whatsapp',{p_tenant:session.tenantId,p_dados:fields(next.whatsapp),p_antes:fields(before.whatsapp)}));if(result.tenant_id!==session.tenantId||Object.entries(fields(next.whatsapp)).some(([key,value])=>result.preferences?.[key]!==value))throw Error('O servidor não confirmou as preferências dos avisos.');
    await refreshResource('giras');
  }else{
    const p=next.profile;
    if(p.email!==session.email)throw new Error('O e-mail de acesso usa um fluxo de confirmação próprio. Nenhum dado foi alterado.');
    let foto=readValue('accountRow').foto_url||null;
    if(p.photo){const file=p.photo;operation?.files([{id:'profile-photo',name:file.name,bytes:file.size}]);operation?.file('profile-photo',{phase:'preparing'});let url=photoUploads.get(file);if(!url){const uploaded=await request('/api/v1/profile/upload-photo','POST',{fileName:`${session.userId}-${crypto.randomUUID()}.${file.name.split('.').at(-1)}`,contentType:file.type,fileData:await fileBase64(file)},(loaded,total)=>{operation?.progress('profile-photo',loaded,total);if(total&&loaded>=total)operation?.file('profile-photo',{phase:'confirming',progress:1});});if(!uploaded.publicUrl)throw new Error('O servidor não confirmou a foto.');url=uploaded.publicUrl;photoUploads.set(file,url!);}foto=url!;operation?.file('profile-photo',{phase:'confirming',progress:1});}
    await request('/api/v1/settings/save','POST',{userId:session.userId,tenantId:session.tenantId,profile:{nome_terreiro:p.house,zelador:p.responsible,cargo:p.role,email:session.email,foto_url:foto}});if(p.photo)operation?.file('profile-photo',{phase:'done',progress:1});
    await request('/api/v1/settings/portal-consulente','POST',{tradicao:p.tradition.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),cidadePublica:p.city,estadoPublico:p.uf,whatsappPublico:p.phone});
  }
  await refreshResource('account');
  const saved=readValue<AccountSetup>('account');
  publishValue('account',{...saved,draft:{...saved.profile},whatsDraft:{...saved.whatsapp}});
});
