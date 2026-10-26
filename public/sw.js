const CACHE_NAME = 'minhas-compras-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('minhas-compras-offline-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key))
  )));
});

// Keep purchases, API calls and OCR requests on the network.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (
    (await caches.match(OFFLINE_URL)) || Response.error()
  )));
});
