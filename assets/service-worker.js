// service-worker.js
// Service Worker for offline support and API response caching

const CACHE_VERSION = 'sxrx-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/assets/app.css',
  '/assets/custom.css',
  '/assets/error-messages.js',
  '/assets/mobile-styles.js',
  '/assets/onboarding.js'
];

// API endpoints to cache (read-only endpoints)
const CACHEABLE_API_PATTERNS = [
  /\/api\/tebra\/provider\/get/,
  /\/api\/tebra\/appointment\/search/,
  /\/api\/shopify\/customers\/.*\/chart/,
  /\/api\/availability\/slots/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
        // Continue even if some assets fail to cache
      });
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE && 
              cacheName !== IMAGE_CACHE &&
              cacheName.startsWith('sxrx-')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (except our API)
  if (url.origin !== location.origin && !isAPIRequest(url)) {
    return;
  }
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isImageRequest(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, { maxAge: 7 * 24 * 60 * 60 * 1000 })); // 7 days
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
  } else {
    // For other requests, try network first, fallback to cache
    event.respondWith(networkFirst(request));
  }
});

// Helper functions

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2');
}

/**
 * Check if URL is an image request
 */
function isImageRequest(url) {
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) ||
         url.pathname.includes('/images/');
}

/**
 * Check if URL is an API request
 */
function isAPIRequest(url) {
  // Check if it's our backend API
  const backendApi = self.location.origin.includes('shopify') 
    ? (window.BACKEND_API || '') 
    : '';
  
  if (backendApi && url.origin === new URL(backendApi).origin) {
    return true;
  }
  
  // Check if it matches cacheable API patterns
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

/**
 * Cache-first strategy: check cache first, fallback to network
 */
async function cacheFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // Check if cache is still valid
    const cacheDate = cached.headers.get('date');
    if (cacheDate && options.maxAge) {
      const age = Date.now() - new Date(cacheDate).getTime();
      if (age < options.maxAge) {
        return cached;
      }
    } else {
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone response before caching (responses can only be read once)
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error('[SW] Network request failed:', error);
    // Return cached version even if expired, or return offline page
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first strategy: try network first, fallback to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.warn('[SW] Network request failed, trying cache:', error);
    const cache = await caches.match(request);
    if (cache) {
      return cache;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first with caching for API requests
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  const url = new URL(request.url);
  
  // Check if this API endpoint should be cached
  const shouldCache = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
  
  try {
    const response = await fetch(request);
    
    // Cache successful GET responses
    if (response.ok && shouldCache && request.method === 'GET') {
      // Check cache-control headers
      const cacheControl = response.headers.get('cache-control');
      const maxAge = cacheControl ? parseMaxAge(cacheControl) : 300; // Default 5 minutes
      
      if (maxAge > 0) {
        const responseToCache = response.clone();
        cache.put(request, responseToCache);
        
        // Set expiration metadata
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cached-at', new Date().toISOString());
        headers.set('sw-max-age', maxAge.toString());
        
        return new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
      }
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] API request failed, trying cache:', error);
    
    // Try to serve from cache
    const cached = await cache.match(request);
    if (cached) {
      // Check if cached response is still valid
      const cachedAt = cached.headers.get('sw-cached-at');
      const maxAge = parseInt(cached.headers.get('sw-max-age') || '300') * 1000;
      
      if (cachedAt && maxAge) {
        const age = Date.now() - new Date(cachedAt).getTime();
        if (age < maxAge) {
          // Add header to indicate this is from cache
          const headers = new Headers(cached.headers);
          headers.set('X-Served-From-Cache', 'true');
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: headers
          });
        }
      } else if (cached) {
        // No expiration info, serve anyway when offline
        const headers = new Headers(cached.headers);
        headers.set('X-Served-From-Cache', 'true');
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: headers
        });
      }
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Network request failed',
        message: 'You are offline. Please check your connection.',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Parse max-age from Cache-Control header
 */
function parseMaxAge(cacheControl) {
  const match = cacheControl.match(/max-age=(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('sxrx-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            return { name: cacheName, size: keys.length };
          })
        );
      }).then((sizes) => {
        event.ports[0].postMessage({ sizes });
      })
    );
  }
});
