/* ═══════════════════════════════════════════════════════
   Don Bosco Lab Management — Service Worker (PWA)
   Cache-first for app shell, network-first for API calls
═══════════════════════════════════════════════════════ */

const CACHE_NAME  = 'labmgmt-v2';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// ── INSTALL: cache app shell ──────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_FILES.filter(url => url.startsWith('./')))
        .catch(() => { /* network might be unavailable on first install */ })
    )
  );
});

// ── ACTIVATE: clean old caches ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: route strategy ─────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Always network for GAS API calls
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    return; // let browser handle natively
  }

  // 2. Network-first for navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Update cache in background
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. Cache-first for CDN assets (fonts, icons, libraries)
  if (url.includes('fonts.googleapis.com') || url.includes('cdnjs.cloudflare.com') ||
      url.includes('jsdelivr.net') || url.includes('unpkg.com') ||
      url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // 4. Cache-first for local static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
