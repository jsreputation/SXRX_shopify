// Mobile Responsiveness Styles
// Adds mobile-friendly styles to improve touch targets and layouts

(function() {
  'use strict';
  
  if (document.getElementById('mobile-responsive-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'mobile-responsive-styles';
  style.textContent = `
    /* Mobile Responsiveness - Global Styles */
    
    /* Touch targets - minimum 44x44px for accessibility */
    button, a.btn, .btn, input[type="submit"], input[type="button"] {
      min-height: 44px;
      min-width: 44px;
      touch-action: manipulation; /* Disable double-tap zoom */
    }
    
    /* Form inputs - larger on mobile */
    @media (max-width: 768px) {
      input[type="text"],
      input[type="email"],
      input[type="password"],
      input[type="tel"],
      input[type="date"],
      input[type="time"],
      select,
      textarea {
        font-size: 16px; /* Prevents zoom on iOS */
        padding: 0.875rem;
        min-height: 44px;
      }
      
      /* Consultation scheduling mobile styles */
      .slots-grid {
        grid-template-columns: 1fr !important;
        gap: 0.75rem;
      }
      
      .slot-card {
        min-height: 80px;
        padding: 1rem;
      }
      
      .slot-label {
        padding: 1rem;
      }
      
      .consultation-prompt {
        padding: 1rem;
      }
      
      .booking-actions {
        margin-top: 1.5rem;
      }
      
      .btn-booking {
        width: 100%;
        min-height: 48px;
        font-size: 1rem;
      }
      
      /* Questionnaire mobile styles */
      .questionnaire-container {
        padding: 1rem 0.5rem;
      }
      
      .questionnaire-content {
        padding: 1rem;
      }
      
      /* General mobile improvements */
      .container,
      .wrapper,
      .content-wrapper {
        padding-left: 1rem;
        padding-right: 1rem;
      }
      
      /* Tables - horizontal scroll on mobile */
      table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        white-space: nowrap;
      }
      
      /* Cards - full width on mobile */
      .card,
      .section-card {
        margin-left: 0;
        margin-right: 0;
      }
    }
    
    @media (max-width: 480px) {
      /* Extra small screens */
      h1 { font-size: 1.5rem !important; }
      h2 { font-size: 1.25rem !important; }
      h3 { font-size: 1.125rem !important; }
      
      .btn {
        padding: 0.875rem 1.25rem;
        font-size: 0.9375rem;
      }
      
      .slots-grid {
        gap: 0.5rem;
      }
      
      .slot-card {
        min-height: 70px;
        padding: 0.875rem;
      }
    }
    
    /* Prevent text size adjustment on orientation change */
    html {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    
    /* Improve tap highlighting */
    a, button {
      -webkit-tap-highlight-color: rgba(63, 114, 229, 0.2);
    }
  `;
  
  document.head.appendChild(style);
})();
