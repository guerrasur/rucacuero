// Service worker de Ruca Cuero.
// La app (HTML/JS/CSS) va por RED primero: al recargar con conexión SIEMPRE ves
// la última versión, y el caché queda solo de respaldo offline (antes era
// cache-first y una recarga nunca traía la actualización — pasaba en Brave iOS).
// Las fuentes, íconos e imágenes (pesados e inmutables) siguen cache-first.
// REGLA: cualquier cambio en un asset requiere bumpear CACHE (rucacuero-vN).
const CACHE = 'rucacuero-v31';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'manifest.json',
  'js/main.js',
  'js/state.js',
  'js/economy.js',
  'js/climb.js',
  'js/carrera.js',
  'js/events.js',
  'js/quests.js',
  'js/logros.js',
  'js/cosmetics.js',
  'js/scene.js',
  'js/ui.js',
  'js/iconos.js',
  'js/audio.js',
  'js/compartir.js',
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

// La app (documento, JS y CSS) se resuelve por red primero y refresca el caché;
// si no hay conexión, cae al caché. Todo lo demás es cache-first.
const APP_SHELL = /\.(?:html|js|css)$/i;

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  const netFirst = e.request.mode === 'navigate' || url.pathname === '/' || APP_SHELL.test(url.pathname);
  if (netFirst) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
