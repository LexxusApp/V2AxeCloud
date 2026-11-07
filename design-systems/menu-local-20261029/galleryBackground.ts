import type {GalleryCategory,GalleryMedia,LocalGallery} from './gallery';
export type GalleryUploadChoice=Omit<GalleryMedia,'albumId'|'created'|'liked'>;
export type GalleryEditor={kind:'new'|'edit'|'add';id:string;name:string;category:GalleryCategory;description:string};
export type GalleryUploadDraft={editor:GalleryEditor;uploads:GalleryUploadChoice[];created:string};
export type GallerySave={draft:GalleryUploadDraft;phase:'working'|'failed';message:string};

/** File objects belong to the save, never to the lifetime of the modal/page. */
export function createGallerySaveStore(){
 const saves=new Map<string,GallerySave>(),listeners=new Set<()=>void>();
 const notify=()=>listeners.forEach(listener=>listener());
 return {
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  snapshot:(scope:string)=>saves.get(scope),
  discard(scope:string){if(saves.get(scope)?.phase==='working')return;saves.delete(scope);notify();},
  start(scope:string,draft:GalleryUploadDraft,write:()=>void|Promise<void>):Promise<boolean>|null{
   if(saves.get(scope)?.phase==='working')return null;
   const save:GallerySave={draft:{editor:{...draft.editor},uploads:[...draft.uploads],created:draft.created},phase:'working',message:''};
   saves.set(scope,save);notify();
   return (async()=>{
    try{await write();if(saves.get(scope)===save){saves.delete(scope);notify();}return true;}
    catch(error){if(saves.get(scope)===save){saves.set(scope,{...save,phase:'failed',message:error instanceof Error?error.message:'O envio não foi confirmado. Retome a seleção para tentar novamente.'});notify();}return false;}
   })();
  },
 };
}
export const gallerySaves=createGallerySaveStore();

/** Merge a recovered draft with current data without duplicating its album. */
export function gallerySubmission(state:LocalGallery,draft:GalleryUploadDraft):LocalGallery{
 const {editor,uploads,created}=draft;
 const media=uploads.map(row=>({...row,albumId:editor.id,created,liked:false}));
 const previous=state.albums.find(row=>row.id===editor.id);
 const album={id:editor.id,name:editor.name.trim(),description:editor.description.trim(),category:editor.category,coverId:previous?.coverId||media[0]?.id||'',created:previous?.created||created};
 return {
  albums:editor.kind==='add'?state.albums:previous?state.albums.map(row=>row.id===editor.id?{...row,...album}:row):[...state.albums,album],
  media:[...state.media,...media.filter(row=>!state.media.some(saved=>saved.id===row.id))],
 };
}
