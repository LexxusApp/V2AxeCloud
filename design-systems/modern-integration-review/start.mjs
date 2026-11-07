import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(root, '../..');
const owner = '00000000-0000-4000-8000-000000000001';
const child = '00000000-0000-4000-8000-000000000002';
const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const server = await createServer({
  configFile: false, root, envDir: project, publicDir: path.join(project, 'public'),
  plugins: [react(), tailwind(), { name: 'read-only-local-review', configureServer(server) {
    server.middlewares.use('/api', (request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET') { response.statusCode = 409; response.end(JSON.stringify({ error: 'Revisão local: gravação bloqueada. Nenhum registro real foi alterado.' })); return; }
      const url = new URL(request.url, 'http://local.invalid');
      let data = [];
      if (url.pathname === '/children') data = [{ id: child, nome: 'Membro de validação', tenant_id: owner }];
      if (url.pathname === '/transactions') data = [{ id: '00000000-0000-4000-8000-000000000003', tipo: 'entrada', categoria: 'Doação', valor: 200, status: 'pago', data: now, descricao: 'Registro local para conferência visual' }];
      if (url.pathname === '/v1/financial/pix-config') { response.end(JSON.stringify({ data: { chave_pix: 'casa@example.invalid', tipo_chave: 'email', nome_beneficiario: 'Conta de teste local', valor_mensalidade: 100, dia_vencimento: 31, mensalidade_ativa: true } })); return; }
      response.end(JSON.stringify({ data, ...(url.pathname === '/transactions' ? { ledgerRevision: 'review-v1', hasMore: false, offset: Number(url.searchParams.get('offset') || 0) } : {}) }));
    });
  } }],
  resolve: { dedupe: ['react', 'react-dom', 'framer-motion'] },
  cacheDir: path.join(root, '.vite'),
  server: { host: '127.0.0.1', port: 5190, strictPort: true, fs: { allow: [project] } },
});
await server.listen();
server.printUrls();
