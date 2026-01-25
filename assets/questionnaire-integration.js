// Questionnaire Integration for Shopify Storefront
// Main orchestrator - coordinates all questionnaire modules
// Handles purchase button redirect to questionnaire and completion flow

(function() {
  'use strict';

  const QUESTIONNAIRE_INTEGRATION_VERSION = '2026-01-21-1';
  console.log(`[SXRX] questionnaire-integration loaded (${QUESTIONNAIRE_INTEGRATION_VERSION})`);

  // Wait for all modules to be loaded
  const init = () => {
    // Ensure all required modules are available
    if (!window.SXRX || !window.SXRX.Questionnaire) {
      console.error('[SXRX] Questionnaire modules not loaded. Ensure all questionnaire-*.js files are loaded before questionnaire-integration.js');
      return;
    }

    const Utils = window.SXRX.Questionnaire.Utils;
    const ProductHelpers = window.SXRX.Questionnaire.ProductHelpers;
    const Gating = window.SXRX.Questionnaire.Gating;
    const Quiz = window.SXRX.Questionnaire.Quiz;
    const Cart = window.SXRX.Questionnaire.Cart;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
      // If user is on a marketing page under /pages/<handle>, redirect Buy Now to /products/<handle>
      // so the questionnaire flow can run from the real product form.
      Gating.initLandingPageBuyNowRedirect();

      // Check if we're on a product page
      const purchaseButton = document.getElementById('purchase-button');

      // For questionnaire-gated products, also gate Add to cart / Buy it now until quiz is completed.
      Gating.initQuestionnaireGateForBuyButtons();
      
      // Add authentication check for "Schedule an appointment" links/buttons
      initScheduleAppointmentAuthCheck();
      
      if (purchaseButton) {
        // Set up purchase button click handler
        purchaseButton.addEventListener('click', Gating.handlePurchaseButtonClick);
        
        // Check if questionnaire already completed
        const productId = purchaseButton.getAttribute('data-product-id');
        const customerId = purchaseButton.getAttribute('data-customer-id');
        
        if (productId && customerId) {
          Gating.checkQuestionnaireStatus(customerId, productId).then(status => {
            if (status.completed && status.status === 'approved') {
              Cart.enableAddToCartAfterCompletion();
            }
          });
        } else {
          // Check sessionStorage for guest users
          Cart.enableAddToCartAfterCompletion();
        }
      }
      
      // Check if we're on the questionnaire page
      const urlParams = new URLSearchParams(window.location.search);
      const quizId = urlParams.get('quiz');
      
      if (quizId && window.location.pathname.includes('questionnaire')) {
        // Store product and customer info
        window.currentProductId = urlParams.get('product');
        window.customerId = urlParams.get('customer');
        
        // Clear any stale completion flags when starting a new quiz attempt
        // This ensures the quiz must be completed fresh each time
        const productId = urlParams.get('product');
        if (productId) {
          try {
            sessionStorage.removeItem(`questionnaire_completed_${productId}`);
          } catch (e) {}
        }
        
        // Initialize RevenueHunt quiz
        if (quizId && !quizId.includes('_QUIZ_ID')) {
          Quiz.initRevenueHuntQuiz(quizId);

          // Trigger RevenueHunt quiz opening.
          // RevenueHunt v2 link-popup relies on hash changes; if the user lands on the page
          // with the target hash already set, we must "bump" it to ensure the popup opens.
          const targetHash = `quiz-${quizId}`;
          try {
            const current = String(window.location.hash || '').replace(/^#/, '');
            if (current === targetHash) {
              window.location.hash = 'quiz';
              setTimeout(() => {
                window.location.hash = targetHash;
              }, 50);
            } else {
              window.location.hash = targetHash;
            }
          } catch (e) {
            window.location.hash = targetHash;
          }

          // Fallback UX: if the quiz embed doesn't open, show a helpful message.
          setTimeout(() => {
            try {
              const hasRevenueHuntUi =
                !!document.querySelector('[data-revenuehunt-quiz], .revenuehunt, iframe[src*="revenuehunt"], iframe[id*="revenuehunt"]');
              if (!hasRevenueHuntUi) {
                const contentDiv = document.getElementById('questionnaire-content');
                if (contentDiv) {
                  contentDiv.innerHTML = `
                    <div class="message error">
                      Quiz failed to load. Please refresh the page. If it still doesn't load, ensure the RevenueHunt "Link Popup Quiz" app embed is enabled in your theme.
                    </div>
                  `;
                }
              }
            } catch (e) {}
          }, 2500);

          // If RevenueHunt renders the result screen but doesn't fire an event, still proceed.
          Quiz.initApprovedResultAutoProceedWatcher();
          
          // Expose manual trigger for testing/debugging
          // Call window.SXRX.triggerQuizCompletion() from console if events aren't firing
          if (!window.SXRX) window.SXRX = {};
          window.SXRX.triggerQuizCompletion = function() {
            console.log('[SXRX] Manual quiz completion triggered');
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('product') || window.currentProductId;
            Quiz.handleQuizCompletion({
              quizId: urlParams.get('quiz'),
              productId: productId,
              manualTrigger: true,
              timestamp: new Date().toISOString()
            });
          };
          console.log('[SXRX] Manual trigger available: window.SXRX.triggerQuizCompletion()');
        } else {
          console.error('Invalid or placeholder Quiz ID:', quizId);
          Utils.showMessage('Quiz configuration error. Please contact support.', 'error');
        }
      }
    });
  };

  /**
   * Initialize authentication check for "Schedule an appointment" links/buttons
   * Redirects to login if user is not authenticated
   */
  function initScheduleAppointmentAuthCheck() {
    // Check if user is logged in
    const isLoggedIn = !!(window.SXRX?.isLoggedIn || 
                         window.Shopify?.customer?.id ||
                         document.body.classList.contains('customer-logged-in'));
    
    // Find all links/buttons that point to questionnaire or appointment booking
    const scheduleLinks = document.querySelectorAll(
      'a[href*="/pages/questionnaire"], ' +
      'a[href*="/pages/book-appointment"], ' +
      'button[data-schedule-appointment], ' +
      'a[data-schedule-appointment]'
    );
    
    scheduleLinks.forEach(link => {
      // Skip if already has handler or is on product page (handled by product page logic)
      if (link.hasAttribute('data-sxrx-auth-checked')) return;
      if (window.location.pathname.includes('/products/')) return; // Product pages handle their own auth
      
      link.setAttribute('data-sxrx-auth-checked', 'true');
      
      link.addEventListener('click', function(event) {
        // Only check if user is not logged in
        if (!isLoggedIn) {
          event.preventDefault();
          event.stopPropagation();
          
          // Get the target URL
          const targetUrl = link.href || link.getAttribute('href') || '/pages/questionnaire';
          const questionnaireUrl = window.SXRX?.questionnairePagePath || '/pages/questionnaire';
          
          // Redirect to login with return URL
          const redirectUrl = `/account/login?redirect=${encodeURIComponent(questionnaireUrl)}`;
          console.log('[SXRX] User not logged in, redirecting to login:', redirectUrl);
          window.location.href = redirectUrl;
          return false;
        }
        // User is logged in - allow normal navigation
      });
    });
  }

  // Initialize immediately if modules are already loaded, otherwise wait
  if (window.SXRX && window.SXRX.Questionnaire) {
    init();
  } else {
    // Wait for modules to load (with timeout)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    const checkInterval = setInterval(() => {
      attempts++;
      if (window.SXRX && window.SXRX.Questionnaire) {
        clearInterval(checkInterval);
        init();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('[SXRX] Timeout waiting for questionnaire modules to load');
      }
    }, 100);
  }
})();
