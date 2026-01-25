// shopify_new/assets/accessibility.js
// Accessibility enhancements for WCAG AA compliance

(function() {
  'use strict';
  
  const ACCESSIBILITY_VERSION = '2026-01-21-1';
  console.log(`[SXRX] accessibility.js loaded (${ACCESSIBILITY_VERSION})`);
  
  /**
   * Initialize accessibility enhancements
   */
  function init() {
    addAriaLabels();
    enhanceKeyboardNavigation();
    addSkipLinks();
    enhanceFormLabels();
    addFocusIndicators();
    announceDynamicContent();
  }
  
  /**
   * Add ARIA labels to interactive elements
   */
  function addAriaLabels() {
    // Add labels to buttons without text
    document.querySelectorAll('button:not([aria-label]):not(:has(span, img, svg))').forEach(button => {
      if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
        const icon = button.querySelector('i, svg, img');
        if (icon) {
          const iconClass = icon.className || '';
          const label = getLabelFromIcon(iconClass);
          if (label) {
            button.setAttribute('aria-label', label);
          }
        }
      }
    });
    
    // Add labels to close buttons
    document.querySelectorAll('.close, [data-close], .modal-close, .notification-close').forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Close');
      }
    });
    
    // Add labels to navigation links
    document.querySelectorAll('nav a, .nav-link').forEach(link => {
      if (!link.getAttribute('aria-label') && !link.textContent.trim()) {
        const icon = link.querySelector('i, svg');
        if (icon) {
          const label = getLabelFromIcon(icon.className);
          if (label) {
            link.setAttribute('aria-label', label);
          }
        }
      }
    });
    
    // Add role attributes where needed
    document.querySelectorAll('[role="button"]').forEach(el => {
      el.setAttribute('tabindex', '0');
    });
  }
  
  /**
   * Get label from icon class name
   */
  function getLabelFromIcon(iconClass) {
    const iconMap = {
      'search': 'Search',
      'cart': 'Shopping cart',
      'menu': 'Menu',
      'close': 'Close',
      'edit': 'Edit',
      'delete': 'Delete',
      'add': 'Add',
      'remove': 'Remove',
      'next': 'Next',
      'previous': 'Previous',
      'back': 'Back',
      'forward': 'Forward',
      'save': 'Save',
      'cancel': 'Cancel',
      'submit': 'Submit',
      'loading': 'Loading'
    };
    
    for (const [key, label] of Object.entries(iconMap)) {
      if (iconClass.includes(key)) {
        return label;
      }
    }
    
    return null;
  }
  
  /**
   * Enhance keyboard navigation
   */
  function enhanceKeyboardNavigation() {
    // Ensure all interactive elements are keyboard accessible
    document.querySelectorAll('[role="button"], [role="tab"], [role="menuitem"]').forEach(el => {
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }
      
      // Add keyboard event handlers
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
    
    // Trap focus in modals
    document.querySelectorAll('.modal, [role="dialog"]').forEach(modal => {
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
          
          if (e.key === 'Escape') {
            const closeButton = modal.querySelector('[data-close], .close, [aria-label="Close"]');
            if (closeButton) {
              closeButton.click();
            }
          }
        });
      }
    });
    
    // Arrow key navigation for tabs
    document.querySelectorAll('[role="tablist"]').forEach(tablist => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      
      tabs.forEach((tab, index) => {
        tab.addEventListener('keydown', (e) => {
          let targetIndex = index;
          
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            targetIndex = (index + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            targetIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            targetIndex = 0;
          } else if (e.key === 'End') {
            targetIndex = tabs.length - 1;
          } else {
            return;
          }
          
          e.preventDefault();
          tabs[targetIndex].focus();
          tabs[targetIndex].click();
        });
      });
    });
  }
  
  /**
   * Add skip links for keyboard navigation
   */
  function addSkipLinks() {
    if (document.getElementById('skip-links')) {
      return; // Already exists
    }
    
    const skipLinks = document.createElement('div');
    skipLinks.id = 'skip-links';
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -100px;
        left: 0;
        z-index: 10000;
      }
      
      .skip-link {
        position: absolute;
        top: 0;
        left: 0;
        padding: 1rem;
        background: #000;
        color: #fff;
        text-decoration: none;
        z-index: 10001;
        opacity: 0;
        pointer-events: none;
      }
      
      .skip-link:focus {
        top: 0;
        opacity: 1;
        pointer-events: auto;
      }
    `;
    
    document.head.appendChild(style);
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }
  
  /**
   * Enhance form labels
   */
  function enhanceFormLabels() {
    // Ensure all inputs have associated labels
    document.querySelectorAll('input, select, textarea').forEach(input => {
      const id = input.id || `input-${Math.random().toString(36).substr(2, 9)}`;
      if (!input.id) {
        input.id = id;
      }
      
      if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        const label = input.closest('label') || document.querySelector(`label[for="${id}"]`);
        if (!label && input.placeholder) {
          input.setAttribute('aria-label', input.placeholder);
        } else if (label && !label.getAttribute('for')) {
          label.setAttribute('for', id);
        }
      }
      
      // Add error state ARIA attributes
      if (input.hasAttribute('data-invalid') || input.classList.contains('error')) {
        input.setAttribute('aria-invalid', 'true');
        const errorMessage = input.getAttribute('data-error') || input.parentElement.querySelector('.error-message');
        if (errorMessage) {
          const errorId = `error-${id}`;
          if (typeof errorMessage === 'string') {
            input.setAttribute('aria-describedby', errorId);
            const errorEl = document.createElement('span');
            errorEl.id = errorId;
            errorEl.className = 'sr-only';
            errorEl.textContent = errorMessage;
            input.parentElement.appendChild(errorEl);
          } else {
            errorMessage.id = errorId;
            input.setAttribute('aria-describedby', errorId);
          }
        }
      }
    });
  }
  
  /**
   * Add visible focus indicators
   */
  function addFocusIndicators() {
    const style = document.createElement('style');
    style.textContent = `
      *:focus-visible {
        outline: 3px solid #0066cc;
        outline-offset: 2px;
      }
      
      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 3px solid #0066cc;
        outline-offset: 2px;
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        *:focus-visible {
          outline: 4px solid;
          outline-offset: 3px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Announce dynamic content changes to screen readers
   */
  function announceDynamicContent() {
    // Create live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
    
    // Expose function to announce messages
    window.SXRX = window.SXRX || {};
    window.SXRX.announce = (message, priority = 'polite') => {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    };
    
    // Monitor form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        setTimeout(() => {
          const successMessage = form.querySelector('.success-message, .alert-success');
          if (successMessage) {
            window.SXRX.announce(successMessage.textContent, 'polite');
          }
        }, 100);
      }
    });
  }
  
  /**
   * Add screen reader only class
   */
  function addScreenReaderStyles() {
    if (document.getElementById('sr-only-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'sr-only-styles';
    style.textContent = `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
      
      .sr-only-focusable:focus {
        position: static;
        width: auto;
        height: auto;
        padding: inherit;
        margin: inherit;
        overflow: visible;
        clip: auto;
        white-space: normal;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addScreenReaderStyles();
      init();
    });
  } else {
    addScreenReaderStyles();
    init();
  }
  
  // Re-initialize on dynamic content changes
  const observer = new MutationObserver(() => {
    addAriaLabels();
    enhanceFormLabels();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
})();
