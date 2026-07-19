/**
 * KOTOBA TRAINER — service-worker.js
 * Strategi: Network-first untuk semua file penting (js, data, html)
 * Cache hanya untuk fallback offline
 * Versi cache selalu berubah otomatis pakai timestamp build
 */

const CACHE_VERSION = 'kotoba-20250719-001';
const CACHE_NAME    = 'kotoba-cache-' + CACHE_VERSION;

// File yang di-cache untuk offline fallback
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

// Handle pesan dari halaman (force update)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: cache semua aset, langsung skip waiting
self.addEventListener('install', event => {
  console.log('[SW] Install - versi:', CACHE_VERSION);
  self.skipWaiting(); // langsung aktif, tidak tunggu tab lama tutup
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: hapus SEMUA cache lama
self.addEventListener('activate', event => {
  console.log('[SW] Activate - hapus cache lama');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Hapus cache lama:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        console.log('[SW] Klaim semua klien');
        return self.clients.claim(); // ambil alih semua tab sekarang juga
      })
  );
});

// Fetch: Network-first untuk JS, HTML, Data — Cache-first untuk gambar/icon
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Hanya handle request dari origin yang sama
  if (url.origin !== location.origin) return;

  const isNetworkFirst =
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/'           ||
    url.pathname.endsWith('/');

  if (isNetworkFirst) {
    // Network-first: selalu coba ambil dari network dulu
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            // Update cache dengan versi terbaru
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback ke cache kalau offline
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
  } else {
    // Cache-first untuk aset statis (icon, css, font)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
