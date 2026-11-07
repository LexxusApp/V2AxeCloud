import {operationPending,type Activity} from './operations';
type Store={snapshot:()=>Activity[];subscribe:(listener:()=>void)=>()=>void;dismiss:(id:string)=>void};
export const activityCanAutoClose=(row:Activity)=>row.state==='done'&&!operationPending(row)&&row.files.every(file=>file.phase==='done');
export const announceBackgroundDispatch=(status:string)=>status==='failed';
/** Only the transient success card expires. Pending work/failures and the
 * persisted business record/history are never cleared by this controller. */
export function createActivityAutoDismiss(store:Store,options:{delay?:number;setTimer?:(fn:()=>void,ms:number)=>unknown;clearTimer?:(id:unknown)=>void}={}){
 const schedule=options.setTimer||((fn,ms)=>setTimeout(fn,ms)),clear=options.clearTimer||(id=>clearTimeout(id as ReturnType<typeof setTimeout>)),timers=new Map<string,unknown>();
 let paused=false,stopped=false;
 const cancel=(id:string)=>{if(timers.has(id)){clear(timers.get(id));timers.delete(id);}};
 const sync=()=>{
  const rows=store.snapshot();
  for(const id of timers.keys())if(paused||!rows.some(row=>row.id===id&&activityCanAutoClose(row)))cancel(id);
  if(paused||stopped)return;
  for(const row of rows)if(activityCanAutoClose(row)&&!timers.has(row.id))timers.set(row.id,schedule(()=>{timers.delete(row.id);const latest=store.snapshot().find(item=>item.id===row.id);if(!paused&&!stopped&&latest&&activityCanAutoClose(latest))store.dismiss(row.id);},options.delay??3000));
 };
 const unsubscribe=store.subscribe(sync);sync();
 return {setPaused(value:boolean){if(paused===value)return;paused=value;sync();},stop(){stopped=true;unsubscribe();for(const id of timers.keys())cancel(id);}};
}
