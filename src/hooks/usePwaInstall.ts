import { useSyncExternalStore } from 'react';
import {
  getPwaInstallSnapshot,
  subscribePwaInstallState,
  triggerPwaInstall,
} from '../lib/pwaInstallController';

export function usePwaInstall() {
  const state = useSyncExternalStore(
    subscribePwaInstallState,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot,
  );

  return {
    ...state,
    install: triggerPwaInstall,
  };
}
