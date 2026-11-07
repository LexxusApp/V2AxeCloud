import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
await build({
  configFile: false,
  root,
  // Do not copy production public documents or assets into the prototype build.
  publicDir: false,
  plugins: [react()],
  cacheDir: path.join(root, '.vite'),
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: path.join(root, 'build'), emptyOutDir: true },
});
