/* MTC service worker: lets the app open offline.
   Bump VERSION whenever you change any file, so phones pick up the update. */
const VERSION = 'mtc-beta-7';
const SHELL = [
  './', './index.html', './app.css', './app.js', './content.js', './config.js', './version.js', './vendor/supabase.js',
  './manifest.webmanifest', './bendix.jpg',
  './brand/mtc-logo-white.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts, YouTube, Discord go straight to the network
  // network first so updates show up, fall back to the saved copy when offline
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
