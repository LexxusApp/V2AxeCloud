const ASSET_PATH_RE = /\.[a-z0-9]{2,16}$/i;

const ROTA_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://axecloud.com.br https://*.supabase.co https://*.openstreetmap.org",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

function secure(response, pathname) {
  const headers = new Headers(response.headers);
  const contentType = headers.get('Content-Type') || '';
  headers.set('X-AxeCloud-Runtime', 'cloudflare-rota-assets');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!pathname.startsWith('/api/')) headers.set('Content-Security-Policy', ROTA_CSP);
  if (contentType.includes('text/html')) headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  else if (pathname.startsWith('/assets/') && response.ok) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, 'https://axecloud.com.br');
      const headers = new Headers(request.headers);
      const upstream = await env.API.fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }));
      return secure(upstream, url.pathname);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secure(new Response('Method Not Allowed', { status: 405 }), url.pathname);
    }

    if (ASSET_PATH_RE.test(url.pathname)) return secure(await env.ASSETS.fetch(request), url.pathname);

    const shellUrl = new URL(request.url);
    shellUrl.pathname = '/index.html';
    shellUrl.search = '';
    return secure(await env.ASSETS.fetch(new Request(shellUrl, request)), url.pathname);
  },
};


