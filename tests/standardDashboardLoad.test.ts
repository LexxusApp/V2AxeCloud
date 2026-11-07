import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStandardDashboardCore, mergeStandardDashboard } from '../src/lib/standardDashboardLoad';
const scope={tenantId:'tenant-a',userId:'user-a',userRole:'admin'};
test('one core request supplies all four main resources',async()=>{
  const urls:string[]=[];
  const result=await loadStandardDashboardCore(scope,async url=>{
    urls.push(url); return Response.json({schemaVersion:1,resources:Object.fromEntries(
      ['children','transactions','events','notices'].map(key=>[key,{data:[{id:key}]}]))});
  });
  assert.deepEqual(urls,['/api/v1/dashboard/core?tenantId=tenant-a']);
  assert.equal(result?.transactions.data?.[0].id,'transactions');
});
test('only missing backend routes permit compatibility fallback',async()=>{
  for(const status of [404,405,501]) assert.equal(await loadStandardDashboardCore(scope,async()=>new Response('',{status})),null);
  for(const status of [401,403,429,500]) await assert.rejects(loadStandardDashboardCore(scope,async()=>new Response('',{status})));
});
test('a failed core resource cannot display false empty financial totals',async()=>{
  await assert.rejects(loadStandardDashboardCore(scope,async()=>Response.json({schemaVersion:1,resources:{
    children:{data:[]},transactions:{error:'failed'},events:{data:[]},notices:{data:[]},
  }})));
});
test('late supplementary data preserves financial, member and calendar indicators',()=>{
  const core={transactions:[{valor:42}],allChildren:[{id:1}],nextEvent:{id:2},historyData:[{data:'2026-10-26'}],
    pedidosData:[],pixConfig:null,profileSetup:null,radarSummary:null,
    attention:{obligationsPending:3,lowStock:0,outOfStock:0,whatsappFailed:0}};
  assert.equal(mergeStandardDashboard(core),core);
  const extra={...core,transactions:[],allChildren:[],nextEvent:null,historyData:[{data:'2026-10-25'}],
    attention:{obligationsPending:0,lowStock:2,outOfStock:1,whatsappFailed:4}};
  const result=mergeStandardDashboard(core,extra as typeof core);
  assert.equal(result.transactions,core.transactions); assert.equal(result.allChildren,core.allChildren);
  assert.equal(result.nextEvent,core.nextEvent); assert.equal(result.attention.obligationsPending,3);
  assert.equal(result.attention.whatsappFailed,4); assert.equal(result.historyData.length,2);
});
