// Questionnaire Integration - Consultation Scheduling
// Handles consultation scheduling UI and appointment booking

(function() {
  'use strict';

  // Initialize SXRX namespace if it doesn't exist
  if (!window.SXRX) window.SXRX = {};
  if (!window.SXRX.Questionnaire) window.SXRX.Questionnaire = {};

  const Utils = window.SXRX.Questionnaire.Utils;
  const ProductHelpers = window.SXRX.Questionnaire.ProductHelpers;
  const Cart = window.SXRX.Questionnaire.Cart;

  // Show consultation scheduling with beautiful, productive UI
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
      slotsHtml = `
        <div class="appointment-scheduler">
          <div class="scheduler-header">
            <h4>📅 Select Your Preferred Time</h4>
            <p class="scheduler-subtitle">Choose an available consultation slot with our medical director</p>
          </div>
          <div class="slots-grid">
      `;
      
      availableSlots.forEach((slot, index) => {
        const slotDate = new Date(slot.startTime || slot.date);
        const formattedDate = slotDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
        const formattedTime = slotDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true
        });
        const endTime = slot.endTime ? new Date(slot.endTime) : new Date(slotDate.getTime() + 30 * 60000);
        const formattedEndTime = endTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true
        });
        
        slotsHtml += `
          <div class="slot-card" data-slot-index="${index}">
            <input type="radio" name="selected-slot" id="slot-${index}" value="${index}" class="slot-radio">
            <label for="slot-${index}" class="slot-label">
              <div class="slot-date">
                <span class="slot-day">${slotDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="slot-month-day">${slotDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div class="slot-time">
                <span class="time-start">${formattedTime}</span>
                <span class="time-separator">–</span>
                <span class="time-end">${formattedEndTime}</span>
              </div>
              ${slot.provider ? `<div class="slot-provider">${slot.provider}</div>` : '<div class="slot-provider">Medical Director</div>'}
            </label>
          </div>
        `;
      });
      
      slotsHtml += `
          </div>
          <div class="selected-slot-info" id="selected-slot-info" style="display: none;">
            <div class="selected-slot-content">
              <span class="selected-icon">✓</span>
              <span class="selected-text">Appointment selected</span>
            </div>
          </div>
        </div>
      `;
    } else {
      slotsHtml = `
        <div class="no-slots-message">
          <div class="no-slots-icon">📅</div>
          <h4>No Available Slots</h4>
          <p>We're currently fully booked. Please contact us to schedule a consultation.</p>
          <a href="/pages/contact" class="contact-link">Contact Us</a>
        </div>
      `;
    }

    const message = `
      <div class="consultation-prompt">
        <div class="consultation-header">
          <div class="consultation-icon">👨‍⚕️</div>
          <h3>Consultation Required</h3>
          <p class="consultation-description">A consultation with our medical director is required before we can proceed with your order. Please select an available appointment time below.</p>
        </div>
        ${slotsHtml}
        <div class="booking-actions">
          <button id="schedule-consultation-btn" class="btn btn-primary btn-booking" ${availableSlots.length === 0 ? 'disabled' : ''}>
            <span class="btn-text">${availableSlots.length > 0 ? 'Book Selected Appointment' : 'No Slots Available'}</span>
            <span class="btn-loader" style="display: none;">⏳</span>
          </button>
        </div>
      </div>
    `;
    
    container.innerHTML = message;
    container.style.display = 'block';

    // Initialize direct Tebra booking
    const scheduleBtn = document.getElementById('schedule-consultation-btn');
    if (scheduleBtn && availableSlots.length > 0) {
      // Add click handlers to slot cards
      const slotCards = container.querySelectorAll('.slot-card');
      slotCards.forEach(card => {
        const radio = card.querySelector('.slot-radio');
        const label = card.querySelector('.slot-label');
        
        // Make entire card clickable
        card.addEventListener('click', function(e) {
          if (e.target !== radio && e.target !== label) {
            radio.checked = true;
            updateSelectedSlot(availableSlots, parseInt(radio.value));
          }
        });
        
        radio.addEventListener('change', function() {
          if (this.checked) {
            updateSelectedSlot(availableSlots, parseInt(this.value));
          }
        });
      });
      
      scheduleBtn.addEventListener('click', function() {
        const selectedSlot = container.querySelector('input[name="selected-slot"]:checked');
        if (!selectedSlot) {
          Utils.showMessage('Please select an appointment slot', 'error');
          return;
        }
        
        const slotIndex = parseInt(selectedSlot.value);
        const selectedSlotData = availableSlots[slotIndex];
        
        // Book directly via Tebra
        bookTebraAppointment(data, selectedSlotData);
      });
    }
  }

  // Update selected slot visual feedback
  function updateSelectedSlot(availableSlots, index) {
    const selectedInfo = document.getElementById('selected-slot-info');
    if (selectedInfo) {
      const slot = availableSlots[index];
      const slotDate = new Date(slot.startTime || slot.date);
      const formattedDate = slotDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = slotDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
      
      selectedInfo.querySelector('.selected-text').textContent = `Selected: ${formattedDate} at ${formattedTime}`;
      selectedInfo.style.display = 'block';
    }
    
    // Update visual state of slot cards
    const slotCards = document.querySelectorAll('.slot-card');
    slotCards.forEach((card, i) => {
      if (i === index) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // Book appointment directly via Tebra
  async function bookTebraAppointment(consultationData, selectedSlot) {
    // Show loading state
    const bookButton = document.getElementById('book-consultation-btn');
    const originalButtonText = bookButton?.textContent || 'Book Consultation';
    if (bookButton) {
      bookButton.disabled = true;
      bookButton.textContent = 'Booking...';
      bookButton.style.opacity = '0.6';
    }
    
    try {
      // Show loading state
      const btn = document.getElementById('schedule-consultation-btn');
      const btnText = btn.querySelector('.btn-text');
      const btnLoader = btn.querySelector('.btn-loader');
      const originalText = btnText.textContent;
      
      btn.disabled = true;
      btnText.style.display = 'none';
      btnLoader.style.display = 'inline-block';

      // Check if user is logged in before booking
      const isLoggedIn = !!(window.SXRX?.isLoggedIn || 
                           window.Shopify?.customer?.id ||
                           document.body.classList.contains('customer-logged-in'));
      
      if (!isLoggedIn) {
        throw new Error('You must be logged in to book an appointment. Redirecting to login...');
      }

      // Get patient ID and state from consultation data
      const patientId = consultationData.patientId;
      const state = consultationData.state || Utils.getStateFromUrl();
      const productId = consultationData.productId;
      const purchaseType = consultationData.purchaseType || 'subscription';

      if (!patientId || !state) {
        throw new Error('Missing required information. Please try again.');
      }

      // Call backend to create appointment
      const response = await fetch(`${Utils.BACKEND_API}/api/appointments/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: patientId,
          state: state,
          startTime: selectedSlot.startTime,
          // endTime not sent - backend will always enforce 30 minutes
          appointmentName: 'Telemedicine Consultation',
          productId: productId,
          purchaseType: purchaseType
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to book appointment' }));
        throw new Error(errorData.message || 'Failed to book appointment');
      }

      const result = await response.json();

      if (result.success) {
        // Show success message
        Utils.showMessage('✅ Appointment booked successfully! Redirecting to checkout...', 'success');
        
        // Store appointment info
        sessionStorage.setItem(`appointment_booked_${productId}`, 'true');
        sessionStorage.setItem(`appointment_id_${productId}`, result.appointmentId);
        sessionStorage.setItem(`appointment_time_${productId}`, selectedSlot.startTime);
        
        // Redirect to checkout after short delay
        setTimeout(() => {
          // Check if user is logged in before proceeding to checkout
          if (!window.SXRX || !window.SXRX.isLoggedIn) {
            // Force sign up first
            Utils.redirectToSignUp(productId, purchaseType);
          } else {
            // Proceed to checkout with product
            const variantId = sessionStorage.getItem(`variant_id_${productId}`);
            if (variantId) {
              Cart.addToCartAndCheckout(productId, variantId, purchaseType);
            } else {
              window.location.href = `/products/${ProductHelpers.getProductHandle(productId)}?appointment_booked=true`;
            }
          }
        }, 2000);
      } else {
        throw new Error(result.message || 'Booking failed');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      
      // If error is about not being logged in, redirect to login
      if (error.message && error.message.includes('logged in')) {
        const questionnaireUrl = window.SXRX?.questionnairePagePath || '/pages/questionnaire';
        const redirectUrl = `/account/login?redirect=${encodeURIComponent(questionnaireUrl)}`;
        window.location.href = redirectUrl;
        return;
      }
      
      Utils.showMessage(error.message || 'Failed to book appointment. Please try again.', 'error');
      
      // Restore button
      const btn = document.getElementById('schedule-consultation-btn');
      if (btn) {
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        btn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
      }
    }
  }

  // Export scheduling functions to SXRX.Questionnaire namespace
  window.SXRX.Questionnaire.Scheduling = {
    showConsultationScheduling,
    updateSelectedSlot,
    bookTebraAppointment
  };
})();
