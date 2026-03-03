const CACHE = 'notifyr-v2';
const APP_SHELL = [
  '/notifyr/',
  '/notifyr/index.html',
  '/notifyr/manifest.json',
  '/notifyr/icons/icon-192.png',
  '/notifyr/icons/icon-512.png'
];

// Install: cache the full app shell so offline check passes
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell, network-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAppShell = APP_SHELL.some(p => url.pathname === p || url.pathname.startsWith('/notifyr/icons/'));
  const isCrossOrigin = url.origin !== self.location.origin;

  if (isCrossOrigin) return; // Don't intercept Google Fonts etc.

  if (isAppShell) {
    // Cache-first: serve from cache, update in background
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(resp => {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
  }
});

// Handle notification messages from the page
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'NOTIFY') return;
  self.registration.showNotification(e.data.title, {
    body: e.data.body || '',
    icon: '/notifyr/icons/icon-192.png',
    badge: '/notifyr/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'notifyr-' + Date.now(),
    renotify: true
  });
});

// Tap notification -> focus or open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.includes('/notifyr'));
      if (match) return match.focus();
      return clients.openWindow('/notifyr/');
    })
  );
});
