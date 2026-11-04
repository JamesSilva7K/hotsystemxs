// Hot System Service Worker (PWA & Push Notifications)
const CACHE_NAME = 'hotsystem-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Suporte a Push Notifications personalizadas (Vendas, PIX gerado)
self.addEventListener('push', (event) => {
  let data = {
    title: '💰 Venda Aprovada · Hot System VIP',
    body: 'Novo pagamento confirmado pelo webhook!',
    icon: '/icon-192.png',
  };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '💰 Hot System VIP', {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: data.tag || 'hot-system-sale',
      renotify: true,
      requireInteraction: true,
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || '/');
      }
    })
  );
});
