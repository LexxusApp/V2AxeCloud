type Realtime = {
  getChannels(): unknown[];
  isConnecting(): boolean;
  disconnect(): void;
  connect(): void;
};

/** Release the socket before BFCache freezes the document; keep channel registrations. */
export function installRealtimePageLifecycle(client: Realtime, target: Window) {
  let suspended = false;
  const hide = () => {
    if (suspended || client.isConnecting() || client.getChannels().length === 0) return;
    suspended = true;
    try {
      const conn = (client as any)?.socketAdapter?.socket?.conn;
      if (conn?.readyState === 1) {
        conn.close(1000, 'Normal Closure');
      }
    } catch {}
    client.disconnect();
  };
  const resume = () => {
    if (!suspended || target.navigator.onLine === false || target.document.visibilityState === 'hidden') return;
    suspended = false;
    if (client.getChannels().length > 0) client.connect();
  };
  const visibility = () => {
    if (target.document.visibilityState === 'visible') resume();
  };
  target.addEventListener('pagehide', hide);
  target.addEventListener('pageshow', resume);
  target.addEventListener('online', resume);
  target.document.addEventListener('visibilitychange', visibility);
  (target.document as any)?.addEventListener?.('freeze', hide);
  return () => {
    target.removeEventListener('pagehide', hide);
    target.removeEventListener('pageshow', resume);
    target.removeEventListener('online', resume);
    target.document.removeEventListener('visibilitychange', visibility);
    (target.document as any)?.removeEventListener?.('freeze', hide);
  };
}
