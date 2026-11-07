import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePilotRadar,handlePilotRadarPublic,projectPilotRadarPayload} from '../cloudflare/pilot-radar.js';
import {normalizePilotRadar,publicPilotRadar,pilotRadarDirectory,legacyPilotRadarLocation,pilotRadarAddress} from '../cloudflare/pilot-radar-contract.js';
import {PILOT_TENANT,PILOT_EMAIL} from '../cloudflare/pilot-interface-policy.js';
import {radarFixture} from './pilotRadar.fixture';
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function fixture(actor=PILOT_TENANT){
 const calls:any[]=[];let revision=0,profile:any=null,manifest:any[]=[],rpcFailure:any=null,upstream:any={};
 const env={API:{fetch:async(req:Request)=>{calls.push({api:new URL(req.url).pathname});return new URL(req.url).pathname==='/api/public-config'?json({supabaseUrl:'https://radar.invalid',supabaseAnonKey:'public-mock'}):json(upstream);}}};
 const fetcher=async(input:any,init:any)=>{const path=new URL(String(input)).pathname;const body=init.body?JSON.parse(init.body):null;calls.push({path,body});if(path==='/auth/v1/user')return json({id:actor,email:PILOT_EMAIL});if(rpcFailure)return json(rpcFailure,400);if(path.endsWith('piloto_radar_publicos'))return json(manifest);if(path.endsWith('piloto_radar_ler'))return json({profile,revision});if(path.endsWith('piloto_radar_salvar')){if(body.p_revision!==revision)return json({code:'23505'},409);profile=body.p_profile;return json({profile,revision:++revision});}throw Error('Unexpected request');};
 const request=(method='PUT',body:any={revision:0,profile:radarFixture()})=>new Request('https://axecloud.com.br/api/pilot/radar',{method,headers:{Authorization:'Bearer mock-session',Origin:'https://axecloud.com.br','Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 return {calls,request,run:(r:Request)=>handlePilotRadar(r,env,fetcher),public:(path:string)=>handlePilotRadarPublic(new Request('https://axecloud.com.br'+path),env,fetcher),setManifest:(v:any[])=>manifest=v,setUpstream:(v:any)=>upstream=v,fail:(v:any)=>rpcFailure=v};
}
test('Radar saves and reloads every structured field without touching shared writers or internal gallery',async()=>{
 const f=fixture(),p=radarFixture();const saved=await f.run(f.request());assert.equal(saved!.status,200);const body=await saved!.json();assert.equal(body.revision,1);assert.deepEqual(body.profile,normalizePilotRadar(p));
 assert.deepEqual((await (await f.run(f.request('GET')))!.json()).profile,body.profile);
 assert.equal(f.calls.filter(c=>c.path?.endsWith('piloto_radar_salvar')).length,1);assert.equal(f.calls.some(c=>c.api&&c.api!=='/api/public-config'),false);
 assert.equal((await f.run(f.request()))!.status,409);assert.equal(saved!.headers.get('Cache-Control'),'private, no-store');
});
test('Radar rejects unsigned, member, other house, foreign origin and malformed payload before any write',async()=>{
 const f=fixture();assert.equal((await f.run(new Request('https://axecloud.com.br/api/pilot/radar')))!.status,401);assert.equal(f.calls.length,0);
 for(const actor of ['ab2eef13-604c-4c8f-9d14-f3da41cc5a81','00000000-0000-0000-0000-000000000001']){const member=fixture(actor);assert.equal((await member.run(member.request()))!.status,403);assert.equal(member.calls.some(c=>c.path?.endsWith('piloto_radar_salvar')),false);}
 const origin=f.request();origin.headers.set('Origin','https://other.invalid');assert.equal((await f.run(origin))!.status,403);
 const tenant=f.request();assert.equal((await f.run(new Request(tenant.url+'?tenantId=other',tenant)))!.status,403);
 assert.equal((await f.run(f.request('PUT',{revision:-1,profile:radarFixture()})))!.status,400);
 const huge=f.request('PUT',{data:'x'.repeat(51000)});assert.equal((await f.run(huge))!.status,413);
 const invalid=f.request();invalid.headers.delete('Content-Length');const p=radarFixture();p.socials[0].url='https://instagram.com.evil.invalid/';assert.equal((await f.run(f.request('PUT',{revision:0,profile:p})))!.status,400);
 assert.equal(f.calls.some(c=>c.path?.endsWith('piloto_radar_salvar')),false);
});
test('contract preserves empty coordinates and rejects malformed schedules, media and social links',()=>{
 const p=radarFixture();p.latitude='';p.longitude='';assert.equal(normalizePilotRadar(p).latitude,'');p.latitude='0';assert.throws(()=>normalizePilotRadar(p));
 for(const url of ['javascript:alert(1)','https://user:pass@instagram.com/casa','https://instagram.com.evil.invalid/casa'])assert.throws(()=>normalizePilotRadar({...radarFixture(),socials:[{id:'ig',network:'instagram',url}]}));
 assert.throws(()=>normalizePilotRadar({...radarFixture(),gallery:Array(7).fill(radarFixture().gallery[0])}));
 assert.throws(()=>normalizePilotRadar({...radarFixture(),schedules:[{...radarFixture().schedules[0],end:'25:00'}]}));
 assert.throws(()=>normalizePilotRadar({...radarFixture(),cover:{...radarFixture().cover,source:'blob:local'}}));
 const out=normalizePilotRadar({...radarFixture(),posts:[{text:'private'}],internalGallery:['private'],unexpected:'private'});assert.equal('posts' in out,false);assert.equal('internalGallery' in out,false);
});
test('hiding address removes location from public JSON, legacy lists, export, neighborhoods and packed map',async()=>{
 const p={...radarFixture(),showAddress:false};const projected=publicPilotRadar(p)!;
 for(const key of ['address','number','noNumber','complement','neighborhood','cep','mapsUrl','latitude','longitude'])assert.equal(key in projected,false,key);
 assert.equal(projected.schedules.length,1);
 const entries=[{id:'pilot-id',slug:'casa',managed:true,profile:projected}];const old={slug:'casa',endereco:'DO NOT LEAK',latitude:-23.5,longitude:-46.6,bairro:'Bairro reservado',extraSecret:'DO NOT LEAK',galleryPhotoUrls:['INTERNAL']};
 const f=fixture();f.setManifest(entries);f.setUpstream({items:[old,{slug:'other',nome:'Unchanged'}],bairros:[{nome:'Bairro reservado',items:[old]}]});
 for(const path of ['/api/v1/public/diretorio/export','/api/v1/public/diretorio/sp/sao-paulo','/api/v1/public/terreiros','/api/v1/public/diretorio/terreiro/casa','/api/v1/public/terreiros/casa','/api/pilot/radar/public/casa']){
  const response=await f.public(path);assert.equal(response!.status,200,path);const text=await response!.text();for(const secret of ['DO NOT LEAK','Bairro reservado','-23.5','-46.6','01001','INTERNAL'])assert.equal(text.includes(secret),false,path+' '+secret);
 }
 const payload=projectPilotRadarPayload({items:[old,{slug:'other',nome:'Unchanged'}]},entries);assert.deepEqual(payload.items[1],{slug:'other',nome:'Unchanged'});assert.equal('latitude' in payload.items[0],false);
 const map={s:['casa','other'],n:['Casa','Outra'],a:[-2350000,100],o:[-4660000,200],c:[0,1],e:[0,1],r:[1,0],m:[1,0],i:['ig',''],t:{listed:2,exact:2}};
 const filtered=projectPilotRadarPayload(map,entries,{map:true});assert.deepEqual(filtered.s,['other']);assert.deepEqual(filtered.a,[100]);assert.equal(filtered.t.exact,1);
});
test('unpublished profile disappears from aliases, posts and services; lookup failure closes public response',async()=>{
 const f=fixture();f.setManifest([{id:'pilot',slug:'casa',managed:true,profile:null}]);
 for(const path of ['/api/v1/public/diretorio/terreiro/casa','/api/v1/public/terreiros/casa','/api/v1/public/diretorio/terreiro/casa/publicacoes','/api/v1/public/diretorio/terreiro/casa/servicos','/api/pilot/radar/public/casa','/api/v1/public/diretorio/foto/casa'])assert.equal((await f.public(path))!.status,404,path);
 assert.equal(f.calls.some(c=>c.api&&c.api!=='/api/public-config'),false);
 f.fail({code:'unavailable'});assert.equal((await f.public('/api/v1/public/diretorio/export'))!.status,503);
});
test('legacy address imports separate the number, complement and CEP; repeated save does not duplicate them',()=>{
 const location=legacyPilotRadarLocation({endereco:'Rua de teste, 123, Sala 2, Bairro reservado, São Paulo - SP, CEP 01001-000',bairro:'Bairro reservado',cidade:'São Paulo',estado:'SP'});
 assert.deepEqual(location,{address:'Rua de teste',number:'123',noNumber:false,complement:'Sala 2',cep:'01001-000'});
 const p={...radarFixture(),...location};assert.equal(pilotRadarAddress(p),'Rua de teste, 123, Sala 2, Bairro reservado, São Paulo · SP, CEP 01001-000');
 const first=pilotRadarDirectory(p,{slug:'casa'});const second=pilotRadarDirectory(normalizePilotRadar(p),{slug:'casa'});assert.equal(first!.endereco,second!.endereco);assert.equal(second!.endereco.match(/123/g)?.length,1);
});
