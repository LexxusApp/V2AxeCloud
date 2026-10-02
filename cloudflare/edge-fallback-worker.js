export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/_vinext/image') {
      return env.HOME.fetch(request);
    }

    if (url.pathname === '/planos') {
      return Response.redirect(new URL('/#planos', url), 308);
    }

    return new Response('Página não encontrada', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-AxeCloud-Runtime': 'cloudflare-edge-gateway',
      },
    });
  },
};
