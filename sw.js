const HP_CACHE = 'haydar-pack-pwa-v57-7-physical-print';
const HP_ASSETS = [
  './',
  './index.html?v=57_7physicalprint',
  './config.js?v=57_7physicalprint',
  './manifest.webmanifest?v=57_7physicalprint',
  './offline.html',
  './assets/css/styles.css?v=57_7physicalprint',
  './hp-logo-v3-192.png?v=57_7physicalprint',
  './hp-logo-v3-512.png?v=57_7physicalprint',
  './assets/js/01-core-base.js?v=57_7physicalprint',
  './assets/js/02-business-legacy.js?v=57_7physicalprint',
  './assets/js/03-boot-calc-print.js?v=57_7physicalprint',
  './assets/js/04-sync-import.js?v=57_7physicalprint',
  './assets/js/05-feature-patches.js?v=57_7physicalprint',
  './assets/js/06-data-protection-images-backup.js?v=57_7physicalprint',
  './assets/js/07-clients-final.js?v=57_7physicalprint',
  './assets/js/08-post49-final-modules.js?v=57_7physicalprint'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(HP_CACHE)
      .then(cache => cache.addAll(HP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== HP_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(HP_CACHE).then(cache => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('./index.html?v=57_7physicalprint'))
          .then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(HP_CACHE).then(cache => cache.put(event.request, copy)));
        }
        return response;
      });
    })
  );
});
