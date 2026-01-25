// shopify_new/assets/script-loader.js
// Lazy loading and code splitting utility for Shopify theme
// Optimizes bundle loading by deferring non-critical scripts

(function() {
  'use strict';

  const SCRIPT_LOADER_VERSION = '2026-01-21-1';
  console.log(`[SXRX] script-loader loaded (${SCRIPT_LOADER_VERSION})`);

  // Cache for loaded scripts to prevent duplicate loads
  const loadedScripts = new Set();
  const loadingPromises = new Map();

  /**
   * Load a script dynamically
   * @param {string} src - Script source URL
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   */
  function loadScript(src, options = {}) {
    const {
      async = true,
      defer = true,
      type = 'text/javascript',
      id = null,
      onLoad = null,
      onError = null
    } = options;

    // Return cached promise if already loading
    if (loadingPromises.has(src)) {
      return loadingPromises.get(src);
    }

    // Return resolved promise if already loaded
    if (loadedScripts.has(src)) {
      return Promise.resolve();
    }

    const promise = new Promise((resolve, reject) => {
      // Check if script already exists in DOM
      const existingScript = id ? document.getElementById(id) : 
        document.querySelector(`script[src="${src}"]`);
      
      if (existingScript) {
        loadedScripts.add(src);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = async;
      script.defer = defer;
      script.type = type;
      if (id) script.id = id;

      script.onload = () => {
        loadedScripts.add(src);
        loadingPromises.delete(src);
        if (onLoad) onLoad();
        resolve();
      };

      script.onerror = (error) => {
        loadingPromises.delete(src);
        // Only log error if it's not a 404 (file might not be uploaded yet)
        const is404 = error?.message?.includes('404') || 
                     error?.target?.status === 404 ||
                     (error?.target?.readyState === 4 && error?.target?.status === 404);
        if (is404) {
          console.warn(`[SCRIPT_LOADER] Script not found (404): ${src}. Ensure the file is uploaded to your Shopify theme assets folder.`);
        } else {
          console.error(`[SCRIPT_LOADER] Failed to load script: ${src}`, error);
        }
        if (onError) onError(error);
        reject(error);
      };

      document.head.appendChild(script);
    });

    loadingPromises.set(src, promise);
    return promise;
  }

  /**
   * Load multiple scripts in parallel
   * @param {string[]} sources - Array of script sources
   * @param {Object} options - Loading options
   * @returns {Promise<void[]>}
   */
  function loadScripts(sources, options = {}) {
    return Promise.all(sources.map(src => loadScript(src, options)));
  }

  /**
   * Load scripts sequentially (for dependencies)
   * @param {string[]} sources - Array of script sources
   * @param {Object} options - Loading options
   * @returns {Promise<void>}
   */
  async function loadScriptsSequential(sources, options = {}) {
    for (const src of sources) {
      await loadScript(src, options);
    }
  }

  /**
   * Check if a script is loaded
   * @param {string} src - Script source URL
   * @returns {boolean}
   */
  function isScriptLoaded(src) {
    return loadedScripts.has(src);
  }

  /**
   * Load questionnaire modules only when needed
   * @returns {Promise<void>}
   */
  async function loadQuestionnaireModules() {
    if (isScriptLoaded('questionnaire-utils.js')) {
      return; // Already loaded
    }

    // Get asset URLs from existing script tags or construct them
    // Since we're in Shopify, we need to use the asset_url filter pattern
    // For dynamic loading, we'll construct paths based on current location
    const baseUrl = window.location.origin;
    const modules = [
      `${baseUrl}/assets/questionnaire-utils.js`,
      `${baseUrl}/assets/questionnaire-product-helpers.js`,
      `${baseUrl}/assets/questionnaire-gating.js`,
      `${baseUrl}/assets/questionnaire-cart.js`,
      `${baseUrl}/assets/questionnaire-scheduling.js`,
      `${baseUrl}/assets/questionnaire-quiz.js`,
      `${baseUrl}/assets/questionnaire-integration.js`
    ];

    try {
      await loadScriptsSequential(modules, { defer: true });
      console.log('[SCRIPT_LOADER] Questionnaire modules loaded');
    } catch (error) {
      console.error('[SCRIPT_LOADER] Failed to load questionnaire modules', error);
    }
  }

  /**
   * Get asset URL (Shopify asset_url filter equivalent)
   * Tries multiple methods to find the correct asset URL
   */
  function getAssetUrl(assetName) {
    // Method 1: Try to find existing script/link tag with this asset (has correct Shopify CDN URL)
    const existing = document.querySelector(`script[src*="${assetName}"], link[href*="${assetName}"]`);
    if (existing) {
      const url = existing.src || existing.href;
      if (url) {
        // Extract the base path from existing asset (handles Shopify CDN URLs)
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const assetsIndex = pathParts.indexOf('assets');
        if (assetsIndex !== -1) {
          // Reconstruct using the same base (handles CDN domains)
          return `${urlObj.origin}${pathParts.slice(0, assetsIndex + 1).join('/')}/${assetName}`;
        }
        return url;
      }
    }
    
    // Method 2: Try to extract base from script-loader.js itself (if loaded via asset_url)
    const scriptLoader = document.querySelector('script[src*="script-loader.js"]');
    if (scriptLoader && scriptLoader.src) {
      try {
        const urlObj = new URL(scriptLoader.src);
        const pathParts = urlObj.pathname.split('/');
        const assetsIndex = pathParts.indexOf('assets');
        if (assetsIndex !== -1) {
          return `${urlObj.origin}${pathParts.slice(0, assetsIndex + 1).join('/')}/${assetName}`;
        }
      } catch (e) {
        // Invalid URL, fall through
      }
    }
    
    // Method 3: Fallback - construct URL based on current location
    const baseUrl = window.location.origin;
    return `${baseUrl}/assets/${assetName}`;
  }

  /**
   * Load appointment booking component (lazy)
   */
  async function loadAppointmentBooking() {
    const assetUrl = getAssetUrl('my-appointments.js');
    if (isScriptLoaded(assetUrl)) {
      return Promise.resolve();
    }
    
    console.log('[SCRIPT_LOADER] Lazy loading appointment booking component');
    return loadScript(assetUrl, { defer: true });
  }

  /**
   * Load appointment-booking page script (for /pages/book-appointment)
   */
  async function loadAppointmentBookingPage() {
    const assetUrl = getAssetUrl('appointment-booking.js');
    if (isScriptLoaded(assetUrl)) {
      return Promise.resolve();
    }
    console.log('[SCRIPT_LOADER] Lazy loading appointment-booking page script');
    return loadScript(assetUrl, { defer: true });
  }

  /**
   * Load chart viewer component (lazy)
   */
  async function loadChartViewer() {
    const assetUrl = getAssetUrl('my-chart.js');
    if (isScriptLoaded(assetUrl)) {
      return Promise.resolve();
    }
    
    console.log('[SCRIPT_LOADER] Lazy loading chart viewer component');
    return loadScript(assetUrl, { defer: true });
  }

  /**
   * Load questionnaire components (lazy)
   */
  async function loadQuestionnaireComponents() {
    if (isScriptLoaded('questionnaire-utils.js')) {
      return Promise.resolve();
    }
    
    console.log('[SCRIPT_LOADER] Lazy loading questionnaire components');
    return loadQuestionnaireModules();
  }

  /**
   * Load scripts based on page type (lazy loading)
   */
  function loadPageSpecificScripts() {
    const pageType = document.body.className.match(/template-(\w+)/)?.[1] || '';
    const pageHandle = window.location.pathname.split('/').pop();
    const pathname = window.location.pathname;

    // My Appointments page - lazy load
    if (pageHandle === 'my-appointments' || pathname.includes('/pages/my-appointments')) {
      // Use Intersection Observer to load when container is visible
      const container = document.getElementById('my-appointments-container') || 
                       document.querySelector('[data-appointments-container]');
      if (container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              loadAppointmentBooking().catch(console.error);
              observer.disconnect();
            }
          });
        }, { rootMargin: '50px' });
        observer.observe(container);
      } else {
        // Load immediately if container not found
        loadAppointmentBooking().catch(console.error);
      }
    }

    // My Chart page - lazy load
    if (pageHandle === 'my-chart' || pathname.includes('/pages/my-chart')) {
      const container = document.getElementById('my-chart-container') || 
                       document.querySelector('[data-chart-container]');
      if (container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              loadChartViewer().catch(console.error);
              observer.disconnect();
            }
          });
        }, { rootMargin: '50px' });
        observer.observe(container);
      } else {
        loadChartViewer().catch(console.error);
      }
    }

    // Questionnaire page - lazy load (handles both 'questionnaire' and 'questionnaire-1' handles)
    if (pageHandle === 'questionnaire' || pageHandle === 'questionnaire-1' || pathname.includes('/pages/questionnaire')) {
      const container = document.querySelector('[data-revenuehunt-quiz]') || 
                       document.querySelector('.questionnaire-container') ||
                       document.querySelector('.questionnaire-content');
      if (container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              loadQuestionnaireComponents().catch(console.error);
              observer.disconnect();
            }
          });
        }, { rootMargin: '100px' });
        observer.observe(container);
      } else {
        loadQuestionnaireComponents().catch(console.error);
      }
    }

    // Book Appointment page - lazy load (/pages/book-appointment)
    if (pageHandle === 'book-appointment' || pathname.includes('/pages/book-appointment')) {
      const container = document.getElementById('sxrx-appointment-booking') || 
                       document.querySelector('[data-appointment-booking]');
      if (container) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              loadAppointmentBookingPage().catch(console.error);
              observer.disconnect();
            }
          });
        }, { rootMargin: '50px' });
        observer.observe(container);
      } else {
        // Load immediately if container not found
        loadAppointmentBookingPage().catch(console.error);
      }
    }

    // Account pages
    if (pageType === 'customers' || pathname.includes('/account/')) {
      // Account-specific scripts can be loaded here if needed
    }
  }

  /**
   * Preload scripts for likely next page
   * @param {string} href - Link href
   */
  function preloadForLink(href) {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      return;
    }

    try {
      const url = new URL(href, window.location.origin);
      const pathname = url.pathname;
      
      // Preload based on target page (handles both 'questionnaire' and 'questionnaire-1' handles)
      if (pathname.includes('/pages/questionnaire') || pathname.includes('/questionnaire')) {
        loadQuestionnaireComponents().catch(() => {});
      } else if (pathname.includes('/pages/my-appointments')) {
        loadAppointmentBooking().catch(() => {});
      } else if (pathname.includes('/pages/my-chart')) {
        loadChartViewer().catch(() => {});
      } else if (pathname.includes('/pages/book-appointment')) {
        loadAppointmentBookingPage().catch(() => {});
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  /**
   * Initialize script loader
   */
  function init() {
    // Load page-specific scripts
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadPageSpecificScripts);
    } else {
      loadPageSpecificScripts();
    }

    // Preload on link hover (progressive enhancement)
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('a[href]');
      if (link && link.href) {
        preloadForLink(link.href);
      }
    }, { passive: true });

    // Preload on link focus (accessibility)
    document.addEventListener('focusin', (e) => {
      const link = e.target.closest('a[href]');
      if (link && link.href) {
        preloadForLink(link.href);
      }
    }, true);
  }

  // Export to global scope
  window.SXRX = window.SXRX || {};
  window.SXRX.ScriptLoader = {
    loadScript,
    loadScripts,
    loadScriptsSequential,
    isScriptLoaded,
    loadQuestionnaireModules,
    loadQuestionnaireComponents,
    loadAppointmentBooking,
    loadChartViewer,
    getAssetUrl,
    preloadForLink
  };

  // Initialize
  init();
})();
