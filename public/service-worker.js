// ReadQuest service worker.
// Strategy:
// - App shell (/, manifest, icon) is precached at install. After the user
//   visits once online, the next launch — even offline — boots into the
//   React app, which renders its own OfflineBanner.
// - Other GETs (hashed JS/CSS chunks from Vite) are cache-first with a
//   background refresh — once requested they live in cache and survive
//   offline. The /api/ path is bypassed so OpenAI requests aren't cached.
// - Navigations fall back to the cached index.html when offline.

const CACHE_NAME = "readquest-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/pwa.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll is atomic: any 404 fails the whole install. Iterate so a
      // missing optional asset doesn't break activation.
      Promise.all(
        APP_SHELL.map((path) => cache.add(path).catch(() => undefined))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache or intercept the AI proxy.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: try network first, fall back to cached shell so the React
  // app boots offline and its own UI surfaces the offline state.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Refresh the cached shell when online.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() =>
          caches
            .match("/")
            .then(
              (cached) =>
                cached ||
                new Response(
                  "<h1>ReadQuest is offline</h1><p>Open the app once online to enable offline use.</p>",
                  { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
                )
            )
        )
    );
    return;
  }

  // Everything else: cache-first with background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
