/* ═══════════════════════════════════════════════════════════
   THE SCRIBBLER'S ALMANAC — sw.js
   Offline-first service worker. Cache-first for app shell
   and fonts, network-first for everything else.
═══════════════════════════════════════════════════════════ */

const VERSION     = 'almanac-v1';
const FONT_CACHE  = 'almanac-fonts-v1';

/* All app shell assets to pre-cache on install */
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/stories.js',
  '/manifest.json'
];

/* ── Install: pre-cache app shell ──────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ───────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const toDelete = keys.filter(k => k !== VERSION && k !== FONT_CACHE);
      return Promise.all(toDelete.map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

/* ── Fetch: tiered strategy ────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Google Fonts — cache-first, long-lived
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // App shell assets — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, VERSION));
    return;
  }

  // Everything else — network-first with cache fallback
  event.respondWith(networkFirst(request, VERSION));
});

/* ── Strategies ────────────────────────────────────────── */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — return a minimal offline page for navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
