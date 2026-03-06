/* R-IDE Service Worker — v3
   Caches the app shell for offline use.
   WebR's own WASM/package files are handled by WebR itself.
*/

const CACHE_NAME = 'ride-v4';

// Files to cache on install — the "app shell"
const SHELL_FILES = [
  './',
  './index.html',
  './coi-serviceworker.js',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: cache the app shell immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())   // activate right away, don't wait for old SW to die
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ── ACTIVATE: delete any old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)   // any cache that isn't the current version
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())   // take control of all open tabs immediately
  );
});

// ── FETCH: decide what to serve from cache vs network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests (not WebR CDN, Google Fonts, etc.)
  if (url.origin !== self.location.origin) {
    // Let external requests (WebR WASM, CDN packages, fonts) go straight to network
    // WebR handles its own caching internally
    return;
  }

  const isShellFile =
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.png')  ||
    url.pathname === '/'           ||
    url.pathname === '';

  if (isShellFile) {
    // Cache-first strategy for shell files:
    // Serve from cache instantly, then update cache in background
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response.ok) {
              // Update the cache silently in the background
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);  // if network fails, return what we have cached

        return cached || networkFetch;  // cached copy first, or wait for network
      })
    );
    return;
  }

  // For everything else (sw.js itself, any other local files):
  // Network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
