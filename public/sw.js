/*
 * A service worker whose only job is to not exist.
 *
 * The previous worker never installed anywhere: its install handler cached a
 * list including two files that were never in public/, cache.addAll rejects
 * if any request fails, and a rejected install discards the worker. That had
 * been true since the file was created, which meant offline.html was dead,
 * the activate-time cache cleanup never ran, and the CACHE_NAME bump the team
 * treated as a remote kill switch was connected to nothing.
 *
 * The live hazard was the day somebody added one of the missing images while
 * tidying: the worker would have installed for the first time on every
 * returning visitor, mid-campaign, and begun caching navigation payloads with
 * no working eviction path. Fixing the worker properly would have done the
 * same thing on purpose, which is the wrong change on launch day.
 *
 * So this is the third option: a worker that unregisters itself and deletes
 * anything a predecessor might have stored. It is a no-op on the devices that
 * matter (no prior worker ever installed) and a cleanup on any device where
 * one somehow did. If a PWA is wanted after the campaign, it starts from a
 * blank slate and gets verified on a real device before it ships.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      // A controlled page keeps its old controller until navigation; asking
      // each open tab to reload once hands control back to the network.
      for (const client of clients) {
        client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});
