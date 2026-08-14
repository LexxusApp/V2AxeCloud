import { createReadStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';

const nestedStandalone = join(import.meta.dirname, 'dist', 'standalone');
const root = existsSync(nestedStandalone) ? nestedStandalone : import.meta.dirname;
const clientRoot = join(root, 'dist', 'client');
const publicPrefix = '/site-home-assets/';
const publicPort = Number.parseInt(process.env.PORT ?? '3000', 10);
const internalPort = publicPort + 1;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
]);

function clientFile(pathname) {
  const relative = normalize(pathname.slice(publicPrefix.length)).replace(/^([/\\])+/, '');
  const target = join(clientRoot, relative);
  return target === clientRoot || target.startsWith(clientRoot + sep) ? target : null;
}

async function serveClientAsset(request, response, pathname) {
  const file = clientFile(pathname);
  if (!file) return false;
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
    return true;
  } catch {
    return false;
  }
}

function proxyToApplication(request, response) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: internalPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${internalPort}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', () => response.writeHead(502).end('Serviço temporariamente indisponível'));
  request.pipe(upstream);
}

await startProdServer({
  port: internalPort,
  host: '127.0.0.1',
  outDir: join(root, 'dist'),
});

http.createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${publicPort}`).pathname;
  if (pathname.startsWith(publicPrefix)) {
    if (await serveClientAsset(request, response, pathname)) return;
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Arquivo não encontrado');
    return;
  }
  proxyToApplication(request, response);
}).listen(publicPort, '0.0.0.0', () => {
  console.log(`[axecloud-home] http://0.0.0.0:${publicPort}`);
});
