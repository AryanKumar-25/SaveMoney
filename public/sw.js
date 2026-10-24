// Service Worker for SaveMoney PWA
const CACHE_NAME = 'savemoney-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch with network-first strategy
  if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// Web Push Notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'SaveMoney Alert';
    const options = {
      body: data.message || data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: data.url || '/alerts',
      },
      tag: data.tag || 'savemoney-alert',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('SaveMoney Alert', {
        body: text,
        icon: '/icon.svg',
        data: { url: '/alerts' },
      })
    );
  }
});

// Click notification to focus/open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
