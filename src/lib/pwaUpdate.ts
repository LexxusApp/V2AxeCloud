type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateAvailable = false;
let applyUpdateFn: ApplyUpdateFn | null = null;
const listeners = new Set<Listener>();

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  if (updateAvailable) listener();
  return () => listeners.delete(listener);
}

export function isPwaUpdateAvailable(): boolean {
  return updateAvailable;
}

export function markPwaUpdateAvailable(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  listeners.forEach((l) => l());
}

export function bindPwaApplyUpdate(fn: ApplyUpdateFn): void {
  applyUpdateFn = fn;
}

export async function applyPwaUpdate(): Promise<void> {
  if (!applyUpdateFn) return;
  await applyUpdateFn(true);
}
