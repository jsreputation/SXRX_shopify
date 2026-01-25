// Questionnaire Integration - Cart Operations
// Handles adding products to cart and checkout flow

(function() {
  'use strict';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  const Utils = window.SXRX.Questionnaire.Utils;
  const ProductHelpers = window.SXRX.Questionnaire.ProductHelpers;

  // Add product to cart and redirect to checkout
  async function addToCartAndCheckout(productId, variantId, purchaseType) {
    try {
      // Check if user is logged in - if not, force sign up first
      if (!window.SXRX || !window.SXRX.isLoggedIn) {
        Utils.redirectToSignUp(productId, purchaseType);
        return;
      }
      
      // Add product to cart via Shopify Cart API
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: 1,
          properties: {
            'Purchase Type': purchaseType === 'subscription' ? 'Subscription (Monthly)' : 'One-Time Purchase',
            '_purchaseType': purchaseType,
            '_questionnaire_completed': 'true'
          }
        })
      });

      if (response.ok) {
        // Redirect to checkout
        window.location.href = '/checkout';
      } else {
        // Fallback: redirect to cart
        window.location.href = '/cart';
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      // Fallback: redirect to product page
      const handle = ProductHelpers.getProductHandle(productId);
      const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || (handle ? `/products/${handle}` : '/cart');
      window.location.href = redirectUrl + '?questionnaire_completed=true&action=proceed_to_checkout';
    }
  }

  // Enable add to cart after questionnaire completion
  function enableAddToCartAfterCompletion() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product') || document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
    const action = urlParams.get('action');
    
    // If action is proceed_to_checkout, we should have already redirected to checkout
    if (action === 'proceed_to_checkout') {
      // Show message that they can proceed to checkout
      const statusDiv = document.getElementById('questionnaire-completion-status');
      if (statusDiv) {
        statusDiv.setAttribute('data-completed', 'true');
        statusDiv.innerHTML = '<p>Questionnaire completed. Prescription created. You can proceed to checkout.</p>';
        statusDiv.style.display = 'block';
      }
      return;
    }
    
    if (productId && sessionStorage.getItem(`questionnaire_completed_${productId}`) === 'true') {
      // Hide purchase button, show add to cart
      const purchaseButton = document.getElementById('purchase-button');
      const purchaseWrapper = document.querySelector('.questionnaire-purchase-wrapper');
      const addToCartWrapper = document.getElementById('add-to-cart-wrapper');
      
      if (purchaseButton) purchaseButton.style.display = 'none';
      if (purchaseWrapper) purchaseWrapper.style.display = 'none';
      if (addToCartWrapper) addToCartWrapper.style.display = 'block';
      
      // Show success message
      const statusDiv = document.getElementById('questionnaire-completion-status');
      if (statusDiv) {
        statusDiv.setAttribute('data-completed', 'true');
        statusDiv.innerHTML = '<p>Questionnaire completed. You can now add to cart.</p>';
        statusDiv.style.display = 'block';
      }

      // Intercept form submission to add purchase type
      const productForm = document.querySelector('form[action*="/cart/add"]');
      if (productForm) {
        productForm.addEventListener('submit', function(e) {
          const purchaseType = sessionStorage.getItem(`purchaseType_${productId}`) || 'subscription';
          
          // Add purchase type as hidden input or cart attribute
          let purchaseTypeInput = productForm.querySelector('input[name="properties[Purchase Type]"]');
          if (!purchaseTypeInput) {
            purchaseTypeInput = document.createElement('input');
            purchaseTypeInput.type = 'hidden';
            purchaseTypeInput.name = 'properties[Purchase Type]';
            productForm.appendChild(purchaseTypeInput);
          }
          purchaseTypeInput.value = purchaseType === 'subscription' ? 'Subscription (Monthly)' : 'One-Time Purchase';
          
          // Also add as cart note attribute
          let noteInput = productForm.querySelector('input[name="properties[_purchaseType]"]');
          if (!noteInput) {
            noteInput = document.createElement('input');
            noteInput.type = 'hidden';
            noteInput.name = 'properties[_purchaseType]';
            productForm.appendChild(noteInput);
          }
          noteInput.value = purchaseType;
        });
      }
    }
  }

  // Export cart functions to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.Cart = {
    addToCartAndCheckout,
    enableAddToCartAfterCompletion
  };
})();
