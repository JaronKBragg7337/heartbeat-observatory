// Bump the version when changing the worker or its caching behavior.
const CACHE_NAME = 'heartbeat-morse-v1';
const PAGE_URL = new URL('./', self.registration.scope).href;
const INDEX_URL = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(PAGE_URL, { cache: 'reload' }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('heartbeat-morse-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || (url.origin + url.pathname !== PAGE_URL && url.origin + url.pathname !== INDEX_URL)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(PAGE_URL);
    if (!cached) return fetch(event.request);

    // Keep the next visit current without delaying this one or relying on shared assets.
    event.waitUntil(fetch(new Request(PAGE_URL, { cache: 'reload' }))
      .then(response => response.ok ? cache.put(PAGE_URL, response) : undefined)
      .catch(() => {}));
    return cached;
  })());
});
