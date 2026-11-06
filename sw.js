'use strict';

const CACHE_NAME = 'kintore-v1';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// すぐキャッシュで表示しつつ裏で更新する（次回起動時に新しい版が反映される）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = event.request.mode === 'navigate' ? './' : event.request;
    const cached = await cache.match(key);
    const update = fetch(event.request).then((response) => {
      if (response.ok) cache.put(key, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(update.catch(() => {}));
      return cached;
    }
    return update;
  })());
});
