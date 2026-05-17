import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['axecloud_192.png', 'axecloud_512.png', 'sw-push.js'],
        devOptions: {
          enabled: false,
        },
        manifest: {
          id: '/',
          name: 'AxéCloud',
          short_name: 'AxéCloud',
          description: 'Gestão Inteligente para sua Comunidade',
          start_url: '/',
          scope: '/',
          lang: 'pt-BR',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          icons: [
            {
              src: '/axecloud_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/axecloud_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          /** Bump ao mudar estratégia de cache — força precache/runtime novos e abandona caches antigos (cleanupOutdatedCaches). */
          /** Bump para publicar nova regra NetworkOnly em /login (logout PWA). */
          cacheId: 'axecloud-v101',
          cleanupOutdatedCaches: true,
          importScripts: ['/sw-push.js'],
          // Evita que o fallback do SPA (index.html) intercepte navegação para /api/*
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Navegação HTML: rede primeiro e sem persistir HTML no cache.
              urlPattern: ({request, sameOrigin}) => sameOrigin && request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'axecloud-html-network-first-v101',
                networkTimeoutSeconds: 8,
                // Mantém a estratégia NetworkFirst, mas bloqueia gravação de HTML em cache.
                plugins: [{
                  cacheWillUpdate: async () => null,
                }],
              },
            },
            {
              // Assets estáticos same-origin (nunca cachear /api — checkout EFI, tenant-info, etc.).
              urlPattern: ({request, sameOrigin, url}) => {
                if (!sameOrigin || request.mode === 'navigate') return false;
                try {
                  return !new URL(url).pathname.startsWith('/api/');
                } catch {
                  return true;
                }
              },
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'axecloud-runtime-network-first-v101',
                networkTimeoutSeconds: 12,
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 6,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
