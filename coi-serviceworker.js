/* coi-serviceworker v0.1.7 — github.com/gzuidhof/coi-serviceworker
   Adds Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy headers
   so SharedArrayBuffer (required by WebR/WASM threads) works on GitHub Pages.
*/
(() => {
  // If already cross-origin isolated, nothing to do.
  if (self.crossOriginIsolated !== undefined) {
    if (!self.crossOriginIsolated) {
      // Register this file as a service worker, then reload to activate isolation.
      if (!("serviceWorker" in navigator)) {
        console.warn("coi-serviceworker: browser has no SW support — WebR may be slow or fail");
        return;
      }
      navigator.serviceWorker
        .register(window.coi ? window.coi.coiUrl : "./coi-serviceworker.js")
        .then((reg) => {
          console.log("[coi] Service worker registered:", reg.scope);
          reg.addEventListener("updatefound", () => {
            reg.installing?.addEventListener("statechange", (e) => {
              if (e.target.state === "installed") {
                console.log("[coi] Installed — reloading for isolation…");
                location.reload();
              }
            });
          });
          // If already activated (e.g. page refresh), reload right away.
          if (reg.active && !navigator.serviceWorker.controller) {
            location.reload();
          }
        })
        .catch((err) => console.error("[coi] SW registration failed:", err));
    }
    return;
  }

  // ── We are running inside the service worker itself ──
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    if (e.request.cache === "only-if-cached" && e.request.mode !== "same-origin") return;

    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Only patch responses that need it (skip opaque/error responses).
          if (res.status === 0) return res;

          const newHeaders = new Headers(res.headers);
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
          newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
          newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: newHeaders,
          });
        })
        .catch((err) => {
          console.error("[coi] Fetch failed:", err);
          throw err;
        })
    );
  });
})();
