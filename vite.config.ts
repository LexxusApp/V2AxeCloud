import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {Plugin} from 'vite';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {prerenderPublicPages} from './scripts/vite-plugin-prerender-public';
import {buildIdInject} from './scripts/vite-plugin-build-id';
import {seoHomeInject} from './scripts/vite-plugin-seo-inject';
import {HOME_SEO} from './src/constants/seoHome';
import {BRAND_NAME} from './src/constants/seoBrandKeywords';
import {MARKETING_SITE_PATHS} from './src/lib/routes';

/** Vite injeta crossorigin nos bundles; com CORP global isso quebrava script/style no Brave/Chrome. */
function stripCrossoriginFromBuiltHtml(): Plugin {
  return {
    name: 'strip-crossorigin-built-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
      },
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
      buildIdInject(),
      seoHomeInject({ preloadTourImage: false }),
      prerenderPublicPages('dist', { excludePaths: MARKETING_SITE_PATHS }),
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
          'pwa-48.png',
          'pwa-96.png',
          'pwa-192.png',
          'pwa-512.png',
          'notification-badge.png',
          'login-bg-desktop.png',
          'sw-push.js',
        ],
        devOptions: {
          enabled: false,
        },
        manifest: {
          id: 'https://axecloud.com.br/',
          name: BRAND_NAME,
          short_name: BRAND_NAME,
          description: HOME_SEO.manifestDescription,
          start_url: '/entrar',
          scope: '/',
          lang: 'pt-BR',
          prefer_related_applications: false,
          /**
           * Auto-referência ao próprio PWA: permite que getInstalledRelatedApps()
           * detecte que o app já está instalado no aparelho mesmo abrindo pelo navegador,
           * escondendo o botão «Instalar aplicativo» para quem já instalou.
           */
          related_applications: [
            {
              platform: 'webapp',
              url: 'https://axecloud.com.br/manifest.webmanifest',
              id: 'https://axecloud.com.br/',
            },
          ],
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          display_override: ['standalone'],
          icons: [
            {
              src: '/pwa-48.png',
              sizes: '48x48',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          /** Bump ao mudar estratégia de cache — força precache/runtime novos e abandona caches antigos. */
          cacheId: 'axecloud-v118',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          /** Sem fallback de navegação — evita no-response do Workbox em /dashboard e outras rotas do app. */
          navigateFallback: null,
          importScripts: ['/sw-marketing-bypass.js', '/sw-push.js'],
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/$/,
            /^\/termos(\/|$)/,
            /^\/privacidade(\/|$)/,
            /^\/programa-fundador(\/|$)/,
            /^\/espaco-do-fiel(\/|$)/,
            /^\/conteudo(\/|$)/,
          ],
          /** Só assets (JS/CSS/fonts) — documentos HTML vão direto à rede sem interceptação do SW. */
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode !== 'navigate' && request.destination !== 'image',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'axecloud-runtime-network-first-v118',
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
            if (id.includes('/src/views/Landing') || id.includes('/src/components/landing/LandingHero')) {
              return 'landing-home';
            }
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
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
