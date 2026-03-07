/* R-IDE Service Worker — GitHub Pages Edition
   ─────────────────────────────────────────────
   OTA UPDATES: bump APP_VERSION to force all clients to get fresh files.
   Just change the version string, commit & push — users get the update
   automatically on next visit (after one background refresh cycle).
*/

const APP_VERSION = '1.0.1'; // ← bump this on every release
const CACHE_NAME  = `ride-${APP_VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './coi-serviceworker.js',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL: cache app shell immediately
self.addEventListener('install', event => {
  console.log(`[SW] Installing v${APP_VERSION}…`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ── ACTIVATE: delete all old version caches
self.addEventListener('activate', event => {
  console.log(`[SW] Activating v${APP_VERSION}`);
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const oldKeys = keys.filter(k => k.startsWith('ride-') && k !== CACHE_NAME);
        const isUpdate = oldKeys.length > 0; // only true when replacing an existing version
        return Promise.all(oldKeys.map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })).then(() => isUpdate);
      })
      .then(isUpdate => self.clients.claim().then(() => isUpdate))
      .then(isUpdate => {
        // Only notify clients if this is a genuine update (old caches existed)
        if (!isUpdate) return;
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION }));
        });
      })
  );
});

// ── FETCH: smart caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // External requests (WebR WASM, CDN, fonts) go straight to network
  if (url.origin !== self.location.origin) return;

  // SW files always fetched fresh
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
    // Stale-while-revalidate: serve instantly from cache, update in background
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

  // Network-first for everything else
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
