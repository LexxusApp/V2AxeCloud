import {PILOT_TENANT,PILOT_MANAGERS} from './pilot-interface-policy.js';
import {normalizePilotRadar,publicPilotRadar,pilotRadarDirectory} from './pilot-radar-contract.js';
import {operationRolloutMode,requirePilotOperationAccess} from './pilot-operation-access.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization, Cookie','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
async function connection(env,fetcher,authorization){
 const response=await env.API.fetch(new Request('https://axecloud.com.br/api/public-config'));
 const config=await response.json();if(!response.ok||!config.supabaseUrl||!config.supabaseAnonKey)throw fail('Configuração do Radar indisponível.',503);
 const headers={apikey:config.supabaseAnonKey,Authorization:authorization||'Bearer '+config.supabaseAnonKey,'Content-Type':'application/json'};
 return {config,headers,rpc:async(name,args)=>{const res=await fetcher(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args)});const body=await res.json();if(!res.ok){const status=body?.code==='23505'?409:body?.code==='42501'?403:body?.code==='22023'?400:503;throw fail(status===409?'O perfil mudou em outro aparelho. Atualize antes de salvar.':status===403?'Este perfil está restrito à zeladoria autorizada.':status===400?'Confira os dados do perfil do Radar.':'O servidor não confirmou os dados do Radar.',status);}return body;}};
}
export async function handlePilotRadar(request,env,fetcher=fetch){
 const url=new URL(request.url);if(!/^\/api\/pilot\/radar\/?$/.test(url.pathname))return null;
 try{
  if(!['GET','PUT'].includes(request.method))throw fail('Método não permitido.',405);
  const authorization=request.headers.get('authorization');if(!/^Bearer \S+$/.test(authorization||''))throw fail('Entre na sua conta para acessar o Radar.',401);
  if(request.method==='PUT'&&!['https://axecloud.com.br','http://localhost:5188'].includes(request.headers.get('origin')))throw fail('Origem inválida.',403);
  let db,tenant;
  if(operationRolloutMode(env)==='managers'){
   const access=await requirePilotOperationAccess(request,env,fetcher);
   db={config:access.config,headers:access.headers,rpc:async(name,args)=>{
    const res=await fetcher(access.config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{...access.headers,'Content-Type':'application/json'},body:JSON.stringify(args)});
    const body=await res.json();if(!res.ok){const status=body?.code==='23505'?409:body?.code==='42501'?403:body?.code==='22023'?400:503;throw fail(status===409?'O perfil mudou em outro aparelho. Atualize antes de salvar.':status===403?'Este perfil está restrito à zeladoria autorizada.':status===400?'Confira os dados do perfil do Radar.':'O servidor não confirmou os dados do Radar.',status);}return body;
   }};
   tenant=access.tenantId;
  }else{
   if(url.searchParams.has('tenantId')&&!PILOT_MANAGERS.some(m=>m.id===url.searchParams.get('tenantId')))throw fail('Casa não autorizada.',403);
   db=await connection(env,fetcher,authorization);
   const auth=await fetcher(db.config.supabaseUrl+'/auth/v1/user',{headers:db.headers});if(!auth.ok)throw fail('Sua sessão precisa ser renovada.',401);const user=await auth.json();
   const manager=PILOT_MANAGERS.find(m=>m.id===user.id&&String(m.email).toLowerCase()===String(user.email||'').toLowerCase());
   if(!manager)throw fail('Radar restrito à zeladoria autorizada no piloto.',403);
   tenant=user.id;
  }
  if(request.method==='GET')return json(await db.rpc('piloto_radar_ler',{p_tenant:tenant}));
  if(Number(request.headers.get('content-length'))>50000)throw fail('Perfil muito grande.',413);
  const reader=request.body?.getReader();let raw='',bytes=0;const decoder=new TextDecoder();
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>50000){await reader.cancel();throw fail('Perfil muito grande.',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  let body;try{body=JSON.parse(raw);}catch{throw fail('Dados inválidos.');}
  if(!Number.isSafeInteger(body?.revision)||body.revision<0)throw fail('Atualize o perfil antes de salvar.');
  const profile=normalizePilotRadar(body.profile);
  const saved=await db.rpc('piloto_radar_salvar',{p_tenant:tenant,p_profile:profile,p_revision:body.revision});
  if(!saved?.profile||!Number.isSafeInteger(saved.revision)||saved.revision<1)throw fail('O servidor não confirmou o perfil salvo.',503);
  return json(saved);
 }catch(error){return json({error:error?.status?error.message:'Não foi possível concluir a operação do Radar.'},error?.status||503);}
}
const publicPath=path=>/^\/api\/v1\/public\/(?:diretorio|terreiros)(?:\/|$)/.test(path);
const citySlug=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function includePilotRadarListing(body,entries,url){
 const city=/^\/api\/v1\/public\/diretorio\/([a-z]{2})\/([^/]+)$/.exec(url.pathname),state=/^\/api\/v1\/public\/diretorio\/uf\/([a-z]{2})$/.exec(url.pathname);
 const all=url.pathname==='/api/v1/public/diretorio/export';if(!all&&!state&&(!city||city[1]==='uf'))return body;
 const matching=entries.filter(e=>e.managed&&e.profile?.published&&e.kind!=='portal'&&e.id!==PILOT_TENANT&&(!city||e.profile.uf.toLowerCase()===city[1]&&citySlug(e.profile.city)===decodeURIComponent(city[2]))&&(!state||e.profile.uf.toLowerCase()===state[1]));
 if(!matching.length||body&&!Array.isArray(body.items))return body;
 const out=body||{items:[],cidade:matching[0].profile.city,estado:matching[0].profile.uf,cidadeSlug:citySlug(matching[0].profile.city),total:0,totalTerreiros:0,totalLojas:0};
 const existing=new Set(out.items.map(i=>i.slug));let added=0;
 // Preserve the current listing's pagination; the explicit pilot entry is inserted
 // only where its current public city/state matches, including address-hidden houses.
 for(const entry of matching){if(existing.has(entry.slug))continue;const limit=Number(url.searchParams.get('limit'));if(limit>0&&out.items.length>=limit)break;out.items.push(pilotRadarDirectory(entry.profile,{slug:entry.slug,id:entry.id,cidadeSlug:citySlug(entry.profile.city)}));existing.add(entry.slug);added++;}
 if(added)for(const key of ['total','totalTerreiros'])if(typeof out[key]==='number')out[key]+=added;
 return out;
}
export function projectPilotRadarPayload(body,entries,{map=false}={}){
 const bySlug=new Map(entries.map(e=>[e.slug,e]));
 // The directory map is columnar; filtering objects alone leaks its packed coordinates.
 if(map&&Array.isArray(body?.s)){
  const indexes=body.s.map((slug,i)=>({slug,i})).filter(({slug})=>{const e=bySlug.get(slug);return !e?.managed||!!e.profile?.published&&e.profile.showAddress===true&&!!e.profile.latitude&&!!e.profile.longitude;}).map(x=>x.i);
  const out={...body};for(const key of ['s','n','c','e','a','o','r','m','i'])if(Array.isArray(out[key]))out[key]=indexes.map(i=>out[key][i]);
  out.s.forEach((slug,i)=>{const e=bySlug.get(slug);if(e?.managed&&e.profile){out.a[i]=Math.round(Number(e.profile.latitude)*100000);out.o[i]=Math.round(Number(e.profile.longitude)*100000);out.n[i]=e.profile.publicName;out.i[i]=e.profile.socials.find(s=>s.network==='instagram')?.url||'';}});
  out.t={...out.t,listed:indexes.length,exact:indexes.length};return out;
 }
 function walk(value){
  if(Array.isArray(value))return value.map(walk).filter(v=>v!==null);
  if(!value||typeof value!=='object')return value;
  const entry=typeof value.slug==='string'?bySlug.get(value.slug):null;
  if(entry?.managed)return entry.profile?pilotRadarDirectory(entry.profile,{...value,id:entry.id}):null;
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='bairros'&&Array.isArray(v)?v.map(group=>({...group,items:(group.items||[]).filter(item=>{const e=bySlug.get(item.slug);return !e?.managed||e.profile?.showAddress===true;})})).filter(group=>group.items.length).map(walk):walk(v)]));
 }
 return walk(body);
}
// Principal must mount this BEFORE cached public API forwarding, on every public ingress.
export async function handlePilotRadarPublic(request,env,fetcher=fetch){
 const url=new URL(request.url),direct=/^\/api\/pilot\/radar\/public\/([^/]+)$/.exec(url.pathname);
 if(!direct&&!publicPath(url.pathname))return null;
 if(!['GET','HEAD'].includes(request.method))return null;
 try{
  const db=await connection(env,fetcher);
  const entries=await db.rpc('piloto_radar_publicos',{});if(!Array.isArray(entries))throw fail('Perfil público indisponível.',503);
  if(direct){let slug;try{slug=decodeURIComponent(direct[1]);}catch{throw fail('Perfil inválido.');}const entry=entries.find(e=>e.slug===slug);if(!entry?.managed)return json({managed:false});if(!entry.profile)return json({error:'Perfil não encontrado.'},404);return json({...entry,profile:publicPilotRadar(entry.profile)});}
  const slugMatch=/^\/api\/v1\/public\/(?:diretorio\/terreiro|terreiros)\/([^/]+)(?:\/(?:publicacoes|servicos))?$/.exec(url.pathname);
  const slug=slugMatch?decodeURIComponent(slugMatch[1]):null,entry=entries.find(e=>e.slug===slug);
  if(entry?.managed&&!entry.profile)return json({error:'Perfil não encontrado.'},404);
  if(entry?.managed&&!/\/(publicacoes|servicos)$/.test(url.pathname))return json(pilotRadarDirectory(entry.profile,{slug:entry.slug,id:entry.id}));
  const photoMatch=/^\/api\/v1\/public\/diretorio\/(?:foto\/([^/]+)|terreiro\/([^/]+)\/foto)$/.exec(url.pathname);
  const photoEntry=photoMatch?entries.find(e=>e.slug===decodeURIComponent(photoMatch[1]||photoMatch[2])):null;
  if(photoEntry?.managed){const source=photoEntry.profile?.portrait?.source;return source?new Response(null,{status:302,headers:{Location:source,'Cache-Control':'private, no-store'}}):json({error:'Imagem não encontrada.'},404);}
  const upstream=await env.API.fetch(new Request(request,{method:'GET',headers:new Headers([...request.headers].filter(([key])=>!['if-none-match','if-modified-since','authorization','cookie'].includes(key.toLowerCase())))}));
  if(!upstream.ok){const listing=upstream.status===404?includePilotRadarListing(null,entries,url):null;return listing?json(listing):json({error:'Perfil público indisponível.'},upstream.status);}
  if(!upstream.headers.get('content-type')?.includes('application/json'))return upstream;
  const body=await upstream.json(),projected=includePilotRadarListing(projectPilotRadarPayload(body,entries,{map:url.pathname.endsWith('/mapa')}),entries,url);
  return projected===null?json({error:'Perfil não encontrado.'},404):json(projected);
 }catch(error){return json({error:error?.status?error.message:'Perfil público temporariamente indisponível.'},error?.status||503);}
}
const escapeHtml=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function pilotRadarSafeHead(entry){
 const p=publicPilotRadar(entry.profile);if(!p)return '';
 const title=escapeHtml(p.publicName+' | AxéCloud'),description=escapeHtml(p.description);
 const schema={'@context':'https://schema.org','@type':'Place',name:p.publicName,url:'https://axecloud.com.br/terreiro/'+encodeURIComponent(entry.slug),description:p.description,address:{'@type':'PostalAddress',addressLocality:p.city,addressRegion:p.uf,...(p.showAddress?{streetAddress:pilotRadarDirectory(p,{slug:entry.slug}).endereco}:{})}};
 return `<title>${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`;
}
// Mount on the marketing HTML response as well: old prerendered HTML can contain
// an address before React runs, even when every JSON response is already safe.
export async function protectPilotRadarPublicHtml(request,response,env,fetcher=fetch,Rewriter=globalThis.HTMLRewriter){
 const match=/^\/terreiro\/([^/]+)\/?$/.exec(new URL(request.url).pathname);
 if(!match||!['GET','HEAD'].includes(request.method))return response;
 try{
  const db=await connection(env,fetcher),entries=await db.rpc('piloto_radar_publicos',{}),slug=decodeURIComponent(match[1]);
  if(!Array.isArray(entries))throw fail('Perfil público indisponível.',503);
  const entry=entries.find(e=>e.slug===slug);if(!entry?.managed)return response;
  if(!entry.profile)return json({error:'Perfil não encontrado.'},404);
  if(!Rewriter||!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw fail('Perfil público temporariamente indisponível.',503);
  const headers=new Headers(response.headers);for(const key of ['etag','last-modified','content-length'])headers.delete(key);headers.set('Cache-Control','private, no-store');
  const html=new Rewriter().on('#axecloud-seo-static, noscript, script[type="application/ld+json"], title, meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:description"], meta[name="twitter:title"]',{element:e=>e.remove()})
   .on('#root',{element:e=>e.setInnerContent('')}).on('head',{element:e=>e.append(pilotRadarSafeHead(entry),{html:true})});
  return html.transform(new Response(response.body,{status:response.status,headers}));
 }catch{return json({error:'Perfil público temporariamente indisponível.'},503);}
}
