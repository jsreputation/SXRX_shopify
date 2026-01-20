// Schedule Button Integration with Cowlendar
// Handles schedule button clicks and integrates with Cowlendar booking app

(function() {
  'use strict';

  // Bump this string to verify the latest file is live in Shopify.
  // You can check the browser console for this line.
  const SCHEDULE_INTEGRATION_VERSION = '2026-01-19-1';
  try {
    console.log(`[SXRX] schedule-integration loaded (${SCHEDULE_INTEGRATION_VERSION})`);
  } catch (e) {}

  // Initialize Cowlendar integration
  function initCowlendarIntegration() {
    // NOTE:
    // Do NOT use jQuery-only selectors like :contains() here — they break querySelectorAll().
    // We detect schedule CTAs by href patterns + text content.

    // 1) Explicit href patterns we want to intercept (including legacy external link)
    let hrefTargets = [];
    try {
      hrefTargets = Array.from(document.querySelectorAll(
        'a[href*="app.sxrx.us"], a[href*="/apps/cowlendar"], a[href*="cowlendar"], a[href*="appointment-booking"]'
      ));
    } catch (e) {
      hrefTargets = [];
    }

    hrefTargets.forEach((element) => {
      if (!element.hasAttribute('data-cowlendar-handled')) {
        element.setAttribute('data-cowlendar-handled', 'true');
        element.addEventListener('click', handleScheduleClick);
      }
    });

    // 2) Also check for buttons/links with schedule text
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
    // Expose for other scripts (e.g. my-appointments.js)
    // eslint-disable-next-line no-undef
    window.openCowlendarBooking = openCowlendarBooking;

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
      
      // Option 1: Redirect to Appointment Booking product page (preferred)
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
    // Preferred: route users to the Shopify product page that hosts Cowlendar booking
    // This avoids sending users to external domains like app.sxrx.us
    const basePath = '/products/appointment-booking';
    if (context.customerId) {
      return `${basePath}?customer=${encodeURIComponent(String(context.customerId))}`;
    }
    return basePath;
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

