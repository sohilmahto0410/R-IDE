/* R-IDE Service Worker — simple offline cache, no OTA messaging */

const CACHE_NAME = 'ride-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './coi-serviceworker.js',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // External requests (WebR WASM, CDN) — network only
  if (url.origin !== self.location.origin) return;

  // SW files — always fresh
  if (url.pathname.endsWith('sw.js') || url.pathname.endsWith('coi-serviceworker.js')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  const isShell =
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.png')  ||
    url.pathname.endsWith('.jpg')  ||
    url.pathname === new URL('./', self.location).pathname ||
    url.pathname === '/';

  if (isShell) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
