/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Wipe all old caches on every activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((cache) => caches.delete(cache)))
    ).then(() => self.clients.claim())
  );
});

// Clean up outdated precaches
cleanupOutdatedCaches();

// Precache all Vite-managed assets
precacheAndRoute(self.__WB_MANIFEST);

// Always fetch manifest fresh
registerRoute(
  ({ url }) => url.pathname.endsWith('.webmanifest'),
  new NetworkFirst({ cacheName: 'manifest-cache' })
);

// Always fetch icons fresh
registerRoute(
  ({ url }) => url.pathname.includes('/icons/'),
  new NetworkFirst({ cacheName: 'icon-cache' })
);