const CACHE_NAME = 'notifyr-v1';
const BASE = '/notifyr/';

const CACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'sw.js',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
];

// ─── Install: pre-cache app shell ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ─── Activate: purge old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: cache-first strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache valid same-origin responses
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      });
    })
  );
});

// ─── Message: fire notification from page ───────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'NOTIFY') {
    const { title, body, tag } = event.data;
    const options = {
      body: body || '',
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      tag: tag || 'notifyr-' + Date.now(),
      vibrate: [200, 100, 200],
      data: { url: self.location.origin + BASE },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// ─── Notification click: focus or open app window ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : self.location.origin + BASE;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if available
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin + BASE) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
