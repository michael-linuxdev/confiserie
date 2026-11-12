// Service Worker – Truffle Box
// Cache-first für alle App-Dateien. VERSION wird beim Deploy (GitHub Actions)
// durch den Commit-Hash ersetzt; jede Auslieferung bekommt so einen neuen Cache.
// Bei manuellem Hosting: VERSION bei jeder Änderung an den App-Dateien erhöhen.
const VERSION = 'dev';
const PREFIX = 'confiserie-';
const CACHE = PREFIX + VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/nunito-latin-700-normal.woff2',
  'fonts/nunito-latin-800-normal.woff2',
  'fonts/nunito-latin-900-normal.woff2',
  'fonts/playfair-display-latin-700-italic.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', (e) => {
  // cache:'reload' umgeht den HTTP-Cache, damit wirklich die neue Version im Cache landet.
  // Kein skipWaiting hier: die neue Version wartet, bis im Spiel auf den Hinweis getippt wird.
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === 'navigate') {
          const shell = await cache.match('./');
          if (shell) return shell;
        }
        throw err;
      }
    })
  );
});
