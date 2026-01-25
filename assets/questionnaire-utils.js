// Questionnaire Integration - Utility Functions
// Shared utilities for JSON parsing, URL helpers, etc.

(function() {
  'use strict';

  // Get backend API URL from global (set in theme.liquid from theme settings)
  const BACKEND_API = window.BACKEND_API || 'https://api.sxrx.us';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  // Utility: Safe JSON parsing
  function safeJsonParse(value) {
    if (typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }

  // Utility: Get Storefront API token
  function getStorefrontToken() {
    return window.storefrontToken || '';
  }

  // Utility: Get state from URL or sessionStorage
  function getStateFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('state') || sessionStorage.getItem('patient_state') || 'CA';
  }

  // Utility: Show status message
  function showMessage(message, type) {
    const container = document.getElementById('questionnaire-result') || document.getElementById('questionnaire-status');
    if (container) {
      container.innerHTML = `<p class="message ${type}">${message}</p>`;
      container.style.display = 'block';
    }
  }

  // Utility: Redirect guest users to sign up
  function redirectToSignUp(productId, purchaseType) {
    // Store product info for after signup
    sessionStorage.setItem('pending_purchase_productId', productId);
    sessionStorage.setItem('pending_purchase_purchaseType', purchaseType);
    sessionStorage.setItem('pending_purchase_redirect', '/checkout');
    
    // Redirect to account registration
    window.location.href = '/account/register?redirect=/account/login';
  }

  // Export utilities to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.Utils = {
    BACKEND_API,
    safeJsonParse,
    getStorefrontToken,
    getStateFromUrl,
    showMessage,
    redirectToSignUp
  };
})();
