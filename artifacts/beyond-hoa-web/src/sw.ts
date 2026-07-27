/// <reference lib="webworker" />
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// @ts-ignore
if (workbox) {
  // @ts-ignore
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);
} else {
  console.log('Workbox could not be loaded.');
}