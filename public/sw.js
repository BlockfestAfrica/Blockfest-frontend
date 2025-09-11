// Service Worker for Blockfest Africa PWA
const CACHE_NAME = "blockfest-v1";
const STATIC_CACHE_URLS = [
  "/",
  "/favicon.ico",
  "/images/logo.svg",
  "/images/mobile-logo.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/offline.html",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches (scoped to our prefix)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith("blockfest-") && name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
      // Enable navigation preload when available
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
    })()
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const { request } = event;
  const url = new URL(request.url);

  // Handle navigations explicitly with offline fallback and preload
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const preload =
            "preloadResponse" in event ? await event.preloadResponse : null;
          if (preload) return preload;
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            event.waitUntil(cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(request);
          return cached || (await cache.match("/offline.html"));
        }
      })()
    );
    return;
  }

  // Cache-first strategy for static assets
  if (
    request.destination === "image" ||
    url.pathname.match(/\.(js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;

        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone))
            );
          }
          return response;
        });
      })
    );
  }

  // Network-first strategy for API calls and dynamic content
  else if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("insights")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for 5 minutes
          if (response.ok) {
            const responseClone = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone))
            );
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
  }

  // Stale-while-revalidate for HTML pages
  else {
    event.respondWith(
      caches.match(request).then((response) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, networkResponse.clone()))
            );
          }
          return networkResponse;
        });

        // Return cache immediately, update in background
        return response || fetchPromise;
      })
    );
  }
});
