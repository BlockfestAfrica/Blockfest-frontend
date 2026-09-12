// Service Worker for Blockfest Africa PWA
// Bumped whenever caching behaviour changes, not only when assets do. The
// activate handler deletes every blockfest- cache that is not this one, which
// is what clears responses a previous worker stored that it should not have.
const CACHE_NAME = "blockfest-v3";

// Pages that belong to one person, and must never touch the cache.
//
// The navigation branch below runs before every other rule and returns, so the
// /api/ exclusion further down was never reached for a page load. That meant a
// signed-in page was written to disk with no expiry and re-served offline with
// no check against anything: it survived signing out, a revoked token and a
// deleted row, because Cache Storage is not reachable from any of them.
//
// Matched as a whole segment so /campaigns/.../me matches and a hypothetical
// /campaigns/.../mentions does not.
const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/api/admin",
  "/campaigns/monica-money-story/me",
  "/campaigns/monica-money-story/enter",
];

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
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

  // Before anything else, including the navigation branch. Nothing private is
  // read from the cache, written to it, or served from it offline: the request
  // goes to the network untouched, and if the network is down the browser's own
  // error is the honest answer.
  if (isPrivatePath(url.pathname)) return;

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

  // API calls go to the network and are never cached.
  //
  // This used to cache every successful response and serve it back when the
  // network failed, under a comment claiming a five minute lifetime that was
  // never implemented: there was no expiry at all, and an entry only left the
  // cache when CACHE_NAME changed.
  //
  // Three reasons that had to go. A cached leaderboard served as though it were
  // current, during a campaign that pays real money on it, is worse than a
  // visible failure. An endpoint that answers with somebody's own entry status
  // leaves that answer sitting in the browser cache long after they are done
  // with it. And cache.put rejects on a non-GET request, so every registration
  // POST that came through here produced a rejected promise for no benefit.
  //
  // Offline handling belongs to whatever made the call: it can tell somebody
  // the request did not go through, which is true, rather than showing them an
  // old answer as if it were a new one.
  else if (url.pathname.startsWith("/api/")) {
    return;
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
