const CACHE_NAME = 'disidratazione-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/htm/preact/standalone'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Verifica se la risposta è valida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone della risposta
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Se fallisce il fetch e non c'è cache, ritorna una pagina offline
          return caches.match('/index.html');
        });
      })
  );
});

// Activate
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync per sincronizzare dati quando torna online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-lavorazioni') {
    event.waitUntil(syncLavorazioni());
  }
});

async function syncLavorazioni() {
  try {
    // Qui puoi implementare la logica per sincronizzare i dati locali con il server
    console.log('Sincronizzazione lavorazioni...');
  } catch (error) {
    console.error('Errore sincronizzazione:', error);
  }
}
