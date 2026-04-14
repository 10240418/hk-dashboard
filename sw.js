/* ============================================================
   sw.js — Service Worker for Hong Kong City Dashboard
   PWA: offline cache + background sync
   ============================================================ */

const CACHE_NAME = 'hk-dashboard-v10';
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);
const STATIC_URLS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/base.css',
  '/js/core.js',
  '/js/weather.js',
  '/js/transport.js',
  '/js/health.js',
  '/js/environment.js',
  '/js/cctv.js',
  '/js/bus.js',
  '/js/tides.js',
  '/js/parking.js',
  '/js/ferry.js',
  '/js/holidays.js',
  '/js/climate.js',
  '/js/beach.js',
  '/js/map.js',
  '/js/app.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

/* ── Install: cache all static assets ───────────────────────── */
self.addEventListener('install', event => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_URLS.map(url => cache.add(url).catch(() => { }))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ─────────────────────────────── */
self.addEventListener('activate', event => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k.indexOf('hk-dashboard-') === 0).map(k => caches.delete(k))
        )
      ).then(() => self.clients.claim())
    );
    return;
  }
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for static, network-first for API ───── */
self.addEventListener('fetch', event => {
  if (IS_LOCAL_DEV) return;

  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API calls: network-first with cache fallback
  const isAPI = [
    'data.weather.gov.hk',
    'rt.data.gov.hk',
    'data.etabus.gov.hk',
    'data.etagmb.gov.hk',
    'api.data.gov.hk',
    'datagovhk.blob.core.windows.net',
    'www.ha.org.hk',
    'www.1823.gov.hk',
    'api.allorigins.win',
    'tdcctv.data.one.gov.hk',
  ].some(host => url.hostname.includes(host));

  if (isAPI) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              // Cache API responses for 5 minutes max
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || Response.error())
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone).catch(() => { });
          });
        }
        return response;
      }).catch(() => {
        // Return offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('/index.html').then(cached => cached || Response.error());
        }
        return Response.error();
      });
    })
  );
});
