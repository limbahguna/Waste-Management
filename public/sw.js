const CACHE_NAME = 'limbahguna-v3-universal';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

// Force install - skip waiting to activate immediately
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Force activate immediately
  );
});

// On activate - delete ALL old caches and claim all clients
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW] Now controlling all clients`);
      return self.clients.claim(); // Take control of all open pages
    })
  );
});

// Network-first strategy for navigation, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;

  // Always go network-first for HTML navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)) // Fallback to cache if offline
    );
    return;
  }

  // Cache-first for other assets (images, scripts, styles)
  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
  );
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
