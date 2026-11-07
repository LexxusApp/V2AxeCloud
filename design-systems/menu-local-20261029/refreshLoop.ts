type RefreshOptions = { available: () => boolean; refresh: () => Promise<void>; setTimer?: (callback:()=>void,delay:number)=>unknown; clearTimer?: (timer:unknown)=>void };
/** One read at a time. Visibility/offline changes stop scheduling; failures back off. */
export function createRefreshLoop(options: RefreshOptions) {
  let stopped=false,busy=false,timer:unknown;
  const schedule=options.setTimer||((callback,delay)=>setTimeout(callback,delay));
  const clear=options.clearTimer||(value=>clearTimeout(value as ReturnType<typeof setTimeout>));
  const run=async()=>{
    if(stopped||busy||!options.available())return;
    busy=true;let failed=false;
    try{await options.refresh();}catch{failed=true;}
    finally{busy=false;if(!stopped&&options.available())timer=schedule(()=>{void run();},failed?30000:8000);}
  };
  return { resume(){clear(timer);if(!stopped)void run();},stop(){stopped=true;clear(timer);} };
}
