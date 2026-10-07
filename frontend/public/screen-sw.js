// Service worker de la pantalla gigante: guarda la app (HTML, JS, CSS e
// imágenes del mismo origen) para que /screen vuelva a abrir aunque se
// recargue SIN internet. Solo lo registra BigScreenView, así que nunca se
// instala en los celulares de los clientes.
//
// - Navegaciones: primero la red (para tomar siempre la última versión
//   publicada); sin red, la última copia guardada del HTML.
// - /assets/* (archivos con hash de Vite, nunca cambian): primero la caché.
// - Resto de archivos del mismo origen: primero la red, caché como respaldo.
// - Otros orígenes (backend, Storage, Google Fonts…) no se tocan: la config
//   de la pantalla ya se guarda en localStorage y los videos clave los guarda
//   useCachedAsset.
const CACHE_NAME = 'ledson-screen-app-v1';
const SHELL_KEY = '/__screen-shell__';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ledson-screen-app-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// La página avisa qué archivos ya cargó antes de que este service worker
// tomara el control (la primera visita), para guardarlos también.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return;
  const urls = (event.data.urls || []).filter(
    (u) => new URL(u).origin === self.location.origin,
  );
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urls.map((u) =>
          fetch(u)
            .then((res) => {
              if (!res.ok) return;
              const isPage = new URL(u).pathname.startsWith('/screen');
              return cache.put(isPage ? SHELL_KEY : u, res);
            })
            .catch(() => {}),
        ),
      ),
    ),
  );
});

// Con wifi conectado pero sin salida a internet, fetch puede tardar minutos
// en fallar: pasado este tiempo se responde con la copia guardada.
const NETWORK_TIMEOUT_MS = 5000;

const fetchAndStore = (req, key) =>
  fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(key, copy));
    }
    return res;
  });

const networkFirst = (req, key) =>
  new Promise((resolve) => {
    let settled = false;
    const fromCache = () =>
      caches.match(key).then((hit) => {
        if (hit && !settled) {
          settled = true;
          resolve(hit);
        }
        return hit;
      });
    const timer = setTimeout(fromCache, NETWORK_TIMEOUT_MS);
    fetchAndStore(req, key)
      .then((res) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(res);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then((hit) => {
          if (!settled) {
            settled = true;
            resolve(hit || Response.error());
          }
        });
      });
  });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Conexión de recarga en caliente del servidor de desarrollo de Vite.
  if (req.headers.get('accept') === 'text/event-stream') return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, SHELL_KEY));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetchAndStore(req, req)),
    );
  } else {
    event.respondWith(networkFirst(req, req));
  }
});
