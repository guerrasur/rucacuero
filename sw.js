// Service worker de Ruca Cuero: cache-first con precache cerrado.
// REGLA: cualquier cambio en un asset requiere bumpear CACHE (rucacuero-vN).
const CACHE = 'rucacuero-v2';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'manifest.json',
  'js/main.js',
  'js/state.js',
  'js/economy.js',
  'js/climb.js',
  'js/events.js',
  'js/quests.js',
  'js/logros.js',
  'js/scene.js',
  'js/ui.js',
  'js/audio.js',
  'fonts/chango-latin.woff2',
  'fonts/chango-latin-ext.woff2',
  'fonts/bricolage-latin.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
