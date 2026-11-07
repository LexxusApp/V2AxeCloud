import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { resolveDashboardReadScope, readDashboardCore } from '../api/lib/dashboardCore.ts';
import { registerDashboardCoreRoutes } from '../api/lib/dashboardCoreRoutes.ts';
import { assertUserCanAccessTenant, assertZeladorOrGlobalAdmin } from '../api/lib/tenantAccess.ts';
import { clearConsoleAdminCache } from '../api/lib/consoleAdmin.ts';
import { fetchDashboardCore, canUseLegacyDashboard, DashboardCoreError } from '../src/lib/dashboardCoreClient.ts';
import { isDashboardCoreResponse } from '../lib/dashboardCoreContract.ts';

const owner='11111111-1111-4111-8111-111111111111';
const tenant='22222222-2222-4222-8222-222222222222';
const foreign='33333333-3333-4333-8333-333333333333';
const childId='44444444-4444-4444-8444-444444444444';
const childUser='55555555-5555-4555-8555-555555555555';
const user={id:owner,email:'owner@example.test'};

function fakeDatabase(tables: Record<string, any[]>, options: { failures?: string[]; users?: Record<string, any> } = {}) {
  const calls: Array<{table:string;ops:any[]}> = [];
  const writes: unknown[]=[];
  const sb:any={
    auth:{getUser:async(token:string)=>({data:{user:token==='valid'?user:null},error:token==='valid'?null:new Error('invalid')}),admin:{getUserById:async(id:string)=>({data:{user:options.users?.[id]}})}},
    from(table:string){
      const call={table,ops:[] as any[]};calls.push(call);
      const ops=call.ops;
      const query:any={};
      for(const method of ['select','eq','neq','or','order','limit','ilike'])query[method]=(...args:any[])=>{ops.push([method,...args]);return query;};
      query.update=(value:unknown)=>{writes.push(value);return query;};
      const run=()=>{
        if(options.failures?.includes(table))return {data:null,error:new Error('DB unavailable')};
        let rows=[...(tables[table]||[])];
        for(const [method,...args] of ops){
          if(method==='eq')rows=rows.filter(r=>r[args[0]]===args[1]);
          if(method==='neq')rows=rows.filter(r=>r[args[0]]!=null&&r[args[0]]!==args[1]);
          if(method==='or')rows=rows.filter(r=>args[0].split(',').some((clause:string)=>{const [field,operator,...value]=clause.split('.');return operator==='eq'&&String(r[field])===value.join('.');}));
          if(method==='ilike')rows=rows.filter(r=>String(r[args[0]]).toLowerCase().startsWith(String(args[1]).replace(/%$/,'').toLowerCase()));
          if(method==='order')rows.sort((a,b)=>String(a[args[0]]||'').localeCompare(String(b[args[0]]||''))*(args[1]?.ascending===false?-1:1));
          if(method==='limit')rows=rows.slice(0,args[0]);
        }
        return {data:rows,error:null};
      };
      query.maybeSingle=async()=>{const r=run();return r.error?r:r.data.length>1?{data:null,error:new Error('multiple')}:{data:r.data[0]||null,error:null};};
      query.then=(resolve:any,reject:any)=>Promise.resolve().then(run).then(resolve,reject);
      return query;
    },
  };
  return {sb,calls,writes};
}

test('novo escopo conserva a interseção das permissões atuais em identidades e aliases', async () => {
  const previous = process.env.ADMIN_CONSOLE_EMAILS;
  const previousFallback = process.env.ADMIN_EMAILS;
  process.env.ADMIN_CONSOLE_EMAILS='';process.env.ADMIN_EMAILS='';
  const cases=[
    {name:'tenant canônico',who:user,requested:tenant,profiles:[{id:owner,tenant_id:tenant}],children:[]},
    {name:'alias do líder',who:user,requested:owner,profiles:[{id:owner,tenant_id:tenant}],children:[]},
    {name:'outro tenant',who:user,requested:foreign,profiles:[{id:owner,tenant_id:tenant},{id:foreign,tenant_id:foreign}],children:[]},
    {name:'filho sem perfil gestor',who:{id:childUser,email:'child@example.test'},requested:tenant,profiles:[{id:owner,tenant_id:tenant}],children:[{id:childId,user_id:childUser,lider_id:owner,tenant_id:tenant}]},
    {name:'gestor também é membro da casa',who:user,requested:tenant,profiles:[{id:owner,tenant_id:tenant}],children:[{id:childId,user_id:owner,lider_id:owner,tenant_id:tenant}]},
    {name:'perfil fantasma não supera vínculo de filho',who:{id:childUser,email:'child@example.test'},requested:foreign,profiles:[{id:owner,tenant_id:tenant},{id:childUser,tenant_id:foreign}],children:[{id:childId,user_id:childUser,lider_id:owner,tenant_id:tenant}]},
    {name:'compatibilidade do próprio auth ID',who:{id:childUser,email:'child@example.test'},requested:childUser,profiles:[{id:owner,tenant_id:tenant},{id:childUser,tenant_id:childUser}],children:[{id:childId,user_id:childUser,lider_id:owner,tenant_id:tenant}]},
    {name:'e-mail real encontra vínculo',who:user,requested:foreign,profiles:[{id:owner,tenant_id:foreign}],children:[{id:childId,email:user.email,lider_id:tenant,tenant_id:tenant}]},
    {name:'identidade sombra',who:{id:childUser,email:`f_${childId}@axecloud.internal`},requested:foreign,profiles:[{id:childUser,tenant_id:foreign}],children:[{id:childId,lider_id:owner,tenant_id:tenant}]},
    {name:'admin global',who:user,requested:foreign,profiles:[{id:owner,tenant_id:tenant,is_admin_global:true},{id:foreign,tenant_id:foreign}],children:[]},
    {name:'sem perfil',who:user,requested:tenant,profiles:[],children:[]},
  ];
  try {
    for(const scenario of cases){
      clearConsoleAdminCache();
      const old=fakeDatabase({perfil_lider:scenario.profiles,filhos_de_santo:scenario.children});
      const expected=await assertUserCanAccessTenant(old.sb,scenario.who,scenario.requested)
        && await assertZeladorOrGlobalAdmin(old.sb,scenario.who,scenario.requested);
      clearConsoleAdminCache();
      const current=fakeDatabase({perfil_lider:scenario.profiles,filhos_de_santo:scenario.children});
      const actual=await resolveDashboardReadScope(current.sb,scenario.who,scenario.requested);
      assert.equal(Boolean(actual),expected,scenario.name);
      assert.equal(current.writes.length,0,scenario.name);
    }
  } finally {
    if(previous===undefined)delete process.env.ADMIN_CONSOLE_EMAILS;else process.env.ADMIN_CONSOLE_EMAILS=previous;
    if(previousFallback===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previousFallback;
    clearConsoleAdminCache();
  }
});

test('tenant inválido é negado antes de consultar dados', async () => {
  const db=fakeDatabase({});
  assert.equal(await resolveDashboardReadScope(db.sb,user,'tenant.eq.other'),null);
  assert.equal(db.calls.length,0);
});

test('leitura central mantém escopo, ordenação, limite e excluídos; não faz escritas', async () => {
  const db=fakeDatabase({
    filhos_de_santo:[{id:'a',nome:'Z',tenant_id:tenant},{id:'b',nome:'A',lider_id:tenant},{id:'private',tenant_id:foreign}],
    financeiro:[{id:'paid',tenant_id:tenant,status:'pago',data:'2026-10-01'},{id:'deleted',tenant_id:tenant,status:'excluido'},{id:'private',tenant_id:foreign}],
    calendario_axe:[{id:'gira',lider_id:owner,tipo:'Gira',data:'2026-10-01'},{id:'obrigacao',tenant_id:tenant,tipo:'Obrigação'},{id:'private',tenant_id:foreign,tipo:'Gira'}],
    mural_avisos:[{id:'notice',tenant_id:owner},{id:'private',tenant_id:foreign}],
  });
  const data=await readDashboardCore(db.sb,{tenantId:tenant,leaderId:owner});
  assert.equal(isDashboardCoreResponse(data),true);
  assert.deepEqual(data.resources.children.data?.map(r=>r.id),['b','a']);
  assert.deepEqual(data.resources.transactions.data?.map(r=>r.id),['paid']);
  assert.deepEqual(data.resources.events.data?.map(r=>r.id),['gira']);
  assert.deepEqual(data.resources.notices.data?.map(r=>r.id),['notice']);
  assert.ok(db.calls.find(c=>c.table==='financeiro')?.ops.some(op=>op[0]==='limit'&&op[1]===400));
  assert.equal(db.writes.length,0);
});

test('uma consulta com falha não transforma os demais resultados em erro ou falso zero', async () => {
  const db=fakeDatabase({filhos_de_santo:[{id:'child',tenant_id:tenant}]},{failures:['financeiro']});
  const data=await readDashboardCore(db.sb,{tenantId:tenant,leaderId:owner});
  assert.equal(data.resources.children.data?.length,1);
  assert.equal(data.resources.transactions.data,undefined);
  assert.ok(data.resources.transactions.error);
  assert.deepEqual(data.resources.notices.data,[]);
  assert.equal(isDashboardCoreResponse(data),true);
});

test('fallback só cobre backend anterior: nunca ignora 401, 403 ou contrato inválido', async () => {
  for(const status of [401,403,500,503])assert.equal(canUseLegacyDashboard(new DashboardCoreError(status)),false);
  for(const status of [404,405,501])assert.equal(canUseLegacyDashboard(new DashboardCoreError(status)),true);
  await assert.rejects(fetchDashboardCore({tenantId:tenant,userId:owner,userRole:'admin'},async()=>Response.json({data:[]})),/inválida/);
  assert.equal(canUseLegacyDashboard(new Error('bad payload')),false);
  assert.equal(isDashboardCoreResponse({schemaVersion:1,resources:{}}),false);
});

test('rota exige JWT, nega outro tenant e ignora userId/papel declarados na query', async () => {
  clearConsoleAdminCache();
  const db=fakeDatabase({perfil_lider:[{id:owner,tenant_id:tenant}],filhos_de_santo:[],financeiro:[],calendario_axe:[],mural_avisos:[]});
  const app=express();registerDashboardCoreRoutes(app,db.sb);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/dashboard/core`;
  try {
    const denied=await fetch(`${base}?tenantId=${tenant}`);
    assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'private, no-store');
    const headers={Authorization:'Bearer valid'};
    assert.equal((await fetch(`${base}?tenantId=${foreign}`,{headers})).status,403);
    const allowed=await fetch(`${base}?tenantId=${tenant}&userId=${foreign}&userRole=global-admin`,{headers});
    assert.equal(allowed.status,200);assert.equal(isDashboardCoreResponse(await allowed.json()),true);
    assert.match(allowed.headers.get('server-timing')||'',/access;dur=/);
    assert.equal(db.writes.length,0);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));clearConsoleAdminCache();}
});
