import test from 'node:test';
import assert from 'node:assert/strict';
import {createGallerySaveStore,gallerySubmission,type GalleryUploadDraft} from '../design-systems/menu-local-20261029/galleryBackground';
const empty={albums:[],media:[]};
function draft():GalleryUploadDraft{return {editor:{kind:'new',id:'album-local',name:' Encontro ',description:' Memória ',category:'gira'},created:'2026-11-02T12:00:00Z',uploads:[{id:'photo-local',source:new File(['photo'],'foto.jpg',{type:'image/jpeg'}),title:'Foto',caption:'',type:'image',fileName:'foto.jpg',bytes:5,illustrative:false}]};}
function deferred(){let resolve!:()=>void,reject!:(reason:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
test('upload outlives a page subscription and releases File references only after confirmation',async()=>{
 const saves=createGallerySaveStore(),upload=deferred(),selection=draft();let changes=0;const unsubscribe=saves.subscribe(()=>changes++);
 const pending=saves.start('house:user',selection,()=>upload.promise);assert.ok(pending);assert.equal(saves.snapshot('house:user')?.phase,'working');assert.equal(saves.snapshot('house:user')?.draft.uploads[0].source,selection.uploads[0].source);unsubscribe();const before=changes;upload.resolve();assert.equal(await pending,true);assert.equal(changes,before);assert.equal(saves.snapshot('house:user'),undefined);
});
test('failed selection is retained across navigation, scoped to its user, and recoverable without duplicate album',async()=>{
 const saves=createGallerySaveStore(),selection=draft();assert.equal(await saves.start('house:user',selection,async()=>{throw Error('1 arquivo pendente');}),false);assert.equal(saves.snapshot('other-house:user'),undefined);const restored=saves.snapshot('house:user')!;assert.equal(restored.phase,'failed');assert.match(restored.message,/pendente/);const partial=gallerySubmission(empty,restored.draft);const retry=gallerySubmission({...partial,albums:[...partial.albums,{...partial.albums[0],id:'other-album'}]},restored.draft);assert.equal(retry.albums.length,2);assert.equal(retry.media.length,1);assert.equal(retry.albums[0].name,'Encontro');assert.equal(await saves.start('house:user',restored.draft,async()=>{}),true);assert.equal(saves.snapshot('house:user'),undefined);
});
test('double submit cannot start another upload, and another page operation may complete independently',async()=>{
 const saves=createGallerySaveStore(),upload=deferred();let writes=0;const pending=saves.start('house:user',draft(),()=>{writes++;return upload.promise;});assert.equal(saves.start('house:user',draft(),()=>{writes++;}),null);saves.discard('house:user');assert.equal(saves.snapshot('house:user')?.phase,'working');const other=await Promise.resolve('Outra função concluída');assert.equal(other,'Outra função concluída');assert.equal(writes,1);assert.equal(saves.snapshot('house:user')?.phase,'working');upload.resolve();await pending;assert.equal(saves.snapshot('house:user'),undefined);
});
test('restoring an add-to-album selection preserves the album metadata and existing media',()=>{
 const selection=draft(),initial=gallerySubmission(empty,selection);const add={...selection,editor:{...selection.editor,kind:'add' as const,name:'não alterar'},uploads:[{...selection.uploads[0],id:'second',fileName:'segunda.jpg'}]};const next=gallerySubmission(initial,add);assert.deepEqual(next.albums,initial.albums);assert.equal(next.media.length,2);assert.equal(next.media[0].id,'photo-local');
});
