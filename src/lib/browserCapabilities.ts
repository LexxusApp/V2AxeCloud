/** Compatibilidade defensiva para WebViews (WhatsApp, Instagram etc.). */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    return window.Notification.permission;
  } catch {
    return null;
  }
}

export function supportsWebPush(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  );
}

export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Combina timeout e cancelamento pai sem depender de AbortSignal.timeout/any. */
export async function withCompatibleAbortTimeout<T>(
  parentSignal: AbortSignal,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  parentSignal.addEventListener('abort', abort, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', abort);
  }
}
