/**
 * KOTOBA TRAINER — service-worker.js
 * VERSI BARU: ganti CACHE_NAME supaya SW lama dibuang
 */

const CACHE_NAME = 'kotoba-v4';  // <-- naik versi setiap deploy besar
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './data.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

self.addEventListener('install', event => {
  // Langsung aktif, tidak tunggu tab lama ditutup
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  // Hapus semua cache lama (v1, v2, dll)
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())  // ambil alih semua tab sekarang
  );
});

self.addEventListener('fetch', event => {
  // Network-first untuk HTML supaya selalu dapat yang terbaru
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first untuk aset lain (js, css, data)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
