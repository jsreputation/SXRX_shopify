// My Appointments - Patient Appointment Management
// Displays patient's appointments from Tebra EHR and allows scheduling

(function() {
  'use strict';

  const BACKEND_API = 'https://intermomentary-hendrix-phreatic.ngrok-free.dev';
  
  // Add professional styles
  function addStyles() {
    if (document.getElementById('my-appointments-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'my-appointments-styles';
    style.textContent = `
      .appointments-wrapper {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #1a1c1d;
        line-height: 1.6;
      }
      
      .appointments-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e8e8e8;
        flex-wrap: wrap;
        gap: 1rem;
      }
      
      .appointments-header h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #1a1c1d;
        margin: 0;
        letter-spacing: -0.02em;
      }
      
      .btn-primary {
        padding: 0.875rem 1.75rem;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(63, 114, 229, 0.3);
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(63, 114, 229, 0.4);
      }
      
      .btn-primary::before {
        content: '+';
        font-size: 1.25rem;
        font-weight: 300;
      }
      
      .patient-info-section {
        background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
        border: 1px solid #e0e7ff;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
      }
      
      .patient-info-section h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1a1c1d;
        margin: 0 0 1.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .patient-info-section h2::before {
        content: '👤';
        font-size: 1.5rem;
      }
      
      .patient-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
      }
      
      .patient-detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .patient-detail-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .patient-detail-value {
        font-size: 1rem;
        color: #1a1c1d;
        font-weight: 500;
      }
      
      .appointments-section {
        background: #ffffff;
        border: 1px solid #e8e8e8;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      
      .appointments-section h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1.5rem 0;
        padding-bottom: 1rem;
        border-bottom: 2px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .appointments-section h2::before {
        content: '';
        width: 4px;
        height: 24px;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        border-radius: 2px;
      }
      
      .appointments-list {
        display: grid;
        gap: 1.5rem;
      }
      
      .appointment-card {
        background: #fafafa;
        border: 2px solid #e8e8e8;
        border-radius: 12px;
        padding: 2rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .appointment-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
      }
      
      .appointment-card.upcoming {
        background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);
        border-color: #3f72e5;
        box-shadow: 0 2px 8px rgba(63, 114, 229, 0.15);
      }
      
      .appointment-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        border-color: #d0d0d0;
      }
      
      .appointment-card.upcoming:hover {
        box-shadow: 0 8px 24px rgba(63, 114, 229, 0.25);
      }
      
      .appointment-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      
      .appointment-title {
        flex: 1;
        min-width: 200px;
      }
      
      .appointment-title h3 {
        font-size: 1.25rem;
        font-weight: 600;
        color: #1a1c1d;
        margin: 0 0 0.5rem 0;
      }
      
      .appointment-type {
        font-size: 0.875rem;
        color: #666;
        margin: 0;
      }
      
      .status-badge {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }
      
      .status-scheduled {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      .status-completed {
        background: #e3f2fd;
        color: #1565c0;
      }
      
      .status-cancelled {
        background: #ffebee;
        color: #c62828;
      }
      
      .appointment-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 1rem;
      }
      
      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .detail-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .detail-value {
        font-size: 1rem;
        color: #1a1c1d;
        font-weight: 500;
      }
      
      .detail-value.date {
        font-size: 1.125rem;
        font-weight: 600;
        color: #1a1c1d;
      }
      
      .meeting-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1.75rem;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        color: white;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 600;
        margin-top: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(63, 114, 229, 0.3);
      }
      
      .meeting-link:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(63, 114, 229, 0.4);
      }
      
      .meeting-link::after {
        content: '→';
        font-size: 1.25rem;
      }
      
      .appointment-notes {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #e8e8e8;
      }
      
      .appointment-notes strong {
        font-size: 0.875rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: block;
        margin-bottom: 0.5rem;
      }
      
      .appointment-notes p {
        color: #666;
        font-size: 0.9375rem;
        margin: 0;
        line-height: 1.6;
      }
      
      .no-appointments {
        text-align: center;
        padding: 4rem 2rem;
        background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
        border: 2px dashed #e0e7ff;
        border-radius: 12px;
      }
      
      .no-appointments-icon {
        font-size: 4rem;
        margin-bottom: 1.5rem;
        opacity: 0.6;
      }
      
      .no-appointments h3 {
        font-size: 1.5rem;
        color: #1a1c1d;
        margin: 0 0 0.75rem 0;
        font-weight: 600;
      }
      
      .no-appointments p {
        color: #666;
        margin: 0 0 2rem 0;
        font-size: 1rem;
      }
      
      .loading-state {
        text-align: center;
        padding: 4rem 2rem;
        color: #666;
      }
      
      .loading-spinner {
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3f72e5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .error-message {
        text-align: center;
        padding: 4rem 2rem;
        background: #fff5f5;
        border: 1px solid #fecaca;
        border-radius: 12px;
        color: #dc2626;
      }
      
      .error-message h2 {
        font-size: 1.5rem;
        margin: 0 0 1rem 0;
      }
      
      .error-message p {
        font-size: 1rem;
        margin: 0 0 1.5rem 0;
      }
      
      .error-message a {
        display: inline-block;
        padding: 0.875rem 1.75rem;
        background: #3f72e5;
        color: white;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 600;
        transition: all 0.3s ease;
      }
      
      .error-message a:hover {
        background: #2d5cd4;
        transform: translateY(-2px);
      }
      
      @media (max-width: 768px) {
        .appointments-wrapper {
          padding: 1rem;
        }
        
        .appointments-header {
          flex-direction: column;
          align-items: stretch;
        }
        
        .appointments-header h1 {
          font-size: 1.75rem;
        }
        
        .appointments-section {
          padding: 1.5rem;
        }
        
        .appointment-card {
          padding: 1.5rem;
        }
        
        .appointment-header {
          flex-direction: column;
        }
        
        .appointment-details {
          grid-template-columns: 1fr;
        }
        
        .patient-details {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  async function loadAppointments() {
    try {
      addStyles();
      showLoading();
      
      // Get customer ID from Shopify
      const customerId = window.Shopify?.customer?.id;
      if (!customerId) {
        // Try to get from URL or sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        const storedCustomerId = urlParams.get('customer') || sessionStorage.getItem('customerId');
        
        if (!storedCustomerId) {
          showError('Please log in to view your appointments.');
          return;
        }
        
        // Use stored customer ID
        await loadAppointmentsForCustomer(storedCustomerId);
        return;
      }

      await loadAppointmentsForCustomer(customerId);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showError('Error loading your appointments. Please try again later.');
    }
  }

  function showLoading() {
    const container = document.getElementById('my-appointments-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading your appointments...</p>
        </div>
      `;
    }
  }

  async function loadAppointmentsForCustomer(customerId) {
    try {
      // Build headers - try multiple auth methods
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Try to get Shopify customer access token from various sources
      const storefrontToken = getStorefrontToken();
      const shopifyCustomerToken = window.Shopify?.customerAccessToken || 
                                  sessionStorage.getItem('shopify_customer_access_token') ||
                                  localStorage.getItem('shopify_customer_access_token');
      
      if (storefrontToken) {
        headers['Authorization'] = `Bearer ${storefrontToken}`;
      } else if (shopifyCustomerToken) {
        headers['shopify_access_token'] = shopifyCustomerToken;
      }
      
      console.log(`🔍 [MY-APPOINTMENTS] Loading appointments for customer ${customerId}`, {
        hasStorefrontToken: !!storefrontToken,
        hasShopifyToken: !!shopifyCustomerToken
      });
      
      // First, get patient chart to get Tebra patient ID
      const chartResponse = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`, {
        headers: headers
      });

      if (!chartResponse.ok) {
        const errorData = await chartResponse.json().catch(() => ({}));
        console.error(`❌ [MY-APPOINTMENTS] Chart API error:`, chartResponse.status, errorData);
        
        if (chartResponse.status === 401 || chartResponse.status === 403) {
          showError('Authentication failed. Please log in and try again.');
          return;
        }
        if (chartResponse.status === 404) {
          showError('No patient record found. Please complete a questionnaire or book an appointment first.');
          return;
        }
        throw new Error(errorData.message || 'Failed to load patient data');
      }

      const chartData = await chartResponse.json();
      const appointments = chartData.appointments || [];

      // Also try to fetch appointments directly from appointments endpoint if available
      let additionalAppointments = [];
      try {
        const appointmentsResponse = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/appointments`, {
          headers: headers
        });

        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          additionalAppointments = appointmentsData.appointments || [];
        } else {
          console.warn(`⚠️ [MY-APPOINTMENTS] Appointments endpoint returned ${appointmentsResponse.status}`);
        }
      } catch (e) {
        // Non-critical, continue with chart appointments
        console.warn('⚠️ [MY-APPOINTMENTS] Could not fetch additional appointments:', e);
      }

      // Merge and deduplicate appointments
      const allAppointments = mergeAppointments(appointments, additionalAppointments);
      
      renderAppointments(allAppointments, chartData.patient);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showError('Error loading your appointments. Please try again later.');
    }
  }

  function mergeAppointments(appointments1, appointments2) {
    const merged = [...appointments1];
    const seenIds = new Set(appointments1.map(apt => apt.id || apt.ID));

    appointments2.forEach(apt => {
      const aptId = apt.id || apt.ID;
      if (aptId && !seenIds.has(aptId)) {
        merged.push(apt);
        seenIds.add(aptId);
      }
    });

    // Sort by start time (most recent first)
    return merged.sort((a, b) => {
      const timeA = new Date(a.startTime || a.StartTime || 0).getTime();
      const timeB = new Date(b.startTime || b.StartTime || 0).getTime();
      return timeB - timeA; // Descending order
    });
  }

  function renderAppointments(appointments, patientInfo) {
    const container = document.getElementById('my-appointments-container');
    if (!container) return;

    // Separate appointments by status
    const upcoming = appointments.filter(apt => {
      const startTime = new Date(apt.startTime || apt.StartTime || 0);
      const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || '').toLowerCase();
      return startTime > new Date() && !status.includes('cancelled') && !status.includes('completed');
    });

    const past = appointments.filter(apt => {
      const startTime = new Date(apt.startTime || apt.StartTime || 0);
      const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || '').toLowerCase();
      return startTime <= new Date() || status.includes('completed') || status.includes('cancelled');
    });

    const html = `
      <div class="appointments-wrapper">
        ${patientInfo ? `
          <div class="patient-info-section">
            <h2>Patient Information</h2>
            <div class="patient-details">
              ${patientInfo.firstName || patientInfo.lastName ? `
                <div class="patient-detail-item">
                  <span class="patient-detail-label">Full Name</span>
                  <span class="patient-detail-value">${(patientInfo.firstName || '') + ' ' + (patientInfo.lastName || '')}</span>
                </div>
              ` : ''}
              ${patientInfo.email ? `
                <div class="patient-detail-item">
                  <span class="patient-detail-label">Email Address</span>
                  <span class="patient-detail-value">${patientInfo.email}</span>
                </div>
              ` : ''}
              ${patientInfo.mobilePhone ? `
                <div class="patient-detail-item">
                  <span class="patient-detail-label">Phone Number</span>
                  <span class="patient-detail-value">${patientInfo.mobilePhone}</span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="appointments-header">
          <h1>My Appointments</h1>
          <button id="schedule-new-appointment-btn" class="btn-primary">
            Schedule New Appointment
          </button>
        </div>

        ${upcoming.length > 0 ? `
          <div class="appointments-section">
            <h2 style="color: #3f72e5;">Upcoming Appointments (${upcoming.length})</h2>
            <div class="appointments-list">
              ${upcoming.map(apt => renderAppointmentCard(apt, true)).join('')}
            </div>
          </div>
        ` : ''}

        ${past.length > 0 ? `
          <div class="appointments-section">
            <h2 style="color: #666;">Past Appointments (${past.length})</h2>
            <div class="appointments-list">
              ${past.map(apt => renderAppointmentCard(apt, false)).join('')}
            </div>
          </div>
        ` : ''}

        ${appointments.length === 0 ? `
          <div class="no-appointments">
            <div class="no-appointments-icon">📅</div>
            <h3>No Appointments Found</h3>
            <p>You don't have any appointments scheduled yet.</p>
            <button id="schedule-first-appointment-btn" class="btn-primary">
              Schedule Your First Appointment
            </button>
          </div>
        ` : ''}
      </div>
    `;
    
    container.innerHTML = html;

    // Add event listeners for schedule buttons
    const scheduleBtn = document.getElementById('schedule-new-appointment-btn');
    const scheduleFirstBtn = document.getElementById('schedule-first-appointment-btn');
    
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', handleScheduleClick);
    }
    if (scheduleFirstBtn) {
      scheduleFirstBtn.addEventListener('click', handleScheduleClick);
    }
  }

  function renderAppointmentCard(apt, isUpcoming) {
    const startTime = new Date(apt.startTime || apt.StartTime || 0);
    const endTime = new Date(apt.endTime || apt.EndTime || startTime.getTime() + 30 * 60000);
    const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || 'Scheduled').toLowerCase();
    const appointmentName = apt.appointmentName || apt.AppointmentName || 'Appointment';
    const appointmentType = apt.appointmentType || apt.AppointmentType || 'Consultation';
    const meetingLink = apt.meetingLink || apt.MeetingLink || apt.telemedicineLink || 
                       (apt.notes && apt.notes.match(/https?:\/\/[^\s]+(?:meet\.google\.com|zoom\.us)[^\s]*/i)?.[0]) || null;
    
    let statusClass = 'status-scheduled';
    if (status.includes('cancelled')) {
      statusClass = 'status-cancelled';
    } else if (status.includes('completed')) {
      statusClass = 'status-completed';
    }
    
    return `
      <div class="appointment-card ${isUpcoming ? 'upcoming' : ''}">
        <div class="appointment-header">
          <div class="appointment-title">
            <h3>${appointmentName}</h3>
            <p class="appointment-type">${appointmentType}</p>
          </div>
          <span class="status-badge ${statusClass}">${status}</span>
        </div>
        
        <div class="appointment-details">
          <div class="detail-item">
            <span class="detail-label">Date</span>
            <span class="detail-value date">${startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Time</span>
            <span class="detail-value">${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          ${meetingLink ? `
            <div class="detail-item">
              <span class="detail-label">Telemedicine</span>
              <a href="${meetingLink}" target="_blank" class="meeting-link">Join Meeting</a>
            </div>
          ` : ''}
        </div>

        ${apt.notes ? `
          <div class="appointment-notes">
            <strong>Notes</strong>
            <p>${apt.notes}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  function handleScheduleClick(event) {
    event.preventDefault();
    
    // Get patient context if available
    const customerId = window.Shopify?.customer?.id || sessionStorage.getItem('customerId');
    
    // Use schedule-integration.js if available, or redirect to Cowlendar
    if (window.openCowlendarBooking) {
      window.openCowlendarBooking({ customerId });
    } else {
      // Fallback: redirect to appointment booking product page
      window.location.href = '/products/appointment-booking' + (customerId ? `?customer=${customerId}` : '');
    }
  }

  function showError(message) {
    const container = document.getElementById('my-appointments-container');
    if (container) {
      addStyles();
      container.innerHTML = `
        <div class="error-message">
          <h2>⚠️ Unable to Load Appointments</h2>
          <p>${message}</p>
          <a href="/account/login">Please log in to view your appointments</a>
        </div>
      `;
    }
  }

  function getStorefrontToken() {
    return window.storefrontToken || '';
  }

  // Load appointments on page load
  document.addEventListener('DOMContentLoaded', loadAppointments);
})();
