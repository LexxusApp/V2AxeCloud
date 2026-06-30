// Service Worker handlers para Web Push Notifications.
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const title = payload.title || 'AxéCloud';
      const options = {
        body: payload.body || 'Você tem uma nova notificação.',
        icon: '/pwa-192.png',
        badge: '/notification-badge.png',
        data: {
          url: payload.url || '/'
        },
        vibrate: [100, 50, 100],
        actions: [
          { action: 'open', title: 'Ver Agora' }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch (e) {
      console.error('Erro ao processar payload do push:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const rawUrl = String(event.notification.data?.url || '/');
  let urlToOpen = '/';
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    const allowed = [
      'https://axecloud.com.br',
      'https://www.axecloud.com.br',
      'https://axecloud.app',
      'https://www.axecloud.app',
    ];
    if (parsed.origin === self.location.origin || allowed.some((o) => parsed.origin === o)) {
      urlToOpen = parsed.href;
    }
  } catch (_e) {
    urlToOpen = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
