// Sophionix Service Worker — Workbox-based offline shell
// Uses importScripts to load Workbox from CDN (simplest approach)
// In production, swap to local copy built via workbox-cli

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { precacheAndRoute } = workbox.precaching;

// Shell routes — cache-first for static assets
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'static-resources' })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })]
  })
);

// App shell — network-first for HTML pages (home, journal)
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    (url.pathname === '/' || url.pathname.startsWith('/journal')),
  new NetworkFirst({
    cacheName: 'app-shell',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 })]
  })
);

// Fallback offline page
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
