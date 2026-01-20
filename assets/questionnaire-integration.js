// Questionnaire Integration for Shopify Storefront
// Handles purchase button redirect to questionnaire and completion flow

(function() {
  'use strict';

  const QUESTIONNAIRE_INTEGRATION_VERSION = '2026-01-20-1';
  const BACKEND_API = 'https://intermomentary-hendrix-phreatic.ngrok-free.dev';
  console.log(`[SXRX] questionnaire-integration loaded (${QUESTIONNAIRE_INTEGRATION_VERSION})`, { BACKEND_API });

  function isNgrokBackend() {
    return /ngrok/i.test(BACKEND_API);
  }

  function withNgrokSkip(url) {
    try {
      if (!isNgrokBackend()) return url;
      const u = new URL(url);
      if (!u.searchParams.has('ngrok-skip-browser-warning')) {
        u.searchParams.set('ngrok-skip-browser-warning', '1');
      }
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function addNgrokBypassHeader(headers) {
    if (!isNgrokBackend()) return;
    if (headers && typeof headers.set === 'function') {
      headers.set('ngrok-skip-browser-warning', '1');
      return;
    }
    headers['ngrok-skip-browser-warning'] = '1';
  }

  // Check if customer has completed questionnaire
  async function checkQuestionnaireStatus(customerId, productId) {
    try {
      const headers = {
        'Authorization': `Bearer ${getStorefrontToken()}`
      };
      addNgrokBypassHeader(headers);

      const response = await fetch(withNgrokSkip(`${BACKEND_API}/api/shopify/products/${productId}`), {
        headers
      });
      
      if (!response.ok) return { requiresQuestionnaire: false, completed: false };
      
      const data = await response.json();
      return {
        requiresQuestionnaire: data.requiresQuestionnaire || false,
        completed: data.customerHasCompleted || false,
        status: data.questionnaireStatus || 'not_started'
      };
    } catch (error) {
      console.error('Error checking questionnaire status:', error);
      return { requiresQuestionnaire: false, completed: false };
    }
  }

  // Get Storefront API token (if customer is logged in)
  function getStorefrontToken() {
    return window.storefrontToken || '';
  }

  function getPageHandleFromPathname(pathname) {
    try {
      const p = String(pathname || window.location.pathname || '');
      const m = p.match(/^\/pages\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  // Landing pages ("/pages/<handle>") that are actually product marketing pages.
  // If someone clicks "Buy now" there, redirect them to the matching product page
  // where the questionnaire purchase flow is implemented.
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

  function initLandingPageBuyNowRedirect() {
    const pageHandle = getPageHandleFromPathname(window.location.pathname);
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
    
    // Get selected purchase type
    const purchaseTypeRadio = document.querySelector('input[name="purchase-type"]:checked');
    const purchaseType = purchaseTypeRadio ? purchaseTypeRadio.value : 'subscription';
    
    // Store purchase type in sessionStorage for later use
    sessionStorage.setItem(`purchaseType_${productId}`, purchaseType);
    sessionStorage.setItem(`redirectProduct_${productId}`, window.location.href);
    
    // Redirect to questionnaire
    redirectToQuestionnaire(productId, quizId, customerId, purchaseType);
  }

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

    const getPurchaseType = () => {
      const purchaseTypeRadio = document.querySelector('input[name="purchase-type"]:checked');
      return purchaseTypeRadio ? purchaseTypeRadio.value : 'subscription';
    };

    const goToQuiz = () => {
      const purchaseType = getPurchaseType();
      try {
        sessionStorage.setItem(`purchaseType_${productId}`, purchaseType);
        sessionStorage.setItem(`redirectProduct_${productId}`, window.location.href);
      } catch (e) {}
      redirectToQuestionnaire(productId, quizId, customerId, purchaseType);
    };

    // Intercept any attempt to add-to-cart or buy-now (dynamic checkout) before quiz completion.
    const interceptSubmit = (evt) => {
      if (!shouldGate()) return;
      try {
        evt.preventDefault();
        evt.stopImmediatePropagation();
      } catch (e) {}
      goToQuiz();
    };

    // Capture phase so we beat the theme's product.js ajax handler.
    document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
      if (form.hasAttribute('data-sxrx-quiz-gate')) return;
      form.setAttribute('data-sxrx-quiz-gate', 'true');
      form.addEventListener('submit', interceptSubmit, true);
    });

    // Also intercept direct clicks on Shopify payment buttons (some themes submit differently).
    document.querySelectorAll('.shopify-payment-button__button, .shopify-payment-button button').forEach((btn) => {
      if (btn.hasAttribute('data-sxrx-quiz-gate')) return;
      btn.setAttribute('data-sxrx-quiz-gate', 'true');
      btn.addEventListener('click', (evt) => {
        if (!shouldGate()) return;
        try {
          evt.preventDefault();
          evt.stopImmediatePropagation();
        } catch (e) {}
        goToQuiz();
      }, true);
    });
  }

  // Initialize RevenueHunt quiz on questionnaire page
  function initRevenueHuntQuiz(quizId) {
    // Listen for RevenueHunt completion event
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'revenuehunt-quiz-completed') {
        handleQuizCompletion(event.data);
      }
    });

    // Also listen for RevenueHunt's custom event
    document.addEventListener('revenuehunt:quiz:completed', function(event) {
      handleQuizCompletion(event.detail);
    });
  }

  // Handle quiz completion
  async function handleQuizCompletion(quizData) {
    try {
      // Get product ID and customer ID from URL or storage
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product') || window.currentProductId;
      const customerId = urlParams.get('customer') || window.customerId;
      const purchaseType = urlParams.get('purchaseType') || sessionStorage.getItem(`purchaseType_${productId}`) || 'subscription';
      
      const headers = {
        'Content-Type': 'application/json'
      };
      addNgrokBypassHeader(headers);

      // Send quiz results to backend
      const response = await fetch(withNgrokSkip(`${BACKEND_API}/webhooks/revenue-hunt`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...quizData,
          customerId: customerId,
          productId: productId,
          purchaseType: purchaseType,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        if (result.action === 'proceed_to_checkout') {
          // No red flags - prescription created, redirect to checkout
          sessionStorage.setItem(`questionnaire_completed_${productId}`, 'true');
          sessionStorage.setItem(`patient_chart_url_${productId}`, result.patientChartUrl || '');
          sessionStorage.setItem(`prescription_id_${productId}`, result.prescriptionId || '');
          
          // Get product variant ID and redirect to checkout
          const variantId = urlParams.get('variant_id') || getVariantIdFromProduct(productId);
          if (variantId) {
            // Add product to cart and redirect to checkout
            addToCartAndCheckout(productId, variantId, purchaseType);
          } else {
            // Fallback: redirect back to product page with completion flag
            const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || `/products/${getProductHandle(productId)}`;
            window.location.href = redirectUrl + '?questionnaire_completed=true&action=proceed_to_checkout';
          }
        } else if (result.action === 'schedule_consultation') {
          // Red flags detected - show consultation scheduling
          showConsultationScheduling(result);
        } else {
          // Fallback for other actions (e.g., 'allow_purchase' for backward compatibility)
          sessionStorage.setItem(`questionnaire_completed_${productId}`, 'true');
          const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || `/products/${getProductHandle(productId)}`;
          window.location.href = redirectUrl + '?questionnaire_completed=true';
        }
      } else {
        showMessage('Error processing questionnaire. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error handling quiz completion:', error);
      showMessage('Error processing questionnaire. Please try again.', 'error');
    }
  }

  // Get product handle from ID (helper function)
  function getProductHandle(productId) {
    // This would ideally come from the backend or be stored
    // For now, we'll use the product ID in the URL
    return '';
  }

  // Get variant ID from product (helper function)
  function getVariantIdFromProduct(productId) {
    // Try to get variant ID from URL params or page
    const urlParams = new URLSearchParams(window.location.search);
    const variantId = urlParams.get('variant_id');
    if (variantId) return variantId;
    
    // Try to get from product form on page
    const variantInput = document.querySelector('input[name="id"]');
    if (variantInput) return variantInput.value;
    
    // Try to get from product data attribute
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm) {
      const hiddenVariantInput = productForm.querySelector('input[name="id"]');
      if (hiddenVariantInput) return hiddenVariantInput.value;
    }
    
    return null;
  }

  // Add product to cart and redirect to checkout
  async function addToCartAndCheckout(productId, variantId, purchaseType) {
    try {
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
      const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || `/products/${getProductHandle(productId)}`;
      window.location.href = redirectUrl + '?questionnaire_completed=true&action=proceed_to_checkout';
    }
  }

  // Show consultation scheduling
  function showConsultationScheduling(data) {
    let container = document.getElementById('questionnaire-result');
    if (!container) {
      // Create container if it doesn't exist
      const resultContainer = document.createElement('div');
      resultContainer.id = 'questionnaire-result';
      
      // Try to insert after quiz or at end of page
      const quizContainer = document.querySelector('[data-revenuehunt-quiz]') || document.querySelector('.questionnaire-container') || document.querySelector('.questionnaire-content');
      if (quizContainer) {
        quizContainer.parentNode.insertBefore(resultContainer, quizContainer.nextSibling);
      } else {
        document.body.appendChild(resultContainer);
      }
      
      // Get the newly created container
      container = document.getElementById('questionnaire-result');
    }

    const availableSlots = data.availableSlots || [];
    let slotsHtml = '';
    
    if (availableSlots.length > 0) {
      slotsHtml = '<div class="available-slots"><strong>Available appointment slots:</strong><ul>';
      availableSlots.slice(0, 5).forEach(slot => {
        slotsHtml += `<li>${slot.date} at ${slot.startTime} - ${slot.provider || 'Medical Director'}</li>`;
      });
      slotsHtml += '</ul></div>';
    }

    const message = `
      <div class="consultation-prompt">
        <h3>Consultation Required</h3>
        <p>A consultation with our medical director is required before we can proceed with your order.</p>
        ${slotsHtml}
        <button id="schedule-consultation-btn" class="btn btn-primary">
          Schedule Consultation
        </button>
      </div>
    `;
    
    container.innerHTML = message;
    container.style.display = 'block';

    // Initialize Cowlendar when button is clicked
    const scheduleBtn = document.getElementById('schedule-consultation-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', function() {
        initCowlendarBooking(data);
      });
    }
  }

  // Initialize Cowlendar booking
  function initCowlendarBooking(consultationData) {
    // Redirect to appointment booking product page
    // Cowlendar will transform "Add to Cart" to "Book Now" button
    const appointmentProductUrl = '/products/appointment-booking';
    
    // Store consultation data for potential use
    if (consultationData.patientId) {
      sessionStorage.setItem('consultation_patientId', consultationData.patientId);
    }
    if (consultationData.providerId) {
      sessionStorage.setItem('consultation_providerId', consultationData.providerId);
    }
    if (consultationData.practiceId) {
      sessionStorage.setItem('consultation_practiceId', consultationData.practiceId);
    }
    if (consultationData.availableSlots && consultationData.availableSlots.length > 0) {
      sessionStorage.setItem('consultation_availableSlots', JSON.stringify(consultationData.availableSlots));
    }
    
    // Redirect to appointment booking page
    window.location.href = appointmentProductUrl;
  }

  // Show status message
  function showMessage(message, type) {
    const container = document.getElementById('questionnaire-result') || document.getElementById('questionnaire-status');
    if (container) {
      container.innerHTML = `<p class="message ${type}">${message}</p>`;
      container.style.display = 'block';
    }
  }

  // Enable add to cart after questionnaire completion
  function enableAddToCartAfterCompletion() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product') || document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
    const action = urlParams.get('action');
    
    // If action is proceed_to_checkout, we should have already redirected to checkout
    // This is a fallback in case user returns to product page
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

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function() {
    // If user is on a marketing page under /pages/<handle>, redirect Buy Now to /products/<handle>
    // so the questionnaire flow can run from the real product form.
    initLandingPageBuyNowRedirect();

    // Check if we're on a product page
    const purchaseButton = document.getElementById('purchase-button');

    // For questionnaire-gated products, also gate Add to cart / Buy it now until quiz is completed.
    initQuestionnaireGateForBuyButtons();
    
    if (purchaseButton) {
      // Set up purchase button click handler
      purchaseButton.addEventListener('click', handlePurchaseButtonClick);
      
      // Check if questionnaire already completed
      const productId = purchaseButton.getAttribute('data-product-id');
      const customerId = purchaseButton.getAttribute('data-customer-id');
      
      if (productId && customerId) {
        checkQuestionnaireStatus(customerId, productId).then(status => {
          if (status.completed && status.status === 'approved') {
            enableAddToCartAfterCompletion();
          }
        });
      } else {
        // Check sessionStorage for guest users
        enableAddToCartAfterCompletion();
      }
    }
    
    // Check if we're on the questionnaire page
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quiz');
    
    if (quizId && window.location.pathname.includes('questionnaire')) {
      // Store product and customer info
      window.currentProductId = urlParams.get('product');
      window.customerId = urlParams.get('customer');
      
      // Initialize RevenueHunt quiz
      if (quizId && !quizId.includes('_QUIZ_ID')) {
        initRevenueHuntQuiz(quizId);
        
        // Trigger RevenueHunt quiz opening
        // RevenueHunt v2 uses hash-based navigation
        window.location.hash = `quiz-${quizId}`;
      } else {
        console.error('Invalid or placeholder Quiz ID:', quizId);
        showMessage('Quiz configuration error. Please contact support.', 'error');
      }
    }
  });
})();

