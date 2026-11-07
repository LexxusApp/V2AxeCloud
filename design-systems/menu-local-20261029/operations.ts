export type FilePhase = 'queued' | 'preparing' | 'uploading' | 'confirming' | 'done' | 'error';
export type FileActivity = { id: string; name: string; bytes: number; phase: FilePhase; progress?: number; message?: string };
export type DeliveryStatus = 'queued' | 'sending' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
export type Activity = { id: string; title: string; detail: string; state: 'working'|'done'|'error'; kind: 'change'|'upload'|'send'; started: number; files: FileActivity[]; delivery?: { externalId: string; status: DeliveryStatus }; result?: string; key?: string };
export const operationPending = (row: Activity) => row.state === 'working' || row.state!=='error'&&row.files.some(file=>!['done','error'].includes(file.phase)) || !!row.delivery && !['delivered','read','failed'].includes(row.delivery.status);
/** Detailed progress is useful for a batch of media or recipients. Ordinary
 * writes and single-file uploads intentionally use the compact status notice. */
export const activityUsesPanel = (row: Activity) => row.key === 'gallery' || row.kind === 'send';
export type Operation = {
  id: string;
  resource: (key: string) => void;
  sending: () => void;
  phase: (detail: string) => void;
  files: (files: { id: string; name: string; bytes: number }[]) => void;
  file: (id: string, patch: Partial<Omit<FileActivity,'id'>>) => void;
  progress: (id: string, loaded: number, total?: number) => void;
  sent: (externalId: string, status?: DeliveryStatus) => void;
  complete: (detail?: string) => void;
  fail: (error: unknown) => void;
};
export function createOperationStore() {
  let records: Activity[] = [], serial = 0;
  const listeners = new Set<() => void>(), handled = new WeakSet<object>();
  const notify = () => listeners.forEach(listener => listener());
  const update = (id: string, change: (row: Activity) => Activity) => { records = records.map(row => row.id === id ? change(row) : row); notify(); };
  const store = {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => records,
    handled(error: unknown) { return !!error && typeof error === 'object' && handled.has(error); },
    dismiss(id: string) { if (records.find(row => row.id === id)?.state === 'working') return; records = records.filter(row => row.id !== id); notify(); },
    clearFinished() { records = records.filter(operationPending); notify(); },
    begin(title: string, key?: string): Operation {
      const id = `activity-${++serial}`;
      // Limit completed history only; active operations can never be evicted.
      const retained = new Set(records.filter(row => !operationPending(row)).slice(-39).map(row => row.id));
      records = [...records.filter(row => operationPending(row) || retained.has(row.id)), { id, key, title, detail: 'Processando sua solicitação…', state: 'working', kind: 'change', started: Date.now(), files: [] }];
      notify();
      return {
        id,
        resource: key => update(id, row => ({...row,key})),
        sending: () => update(id,row=>({...row,kind:'send'})),
        phase: detail => update(id, row => ({ ...row, detail })),
        files: files => update(id, row => ({ ...row, kind: files.length ? 'upload' : row.kind, files: files.map(file => ({ ...file, phase: 'queued', progress: 0 })) })),
        file: (fileId, patch) => update(id, row => ({ ...row, files: row.files.map(file => file.id === fileId ? { ...file, ...patch } : file) })),
        progress: (fileId, loaded, total) => update(id, row => ({ ...row, files: row.files.map(file => file.id === fileId ? { ...file, phase: 'uploading', progress: total && total > 0 ? Math.max(0, Math.min(1, loaded / total)) : undefined } : file) })),
        sent: (externalId, status = 'sent') => update(id, row => ({ ...row, kind: 'send', delivery: { externalId, status }, result: 'Solicitação aceita pelo WhatsApp. A entrega ainda depende do destinatário.' })),
        complete: detail => update(id, row => ({ ...row, state: 'done', detail: detail || row.result || 'Alteração salva.' })),
        fail: error => { if (error && typeof error === 'object') handled.add(error); const detail=error instanceof Error ? error.message : 'A operação não foi confirmada. Confira os dados antes de tentar novamente.'; update(id, row => ({ ...row, state: 'error', detail, files:row.files.map(file=>['preparing','uploading','confirming'].includes(file.phase)?{...file,phase:'error',message:detail}:file) })); },
      };
    },
    delivery(externalId: string, status: DeliveryStatus) {
      const details:Record<DeliveryStatus,string>={failed:'O provedor registrou falha no envio. Consulte o histórico antes de reenviar.',read:'Leitura confirmada pelo WhatsApp.',delivered:'Entrega confirmada pelo WhatsApp.',sent:'Enviado ao WhatsApp. Aguardando confirmação de entrega.',accepted:'Solicitação aceita pelo WhatsApp. A entrega ainda não foi confirmada.',queued:'O serviço colocou o disparo na fila.',sending:'O serviço está enviando este disparo.',unknown:'O serviço ainda não disponibilizou a situação deste disparo.'};
      const detail=details[status];
      if(!records.some(row=>row.delivery?.externalId===externalId&&(row.delivery.status!==status||row.detail!==detail||status==='failed'&&row.state!=='error')))return;
      records = records.map(row => row.delivery?.externalId === externalId ? { ...row, state: status === 'failed' ? 'error' : row.state==='working' ? 'working' : 'done', delivery: { externalId, status }, detail } : row); notify();
    },
    externalIds() { return records.filter(row => row.delivery && !['failed','read'].includes(row.delivery.status)).map(row => row.delivery!.externalId); },
  };
  return store;
}
export const operations = createOperationStore();
let current: Operation | undefined;
export const currentOperation = () => current;
/** Scope exists only while starting the callback; async writers capture the handle explicitly. */
export function withOperation<T>(operation: Operation, run: () => T): T { const previous = current; current = operation; try { return run(); } finally { current = previous; } }
export function fileTransferPercent(files: FileActivity[]): number | undefined {
  if (!files.length || files.some(file => file.progress == null)) return undefined;
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  return total > 0 ? Math.round(files.reduce((sum, file) => sum + file.bytes * file.progress!, 0) / total * 100) : undefined;
}
export function isRemoteMutation(key: string, after: any, before: any): boolean {
  if (key === 'notifications') return false;
  if (key === 'account') return after.profile !== before.profile || after.whatsapp !== before.whatsapp;
  if (key === 'support') return after.tickets !== before.tickets;
  // Read markers are acknowledged silently by the inbox. Messages and uploads
  // still own visible send feedback; opening a thread must not open a drawer.
  if (key === 'inbox') return after.conversations.length!==before.conversations.length||after.conversations.some((row:any,index:number)=>{const old=before.conversations[index];return row.id!==old.id||row.messages!==old.messages||row.archived!==old.archived||row.title!==old.title;});
  if (key === 'shop') return after.orders !== before.orders || after.products !== before.products;
  if (key === 'cantina') {const persistent=(state:any)=>({sales:state.sales,products:state.products?.filter((row:any)=>!row.transient),receipts:state.receipts,preferences:state.preferences});return JSON.stringify(persistent(after))!==JSON.stringify(persistent(before));}
  return true;
}
