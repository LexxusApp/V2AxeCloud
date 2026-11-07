import { build, loadConfigFromFile } from 'vite';
import path from 'node:path';

const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.resolve('vite.config.ts'));
if (!loaded) throw Error('Configuração de build não encontrada.');
await build({
  ...loaded.config,
  configFile: false,
  plugins: loaded.config.plugins.flat(Infinity).filter(plugin => plugin?.name !== 'prerender-public-pages'),
  define: { ...loaded.config.define, 'import.meta.env.VITE_MODERN_DASHBOARD': JSON.stringify('true') },
  build: { ...loaded.config.build, outDir: path.resolve('artifacts/modern-integration/app'), emptyOutDir: true },
});
