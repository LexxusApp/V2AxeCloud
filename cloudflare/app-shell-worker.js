const ASSET_PATH_RE = /\.[a-z0-9]{2,16}$/i;

const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.pagseguro.uol.com.br https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://googleads.g.doubleclick.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://cloudflareinsights.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.backblazeb2.com https://s3.us-east-005.backblazeb2.com https://*.s3.us-east-005.backblazeb2.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.google.com https://www.googleadservices.com https://*.doubleclick.net https://*.googleadservices.com https://pagead2.googlesyndication.com https://www.google.com.br",
  "frame-src 'self' blob: https://vlaojhfwhqmwudqsumpi.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://www.googletagmanager.com https://*.doubleclick.net",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.efi.com.br https://*.gerencianet.com.br",
  'upgrade-insecure-requests',
].join('; ');

function redirect(location, status = 302) {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function finish(response, pathname, preview) {
  const headers = new Headers(response.headers);
  const contentType = headers.get('Content-Type') || '';
  const isHtml = contentType.includes('text/html');
  const isHashedAsset = pathname.startsWith('/assets/');
  const isServiceWorker = pathname === '/sw.js' || pathname.startsWith('/workbox-');

  headers.set('X-AxeCloud-Runtime', 'cloudflare-app-assets');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');
  headers.set('Content-Security-Policy', APP_CSP);

  if (preview || isHtml) headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (isHtml || isServiceWorker || pathname === '/manifest.webmanifest' || pathname === '/build-info.json') {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else if (isHashedAsset) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (response.ok) {
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const preview = env.PREVIEW_MODE === 'true';

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return finish(new Response('Method Not Allowed', { status: 405 }), url.pathname, preview);
    }

    if (url.pathname === '/login' || url.pathname.startsWith('/login/')) {
      const suffix = url.pathname.slice('/login'.length);
      return finish(redirect(`/entrar${suffix}${url.search}`, 301), url.pathname, preview);
    }

    const legacyIconMatch = url.pathname.match(/^\/icon-(32|48|96|192|512)\.png$/);
    if (url.pathname === '/site.webmanifest' || legacyIconMatch || url.pathname === '/apple-touch-icon.png') {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname === '/site.webmanifest'
        ? '/manifest.webmanifest'
        : `/pwa-${legacyIconMatch?.[1] || '192'}.png`;
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
      return finish(asset, url.pathname, preview);
    }
    if (ASSET_PATH_RE.test(url.pathname)) {
      const asset = await env.ASSETS.fetch(request);
      // Arquivo inexistente nunca recebe o HTML da SPA: evita MIME incorreto e 200 enganoso.
      return finish(asset, url.pathname, preview);
    }

    const shellUrl = new URL(request.url);
    shellUrl.pathname = '/index.html';
    shellUrl.search = '';
    const shell = await env.ASSETS.fetch(new Request(shellUrl, request));
    return finish(shell, url.pathname, preview);
  },
};
