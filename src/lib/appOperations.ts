type Listener = () => void;
const listeners = new Set<Listener>();
const pending = new Set<symbol>();
const notify = () => listeners.forEach(listener => listener());
export function subscribeAppOperations(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function pendingAppOperations() { return pending.size; }
/** Only mutations appear; background polling must not continually animate the UI. */
export function beginAppOperation(method = 'GET', url = ''): () => void {
  if (!/^(POST|PUT|PATCH|DELETE|DOWNLOAD)$/i.test(method) || /telemetry|notification-inbox|\/api\/pilot\/refresh(?:\?|$)/.test(url)) return () => {};
  const token = Symbol(); pending.add(token); notify();
  let finished = false;
  return () => { if (finished) return; finished = true; pending.delete(token); notify(); };
}
