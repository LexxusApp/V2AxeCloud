import {useSyncExternalStore} from 'react';
import {normalizePath} from '../lib/routes';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange);
  return () => window.removeEventListener('popstate', onStoreChange);
}

function getSnapshot(): string {
  return normalizePath(window.location.pathname);
}

function getServerSnapshot(): string {
  return '/';
}

/** Pathname da SPA reativo a voltar/avançar do navegador. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
