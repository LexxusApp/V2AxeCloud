import { test } from 'node:test';
import assert from 'node:assert/strict';
import { childrenReadKey, loadChildren, loadPendingPayments, rememberChildren, recentChildren, forgetChildren } from '../src/lib/childrenRead';
const scope={userId:'owner-a',tenantId:'house-a'};
const payload=(children:any,finance:any={data:[]})=>({schemaVersion:1,resources:{children,transactions:finance,events:{data:[]},notices:{data:[]}}});
test('fast read preserves all statuses and fields; another resource failure cannot hide members',async()=>{
  const rows=[{id:'a',status:'Ativo',email:'a@example.test'},{id:'p',status:'Pendente'},{id:'i',status:'Inativo'}];
  const calls:string[]=[];
  const result=await loadChildren(scope,async url=>{calls.push(url);return Response.json(payload({data:rows},{error:'unavailable'}));});
  assert.deepEqual(result,rows); assert.deepEqual(calls,['/api/v1/dashboard/core?tenantId=house-a']);
});
test('a children resource failure is not an empty list',async()=>{
  await assert.rejects(loadChildren(scope,async()=>Response.json(payload({error:'failed'}))));
});
test('fallback covers absent route only; forbidden/server failures never access legacy route',async()=>{
  for(const status of [401,403,429,500,503]){
    let calls=0;
    await assert.rejects(loadChildren(scope,async()=>{calls++;return new Response('',{status});}));
    assert.equal(calls,1);
  }
  for(const status of [404,405,501]){
    const urls:string[]=[];
    assert.deepEqual(await loadChildren(scope,async url=>{
      urls.push(url);return urls.length===1?new Response('',{status}):Response.json({data:[{id:'legacy'}]});
    }),[{id:'legacy'}]);
    assert.equal(urls[1],'/api/children?userId=owner-a&tenantId=house-a');
  }
});
test('recent dashboard rows are isolated by user/house, expire and invalidate after writes',()=>{
  rememberChildren(scope,[{id:'a'}]);
  assert.equal(recentChildren(scope)?.[0].id,'a');
  assert.equal(recentChildren({...scope,userId:'other'}),undefined);
  assert.equal(recentChildren({...scope,tenantId:'other'}),undefined);
  assert.notDeepEqual(childrenReadKey(scope),childrenReadKey({...scope,userId:'other'}));
  const now=Date.now;try {Date.now=()=>now()+10001;assert.equal(recentChildren(scope),undefined);}finally{Date.now=now;}
  rememberChildren(scope,[]);assert.deepEqual(recentChildren(scope),[]);
  forgetChildren(scope);assert.equal(recentChildren(scope),undefined);
  assert.equal(childrenReadKey(),null);
});
test('pending financial data preserves records and distinguishes failure from no pending payments',async()=>{
  assert.deepEqual(await loadPendingPayments(scope,async()=>Response.json({data:[]})),[]);
  const rows=[{filho_id:'a',status:'pendente'}];
  assert.deepEqual(await loadPendingPayments(scope,async()=>Response.json({data:rows})),rows);
  for(const status of [401,403,500])await assert.rejects(loadPendingPayments(scope,async()=>new Response('',{status})));
  await assert.rejects(loadPendingPayments(scope,async()=>Response.json({error:'failure'})));
});
