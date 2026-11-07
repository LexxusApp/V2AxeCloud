// Actual authenticated application; no prototype entry, fake session or seeded data.
import { createServer, loadConfigFromFile, mergeConfig } from 'vite';
import path from 'node:path';
const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, path.resolve('vite.config.ts'));
if (!loaded) throw Error('Configuração da aplicação não encontrada.');
const server = await createServer(mergeConfig(loaded.config, {
  configFile: false,
  define: { 'import.meta.env.VITE_MODERN_DASHBOARD': JSON.stringify('true') },
  server: { host: '127.0.0.1', port: 5191, strictPort: true, proxy: { '/api': { target: 'https://axecloud.com.br', changeOrigin: true, secure: true } } },
}));
await server.listen();
server.printUrls();
console.log('Aplicação real: faça login normalmente. Para validação, use apenas a casa Teste autorizada. Nenhum dado fictício é criado automaticamente.');
