const crawlerPattern = /googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|applebot|petalbot|semrushbot|ahrefsbot|mj12bot|dotbot|crawler|spider/i;
const missingAssetPattern = /\.(?:png|jpe?g|gif|webp|ico|svg|woff2?|css|js|json|xml|txt|webmanifest|pdf|mp4|webm)$/i;
const linkHeader = '</.well-known/api-catalog>; rel="api-catalog", </sitemap.xml>; rel="sitemap", </openapi.json>; rel="service-desc", </llms.txt>; rel="describedby", </auth.md>; rel="help"';
const contentSecurityPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.pagseguro.uol.com.br https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://googleads.g.doubleclick.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://cloudflareinsights.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.backblazeb2.com https://s3.us-east-005.backblazeb2.com https://*.s3.us-east-005.backblazeb2.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.google.com https://www.googleadservices.com https://*.doubleclick.net https://*.googleadservices.com https://pagead2.googlesyndication.com https://www.google.com.br; frame-src 'self' blob: https://vlaojhfwhqmwudqsumpi.supabase.co https://*.efi.com.br https://*.gerencianet.com.br https://tokenizer.sejaefi.com.br https://www.googletagmanager.com https://*.doubleclick.net; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://*.efi.com.br https://*.gerencianet.com.br; upgrade-insecure-requests";

function redirect(location, status) {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function staleAssetRecovery(path) {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-AxeCloud-Asset-Recovery': '1',
  };
  if (path.endsWith('.css')) {
    return new Response('/* bundle antigo: recuperação conduzida pelo JavaScript */', {
      status: 200,
      headers: { ...headers, 'Content-Type': 'text/css; charset=utf-8' },
    });
  }

  const source = `(() => {
    const key = 'axecloud:stale-asset-recovery';
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) || '0');
    if (now - last < 15000) return;
    sessionStorage.setItem(key, String(now));
    const clearWorkers = 'serviceWorker' in navigator
      ? navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister())))
      : Promise.resolve();
    const clearCaches = 'caches' in window
      ? caches.keys().then((items) => Promise.all(items.map((item) => caches.delete(item))))
      : Promise.resolve();
    Promise.allSettled([clearWorkers, clearCaches]).finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('axe_asset_recovery', String(now));
      window.location.replace(url.href);
    });
  })();`;
  return new Response(source, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' },
  });
}

function finish(response, preview, path, fallback = false) {
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');
  headers.set('Content-Security-Policy', contentSecurityPolicy);
  if (response.status === 200 && (headers.get('Content-Type') || '').includes('text/html')) {
    const directoryDetail = !fallback && (/^\/terreiro\/[^/]+\/?$/.test(path) || /^\/terreiros\/[A-Za-z]{2}\/[^/]+\/?$/.test(path));
    headers.set('Cache-Control', directoryDetail
      ? 'public, max-age=300, stale-while-revalidate=86400, stale-if-error=604800'
      : 'no-store, no-cache, must-revalidate');
    headers.set('Vary', 'Accept');
    headers.set('Link', linkHeader);
  }
  if (preview) headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const preview = env.PREVIEW_MODE === 'true';
    const respond = (response, fallback = false) => finish(response, preview, path, fallback);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return respond(new Response('Method Not Allowed', { status: 405 }));
    }

    if (path === '/sitemap.xm') return respond(redirect('/sitemap.xml', 301));
    if (/^\/recursos\/(?:%3c|<)a/i.test(path)) return respond(redirect('/recursos', 301));
    if (path === '/terreiro') return respond(redirect('/terreiros', 302));
    if (path === '/terreiro/associacao-araxa' || path === '/terreiro/templo-de-umbanda-pai-jobim-da-guine') {
      return respond(new Response('Perfil removido por solicitação do responsável.', { status: 410 }));
    }
    if (path === '/conteudo' && url.searchParams.get('aba') === 'glossario') {
      return respond(redirect('/conteudo/glossario', 301));
    }
    const legacyCity = path.match(/^\/terreiros\/cidade\/([^/]+)\/?$/);
    if (legacyCity) return respond(redirect(`/terreiros?cidade=${encodeURIComponent(legacyCity[1])}`, 302));
    const legacyProfile = path.match(/^\/terreiros\/([^/.]+)\/?$/);
    if (legacyProfile) return respond(redirect(`/terreiro/${legacyProfile[1]}`, 302));
    if (path.startsWith('/api/')) return respond(new Response('Not Found', { status: 404 }));

    const asset = async (pathname) => {
      const target = new URL(url);
      target.pathname = pathname;
      target.search = '';
      return env.ASSETS.fetch(new Request(target, request));
    };

    if (/\btext\/markdown\b/i.test(request.headers.get('Accept') || '')) {
      const normalized = path.replace(/\/$/, '') || '/';
      const markdownPath = normalized === '/' ? '/index.md' : `${normalized}/index.md`;
      const markdown = await asset(markdownPath);
      const selected = markdown.status === 404 ? await asset('/index.md') : markdown;
      if (selected.status === 404) return respond(new Response('Not Acceptable', { status: 406 }));
      const headers = new Headers(selected.headers);
      headers.set('Content-Type', 'text/markdown; charset=utf-8');
      headers.set('Vary', 'Accept');
      headers.set('Cache-Control', 'public, max-age=300');
      headers.set('Content-Signal', 'search=yes, ai-input=yes, ai-train=no');
      headers.set('Link', linkHeader);
      return respond(new Response(selected.body, { status: selected.status, headers }));
    }

    const direct = await env.ASSETS.fetch(request);
    if (direct.status !== 404) return respond(direct);
    if (path.startsWith('/m-assets/') && /\.(?:js|css)$/i.test(path)) {
      return respond(staleAssetRecovery(path));
    }
    if (missingAssetPattern.test(path) || path.startsWith('/m-assets/') || path.startsWith('/screenshots/')) {
      return respond(direct);
    }

    const profile = /^\/terreiro\/[^/]+\/?$/.test(path);
    if (profile && crawlerPattern.test(request.headers.get('User-Agent') || '')) {
      return respond(new Response('Not Found', { status: 404 }));
    }

    const fallback = /^\/senhas\/[^/]+\/?$/.test(path)
      ? '/senhas'
      : /^\/evento\/[^/]+\/?$/.test(path)
        ? '/evento'
        : '/__react_shell';
    return respond(await asset(fallback), true);
  },
};
