//  DKG Online Service Worker 
// Strategy: Network-First with Cache Fallback
// - Always tries to fetch fresh files from server first
// - Falls back to cache if offline
// - Auto-updates silently in the background on every visit
// 

const CACHE_NAME = 'dkg-online-v34';

// Files to pre-cache on install (app shell)
const PRECACHE_URLS = [
  './',
  './index.html',
  './admin.html',
  './admin-install.html',
  './admin-manifest.json',
  './admin.css',
  './admin.js',
  './styles.css',
  './app.js',
  './db.js',
  './icon-fallback.js',
  './backend-config.js',
  './scroll-fix.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

//  INSTALL: Pre-cache all app shell files 
self.addEventListener('install', event => {
  console.log('[SW] Installing DKG Online Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell files...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Pre-cache complete. Activating immediately.');
        // Take control immediately without waiting for old tabs to close
        return self.skipWaiting();
      })
  );
});

//  ACTIVATE: Clean up old caches 
self.addEventListener('activate', event => {
  console.log('[SW] Activating new Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Now controlling all clients.');
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

//  FETCH: Network-First Strategy 
// 1. Try network first  if success, update cache & return response
// 2. If network fails (offline)  serve from cache
// 3. If neither works  show offline fallback
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (CDN libraries etc.)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Got a fresh response from network  clone it into cache
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed  serve from cache (offline mode)
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', event.request.url);
            return cachedResponse;
          }
          // Nothing in cache either  return offline page
          return caches.match('./index.html');
        });
      })
  );
});

//  MESSAGE: Handle skip-waiting trigger from app 
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});












