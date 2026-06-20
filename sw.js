// ─── AE Home POS — Service Worker ────────────────────────────────────────
// v4 — Fixed for GitHub Pages (relative paths, no absolute /index.html)
const CACHE   = 'ae-pos-v4';
const SW_BASE = self.location.pathname.replace(/\/sw\.js$/, '') || '';

// Derive base path from where sw.js is registered
// e.g. "" for username.github.io or "/reponame" for project repos
const PRECACHE_URLS = [
  SW_BASE + '/',
  SW_BASE + '/index.html',
  SW_BASE + '/style.css',
  SW_BASE + '/app.js',
  SW_BASE + '/manifest.json',
  SW_BASE + '/icon-192.png',
  SW_BASE + '/icon-512.png',
];

// ── Install: pre-cache static assets ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(() => {}) // skip if a file fails
          )
        );
      })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: smart routing ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  // Never intercept GAS requests or non-GET
  if (url.includes('script.google.com')) return;
  if (url.includes('fonts.googleapis.com')) return;
  if (url.includes('cdnjs.cloudflare.com')) return;
  if (req.method !== 'GET') return;

  // HTML navigation — always fetch fresh, fall back to cached index.html
  const isNavigate =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigate) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .catch(() =>
          caches.match(SW_BASE + '/index.html') ||
          caches.match(SW_BASE + '/')
        )
    );
    return;
  }

  // Static assets — cache-first, then network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
