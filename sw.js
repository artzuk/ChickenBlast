// Offline-Cache für Chicken Blast. Bei Änderungen am Spiel VERSION erhöhen.
const VERSION = 'chickenblast-v7';
const FILES = [
  './',
  'index.html',
  'core.js',
  'worlds.js',
  'firebase-config.js',
  'highscore.js',
  'game.js',
  'manifest.webmanifest',
  'fonts/PressStart2P-latin.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Netzwerk zuerst (damit Updates sofort ankommen), Cache als Fallback offline.
// Fremde Server (Firebase-API, Login, reCAPTCHA) nie anfassen – nur eigene Dateien und das Firebase-SDK cachen.
const SDK = 'https://www.gstatic.com/firebasejs/';
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith(self.location.origin + '/') && !url.startsWith(SDK)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
