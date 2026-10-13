/* DREAMS · service worker mínimo: permite instalar la app y muestra un aviso cuando no hay internet.
   No guarda datos del negocio ni respuestas de la API (siempre se consultan en línea). */
const CACHE = 'dreams-shell-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icons/dreams-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return;
  e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
});
