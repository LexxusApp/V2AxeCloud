import { ritualPromotionMetrics } from './ritual-promotion-metrics.js';

const ASSET_PATH_RE = /\.[a-z0-9]{2,16}$/i;

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://axecloud.com.br https://admin.axecloud.com.br https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com",
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
  const isHtml = contentType.includes('text/html');
  headers.set('X-AxeCloud-Runtime', 'cloudflare-admin-assets');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!pathname.startsWith('/api/')) headers.set('Content-Security-Policy', ADMIN_CSP);
  if (isHtml) headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  else if (pathname.startsWith('/assets/') && response.ok) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function getMonthRange() {
  const now = new Date();
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const year = spNow.getUTCFullYear();
  const month = spNow.getUTCMonth() + 1;
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    monthStart: `${year}-${monthStr}-01`,
    monthEnd: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin-console/ritual-promotions') {
      return secure(await ritualPromotionMetrics(request, env), url.pathname);
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, 'https://axecloud.com.br');
      const headers = new Headers(request.headers);
      const upstream = await env.API.fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }));

      if (url.pathname === '/api/admin-console/mensalidades/tenants' && request.method === 'GET' && upstream.ok) {
        try {
          const upstreamData = await upstream.clone().json().catch(() => ({}));
          const metaConfigured = Boolean(upstreamData.metaConfigured);

          if (env.SUPABASE_SERVICE_ROLE_KEY) {
            const { monthStart, monthEnd } = getMonthRange();
            const sbUrl = String(env.SUPABASE_URL || 'https://vlaojhfwhqmwudqsumpi.supabase.co').replace(/\/$/, '');
            const authHeaders = {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            };

            const [perfRes, finRes] = await Promise.all([
              fetch(`${sbUrl}/rest/v1/perfil_lider?select=id,tenant_id,nome_terreiro,email,deleted_at&deleted_at=is.null&order=nome_terreiro.asc&limit=500`, {
                headers: authHeaders,
              }),
              fetch(`${sbUrl}/rest/v1/financeiro?select=tenant_id,filho_id,status,categoria,data,lider_id&categoria=eq.Mensalidade&data=gte.${monthStart}&data=lte.${monthEnd}&limit=2000`, {
                headers: authHeaders,
              }),
            ]);

            if (perfRes.ok && finRes.ok) {
              const [profiles, finRows] = await Promise.all([perfRes.json(), finRes.json()]);

              const pendingByTenant = new Map();
              for (const row of finRows) {
                const st = String(row.status || '').toLowerCase();
                if (st === 'pago' || st === 'paid' || st === 'concluido' || st === 'concluida' || st === 'cancelado' || st === 'cancelada') continue;
                const tid = String(row.tenant_id || row.lider_id || '');
                const fid = String(row.filho_id || row.id || '');
                if (!tid) continue;
                if (!pendingByTenant.has(tid)) pendingByTenant.set(tid, new Set());
                pendingByTenant.get(tid).add(fid);
              }

              const tenants = (profiles || [])
                .map((p) => {
                  const tid = String(p.tenant_id || p.id || '');
                  const pendingCount =
                    (pendingByTenant.get(tid)?.size || 0) ||
                    (p.id ? (pendingByTenant.get(String(p.id))?.size || 0) : 0);
                  return {
                    id: tid,
                    nomeTerreiro: String(p.nome_terreiro || 'Terreiro'),
                    email: p.email ? String(p.email) : null,
                    pendingCount,
                  };
                })
                .filter((t) => t.id)
                .sort((a, b) => {
                  const countA = a.pendingCount || 0;
                  const countB = b.pendingCount || 0;
                  if (countB !== countA) return countB - countA;
                  return a.nomeTerreiro.localeCompare(b.nomeTerreiro, 'pt-BR');
                });

              return secure(
                new Response(JSON.stringify({ tenants, metaConfigured }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }),
                url.pathname
              );
            }
          }
        } catch (enrichErr) {
          console.error('[admin-shell] failed to list mensalidades tenants:', enrichErr);
        }
      }

      return secure(upstream, url.pathname);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secure(new Response('Method Not Allowed', { status: 405 }), url.pathname);
    }

    if (ASSET_PATH_RE.test(url.pathname)) {
      return secure(await env.ASSETS.fetch(request), url.pathname);
    }

    const shellUrl = new URL(request.url);
    shellUrl.pathname = '/index.html';
    shellUrl.search = '';
    return secure(await env.ASSETS.fetch(new Request(shellUrl, request)), url.pathname);
  },
};


