type SyncResult = {created?: number; removed?: number; revalued?: number};
const synchronizations = new Map<string, Promise<SyncResult>>();

export async function withMensalidadeDeadline<T>(request: (signal: AbortSignal) => Promise<T>, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await request(controller.signal); }
  finally { clearTimeout(timer); }
}

export function synchronizeMensalidadesOnce(key: string, task: () => Promise<SyncResult>): Promise<SyncResult> {
  const running = synchronizations.get(key);
  if (running) return running;
  const request = Promise.resolve().then(task).finally(() => {
    if (synchronizations.get(key) === request) synchronizations.delete(key);
  });
  synchronizations.set(key, request);
  return request;
}

/** Display existing records immediately; synchronization must not block the first read. */
export async function refreshMensalidadesWithoutBlocking<T>(options: {
  read: () => Promise<T>;
  sync?: () => Promise<SyncResult>;
  onData: (data: T) => void;
  onReadDone: () => void;
  onSyncDone: () => void;
  onError: (error: unknown) => void;
}) {
  const sync = options.sync?.().then(result => ({result, error: null}), error => ({result: null, error}));
  const read = async () => {
    try { options.onData(await options.read()); }
    catch (error) { options.onError(error); }
    finally { options.onReadDone(); }
  };
  await read();
  try {
    if (!sync) return;
    const outcome = await sync;
    if (outcome.error) { options.onError(outcome.error); return; }
    const result = outcome.result;
    if (result && (Number(result.created) > 0 || Number(result.removed) > 0 || Number(result.revalued) > 0)) await read();
  } finally { options.onSyncDone(); }
}
