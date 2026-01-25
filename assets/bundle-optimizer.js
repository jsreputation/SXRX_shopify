// shopify_new/assets/bundle-optimizer.js
// Bundle optimization utilities for performance
// Minifies inline scripts, defers non-critical resources, and optimizes loading

(function() {
  'use strict';

  const BUNDLE_OPTIMIZER_VERSION = '2026-01-21-1';
  console.log(`[SXRX] bundle-optimizer loaded (${BUNDLE_OPTIMIZER_VERSION})`);

  /**
   * Defer non-critical CSS loading
   */
  function deferNonCriticalCSS() {
    // Find stylesheets that can be deferred
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]:not([data-critical])');
    stylesheets.forEach((link) => {
      // Skip if already handled
      if (link.dataset.deferred) return;

      // Create a preload link for better performance
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'style';
      preload.href = link.href;
      preload.onload = function() {
        this.onload = null;
        link.media = 'all';
      };
      document.head.appendChild(preload);

      // Mark as deferred
      link.media = 'print';
      link.dataset.deferred = 'true';
      link.onload = function() {
        this.media = 'all';
      };
    });
  }

  /**
   * Check if browser supports WebP
   */
  function checkWebPSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Lazy load images with WebP support
   */
  function lazyLoadImages() {
    const supportsWebP = checkWebPSupport();
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Convert to WebP if supported and source available
            if (supportsWebP && img.dataset.srcWebp) {
              img.src = img.dataset.srcWebp;
              if (img.dataset.srcsetWebp) {
                img.srcset = img.dataset.srcsetWebp;
              }
            } else {
              if (img.dataset.src) {
                img.src = img.dataset.src;
              }
              if (img.dataset.srcset) {
                img.srcset = img.dataset.srcset;
              }
            }
            
            img.removeAttribute('data-src');
            img.removeAttribute('data-src-webp');
            img.removeAttribute('data-srcset');
            img.removeAttribute('data-srcset-webp');
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px' // Start loading 50px before image enters viewport
      });

      // Observe all lazy images
      document.querySelectorAll('img.lazy, img[data-src], img[data-src-webp]').forEach(img => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback for browsers without IntersectionObserver
      document.querySelectorAll('img[data-src], img[data-src-webp]').forEach(img => {
        if (supportsWebP && img.dataset.srcWebp) {
          img.src = img.dataset.srcWebp;
          if (img.dataset.srcsetWebp) {
            img.srcset = img.dataset.srcsetWebp;
          }
        } else {
          img.src = img.dataset.src || img.src;
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
          }
        }
        img.removeAttribute('data-src');
        img.removeAttribute('data-src-webp');
        img.removeAttribute('data-srcset');
        img.removeAttribute('data-srcset-webp');
      });
    }
  }

  /**
   * Add preconnect and prefetch hints for external resources
   */
  function addPreconnects() {
    const preconnects = [
      'https://cdn.shopify.com',
      'https://fonts.shopifycdn.com'
    ];

    // Add backend API preconnect if available
    if (window.BACKEND_API) {
      try {
        const backendUrl = new URL(window.BACKEND_API);
        preconnects.push(backendUrl.origin);
      } catch (e) {
        // Invalid URL, skip
      }
    }

    preconnects.forEach(url => {
      if (!document.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });

    // Add DNS prefetch for additional domains
    const dnsPrefetch = [
      'https://fonts.googleapis.com',
      'https://www.google-analytics.com'
    ];

    dnsPrefetch.forEach(url => {
      if (!document.querySelector(`link[rel="dns-prefetch"][href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = url;
        document.head.appendChild(link);
      }
    });
  }

  /**
   * Add resource hints (preload, prefetch) for critical resources
   */
  function addResourceHints() {
    // Preload critical CSS
    const criticalCSS = [
      'app.css',
      'custom.css'
    ];

    criticalCSS.forEach(cssFile => {
      if (!document.querySelector(`link[rel="preload"][href*="${cssFile}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = `/assets/${cssFile}`;
        link.as = 'style';
        document.head.appendChild(link);
      }
    });

    // Prefetch likely next page resources
    const pageType = document.body.className.match(/template-(\w+)/)?.[1] || '';
    if (pageType === 'product') {
      // Prefetch cart page resources
      const cartLink = document.querySelector('a[href*="/cart"]');
      if (cartLink) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = cartLink.href;
        document.head.appendChild(link);
      }
    }
  }

  /**
   * Optimize font loading
   */
  function optimizeFontLoading() {
    // Add font-display: swap to existing font links
    document.querySelectorAll('link[rel="stylesheet"][href*="font"]').forEach(link => {
      if (!link.dataset.optimized) {
        // Create a style tag to override font-display
        const style = document.createElement('style');
        style.textContent = `
          @font-face {
            font-display: swap;
          }
        `;
        document.head.appendChild(style);
        link.dataset.optimized = 'true';
      }
    });
  }

  /**
   * Remove unused CSS (basic implementation)
   */
  function removeUnusedCSS() {
    // This is a basic implementation - for production, consider using PurgeCSS
    // or similar tools during build time
    const pageType = document.body.className.match(/template-(\w+)/)?.[1] || '';
    
    // Remove stylesheets that are definitely not needed for this page type
    if (pageType !== 'product') {
      // Product-specific CSS can be conditionally loaded
      // This is handled in theme.liquid
    }
  }

  /**
   * Initialize bundle optimizer
   */
  function init() {
    // Run optimizations after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        deferNonCriticalCSS();
        lazyLoadImages();
        addPreconnects();
        addResourceHints();
        optimizeFontLoading();
      });
    } else {
      deferNonCriticalCSS();
      lazyLoadImages();
      addPreconnects();
      addResourceHints();
      optimizeFontLoading();
    }

    // Run after a short delay to not block initial render
    setTimeout(() => {
      removeUnusedCSS();
    }, 1000);
  }

  // Export to global scope
  window.SXRX = window.SXRX || {};
  window.SXRX.BundleOptimizer = {
    deferNonCriticalCSS,
    lazyLoadImages,
    addPreconnects,
    addResourceHints,
    optimizeFontLoading,
    removeUnusedCSS,
    checkWebPSupport
  };

  // Initialize
  init();
})();
