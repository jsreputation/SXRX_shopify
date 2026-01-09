// Schedule Button Integration with Cowlendar
// Handles schedule button clicks and integrates with Cowlendar booking app

(function() {
  'use strict';

  // Initialize Cowlendar integration
  function initCowlendarIntegration() {
    // Find all schedule buttons
    const scheduleButtons = document.querySelectorAll('a[href*="schedule"], a[href*="appointment"], button:contains("Schedule"), a:contains("Schedule")');
    
    // Also check for buttons with specific text
    const allLinks = document.querySelectorAll('a, button');
    allLinks.forEach(element => {
      const text = element.textContent.toLowerCase();
      if (text.includes('schedule') && (text.includes('appointment') || text.includes('consultation'))) {
        if (!element.hasAttribute('data-cowlendar-handled')) {
          element.setAttribute('data-cowlendar-handled', 'true');
          element.addEventListener('click', handleScheduleClick);
        }
      }
    });

    // Check for URL parameter to trigger scheduling
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('schedule') === 'true') {
      openCowlendarBooking();
    }
  }

  // Handle schedule button click
  function handleScheduleClick(event) {
    event.preventDefault();
    
    // Get patient context if available
    const customerId = window.Shopify?.customer?.id || sessionStorage.getItem('customerId');
    const patientData = window.cowlendarData || {};
    
    // Open Cowlendar booking
    openCowlendarBooking({
      customerId: customerId,
      ...patientData
    });
  }

  // Open Cowlendar booking
  function openCowlendarBooking(context = {}) {
    // Check if Cowlendar app is embedded
    const cowlendarEmbed = document.querySelector('[data-cowlendar-app]');
    
    if (cowlendarEmbed) {
      // Pass context to Cowlendar
      if (context.patientId || context.customerId) {
        window.cowlendarBookingContext = context;
      }
      
      // Trigger Cowlendar modal
      cowlendarEmbed.click();
    } else {
      // Check for Cowlendar app installation
      // Cowlendar typically provides a booking page URL or embed code
      // Redirect to Cowlendar booking page or show embedded widget
      
      // Option 1: Redirect to Cowlendar booking page (if configured)
      const cowlendarBookingUrl = getCowlendarBookingUrl(context);
      if (cowlendarBookingUrl) {
        window.location.href = cowlendarBookingUrl;
        return;
      }
      
      // Option 2: Show embedded Cowlendar widget
      showCowlendarWidget(context);
    }
  }

  // Get Cowlendar booking URL
  function getCowlendarBookingUrl(context) {
    // This should be configured in Shopify settings or environment
    // For now, check for common Cowlendar patterns
    const baseUrl = window.Shopify?.shop || '';
    
    // Cowlendar typically uses: /apps/cowlendar/book or similar
    // You may need to configure this based on your Cowlendar setup
    if (context.customerId) {
      return `/apps/cowlendar/book?customer=${context.customerId}`;
    }
    
    return '/apps/cowlendar/book';
  }

  // Show Cowlendar widget (if embedded)
  function showCowlendarWidget(context) {
    // Create modal or show embedded widget
    const widgetContainer = document.getElementById('cowlendar-widget-container');
    
    if (widgetContainer) {
      widgetContainer.style.display = 'block';
    } else {
      // Create widget container
      const container = document.createElement('div');
      container.id = 'cowlendar-widget-container';
      container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
      
      const widget = document.createElement('div');
      widget.style.cssText = 'background: white; padding: 2rem; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;';
      widget.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2>Schedule Appointment</h2>
          <button id="close-cowlendar-widget" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div id="cowlendar-booking-widget">
          <p>Loading booking widget...</p>
          <p style="color: #666; font-size: 0.9rem; margin-top: 1rem;">
            If the widget doesn't load, please install the Cowlendar Booking app from the Shopify App Store.
          </p>
        </div>
      `;
      
      container.appendChild(widget);
      document.body.appendChild(container);
      
      // Close button handler
      document.getElementById('close-cowlendar-widget').addEventListener('click', () => {
        container.remove();
      });
      
      // Load Cowlendar widget (this would be provided by Cowlendar app)
      // For now, show instructions
      setTimeout(() => {
        widget.querySelector('#cowlendar-booking-widget').innerHTML = `
          <p>To enable appointment booking:</p>
          <ol style="text-align: left; margin-top: 1rem;">
            <li>Install the Cowlendar Booking app from the Shopify App Store</li>
            <li>Configure your appointment types and availability</li>
            <li>The booking widget will appear here automatically</li>
          </ol>
          <p style="margin-top: 1rem;">
            <a href="https://apps.shopify.com/cowlendar" target="_blank" style="color: #3f72e5;">
              Install Cowlendar Booking App →
            </a>
          </p>
        `;
      }, 1000);
    }
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', initCowlendarIntegration);
  
  // Also initialize after dynamic content loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCowlendarIntegration);
  } else {
    initCowlendarIntegration();
  }
})();

