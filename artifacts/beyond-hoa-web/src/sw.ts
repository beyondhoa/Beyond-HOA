/// <reference lib="webworker" />
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

declare const self: ServiceWorkerGlobalScope;

// @ts-ignore
if (workbox) {
  // 1. Force the waiting service worker to become the active service worker immediately
  // @ts-ignore
  workbox.core.skipWaiting();
  
  // 2. Force the active service worker to take control of all open clients/tabs
  // @ts-ignore
  workbox.core.clientsClaim();

  // @ts-ignore
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
} else {
  console.log('Workbox could not be loaded.');
}

// 3. Automatically reload the window when a new worker takes control
self.addEventListener('controllerchange', () => {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.navigate(client.url);
    });
  });
});