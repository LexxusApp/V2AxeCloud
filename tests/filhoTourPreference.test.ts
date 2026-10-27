import test from 'node:test';
import assert from 'node:assert/strict';
import { createFilhoTourPreference, FILHO_TOUR_PREF_PREFIX } from '../src/lib/filhoTourPreference.ts';
import { collectClientUiPrefsFromStorage, restoreClientUiPrefsToStorage } from '../src/lib/notificationPrefs.ts';
class MemoryStorage {
  values = new Map<string,string>(); get length(){return this.values.size;} key(i:number){return [...this.values.keys()][i]??null;}
  getItem(k:string){return this.values.get(k)??null;} setItem(k:string,v:string){this.values.set(k,v);} clear(){this.values.clear();}
}
function account() {
 const seen=new Set<string>();let offline=false;
 const remote=(id:string)=>({read:async()=>{if(offline)throw Error('offline');return seen.has(id);},markSeen:async()=>{if(offline)throw Error('offline');seen.add(id);}});
 return {seen,remote,offline:(value:boolean)=>{offline=value;}};
}
test('primeira apresentação fica salva na conta; nova janela privada não reinicia o tutorial',async()=>{
 const a=account();const first=createFilhoTourPreference('a',new MemoryStorage(),a.remote('a'));
 assert.equal(await first.refresh(),false);first.markSeen();await first.sync();
 const newPrivateWindow=createFilhoTourPreference('a',new MemoryStorage(),a.remote('a'));
 assert.equal(await newPrivateWindow.refresh(),true);
});
test('preferência sobrevive à limpeza de logout sem preservar tokens nem dados privados',async()=>{
 const a=account(),storage=new MemoryStorage();const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'window',{value:{},configurable:true});Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 try {
  const pref=createFilhoTourPreference('a',storage,a.remote('a'));pref.markSeen();await pref.sync();storage.setItem('sb-session','secret');storage.setItem('dados-financeiros','private');
  const saved=collectClientUiPrefsFromStorage();storage.clear();restoreClientUiPrefsToStorage(saved);
  assert.equal(storage.getItem(FILHO_TOUR_PREF_PREFIX+'a'),'1');assert.equal(storage.getItem('sb-session'),null);assert.equal(storage.getItem('dados-financeiros'),null);
  assert.equal(await createFilhoTourPreference('a',storage,a.remote('a')).refresh(),true);
 }finally{for(const [key,desc] of [['window',oldWindow],['localStorage',oldLocal]] as const){if(desc)Object.defineProperty(globalThis,key,desc);else Reflect.deleteProperty(globalThis,key);}}
});
test('outro membro no mesmo aparelho mantém seu próprio primeiro acesso',async()=>{
 const a=account(),storage=new MemoryStorage();const first=createFilhoTourPreference('a',storage,a.remote('a'));first.markSeen();await first.sync();
 assert.equal(await createFilhoTourPreference('b',storage,a.remote('b')).refresh(),false);
});
test('sem conexão não presume primeiro acesso; depois recupera a preferência da conta',async()=>{
 const a=account();a.seen.add('a');a.offline(true);const pref=createFilhoTourPreference('a',new MemoryStorage(),a.remote('a'));
 assert.equal(await pref.refresh(),null);a.offline(false);assert.equal(await pref.refresh(),true);
});
test('guia aberto sem conexão permanece visto e sincroniza ao reconectar',async()=>{
 const a=account(),storage=new MemoryStorage();a.offline(true);const pref=createFilhoTourPreference('a',storage,a.remote('a'));pref.markSeen();await pref.sync();assert.equal(await pref.refresh(),true);
 a.offline(false);await pref.sync();assert.equal(a.seen.has('a'),true);
});
test('armazenamento bloqueado usa a conta e resposta atrasada não desfaz a apresentação',async()=>{
 const a=account();const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 const pref=createFilhoTourPreference('a',blocked,a.remote('a'));pref.markSeen();await pref.sync();assert.equal(await createFilhoTourPreference('a',blocked,a.remote('a')).refresh(),true);
 let release:(v:boolean)=>void;const delayed=createFilhoTourPreference('b',blocked,{read:()=>new Promise(r=>{release=r;}),markSeen:async()=>{}});
 const pending=delayed.refresh();delayed.markSeen();release!(false);assert.equal(await pending,true);
});
