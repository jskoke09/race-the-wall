const CACHE_NAME = 'race-the-wall-v1';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE_NAME).map((x) => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('/index.html'))); return; }
  e.respondWith(caches.match(e.request).then((c) => { const f = fetch(e.request).then((r) => { caches.open(CACHE_NAME).then((cache) => cache.put(e.request, r.clone())); return r; }).catch(() => c); return c || f; }));
});
