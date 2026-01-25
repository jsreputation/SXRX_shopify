// Questionnaire Integration - RevenueHunt Quiz Handling
// Handles quiz initialization, completion events, and auto-proceed fallback

(function() {
  'use strict';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  const Utils = window.SXRX.Questionnaire.Utils;
  const ProductHelpers = window.SXRX.Questionnaire.ProductHelpers;
  const Cart = window.SXRX.Questionnaire.Cart;
  const Scheduling = window.SXRX.Questionnaire.Scheduling;

  // Initialize RevenueHunt quiz on questionnaire page
  function initRevenueHuntQuiz(quizId) {
    let completionHandled = false; // Prevent duplicate handling
    
    console.log('[SXRX] Initializing RevenueHunt quiz listeners for quiz:', quizId);
    
    // Listen for RevenueHunt completion event via postMessage
    window.addEventListener('message', function(event) {
      // Prevent duplicate handling
      if (completionHandled) return;
      
      const raw = event.data;
      const parsed = Utils.safeJsonParse(raw);
      const data = parsed || raw;
      if (!data || typeof data !== 'object') return;

      // Only process messages that look like RevenueHunt quiz completion / response payloads.
      const origin = String(event.origin || '');
      const fromRevenueHunt = /revenuehunt/i.test(origin);
      const typeStr = String(data.type || data.event || data.name || '').toLowerCase();
      const looksCompleted =
        typeStr.includes('completed') ||
        typeStr.includes('finished') ||
        typeStr.includes('quiz_completed') ||
        data.quizCompleted === true ||
        data.completed === true;
      const looksLikeQuizPayload =
        !!(data.answers || data.answersByBlock || data.recommendationsBySlot || data.responseId || data.quizId || data.quiz_id || data.resultRef);

      // Log for debugging
      if (fromRevenueHunt || looksCompleted || looksLikeQuizPayload) {
        console.log('[SXRX] Received RevenueHunt message:', {
          origin,
          fromRevenueHunt,
          typeStr,
          looksCompleted,
          looksLikeQuizPayload,
          hasData: !!data
        });
      }

      // More flexible: accept if from RevenueHunt AND looks completed, OR if has completion indicator AND payload
      if ((fromRevenueHunt && looksCompleted) || (looksCompleted && looksLikeQuizPayload)) {
        console.log('[SXRX] Detected quiz completion via postMessage, handling...');
        completionHandled = true;
        handleQuizCompletion(data.detail || data);
      }
    });

    // Also listen for RevenueHunt's custom DOM events
    const handleCustomEvent = (eventName, event) => {
      if (completionHandled) return;
      console.log(`[SXRX] Received custom event: ${eventName}`, event);
      
      // More flexible: accept if event.detail exists (even without strict validation)
      if (event.detail) {
        console.log('[SXRX] Detected quiz completion via custom event, handling...');
        completionHandled = true;
        handleQuizCompletion(event.detail);
      } else if (event.data) {
        // Some events might have data instead of detail
        console.log('[SXRX] Detected quiz completion via custom event (data), handling...');
        completionHandled = true;
        handleQuizCompletion(event.data);
      }
    };

    document.addEventListener('revenuehunt:quiz:completed', (e) => handleCustomEvent('revenuehunt:quiz:completed', e));
    document.addEventListener('revenuehunt:quiz:finished', (e) => handleCustomEvent('revenuehunt:quiz:finished', e));
    document.addEventListener('revenuehunt:quiz:submitted', (e) => handleCustomEvent('revenuehunt:quiz:submitted', e));
    
    // Also listen for generic quiz completion events
    document.addEventListener('quiz:completed', (e) => handleCustomEvent('quiz:completed', e));
    document.addEventListener('quiz:finished', (e) => handleCustomEvent('quiz:finished', e));
  }

  // Handle quiz completion
  async function handleQuizCompletion(quizData) {
    try {
      console.log('[SXRX] handleQuizCompletion called with data:', quizData);
      
      // Validate that we have actual quiz completion data
      if (!quizData || (typeof quizData === 'object' && Object.keys(quizData).length === 0)) {
        console.log('[SXRX] Ignoring empty quiz completion event');
        return;
      }
      
      // Get product ID and customer ID from URL or storage
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product') || window.currentProductId;
      const customerId = urlParams.get('customer') || window.customerId;
      const purchaseType = urlParams.get('purchaseType') || sessionStorage.getItem(`purchaseType_${productId}`) || 'subscription';
      
      console.log('[SXRX] Quiz completion context:', { productId, customerId, purchaseType, pathname: window.location.pathname });
      
      // Additional validation: ensure we're actually on the questionnaire page
      const isQuestionnairePage = window.location.pathname.includes('questionnaire');
      if (!isQuestionnairePage) {
        console.log('[SXRX] Warning: Quiz completion detected but not on questionnaire page. Proceeding anyway...');
      }
      
      const headers = {
        'Content-Type': 'application/json'
      };

      // Send quiz results to backend
      const response = await fetch(`${Utils.BACKEND_API}/webhooks/revenue-hunt`, {
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

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText || 'Unknown error' };
        }
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        if (result.action === 'proceed_to_checkout') {
          // No red flags - prescription created, redirect to checkout
          sessionStorage.setItem(`questionnaire_completed_${productId}`, 'true');
          sessionStorage.setItem(`patient_chart_url_${productId}`, result.patientChartUrl || '');
          sessionStorage.setItem(`prescription_id_${productId}`, result.prescriptionId || '');
          
          // Check if user is logged in - if not, force sign up first
          if (!window.SXRX || !window.SXRX.isLoggedIn) {
            // Guest user - redirect to sign up
            Utils.redirectToSignUp(productId, purchaseType);
            return;
          }
          
          // Get product variant ID and redirect to checkout
          let variantId =
            urlParams.get('variant_id') ||
            sessionStorage.getItem(`variant_id_${productId}`);
          
          // If not found, try async fetch (with improved fallbacks)
          if (!variantId) {
            variantId = await ProductHelpers.getVariantIdFromProduct(productId);
          }
          
          if (variantId) {
            // Store variant ID for future use
            try {
              sessionStorage.setItem(`variant_id_${productId}`, String(variantId));
            } catch (e) {}
            // Add product to cart and redirect to checkout
            Cart.addToCartAndCheckout(productId, variantId, purchaseType);
          } else {
            // Fallback: redirect back to product page with completion flag
            const handle = ProductHelpers.getProductHandle(productId);
            const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || (handle ? `/products/${handle}` : '/cart');
            window.location.href = redirectUrl + '?questionnaire_completed=true&action=proceed_to_checkout&variant_fetch_failed=true';
          }
        } else if (result.action === 'schedule_consultation') {
          // Red flags detected - show consultation scheduling
          Scheduling.showConsultationScheduling(result);
        } else {
          // Fallback for other actions
          sessionStorage.setItem(`questionnaire_completed_${productId}`, 'true');
          const handle = ProductHelpers.getProductHandle(productId);
          const redirectUrl = sessionStorage.getItem(`redirectProduct_${productId}`) || (handle ? `/products/${handle}` : '/cart');
          window.location.href = redirectUrl + '?questionnaire_completed=true';
        }
      } else {
        const errorMessage = result.message || 'Error processing questionnaire. Please try again.';
        console.error('[SXRX] Questionnaire processing failed:', result);
        Utils.showMessage(errorMessage, 'error');
      }
    } catch (error) {
      console.error('[SXRX] Error handling quiz completion:', error);
      const errorMessage = error.message || 'Error processing questionnaire. Please try again.';
      Utils.showMessage(errorMessage, 'error');
      
      // Log error details for debugging
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product') || window.currentProductId;
      const customerId = urlParams.get('customer') || window.customerId;
      const purchaseType = urlParams.get('purchaseType') || sessionStorage.getItem(`purchaseType_${productId}`) || 'subscription';
      console.error('[SXRX] Quiz completion error details:', {
        productId,
        customerId,
        purchaseType,
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Fallback: if RevenueHunt shows an "Approved for Treatment" result screen but no completion event fires,
  // proceed to checkout using the variant_id we persisted during redirect.
  function initApprovedResultAutoProceedWatcher() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product') || window.currentProductId;
    if (!productId) {
      console.log('[SXRX] Auto-proceed watcher: No productId, skipping');
      return;
    }

    console.log('[SXRX] Auto-proceed watcher initialized for product:', productId);
    
    let handled = false;
    const maxMs = 120000;
    const minWaitMs = 10000; // Reduced to 10 seconds for faster detection
    const requiredVisibleMs = 3000; // Reduced to 3 seconds - text must be visible for 3 consecutive seconds
    const start = Date.now();
    let firstSeenAt = null;

    const matchesApprovedScreen = () => {
      // Check all text content for approval indicators
      const bodyText = String(document.body && document.body.textContent ? document.body.textContent : '').toLowerCase();
      
      // Look for various approval patterns
      const approvalPatterns = [
        /approved\s+for\s+treatment/i,
        /you\s+are\s+approved/i,
        /treatment\s+approved/i,
        /prescription\s+approved/i,
        /qualified\s+for\s+treatment/i
      ];
      
      const hasApprovalText = approvalPatterns.some(pattern => pattern.test(bodyText));
      
      // Only check visible elements (not hidden or in popups that aren't shown)
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, .result-title, .quiz-result'));
      const visibleHeadings = headings.filter(h => {
        const style = window.getComputedStyle(h);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      const headingHit = visibleHeadings.some(h => {
        const text = String(h.textContent || '').toLowerCase();
        return approvalPatterns.some(pattern => pattern.test(text));
      });
      
      if (headingHit || hasApprovalText) {
        console.log('[SXRX] Auto-proceed watcher: Detected approval text');
        return true;
      }
      
      // Also check for completion indicators in RevenueHunt UI
      const revenueHuntComplete = document.querySelector('[data-revenuehunt-complete], .revenuehunt-complete, [class*="complete"], [class*="approved"]');
      if (revenueHuntComplete) {
        const style = window.getComputedStyle(revenueHuntComplete);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          console.log('[SXRX] Auto-proceed watcher: Detected RevenueHunt completion element');
          return true;
        }
      }
      
      return false;
    };

    const tick = () => {
      if (handled) return;
      const elapsed = Date.now() - start;
      if (elapsed > maxMs) return;
      
      // Don't start checking until minimum wait time has passed
      if (elapsed < minWaitMs) return;
      
      // Check if approved screen is visible
      if (matchesApprovedScreen()) {
        // First time seeing it - record the timestamp
        if (firstSeenAt === null) {
          firstSeenAt = Date.now();
          return; // Wait for next tick
        }
        
        // Check if it's been visible long enough
        const visibleDuration = Date.now() - firstSeenAt;
        if (visibleDuration < requiredVisibleMs) {
          return; // Not visible long enough yet
        }
        
        // Text has been visible for required duration - proceed
        console.log('[SXRX] Auto-proceed watcher: Approval text confirmed, proceeding to checkout');
        handled = true;
        try {
          sessionStorage.setItem(`questionnaire_completed_${productId}`, 'true');
        } catch (e) {}

        const purchaseType =
          urlParams.get('purchaseType') ||
          (function() {
            try { return sessionStorage.getItem(`purchaseType_${productId}`) || 'subscription'; } catch (e) { return 'subscription'; }
          })();

        const variantId =
          urlParams.get('variant_id') ||
          (function() {
            try { return sessionStorage.getItem(`variant_id_${productId}`); } catch (e) { return null; }
          })();

        console.log('[SXRX] Auto-proceed watcher: Context:', { productId, variantId, purchaseType });

        // If we have a variant id, we can complete the flow automatically.
        if (variantId) {
          // Check if user is logged in - if not, force sign up first
          if (!window.SXRX || !window.SXRX.isLoggedIn) {
            console.log('[SXRX] Auto-proceed watcher: Guest user detected, redirecting to sign up');
            Utils.redirectToSignUp(productId, purchaseType);
            return;
          }
          
          console.log('[SXRX] Auto-proceed watcher: Adding to cart and redirecting to checkout');
          Utils.showMessage('Approved. Redirecting you to checkout…', 'success');
          Cart.addToCartAndCheckout(productId, variantId, purchaseType);
          return;
        }

        // Otherwise, bounce back to product page so the user can complete purchase.
        Utils.showMessage('Approved. Returning you to the product page to complete checkout…', 'success');
        const redirectUrl = (function() {
          try { return sessionStorage.getItem(`redirectProduct_${productId}`); } catch (e) { return null; }
        })();
        const handle = ProductHelpers.getProductHandle(productId);
        const fallback = handle ? `/products/${handle}` : '/cart';
        window.location.href = (redirectUrl || fallback) + '?questionnaire_completed=true&action=proceed_to_checkout';
      } else {
        // Text disappeared - reset the timer
        firstSeenAt = null;
      }
    };

    const interval = setInterval(() => {
      try { tick(); } catch (e) {}
      if (handled || Date.now() - start > maxMs) clearInterval(interval);
    }, 1000);
  }

  // Export quiz functions to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.Quiz = {
    initRevenueHuntQuiz,
    handleQuizCompletion,
    initApprovedResultAutoProceedWatcher
  };
})();
