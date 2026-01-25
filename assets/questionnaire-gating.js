// Questionnaire Integration - Purchase Button Gating
// Handles purchase button redirects and questionnaire gating logic

(function() {
  'use strict';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  const Utils = window.SXRX.Questionnaire.Utils;
  const ProductHelpers = window.SXRX.Questionnaire.ProductHelpers;

  // Landing pages that are actually product marketing pages
  const QUESTIONNAIRE_PRODUCT_HANDLES = new Set([
    'mirtazapine',
    'wellbutrin',
    'lexapro-zoloft',
    'xanax',
    'adderall',
    'ketamine-therapy',
    'low-dose-naltrexone-ldn',
    'defense-doxyprep-doxycycline',
    'safeguard-prep-descovy',
    'sexual-performance-enhancement-power-performance-pack-nasal-spray',
    'sexual-performance-enhancement-power-performance-pack-oral',
    'premature-ejaculation-solutions-peak-performance',
    'sexual-desire-desire-boost',
    'testosterone-replacement-therapy-trt',
    'weight-loss-weightwise',
    'revitalize-your-hair-root-revival',
    'ease-menopause-estrogen-and-bhrt',
    'hormone-harmony-topical-sublingual-testosterone',
    'birth-control-desogestrel-copy',
    'birth-control-desogestrel',
    'menstrual-health-menoease',
    'renewal-glycolic-exfoliating-lotion',
    'shield-protect-antioxidant-sunscreen',
    'ultimate-radiance-complex',
    'skincare-ultimate-radiance-complex'
  ]);

  // Initialize landing page Buy Now redirect
  function initLandingPageBuyNowRedirect() {
    const pageHandle = ProductHelpers.getPageHandleFromPathname(window.location.pathname);
    if (!pageHandle) return;
    if (!QUESTIONNAIRE_PRODUCT_HANDLES.has(pageHandle)) return;

    const clickMatches = (el) => {
      if (!el) return false;
      const text = (el.textContent || '').trim().toLowerCase();
      // Covers the common variants we've seen
      if (text === 'buy now') return true;
      if (text === 'buy it now') return true;
      if (text.includes('buy') && text.includes('now')) return true;
      if (text.includes('checkout')) return true;
      return false;
    };

    const redirect = (evt) => {
      try {
        evt.preventDefault();
      } catch (e) {}
      window.location.href = `/products/${encodeURIComponent(pageHandle)}`;
    };

    // Only attach within the page content to avoid touching global nav buttons.
    const scope = document.querySelector('.page-content-width, .post-content, .rte') || document;
    const candidates = Array.from(scope.querySelectorAll('a, button'));
    candidates.forEach((el) => {
      if (!clickMatches(el)) return;
      if (el.hasAttribute('data-sxrx-buy-now-handled')) return;
      el.setAttribute('data-sxrx-buy-now-handled', 'true');
      el.addEventListener('click', redirect);
    });
  }

  // Redirect to questionnaire page
  function redirectToQuestionnaire(productId, quizId, customerId, purchaseType) {
    const params = new URLSearchParams({
      product: productId,
      quiz: quizId,
      purchaseType: purchaseType || 'subscription'
    });
    
    if (customerId) {
      params.append('customer', customerId);
    }

    // Persist selected variant/handle so the questionnaire page can auto-add-to-cart after approval.
    try {
      const variantId = ProductHelpers.getSelectedVariantIdFromProductPage();
      if (variantId) {
        params.append('variant_id', variantId);
        sessionStorage.setItem(`variant_id_${productId}`, String(variantId));
      }

      const handle = ProductHelpers.getProductHandleFromLocation();
      if (handle) {
        sessionStorage.setItem(`product_handle_${productId}`, String(handle));
      }
    } catch (e) {}
    
    // Redirect to questionnaire page
    const basePath = (window.SXRX && window.SXRX.questionnairePagePath) ? window.SXRX.questionnairePagePath : '/pages/questionnaire';
    window.location.href = `${basePath}?${params.toString()}`;
  }

  // Handle purchase button click
  function handlePurchaseButtonClick(event) {
    event.preventDefault();
    
    const button = event.currentTarget;
    const productId = button.getAttribute('data-product-id');
    const quizId = button.getAttribute('data-quiz-id');
    const customerId = button.getAttribute('data-customer-id');
    
    // Check if user is logged in - if not, force sign up first
    if (!window.SXRX || !window.SXRX.isLoggedIn) {
      // Store product info for after signup
      const purchaseTypeRadio = document.querySelector('input[name="purchase-type"]:checked');
      const purchaseType = purchaseTypeRadio ? purchaseTypeRadio.value : 'subscription';
      const questionnaireUrl = window.SXRX?.questionnairePagePath || '/pages/questionnaire';
      sessionStorage.setItem('pending_purchase_productId', productId);
      sessionStorage.setItem('pending_purchase_quizId', quizId);
      sessionStorage.setItem('pending_purchase_purchaseType', purchaseType);
      sessionStorage.setItem('pending_purchase_redirect', `${questionnaireUrl}?product=${productId}&quiz=${quizId}&purchaseType=${purchaseType}`);
      
      // Redirect to sign up
      window.location.href = '/account/register?redirect=/account/login';
      return;
    }
    
    // Get selected purchase type (respects user's radio button selection)
    const purchaseTypeRadio = document.querySelector('input[name="purchase-type"]:checked');
    const purchaseType = purchaseTypeRadio ? purchaseTypeRadio.value : 'subscription';
    
    // Store purchase type in sessionStorage for later use
    sessionStorage.setItem(`purchaseType_${productId}`, purchaseType);
    sessionStorage.setItem(`redirectProduct_${productId}`, window.location.href);
    
    // Redirect to questionnaire
    redirectToQuestionnaire(productId, quizId, customerId, purchaseType);
  }

  // Get questionnaire metadata from DOM
  function getQuestionnaireMetaFromDom() {
    const meta = document.getElementById('sxrx-questionnaire-meta');
    if (!meta) return null;
    const productId = meta.getAttribute('data-product-id');
    const quizId = meta.getAttribute('data-quiz-id');
    const requires = (meta.getAttribute('data-requires-questionnaire') || '').toLowerCase() === 'true';
    const customerId = meta.getAttribute('data-customer-id');
    if (!productId || !quizId || !requires) return null;
    return { productId, quizId, customerId: customerId || null };
  }

  // Initialize questionnaire gate for buy buttons
  function initQuestionnaireGateForBuyButtons() {
    const meta = getQuestionnaireMetaFromDom();
    if (!meta) return;

    const { productId, quizId, customerId } = meta;

    const shouldGate = () => {
      try {
        return sessionStorage.getItem(`questionnaire_completed_${productId}`) !== 'true';
      } catch (e) {
        return true;
      }
    };

    const getPurchaseType = (forceSubscription = false) => {
      // If Buy Now is clicked, always use subscription
      if (forceSubscription) {
        return 'subscription';
      }
      // Otherwise, check the radio button selection
      const purchaseTypeRadio = document.querySelector('input[name="purchase-type"]:checked');
      return purchaseTypeRadio ? purchaseTypeRadio.value : 'subscription';
    };

    const goToQuiz = (forceSubscription = false) => {
      // Check if user is logged in - if not, force sign up first
      if (!window.SXRX || !window.SXRX.isLoggedIn) {
        const purchaseType = getPurchaseType(forceSubscription);
        // Store product info for after signup
        const questionnaireUrl = window.SXRX?.questionnairePagePath || '/pages/questionnaire';
        sessionStorage.setItem('pending_purchase_productId', productId);
        sessionStorage.setItem('pending_purchase_quizId', quizId);
        sessionStorage.setItem('pending_purchase_purchaseType', purchaseType);
        sessionStorage.setItem('pending_purchase_redirect', `${questionnaireUrl}?product=${productId}&quiz=${quizId}&purchaseType=${purchaseType}`);
        
        // Redirect to sign up
        window.location.href = '/account/register?redirect=/account/login';
        return;
      }
      
      const purchaseType = getPurchaseType(forceSubscription);
      try {
        sessionStorage.setItem(`purchaseType_${productId}`, purchaseType);
        sessionStorage.setItem(`redirectProduct_${productId}`, window.location.href);
        
        // Store variant ID when user clicks Purchase (for later use)
        const variantId = ProductHelpers.getSelectedVariantIdFromProductPage();
        if (variantId) {
          sessionStorage.setItem(`variant_id_${productId}`, String(variantId));
        }
      } catch (e) {}
      redirectToQuestionnaire(productId, quizId, customerId, purchaseType);
    };

    // Intercept any attempt to add-to-cart before quiz completion.
    const interceptSubmit = (evt) => {
      // Check if user is logged in - if not, force sign up first
      if (!window.SXRX || !window.SXRX.isLoggedIn) {
        try {
          evt.preventDefault();
          evt.stopImmediatePropagation();
        } catch (e) {}
        const purchaseType = getPurchaseType(false);
        Utils.redirectToSignUp(productId, purchaseType);
        return;
      }
      
      if (!shouldGate()) return;
      try {
        evt.preventDefault();
        evt.stopImmediatePropagation();
      } catch (e) {}
      goToQuiz(false); // Use selected purchase type
    };

    // Capture phase so we beat the theme's product.js ajax handler.
    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (form.hasAttribute('data-sxrx-quiz-gate')) return;
      form.setAttribute('data-sxrx-quiz-gate', 'true');
      form.addEventListener('submit', interceptSubmit, true);
    });

    // Intercept clicks on Shopify payment buttons (Buy Now / dynamic checkout).
    document.querySelectorAll('.shopify-payment-button__button, .shopify-payment-button button, button[data-testid*="buy"], button[data-testid*="checkout"], .dynamic-checkout__content button').forEach((btn) => {
      if (btn.hasAttribute('data-sxrx-quiz-gate')) return;
      btn.setAttribute('data-sxrx-quiz-gate', 'true');
      btn.addEventListener('click', (evt) => {
        // Check if user is logged in - if not, force sign up first
        if (!window.SXRX || !window.SXRX.isLoggedIn) {
          try {
            evt.preventDefault();
            evt.stopImmediatePropagation();
          } catch (e) {}
          const purchaseType = 'subscription'; // Buy Now always uses subscription
          Utils.redirectToSignUp(productId, purchaseType);
          return;
        }
        
        if (!shouldGate()) return;
        try {
          evt.preventDefault();
          evt.stopImmediatePropagation();
        } catch (e) {}
        goToQuiz(true); // Force subscription for Buy Now
      }, true);
    });
  }

  // Check if customer has completed questionnaire
  async function checkQuestionnaireStatus(customerId, productId) {
    try {
      const headers = {
        'Authorization': `Bearer ${Utils.getStorefrontToken()}`
      };

      const response = await fetch(`${Utils.BACKEND_API}/api/shopify/products/${productId}`, {
        headers
      });
      
      if (!response.ok) return { requiresQuestionnaire: false, completed: false };
      
      const data = await response.json();

      // Backend response shape is { product, validation: { requiresQuestionnaire, ... } }
      const requiresQuestionnaire = !!(data?.requiresQuestionnaire ?? data?.validation?.requiresQuestionnaire);
      const status = data?.questionnaireStatus || 'not_started';
      const completed = !!(data?.customerHasCompleted || status === 'completed' || status === 'approved');

      return { requiresQuestionnaire, completed, status };
    } catch (error) {
      console.error('Error checking questionnaire status:', error);
      return { requiresQuestionnaire: false, completed: false };
    }
  }

  // Export gating functions to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.Gating = {
    initLandingPageBuyNowRedirect,
    redirectToQuestionnaire,
    handlePurchaseButtonClick,
    getQuestionnaireMetaFromDom,
    initQuestionnaireGateForBuyButtons,
    checkQuestionnaireStatus
  };
})();
