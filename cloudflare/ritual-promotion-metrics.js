import rituals from '../cinematic-site/featured-rituals.json' with { type: 'json' };

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Valida a mesma sessão de admin da API; nunca entrega linhas ou identificadores de visitantes.
export async function ritualPromotionMetrics(request, env, fetchData = fetch) {
  if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Autenticação necessária.' }, 401);
  let session;
  try {
    session = await env.API.fetch(new Request('https://axecloud.com.br/api/admin-console/session', {
      headers: { Authorization: authorization },
    }));
  } catch {
    return json({ error: 'Verificação de sessão indisponível.' }, 503);
  }
  if (!session.ok) {
    const status = session.status === 403 ? 403 : session.status === 401 ? 401 : 503;
    return json({ error: status === 503 ? 'Verificação de sessão indisponível.' : 'Acesso restrito a uma sessão admin válida.' }, status);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Métricas indisponíveis.' }, 503);
  const days = new URL(request.url).searchParams.get('days') === '7' ? 7 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'count=exact' };
  const count = async (ritual, cta, surface) => {
    const url = new URL('/rest/v1/public_conversion_events', env.SUPABASE_URL);
    url.search = new URLSearchParams({ select: 'id', cta_id: `eq.${cta}`, 'metadata->>promotionId': `eq.${ritual.id}`, created_at: `gte.${since}`, ...(surface ? { 'metadata->>surface': `eq.${surface}` } : {}) }).toString();
    const response = await fetchData(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Não foi possível consultar as métricas.');
    const total = response.headers.get('Content-Range')?.split('/')[1];
    if (!total || !/^\d+$/.test(total)) throw new Error('Contagem indisponível.');
    return Number(total);
  };
  try {
    const rows = await Promise.all(rituals.map(async (ritual) => {
      const [impressions, detailOpens, whatsappClicks] = await Promise.all([
        count(ritual, 'ritual_promotion_view', 'directory'),
        count(ritual, 'ritual_promotion_details', 'directory'),
        count(ritual, 'ritual_promotion_whatsapp'),
      ]);
      return { id: ritual.id, title: ritual.title, date: ritual.date, impressions, detailOpens, whatsappClicks };
    }));
    return json({ days, since, measuredAt: new Date().toISOString(), rows });
  } catch {
    return json({ error: 'Não foi possível carregar as métricas dos anúncios. Tente atualizar.' }, 503);
  }
}
