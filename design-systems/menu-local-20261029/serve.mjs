import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '../..');
const server = await createServer({
  configFile: false,
  root,
  envDir: projectRoot,
  publicDir: path.join(projectRoot, 'public'),
  plugins: [react()],
  cacheDir: path.join(root, '.vite'),
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
    fs: { allow: [projectRoot] },
    proxy: {
      '/api': { target: 'https://axecloud.com.br', changeOrigin: true, secure: true },
      // Existing login is a separate document. Its styles never enter the approved UI.
      '^/(entrar|recuperar-senha|redefinir-senha)(\\?|$)': { target: 'https://axecloud.com.br', changeOrigin: true, secure: true },
      '^/assinatura/renovar(\\?|$)': { target: 'https://axecloud.com.br', changeOrigin: true, secure: true },
      '^/assets/.*\\.(js|css|woff2?)$': { target: 'https://axecloud.com.br', changeOrigin: true, secure: true },
    },
  },
  build: { outDir: path.join(root, 'build'), emptyOutDir: true },
});
await server.listen();
console.log('Interface aprovada com sessão e API reais: http://localhost:5188');

