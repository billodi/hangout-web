const CACHE_NAME = "hangout-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.svg", "/icon-512.svg", "/apple-touch-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const isSameOrigin = url.origin === self.location.origin;

  // Never cache extension/custom schemes and avoid third-party runtime requests.
  if (!isHttp || !isSameOrigin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const cloned = response.clone();
          void caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, cloned).catch(() => {
              // Best-effort cache write only.
            }),
          );
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    }),
  );
});
