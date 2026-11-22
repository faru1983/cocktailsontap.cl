// Service Worker exclusivo para /admin (Network-Only para mantener datos y Server Actions en vivo)
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Solo peticiones GET dentro de /admin; no cacheamos HTML/RSC/Server Actions
    if (event.request.method !== 'GET') return;
});
