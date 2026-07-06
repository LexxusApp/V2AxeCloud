import {useSyncExternalStore} from 'react';
import {MARKETING_NAVIGATE_EVENT} from '../lib/marketingNavigation';
import {normalizePath} from '../lib/routes';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener(MARKETING_NAVIGATE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener(MARKETING_NAVIGATE_EVENT, onStoreChange);
  };
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
