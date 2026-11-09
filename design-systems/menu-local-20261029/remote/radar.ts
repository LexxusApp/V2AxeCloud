import type { Operation } from '../operations';
import { request } from './session';
import { initialRadar } from './initial';
import { publishValue,readValue,registerLoader,registerWriter,refreshResource } from './runtime';
import { equal,singleChange } from './helpers';
import { fileBase64 } from './account';
import type { LocalRadar,RadarMedia } from '../completion';
import { normalizePilotRadar,legacyPilotRadarLocation } from '../../../cloudflare/pilot-radar-contract.js';

export function normalizeTradition(t?: string): string {
  if (!t) return 'Mista';
  const map: Record<string, string> = {
    umbanda: 'Umbanda',
    candomble: 'Candomblé',
    'candomblé': 'Candomblé',
    jurema: 'Jurema',
    mista: 'Mista',
    outra: 'Outra',
  };
  return map[t.toLowerCase().trim()] || (t.charAt(0).toUpperCase() + t.slice(1));
}

const picture=(url:string|undefined,id:string):RadarMedia|null=>url?{id,source:url,caption:'',illustrative:false}:null;
registerLoader('radar',async()=>{
  const [savedRes, summaryRes, postsRes, servicesRes] = await Promise.allSettled([
    request('/api/pilot/radar'),
    request('/api/v1/settings/directory-profile'),
    request('/api/v1/settings/directory-publicacoes'),
    request('/api/v1/settings/terreiro-servicos')
  ]);
  if (savedRes.status !== 'fulfilled') throw savedRes.reason;
  const saved = savedRes.value;
  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : { claimed: false, profile: null };
  const posts = postsRes.status === 'fulfilled' ? postsRes.value : { publicacoes: [] };
  const services = servicesRes.status === 'fulfilled' ? servicesRes.value : { servicos: [], whatsappAtendimento: '' };
  if(!Number.isSafeInteger(saved.revision)||saved.revision<0)throw new Error('O servidor não confirmou a versão do Radar.');
  publishValue('radarRevision',saved.revision);
  publishValue('radarSummary',summary);publishValue('radarServiceRows',services.servicos||[]);publishValue('radarPostRows',posts.publicacoes||[]);
  const p=summary.profile;
  const tradition = normalizeTradition(saved.profile?.tradition || p?.tradicao);
  if(!p){
    publishValue('radar',{...initialRadar(),...saved.profile,tradition});
    return;
  }
  const state:LocalRadar={...initialRadar(),publicName:p.nome,tradition,address:p.endereco||'',noNumber:true,city:p.cidade||'',uf:p.estado||'',phone:p.telefone||'',servicePhone:services.whatsappAtendimento||'',neighborhood:p.bairro||'',mapsUrl:p.linkMaps||'',latitude:p.latitude==null?'':String(p.latitude),longitude:p.longitude==null?'':String(p.longitude),description:p.descricaoPublica||'',instructions:p.orientacoesVisita||'',published:p.publicacaoStatus==='publicado',showAddress:true,cover:picture(p.coverPhotoUrl,'cover'),portrait:picture(p.ownerPhotoUrl,'portrait'),gallery:(p.galleryPhotoUrls||[]).map((url:string,i:number)=>picture(url,`gallery-${i}`)!),socials:p.instagramUrl?[{id:'instagram',network:'instagram',url:p.instagramUrl}]:[],schedules:(p.horariosGira||[]).map((row:any,i:number)=>({id:`schedule-${i}`,day:row.diaSemana,start:row.horario,end:'',title:row.titulo||'',enabled:true})),posts:(posts.publicacoes||[]).map((row:any)=>({id:row.id,title:row.titulo,text:row.conteudo,published:row.status==='publicado',updated:row.updated_at||row.publicado_em||row.created_at})),services:(services.servicos||[]).map((row:any)=>({id:row.id,name:row.nome,description:row.descricao||'',minutes:Number(row.duracao_minutos)||0,available:!!row.disponivel}))};
  const finalRadar = saved.profile
    ? { ...state, ...saved.profile, tradition, posts: state.posts, services: state.services }
    : { ...state, tradition, ...legacyPilotRadarLocation({ ...p, cep: saved.legacy?.cep }) };
  publishValue('radar', finalRadar);
});
const photoCache=new WeakMap<File,Map<string,string>>();
async function photo(media:RadarMedia|null,kind:string,operation?:Operation){
  if(!media)return null;if(typeof media.source==='string')return media.source;
  const file=media.source;operation?.file(media.id,{phase:'preparing'});
  let url=photoCache.get(file)?.get(kind);
  if(!url){const result=await request('/api/v1/settings/directory-profile/upload-photo','POST',{fileData:await fileBase64(file),fileName:file.name,contentType:file.type,kind},(loaded,total)=>{operation?.progress(media.id,loaded,total);if(total&&loaded>=total)operation?.file(media.id,{phase:'confirming',progress:1});});if(!result.publicUrl)throw new Error('O servidor não confirmou a imagem.');url=result.publicUrl;const cache=photoCache.get(file)||new Map<string,string>();cache.set(kind,url!);photoCache.set(file,cache);}
  operation?.file(media.id,{phase:'confirming',progress:1});return url!;
}
registerWriter('radar',async(next:LocalRadar,before:LocalRadar,operation)=>{
  if(!equal(next.posts,before.posts)){
    const {row,old,removed}=singleChange(next.posts,before.posts),raw=(readValue<any[]>('radarPostRows')||[]).find(item=>item.id===row.id);
    await request(`/api/v1/settings/directory-publicacoes${old?`/${encodeURIComponent(row.id)}`:''}`,removed?'DELETE':old?'PATCH':'POST',removed?undefined:{titulo:row.title,conteudo:row.text,status:row.published?'publicado':'rascunho',imagemUrl:raw?.imagem_url||null});
  }else if(!equal(next.services,before.services)){
    const {row,old,removed}=singleChange(next.services,before.services),raw=(readValue<any[]>('radarServiceRows')||[]).find(item=>item.id===row.id);
    await request(`/api/v1/settings/terreiro-servicos${old?`/${encodeURIComponent(row.id)}`:''}`,removed?'DELETE':old?'PATCH':'POST',removed?undefined:{nome:row.name,descricao:row.description,duracaoMinutos:row.minutes,disponivel:row.available,valorMin:raw?.valor_min??null,valorMax:raw?.valor_max??null,ordem:raw?.ordem||0});
  }else{
    const revision=readValue<number>('radarRevision');
    if(!Number.isSafeInteger(revision)||revision<0)throw new Error('Atualize o perfil do Radar antes de salvar.');
    const photos=[next.cover,next.portrait,...next.gallery].filter((media):media is RadarMedia=>!!media&&media.source instanceof File);operation?.files(photos.map(media=>({id:media.id,name:(media.source as File).name,bytes:(media.source as File).size})));
    const resolve=async(media:RadarMedia|null,kind:string)=>media?{...media,source:(await photo(media,kind,operation))!}:null;
    const cover=await resolve(next.cover,'cover'),portrait=await resolve(next.portrait,'profile'),gallery=[] as RadarMedia[];
    for(const media of next.gallery)gallery.push((await resolve(media,'gallery'))!);
    const finalNext = { ...next, tradition: normalizeTradition(next.tradition) };
    const saved=await request('/api/pilot/radar','PUT',{revision,profile:normalizePilotRadar({...finalNext,cover,portrait,gallery})});
    if(!saved.profile||!Number.isSafeInteger(saved.revision))throw new Error('O servidor não confirmou o perfil salvo. Atualize antes de repetir.');
    publishValue('radarRevision',saved.revision);
    publishValue('radar',{...finalNext,...saved.profile,tradition:normalizeTradition(saved.profile.tradition),posts:next.posts,services:next.services});
    for(const media of photos)operation?.file(media.id,{phase:'done',progress:1});
  }await refreshResource('radar');
});
