/* coi-serviceworker v0.1.7 — github.com/gzuidhof/coi-serviceworker
   Injects Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy headers
   so SharedArrayBuffer (required by WebR/WASM threads) works on GitHub Pages.
*/
(() => {
  const IS_SW = typeof window === 'undefined';

  // ── Running inside the Service Worker ──
  if (IS_SW) {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', e => {
      if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
      e.respondWith(
        fetch(e.request).then(res => {
          if (res.status === 0) return res;
          const h = new Headers(res.headers);
          h.set('Cross-Origin-Opener-Policy',   'same-origin');
          h.set('Cross-Origin-Embedder-Policy',  'require-corp');
          h.set('Cross-Origin-Resource-Policy',  'cross-origin');
          return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
        }).catch(err => { throw err; })
      );
    });
    return;
  }

  // ── Running in the page ──
  // If already isolated, nothing to do
  if (self.crossOriginIsolated) return;

  if (!('serviceWorker' in navigator)) {
    console.warn('[coi] No service worker support — WebR may fail');
    return;
  }

  navigator.serviceWorker.register('./coi-serviceworker.js')
    .then(reg => {
      console.log('[coi] Registered:', reg.scope);
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', e => {
          if (e.target.state === 'installed') {
            console.log('[coi] Installed — reloading for isolation…');
            location.reload();
          }
        });
      });
      // Already active but page isn't controlled yet → reload once
      if (reg.active && !navigator.serviceWorker.controller) {
        location.reload();
      }
    })
    .catch(err => console.error('[coi] Registration failed:', err));
})();
