import {initPwaInstallController} from '../../src/lib/pwaInstallController';

export function initPilotPwa(): void {
  initPwaInstallController();
  if (import.meta.env.PROD && location.origin === 'https://axecloud.com.br' && 'serviceWorker' in navigator) {
    // Reutiliza o worker oficial; não limpa caches nem reinicia a sessão.
    void navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'})
      .catch(error => console.warn('[PWA] Não foi possível preparar o aplicativo.', error));
  }
}
