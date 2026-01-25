// Registration Handler - Intercepts Shopify registration and creates Tebra patient
(function() {
  'use strict';

  // Get BACKEND_API from global or use default
  const BACKEND_API = window.BACKEND_API || 'https://api.sxrx.us';

  // Get state from URL, geolocation, or default
  function getState() {
    const urlParams = new URLSearchParams(window.location.search);
    const stateFromUrl = urlParams.get('state');
    if (stateFromUrl) return stateFromUrl.toUpperCase();
    
    // Try to get from sessionStorage (from questionnaire)
    try {
      const storedState = sessionStorage.getItem('patient_state');
      if (storedState) return storedState.toUpperCase();
    } catch (e) {}
    
    // Default to CA if not found
    return 'CA';
  }

  // Show error message
  function showError(message) {
    const errorDiv = document.getElementById('registration-error');
    const errorMessage = document.getElementById('registration-error-message');
    if (errorDiv && errorMessage) {
      errorMessage.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Hide error message
  function hideError() {
    const errorDiv = document.getElementById('registration-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Validate form fields
  function validateForm() {
    const firstName = document.getElementById('register-first-name')?.value?.trim();
    const lastName = document.getElementById('register-last-name')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim();
    const phone = document.getElementById('register-phone')?.value?.trim();
    const password = document.getElementById('register-password')?.value;

    if (!firstName) {
      showError('First name is required');
      document.getElementById('register-first-name')?.focus();
      return false;
    }

    if (!lastName) {
      showError('Last name is required');
      document.getElementById('register-last-name')?.focus();
      return false;
    }

    if (!email) {
      showError('Email is required');
      document.getElementById('register-email')?.focus();
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address');
      document.getElementById('register-email')?.focus();
      return false;
    }

    // Phone number validation (optional; when provided, must be 10-20 characters)
    if (phone && phone.trim().length > 0) {
      if (phone.trim().length < 10) {
        showError('Phone number must be at least 10 characters when provided');
        document.getElementById('register-phone')?.focus();
        return false;
      }
      if (phone.trim().length > 20) {
        showError('Phone number must be 20 characters or less');
        document.getElementById('register-phone')?.focus();
        return false;
      }
    }

    if (!password || password.length < 6) {
      showError('Password must be at least 6 characters');
      document.getElementById('register-password')?.focus();
      return false;
    }

    // Enhanced password validation (matches backend requirements)
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      showError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      document.getElementById('register-password')?.focus();
      return false;
    }

    hideError();
    return true;
  }

  // Intercept form submission
  function initRegistrationHandler() {
    const form = document.getElementById('customer-register-form');
    if (!form) {
      console.warn('[REGISTRATION] Registration form not found');
      return;
    }

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Validate form
      if (!validateForm()) {
        return;
      }

      // Get form values
      const firstName = document.getElementById('register-first-name').value.trim();
      const lastName = document.getElementById('register-last-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const phone = document.getElementById('register-phone').value.trim();
      const password = document.getElementById('register-password').value;
      const state = getState();
      
      // Phone: optional; when provided, must be 10-20 characters (validateForm already checks)
      if (phone.length > 0 && (phone.length < 10 || phone.length > 20)) {
        showError('Phone number must be between 10 and 20 characters when provided');
        return;
      }

      // Show loading state
      const submitBtn = document.getElementById('register-submit-btn');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoader = submitBtn.querySelector('.btn-loader');
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoader.style.display = 'inline-block';
      hideError();

      try {
        // First, create customer in Shopify via our backend (which will create Tebra patient)
        const response = await fetch(`${BACKEND_API}/api/shopify-storefront/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
            phone: (phone && phone.length >= 10) ? phone : null, // Phone is optional
            state: state || 'CA', // Ensure state is always provided
            acceptsMarketing: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
          throw new Error(errorData.message || 'Registration failed');
        }

        const result = await response.json();

        if (result.success && result.customer) {
          // Store customer access token if provided (for immediate login)
          if (result.customerAccessToken) {
            try {
              sessionStorage.setItem('storefrontToken', result.customerAccessToken);
              window.storefrontToken = result.customerAccessToken;
              // Update global SXRX object
              if (window.SXRX) {
                window.SXRX.isLoggedIn = true;
                window.SXRX.customerId = result.customer.id;
              }
            } catch (e) {}
          }

          // Check if email verification was sent
          if (result.emailVerificationSent) {
            // Show email verification message
            if (btnText) btnText.textContent = 'Account created!';
            
            // Show verification notice
            const verificationNotice = document.createElement('div');
            verificationNotice.className = 'form-notification success';
            verificationNotice.style.display = 'block';
            verificationNotice.innerHTML = `
              <strong>✓ Account Created Successfully!</strong><br>
              Please check your email (${result.customer.email}) to verify your account. 
              You can still log in, but some features may be limited until your email is verified.
            `;
            
            const form = document.getElementById('customer-register-form');
            if (form) {
              form.insertBefore(verificationNotice, form.firstChild);
            }
            
            // Redirect after showing message
            setTimeout(() => {
              const pendingRedirect = sessionStorage.getItem('pending_purchase_redirect');
              if (pendingRedirect && result.customerAccessToken) {
                window.location.href = pendingRedirect;
              } else {
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/account/login';
                window.location.href = redirectUrl;
              }
            }, 3000);
          } else {
            // No verification email sent (fallback behavior)
            const pendingProductId = sessionStorage.getItem('pending_purchase_productId');
            const pendingRedirect = sessionStorage.getItem('pending_purchase_redirect');

            // Show success message
            if (btnText) btnText.textContent = 'Account created! Redirecting...';
            
            // Redirect to login or pending purchase
            setTimeout(() => {
              if (pendingRedirect && result.customerAccessToken) {
                // If we have access token, we can redirect directly to pending purchase
                window.location.href = pendingRedirect;
              } else if (pendingRedirect) {
                // No token, redirect to login first
                window.location.href = `/account/login?redirect=${encodeURIComponent(pendingRedirect)}`;
              } else {
                // Default: redirect to login
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/account/login';
                window.location.href = redirectUrl;
              }
            }, 1500);
          }
        } else {
          throw new Error(result.message || 'Registration failed');
        }
      } catch (error) {
        console.error('[REGISTRATION] Registration error:', error);
        showError(error.message || 'Registration failed. Please try again.');
        
        // Restore button
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
      }
    });

    // Real-time validation
    const requiredFields = ['register-first-name', 'register-last-name', 'register-email', 'register-password'];
    requiredFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('blur', function() {
          if (this.value.trim()) {
            this.classList.remove('invalid');
            this.classList.add('valid');
          } else {
            this.classList.remove('valid');
            this.classList.add('invalid');
          }
        });
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRegistrationHandler);
  } else {
    initRegistrationHandler();
  }
})();
