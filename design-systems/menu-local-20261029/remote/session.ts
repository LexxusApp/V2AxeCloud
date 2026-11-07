import { supabase } from '../../../src/lib/supabase';
import { authFetch } from '../../../src/lib/authenticatedFetch';
import type { StartupStage } from '../startup';
import { xhrUploadTransport, type UploadProgress } from '../uploadTransport';
import {endPilotSession} from '../../../lib/pilotLogout';
export type PreviewSession = { userId: string; email: string; tenantId: string; profile: Record<string, any> };
let current: PreviewSession | null = null;
let invalidated = false;
let generation = 0;
const sessionListeners = new Set<() => void>();
const reads = new Map<string, Promise<any>>();
let readRevision = 0;
let stopRenewal: (() => void) | undefined;
let authSubscription: { unsubscribe: () => void } | undefined;
let expectedAuthUser: string | undefined;
type Connection = { controller: AbortController; listeners: Set<(stage: StartupStage) => void>; users: number; promise: Promise<boolean> };
let connecting: Connection | undefined;
export function onPreviewSessionChange(listener: () => void) { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; }
function invalidate(destination: string) {
  invalidated = true;
  generation++;
  current = null;
  reads.clear();
  stopRenewal?.(); stopRenewal = undefined;
  authSubscription?.unsubscribe(); authSubscription = undefined;
  connecting?.controller.abort();
  sessionListeners.forEach(listener => listener());
  location.replace(destination);
}
function assertSession(scope: PreviewSession, version: number) {
  const active = previewSession();
  if (version !== generation || active.userId !== scope.userId || active.tenantId !== scope.tenantId) throw new Error('A conta ou a casa mudou durante a consulta. Entre novamente.');
}
export function previewSession(): PreviewSession {
  if (!current) throw new Error('Entre na sua conta para consultar esta casa.');
  return current;
}
export async function connectPreview(options: { signal?: AbortSignal; onStage?: (stage: StartupStage) => void } = {}): Promise<boolean> {
  options.signal?.throwIfAborted();
  if (invalidated) return Promise.resolve(false);
  if (!connecting) {
    const attempt: Connection = { controller: new AbortController(), listeners: new Set(), users: 0, promise: undefined! };
    connecting = attempt;
    attempt.promise = Promise.resolve().then(() => establishPreview({ signal: attempt.controller.signal, onStage: stage => attempt.listeners.forEach(listener => listener(stage)) })).finally(() => { if (connecting === attempt) connecting = undefined; });
  }
  const attempt = connecting;
  attempt.users++;
  if (options.onStage) attempt.listeners.add(options.onStage);
  return new Promise<boolean>((resolve, reject) => {
    let finished = false;
    const finish = (error?: unknown, result?: boolean) => {
      if (finished) return;
      finished = true;
      options.signal?.removeEventListener('abort', abort);
      if (options.onStage) attempt.listeners.delete(options.onStage);
      if (--attempt.users === 0 && connecting === attempt) { connecting = undefined; attempt.controller.abort(); }
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(options.signal?.reason || new Error('Conexão cancelada.'));
    options.signal?.addEventListener('abort', abort, { once: true });
    attempt.promise.then(result => finish(undefined, result), error => finish(error));
  });
}
async function establishPreview(options: { signal: AbortSignal; onStage: (stage: StartupStage) => void }): Promise<boolean> {
  options.signal.throwIfAborted();
  const version = generation;
  if (!authSubscription) authSubscription = supabase.auth.onAuthStateChange((event, next) => {
    const expectedUser = current?.userId || expectedAuthUser;
    if (event === 'SIGNED_OUT' || (next && expectedUser && next.user.id !== expectedUser)) invalidate('/entrar');
  })?.data?.subscription;
  options.signal?.throwIfAborted();
  options.onStage?.('session');
  const { data: { session }, error } = await supabase.auth.getSession();
  options.signal?.throwIfAborted();
  if (error) throw error;
  if (!session) { invalidate('/entrar'); return false; }
  expectedAuthUser = session.user.id;
  if (current && current.userId !== expectedAuthUser) { invalidate('/entrar'); return false; }
  let profile:Record<string,any>|undefined;
  if(!['localhost','127.0.0.1'].includes(location.hostname)){
    options.onStage?.('access');
    const access=await authFetch('/api/pilot/interface-access?space=manager',{method:'POST',cache:'no-store',signal:options.signal});
    if(access.status>=500)throw Error('O serviço de acesso está temporariamente indisponível. Tente novamente.');
    if(access.status===401){invalidate('/entrar');return false;}
    const pilot=await access.json();
    if(!access.ok||!pilot.enabled){invalidate('/dashboard?classic=1');return false;}
    profile=pilot.profile;
  }
  options.signal?.throwIfAborted();
  options.onStage?.('house');
  if(!profile){const response = await authFetch(`/api/tenant-info?userId=${encodeURIComponent(session.user.id)}&email=${encodeURIComponent(session.user.email || '')}`, { cache: 'no-store', signal: options.signal });profile=await response.json();if (!response.ok) throw new Error(profile?.error || 'Não foi possível identificar a casa desta conta.');}
  if (String(profile.role || '').toLowerCase() === 'filho' && !profile.is_co_admin) { invalidate('/entrar'); throw new Error('Esta interface é a área da zeladoria. Use o portal do membro do sistema atual.'); }
  const tenantId = String(profile.tenant_id || '').trim();
  if (!tenantId) { invalidate('/entrar'); throw new Error('O servidor não confirmou o vínculo com o terreiro.'); }
  if (['blocked','deleted'].includes(String(profile.status || '').toLowerCase())) { invalidate('/entrar'); throw new Error('Esta conta não está disponível.'); }
  options.signal?.throwIfAborted();
  if (version !== generation || invalidated) return false;
  if (current && current.tenantId !== tenantId) { invalidate('/entrar'); return false; }
  current = { userId: session.user.id, email: session.user.email || '', tenantId, profile };
  stopRenewal?.(); stopRenewal = undefined;
  if(!['localhost','127.0.0.1'].includes(location.hostname)){
    const scope = current, controller = new AbortController();
    let pending = false, verifiedAt = Date.now();
    const renewPilot=async()=>{
      if (pending || Date.now() - verifiedAt < 60_000) return;
      pending = true;
      try {
        const response=await authFetch('/api/pilot/interface-access',{method:'POST',cache:'no-store',signal:controller.signal});
        if (controller.signal.aborted) return;
        assertSession(scope, version);
        if (response.status >= 500) return;
        if (response.status === 401) { invalidate('/entrar'); return; }
        const access=await response.json();
        if (controller.signal.aborted) return;
        assertSession(scope, version);
        if (!response.ok || !access.enabled) { invalidate('/dashboard?classic=1'); return; }
        if (!access.profile || String(access.profile.tenant_id || '').trim() !== scope.tenantId || String(access.profile.role || '').toLowerCase() === 'filho' || ['blocked','deleted'].includes(String(access.profile.status || '').toLowerCase())) { invalidate('/entrar'); return; }
        verifiedAt = Date.now();
      } catch {} finally { pending = false; }
    };
    const visible = () => { if(document.visibilityState==='visible')void renewPilot(); };
    const timer = setInterval(visible,10*60*1000);
    document.addEventListener('visibilitychange',visible);
    stopRenewal = () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange',visible); };
  }
  return true;
}
export async function request<T = any>(path: string, method = 'GET', body?: unknown, progress?: UploadProgress): Promise<T> {
  const scope = previewSession(), version = generation;
  method = method.toUpperCase();
  const mutation = ['POST','PUT','PATCH','DELETE'].includes(method);
  // Reads that overlap a mutation cannot confirm its resulting state.
  if (mutation) { readRevision++; reads.clear(); }
  const key = method === 'GET' && body === undefined && !progress ? JSON.stringify([scope.userId, scope.tenantId, version, readRevision, path]) : undefined;
  if (key && reads.has(key)) return reads.get(key)!;
  const operation = Promise.resolve().then(async () => {
  assertSession(scope, version);
  const send=()=>authFetch(path, { method, cache: 'no-store', ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }, undefined, progress ? xhrUploadTransport(progress) : undefined);
  let response=await send();
  assertSession(scope, version);
  if(method==='GET'&&[500,502,503,504].includes(response.status)){await response.body?.cancel().catch(()=>{});assertSession(scope, version);response=await send();assertSession(scope, version);}
  if(response.status===204&&response.ok)return {} as T;
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error(`O serviço não retornou uma resposta válida (${response.status}). ${method==='GET'?'Tente carregar novamente.':'Confira o registro antes de repetir a operação.'}`);
  const data = await response.json();
  assertSession(scope, version);
  if (!response.ok) throw new Error(data.error || data.message || `Não foi possível concluir (${response.status}).`);
  return data as T;
  });
  if (key) reads.set(key, operation);
  try { return await operation; } finally { if (key && reads.get(key) === operation) reads.delete(key); if (mutation) { readRevision++; reads.clear(); } }
}
export const scoped = (path: string) => `${path}${path.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(previewSession().tenantId)}&userRole=admin`;
export async function disconnectPreview(){
 await endPilotSession({request:fetch,endAuth:()=>supabase.auth.signOut({scope:'local'}),navigate:()=>invalidate('/entrar')});
}
