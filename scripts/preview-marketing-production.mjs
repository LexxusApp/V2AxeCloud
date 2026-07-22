import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'landing-dist');
const APP_PUBLIC = path.join(ROOT, 'dist');
const PORT = Number(process.env.MARKETING_PREVIEW_PORT || 5173);
const API_ORIGIN = process.env.MARKETING_API_ORIGIN || 'https://axecloud.com.br';
const marketingRoute = /^\/(?:$|register(?:\/.*)?$|termos(?:\/.*)?$|privacidade(?:\/.*)?$|por-que-axecloud(?:\/.*)?$|espaco-do-fiel(?:\/.*)?$|terreiros?(?:\/.*)?$|eventos?(?:\/.*)?$|conteudo(?:\/.*)?$)/;
const appRoute = /^\/(?:entrar|login|dashboard|checkout|assinatura\/renovar|redefinir-senha|recuperar-senha|consulente(?:\/.*)?|presenca(?:\/.*)?|checkin-portaria(?:\/.*)?|convite(?:\/.*)?|checkin(?:\/.*)?|senhas(?:\/.*)?)$/;
const appRootAsset = /^\/(?:workbox-[a-zA-Z0-9_-]+\.js|sw-push\.js|sw-marketing-bypass\.js|pdf\.worker\.min\.mjs)$/;
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.ico', 'image/x-icon'],
  ['.mp4', 'video/mp4'],
]);

function safeFile(relative) {
  const target = path.resolve(PUBLIC, relative.replace(/^[/\\]+/, ''));
  return target.startsWith(`${PUBLIC}${path.sep}`) || target === PUBLIC ? target : null;
}
function safeAppFile(relative) {
  const target = path.resolve(APP_PUBLIC, relative.replace(/^[/\\]+/, ''));
  return target.startsWith(`${APP_PUBLIC}${path.sep}`) || target === APP_PUBLIC ? target : null;
}
function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader('Content-Type', mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', file.includes(`${path.sep}m-assets${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-store, no-cache, must-revalidate');
  fs.createReadStream(file).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(pathname.startsWith('/api/metrics/') ? 204 : 405).end();
      return;
    }
    try {
      const upstreamHeaders = { accept: request.headers.accept || '*/*' };
      if (request.headers.authorization) upstreamHeaders.authorization = request.headers.authorization;
      const upstream = await fetch(`${API_ORIGIN}${pathname}${url.search}`, { headers: upstreamHeaders });
      response.statusCode = upstream.status;
      response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"API indisponível no preview"}');
    }
    return;
  }

  if (appRoute.test(pathname)) {
    return sendFile(response, path.join(APP_PUBLIC, 'index.html'));
  }

  if (pathname.startsWith('/assets/') || pathname === '/manifest.webmanifest' || pathname === '/sw.js' || appRootAsset.test(pathname)) {
    const appFile = safeAppFile(pathname);
    if (appFile && fs.existsSync(appFile) && fs.statSync(appFile).isFile()) return sendFile(response, appFile);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Arquivo não encontrado');
    return;
  }

  const direct = safeFile(pathname);
  const directoryIndex = safeFile(path.join(pathname, 'index.html'));
  if (direct && fs.existsSync(direct) && fs.statSync(direct).isFile()) return sendFile(response, direct);
  if (directoryIndex && fs.existsSync(directoryIndex)) return sendFile(response, directoryIndex);
  if (marketingRoute.test(pathname)) return sendFile(response, path.join(PUBLIC, '__react_shell.html'));

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Página não encontrada');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[marketing:preview] http://localhost:${PORT} — build integrado, API pública em leitura.`);
});
