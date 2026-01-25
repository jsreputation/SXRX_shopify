// Questionnaire Integration - Product Helpers
// Functions for getting product handles, variant IDs, page handles, etc.

(function() {
  'use strict';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  // Get page handle from pathname
  function getPageHandleFromPathname(pathname) {
    try {
      const p = String(pathname || window.location.pathname || '');
      const m = p.match(/^\/pages\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  // Get product handle from current location
  function getProductHandleFromLocation() {
    try {
      const p = String(window.location.pathname || '');
      const m = p.match(/^\/products\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  // Get selected variant ID from product page
  function getSelectedVariantIdFromProductPage() {
    try {
      const el =
        document.querySelector('form[action*="/cart/add"] input[name="id"]') ||
        document.querySelector('input[name="id"]');
      const v = el && el.value ? String(el.value).trim() : '';
      return v || null;
    } catch (e) {
      return null;
    }
  }

  // Get product handle from ID (helper function)
  function getProductHandle(productId) {
    try {
      const stored = sessionStorage.getItem(`product_handle_${productId}`);
      if (stored) return String(stored);
    } catch (e) {}
    try {
      const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`);
      if (redirectUrl) {
        const u = new URL(redirectUrl, window.location.origin);
        const m = u.pathname.match(/^\/products\/([^/?#]+)/i);
        if (m && m[1]) return decodeURIComponent(m[1]);
      }
    } catch (e) {}
    return '';
  }

  // Get variant ID from product (helper function with improved fallbacks)
  async function getVariantIdFromProduct(productId) {
    // Try to get variant ID from URL params or page
    const urlParams = new URLSearchParams(window.location.search);
    const variantId = urlParams.get('variant_id');
    if (variantId) return variantId;
    
    // Try to get from sessionStorage (stored when user clicked Purchase)
    try {
      const stored = sessionStorage.getItem(`variant_id_${productId}`);
      if (stored) return stored;
    } catch (e) {}
    
    // Try to get from product form on page
    const variantInput = document.querySelector('input[name="id"]');
    if (variantInput && variantInput.value) return variantInput.value;
    
    // Try to get from hidden form in add-to-cart-wrapper
    const hiddenForm = document.getElementById('add-to-cart-wrapper');
    if (hiddenForm) {
      const hiddenVariantInput = hiddenForm.querySelector('input[name="id"]');
      if (hiddenVariantInput && hiddenVariantInput.value) return hiddenVariantInput.value;
    }
    
    // Try to get from product data attribute
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm) {
      const hiddenVariantInput = productForm.querySelector('input[name="id"]');
      if (hiddenVariantInput && hiddenVariantInput.value) return hiddenVariantInput.value;
    }
    
    // Try to get from product JSON on page (Shopify theme pattern)
    try {
      const productJson = document.querySelector('script[type="application/json"][data-product-json]');
      if (productJson) {
        const productData = JSON.parse(productJson.textContent);
        const selectedVariant = productData.selected_or_first_available_variant;
        if (selectedVariant && selectedVariant.id) return String(selectedVariant.id);
      }
    } catch (e) {}
    
    // Last resort: try to fetch from Shopify API (if productId is available)
    if (productId) {
      try {
        const response = await fetch(`/products/${productId}.js`);
        if (response.ok) {
          const product = await response.json();
          if (product.variants && product.variants.length > 0) {
            // Return first available variant, or first variant if none available
            const availableVariant = product.variants.find(v => v.available) || product.variants[0];
            if (availableVariant && availableVariant.id) {
              // Store for future use
              try {
                sessionStorage.setItem(`variant_id_${productId}`, String(availableVariant.id));
              } catch (e) {}
              return String(availableVariant.id);
            }
          }
        }
      } catch (e) {
        console.warn('[SXRX] Failed to fetch variant from Shopify API:', e);
      }
    }
    
    return null;
  }

  // Export product helpers to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.ProductHelpers = {
    getPageHandleFromPathname,
    getProductHandleFromLocation,
    getSelectedVariantIdFromProductPage,
    getProductHandle,
    getVariantIdFromProduct
  };
})();
