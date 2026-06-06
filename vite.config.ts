import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {Plugin} from 'vite';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {prerenderPublicPages} from './scripts/vite-plugin-prerender-public';
import {seoHomeInject} from './scripts/vite-plugin-seo-inject';
import {HOME_SEO} from './src/constants/seoHome';

/** Vite injeta crossorigin nos bundles; com CORP global isso quebrava script/style no Brave/Chrome. */
function stripCrossoriginFromBuiltHtml(): Plugin {
  return {
    name: 'strip-crossorigin-built-html',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      stripCrossoriginFromBuiltHtml(),
      seoHomeInject(),
      prerenderPublicPages(),
      VitePWA({
        /** prompt: aguarda o usuário (banner) antes de skipWaiting — evita loop e não prende logados em cache antigo. */
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: [
          'favicon.ico',
          'axecloud_48.png',
          'axecloud_96.png',
          'axecloud_192.png',
          'axecloud_512.png',
          'login-bg.png',
          'login-bg-premium.png',
          'login-bg-desktop.png',
          'sw-push.js',
        ],
        devOptions: {
          enabled: false,
        },
        manifest: {
          id: 'https://axecloud.com.br/',
          name: 'AxéCloud',
          short_name: 'AxéCloud',
          description: HOME_SEO.manifestDescription,
          start_url: 'https://axecloud.com.br/',
          scope: 'https://axecloud.com.br/',
          lang: 'pt-BR',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          icons: [
            {
              src: '/axecloud_48.png',
              sizes: '48x48',
              type: 'image/png',
              purpose: 'any',
            },
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
          /** Bump ao mudar estratégia de cache — força precache/runtime novos e abandona caches antigos. */
          cacheId: 'axecloud-v107',
          cleanupOutdatedCaches: true,
          importScripts: ['/sw-push.js'],
          navigateFallbackDenylist: [/^\/api\//],
          /** HTML e assets: rede primeiro — PWA instalado não fica preso em bundle antigo se houver rede. */
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'axecloud-html-network-first-v107',
                networkTimeoutSeconds: 8,
                expiration: { maxEntries: 12, maxAgeSeconds: 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode !== 'navigate' && request.destination !== 'image',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'axecloud-runtime-network-first-v107',
                networkTimeoutSeconds: 12,
                expiration: { maxEntries: 96, maxAgeSeconds: 6 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
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
      dedupe: ['react', 'react-dom', 'framer-motion'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('date-fns')) return 'vendor-dates';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
