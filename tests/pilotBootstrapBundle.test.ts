import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {PILOT_TENANT} from '../cloudflare/pilot-interface-policy.js';
const OTHER_MANAGER_ID='11111111-1111-4111-8111-111111111111';

test('Worker-bundled pilot bootstrap runs in a fresh browser scope without external bundler helpers',async()=>{
 const bundle=await build({entryPoints:['cloudflare/pilot-bootstrap.js'],bundle:true,platform:'node',format:'cjs',keepNames:true,write:false});
 const module={exports:{} as any};runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports});
 const source=module.exports.pilotBootstrap([PILOT_TENANT]);assert.doesNotMatch(source,/\b__name\s*\(/);
 let calls=0,reloads=0,holding=false;const nodes=new Map<string,any>();
 const document={
   head:{append(){}},documentElement:{append(){holding=true;}},
   createElement(){return {style:{},remove(){holding=false;},querySelector(id:string){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:''});return nodes.get(id);}};},
 };

 runInNewContext(source,{document,localStorage:{getItem:()=>JSON.stringify({access_token:'test-only-fixture',user:{id:PILOT_TENANT}})},location:{pathname:'/dashboard',search:'',reload(){reloads++;}},window:{addEventListener(){}},URLSearchParams,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval(){},fetch:async()=>{calls++;assert.equal(holding,true);return Response.json({enabled:true});}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(reloads,1);
});

test('manager rollout bootstrap probes a non-pilot session but never selects it without server approval',async()=>{
 const bundle=await build({entryPoints:['cloudflare/pilot-bootstrap.js'],bundle:true,platform:'node',format:'cjs',keepNames:true,write:false});
 const module={exports:{} as any};runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports});
 const source=module.exports.pilotBootstrap([PILOT_TENANT],true);
 let calls=0,reloads=0,holding=false;const nodes=new Map<string,any>();
 const document={
  head:{append(){}},documentElement:{append(){holding=true;}},
  createElement(){return {style:{},remove(){holding=false;},querySelector(id:string){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:''});return nodes.get(id);}};},
 };
 const session=JSON.stringify({access_token:'other-manager-fixture',user:{id:OTHER_MANAGER_ID}});
 runInNewContext(source,{document,localStorage:{getItem:()=>session},location:{pathname:'/dashboard',search:'',reload(){reloads++;}},window:{addEventListener(){}},URLSearchParams,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval(){},fetch:async()=>{calls++;assert.equal(holding,true);return Response.json({enabled:false});}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);assert.equal(reloads,0);assert.equal(holding,false);
});
