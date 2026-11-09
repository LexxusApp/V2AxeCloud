import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarManagementContext,userCanModifyCalendarEvent} from '../api/lib/calendarAccess';
const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',child='33333333-3333-4333-8333-333333333333',event='44444444-4444-4444-8444-444444444444';
function fixture(){
 const grant={tenant_id:owner,user_id:member,filho_id:child,ativo:true,permissoes:{giras:'gerenciar'}};
 const tables:Record<string,any[]>={perfil_lider:[{id:owner,tenant_id:owner,role:'admin'}],filhos_de_santo:[{id:child,user_id:member,tenant_id:owner,lider_id:owner,status:'Ativo'}],subscriptions:[{id:owner,status:'active',plan:'premium',expires_at:'2099-01-01'}],piloto_coadministradores:[grant],calendario_axe:[{id:event,tenant_id:owner,lider_id:owner}]};
 const reads:any[]=[];const sb:any={auth:{admin:{getUserById:async()=>({data:{user:{id:member,email:'member@invalid.test'}}})}},from(table:string){let rows=tables[table]||[];const q:any={select:()=>q,eq:(key:string,value:any)=>{reads.push({table,key,value});rows=rows.filter(row=>row[key]===value);return q;},or:(value:string)=>{rows=rows.filter(row=>value.split(',').some(term=>{const [k,,v]=term.split('.');return row[k]===v;}));return q;},maybeSingle:async()=>({data:rows[0]||null,error:null}),then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};return q;}};
 return {sb,tables,grant,reads};
}
test('Giras uses the house subscription and live grant while the actor remains a member without an owner profile',async()=>{
 const f=fixture();const ctx=await calendarManagementContext(f.sb,{id:member,email:'member@invalid.test'});
 assert.equal('error' in ctx,false);assert.equal(ctx.tenantId,owner);
 assert.ok(f.reads.some(row=>row.table==='subscriptions'&&row.key==='id'&&row.value===owner));
 assert.equal(f.reads.some(row=>row.table==='subscriptions'&&row.value===member),false);
 assert.deepEqual(await userCanModifyCalendarEvent(f.sb,{id:member},event),{allowed:true,notFound:false});
});
test('calendar membership, read-only grants and revoked grants do not authorize event mutations',async()=>{
 const f=fixture();f.grant.permissoes.giras='visualizar';
 assert.equal((await userCanModifyCalendarEvent(f.sb,{id:member},event)).allowed,false);
 f.grant.ativo=false;assert.equal((await userCanModifyCalendarEvent(f.sb,{id:member},event)).allowed,false);
 f.tables.piloto_coadministradores=[];assert.equal((await userCanModifyCalendarEvent(f.sb,{id:member},event)).allowed,false);
});
