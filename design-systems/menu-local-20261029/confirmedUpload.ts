/** Resume the same signed object. A confirmed transport or database step is never repeated. */
export async function confirmCachedUpload(task:{pushed:boolean;saved:boolean},transfer:()=>Promise<void>,confirm:()=>Promise<void>){
  if(!task.pushed){await transfer();task.pushed=true;}
  if(!task.saved){await confirm();task.saved=true;}
}
