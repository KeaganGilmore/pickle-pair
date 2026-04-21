// Self-destructing service worker.
//
// A previous deploy registered a PWA service worker at this path which
// pre-cached old /pickle-pair/ assets and now serves them forever. Because
// we removed the PWA plugin, there is no new SW to push an update —
// unless a file lives at this exact URL, the old SW never refreshes.
//
// This script lives at the same path, so the old SW sees it as an update,
// installs it, and hands over control. On activation it wipes every
// cache, unregisters itself, and reloads every open tab so they fetch
// fresh HTML/JS from the network.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (err) {
        console.warn('cache cleanup failed', err);
      }
      try {
        await self.registration.unregister();
      } catch (err) {
        console.warn('unregister failed', err);
      }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch (err) {
        console.warn('reload failed', err);
      }
    })(),
  );
});

// Fall through: if any request is intercepted before activation completes,
// just pass to network — never serve from the legacy precache.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response(null, { status: 504 })));
});
