'use strict';

const HP_SW_VERSION = '58.0.0-rc.3/installer1';
const HP_STATIC_CACHE = 'haydar-pack-static-v58rc3installer1';
const HP_OFFLINE_URL = './offline.html?v=58rc3installer1';
const HP_STATIC_ASSETS = [
  './index.html?v=58rc3installer1',
  './config.js?v=58rc3installer1',
  './offline.html?v=58rc3installer1',
  './manifest.webmanifest?v=58rc3installer1',
  './assets/css/styles.css?v=58rc3installer1',
  './hp-logo-v3-192.png?v=58rc3installer1',
  './hp-logo-v3-512.png?v=58rc3installer1',
  './assets/js/01-app-core.js?v=58rc3installer1',
  './assets/js/02-api-client.js?v=58rc3installer1',
  './assets/js/03-domain-calculations.js?v=58rc3installer1',
  './assets/js/04-business-actions.js?v=58rc3installer1',
  './assets/js/05-ui-pages.js?v=58rc3installer1',
  './assets/js/06-reports-capital.js?v=58rc3installer1',
  './assets/js/07-documents-pdf.js?v=58rc3installer1',
  './assets/js/08-backup-recovery.js?v=58rc3installer1'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(HP_STATIC_CACHE).then(function (cache) { return cache.addAll(HP_STATIC_ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== HP_STATIC_CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  /* Apps Script responses and mutable business JSON are never cached. */
  if (url.origin !== self.location.origin || /script\.google\.com$/.test(url.hostname) || /(?:state|backup|mutation).*\.json$/i.test(url.pathname)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, {cache: 'no-store'}).catch(function () {
      return caches.match('./index.html?v=58rc3installer1').then(function (cached) { return cached || caches.match(HP_OFFLINE_URL); });
    }));
    return;
  }

  var isVersionedStatic = url.searchParams.get('v') === '58rc3installer1' && HP_STATIC_ASSETS.some(function (asset) { return url.pathname.endsWith(asset.replace(/^\.\//, '').split('?')[0]); });
  if (!isVersionedStatic) return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    return cached || fetch(event.request).then(function (response) {
      if (response.ok && response.type === 'basic') event.waitUntil(caches.open(HP_STATIC_CACHE).then(function (cache) { return cache.put(event.request, response.clone()); }));
      return response;
    });
  }));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'GET_VERSION' && event.source) event.source.postMessage({type: 'VERSION', version: HP_SW_VERSION});
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
