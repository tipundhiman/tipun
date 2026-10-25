/* The web app needs a network connection for songs, sessions and creator data.
   Cache only this public offline notice — never API responses, media or user data. */
'use strict';

const CACHE = 'rhymeorbit-offline-v1';
const OFFLINE = '/offline.html';
const ICON = '/icons/icon-192.png';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, ICON])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(name => name.startsWith('rhymeorbit-offline-') && name !== CACHE)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === ICON) {
    event.respondWith(caches.match(ICON).then(cached => cached || fetch(request)));
    return;
  }
  if (request.mode !== 'navigate' || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error())
  );
});
