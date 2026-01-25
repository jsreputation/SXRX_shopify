// service-worker-register.js
// Register service worker for offline support
// NOTE: Service workers in Shopify assets folder have scope limitations
// This is optional and will gracefully fail if scope restrictions prevent registration

(function() {
  'use strict';
  
  // Check if service worker should be enabled (can be disabled via environment/config)
  const SW_ENABLED = window.SXRX?.serviceWorkerEnabled !== false; // Default to enabled if not explicitly disabled
  
  if ('serviceWorker' in navigator && SW_ENABLED) {
    window.addEventListener('load', () => {
      // Try to get service worker path from existing script tag or use fallback
      let swPath = '/assets/service-worker.js';
      
      // Try to find service-worker-register.js script tag to get correct base path
      const registerScript = document.querySelector('script[src*="service-worker-register.js"]');
      if (registerScript && registerScript.src) {
        try {
          const urlObj = new URL(registerScript.src);
          const pathParts = urlObj.pathname.split('/');
          const assetsIndex = pathParts.indexOf('assets');
          if (assetsIndex !== -1) {
            // Use same base path as the register script
            swPath = `${urlObj.origin}${pathParts.slice(0, assetsIndex + 1).join('/')}/service-worker.js`;
          }
        } catch (e) {
          // Invalid URL, use fallback
        }
      }
      
      // Determine scope based on service worker location
      // In Shopify, assets are served from /cdn/shop/t/{theme_id}/assets/
      // Service worker scope MUST be within the directory where the SW file is located
      // Since the SW is at /cdn/shop/t/{id}/assets/service-worker.js, scope must be /cdn/shop/t/{id}/assets/
      let swScope = '/';
      try {
        const urlObj = new URL(swPath);
        // Get the directory containing the service worker file (remove filename)
        const swDir = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
        
        // The scope must be the directory where the SW file is located
        // If SW is at /cdn/shop/t/26/assets/service-worker.js, scope must be /cdn/shop/t/26/assets/
        swScope = swDir;
        
        console.log('[SW] Service Worker path:', swPath);
        console.log('[SW] Calculated scope:', swScope);
      } catch (e) {
        // Invalid URL, try to extract scope from swPath string
        const lastSlash = swPath.lastIndexOf('/');
        if (lastSlash > 0) {
          swScope = swPath.substring(0, lastSlash + 1);
        } else {
          swScope = '/';
        }
        console.warn('[SW] Failed to parse service worker URL, using fallback scope:', swScope);
      }
      
      navigator.serviceWorker.register(swPath, {
        scope: swScope
      }).then((registration) => {
        console.log('[SW] Service Worker registered successfully:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[SW] New service worker available');
              
              // Optionally show notification to user
              if (window.SXRX && window.SXRX.showNotification) {
                window.SXRX.showNotification({
                  message: 'A new version is available. Refresh to update.',
                  type: 'info',
                  action: {
                    label: 'Refresh',
                    onClick: () => window.location.reload()
                  }
                });
              }
            }
          });
        });
        
        // Expose service worker utilities
        window.SXRX = window.SXRX || {};
        window.SXRX.ServiceWorker = {
          registration: registration,
          
          // Clear all caches
          clearCache: async () => {
            if (registration.active) {
              return new Promise((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => {
                  resolve(event.data);
                };
                registration.active.postMessage(
                  { type: 'CLEAR_CACHE' },
                  [channel.port2]
                );
              });
            }
          },
          
          // Get cache sizes
          getCacheSize: async () => {
            if (registration.active) {
              return new Promise((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => {
                  resolve(event.data);
                };
                registration.active.postMessage(
                  { type: 'GET_CACHE_SIZE' },
                  [channel.port2]
                );
              });
            }
          },
          
          // Unregister service worker
          unregister: async () => {
            const unregistered = await registration.unregister();
            if (unregistered) {
              console.log('[SW] Service Worker unregistered');
            }
            return unregistered;
          }
        };
        
      }).catch((error) => {
        // Handle different error types gracefully
        const errorMsg = error?.message || String(error);
        const is404 = errorMsg.includes('404') || errorMsg.includes('Failed to fetch');
        const isScopeError = errorMsg.includes('scope') || errorMsg.includes('Service-Worker-Allowed');
        
        if (is404) {
          console.warn('[SW] Service Worker file not found. Ensure service-worker.js is uploaded to your Shopify theme assets folder.');
        } else if (isScopeError) {
          // Scope restrictions in Shopify assets folder - this is expected and OK
          console.info('[SW] Service Worker scope restrictions detected. Service worker disabled due to Shopify asset path limitations.');
          console.info('[SW] Attempted scope:', swScope, '| Service Worker path:', swPath);
          console.info('[SW] This is normal and does not affect site functionality. Service workers in Shopify assets folder can only control assets, not the entire site.');
        } else {
          console.warn('[SW] Service Worker registration failed:', error);
        }
      });
      
      // Handle service worker controller changes
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('[SW] New service worker activated, reloading page');
          window.location.reload();
        }
      });
    });
  } else {
    if (!SW_ENABLED) {
      console.info('[SW] Service Worker is disabled via configuration.');
    } else {
      console.warn('[SW] Service Workers are not supported in this browser');
    }
  }
})();
