import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { prerenderPublicPages } from './scripts/vite-plugin-prerender-public';
import { seoHomeInject } from './scripts/vite-plugin-seo-inject';
import { ROUTES } from './src/lib/routes';

/** Vite injeta crossorigin nos bundles; com CORP global isso quebrava script/style no Brave/Chrome. */
function stripCrossoriginFromBuiltHtml(): Plugin {
  return {
    name: 'strip-crossorigin-built-html-landing',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '');
      },
    },
  };
}

/** Build estático da landing — assets em /m-assets/ para não colidir com o SPA do app. */
function assertPublicSupabaseConfig(mode: string, env: Record<string, string>): void {
  if (mode !== 'production') return;

  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[landing] Configuração pública do Supabase ausente: ${missing.join(', ')}. ` +
        'O cadastro depende desses valores para concluir o primeiro login.'
    );
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(env.VITE_SUPABASE_URL);
  } catch {
    throw new Error('[landing] VITE_SUPABASE_URL não é uma URL válida.');
  }

  if (supabaseUrl.protocol !== 'https:') {
    throw new Error('[landing] VITE_SUPABASE_URL deve usar HTTPS em produção.');
  }

  if (env.VITE_SUPABASE_ANON_KEY.startsWith('sb_secret_')) {
    throw new Error(
      '[landing] VITE_SUPABASE_ANON_KEY recebeu uma chave secreta. Use somente a chave pública/anon.'
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  assertPublicSupabaseConfig(mode, env);
  const proxyTarget = env.VITE_PROXY_API || 'http://localhost:3000';

  return {
  root: path.resolve(__dirname, 'marketing'),
  envDir: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, 'public'),
  base: '/',
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    // Código-fonte em ../src — necessário para `npm run dev:landing`
    fs: {
      allow: [path.resolve(__dirname)],
    },
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    stripCrossoriginFromBuiltHtml(),
    seoHomeInject({ preloadTourImage: false }),
    prerenderPublicPages('landing-dist', { excludePaths: [ROUTES.login] }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  build: {
    outDir: path.resolve(__dirname, 'landing-dist'),
    emptyOutDir: true,
    /** Evita aviso de preload vs script quando Cloudflare Rocket Loader altera o carregamento. */
    modulePreload: false,
    rollupOptions: {
      output: {
        entryFileNames: 'm-assets/[name]-[hash].js',
        chunkFileNames: 'm-assets/[name]-[hash].js',
        assetFileNames: 'm-assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('/src/views/Landing') || id.includes('/src/components/landing/LandingHero')) {
            return 'landing-home';
          }
          if (!id.includes('node_modules')) return;
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-lucide';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
};
});
