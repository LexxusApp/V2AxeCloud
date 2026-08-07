/**
 * Rotas do container marketing — o SW do app não deve quebrar navegação nelas.
 * Carregado via importScripts antes das rotas Workbox.
 *
 * Se o fetch do SW falhar (rede/CF/race de unregister), devolve Response.error
 * evita rejeitar a promise do FetchEvent (ruído "Failed to fetch" no Workbox).
 */
(function () {
  var MARKETING_PREFIXES = [
    '/register',
    '/termos',
    '/privacidade',
    '/espaco-do-fiel',
    '/terreiros',
    '/terreiro',
    '/eventos',
    '/evento',
    '/senhas',
    '/conteudo',
    '/por-que-axecloud',
    '/recursos',
  ];

  function isMarketingNavigate(url) {
    if (url.origin !== self.location.origin) return false;
    var p = url.pathname.replace(/\/+$/, '') || '/';
    if (p === '/') return true;
    for (var i = 0; i < MARKETING_PREFIXES.length; i++) {
      var prefix = MARKETING_PREFIXES[i];
      if (p === prefix || p.indexOf(prefix + '/') === 0) return true;
    }
    return false;
  }

  self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (event.request.mode !== 'navigate' && event.request.destination !== 'document') return;

    var url = new URL(event.request.url);
    if (!isMarketingNavigate(url)) return;

    event.respondWith(
      fetch(event.request, { cache: 'no-store', credentials: 'same-origin' }).catch(function () {
        return fetch(event.request.url, { cache: 'reload', credentials: 'same-origin' }).catch(function () {
          return Response.error();
        });
      }),
    );
  });
})();
