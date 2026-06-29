/**
 * Rotas servidas pelo container marketing — o SW do app não deve aplicar precache/NetworkFirst nelas.
 * Carregado via importScripts antes das rotas Workbox.
 */
(function () {
  var MARKETING_PREFIXES = [
    '/termos',
    '/privacidade',
    '/espaco-do-fiel',
    '/terreiros',
    '/terreiro',
    '/eventos',
    '/conteudo',
    '/por-que-axecloud',
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

  function debugPostMessage(payload) {
    payload.sessionId = '37bbb6';
    payload.timestamp = Date.now();
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      clients.forEach(function (c) {
        try {
          c.postMessage(payload);
        } catch (_e) {
          /* */
        }
      });
    });
  }

  self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    if (event.request.mode !== 'navigate' && event.request.destination !== 'document') return;

    var url = new URL(event.request.url);
    if (!isMarketingNavigate(url)) return;

    event.respondWith(
      fetch(event.request, { cache: 'no-store', credentials: 'same-origin' })
        .then(function (response) {
          // #region agent log
          debugPostMessage({
            hypothesisId: 'A',
            location: 'sw-marketing-bypass.js:fetch',
            message: 'marketing navigate pass-through ok',
            data: { path: url.pathname, status: response.status },
          });
          // #endregion
          return response;
        })
        .catch(function (err) {
          // #region agent log
          debugPostMessage({
            hypothesisId: 'A',
            location: 'sw-marketing-bypass.js:fetch',
            message: 'marketing navigate pass-through FAIL',
            data: { path: url.pathname, err: String(err) },
          });
          // #endregion
          throw err;
        }),
    );
  });
})();
