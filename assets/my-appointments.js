// My Appointments - Patient Appointment Management
// Displays patient's appointments from Tebra EHR and allows scheduling

(function() {
  'use strict';

  const BACKEND_API = 'https://api.sxrx.us';
  
  async function loadAppointments() {
    try {
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

  async function loadAppointmentsForCustomer(customerId) {
    try {
      // First, get patient chart to get Tebra patient ID
      const chartResponse = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`, {
        headers: {
          'Authorization': `Bearer ${getStorefrontToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!chartResponse.ok) {
        if (chartResponse.status === 404) {
          showError('No patient record found. Please complete a questionnaire first.');
          return;
        }
        throw new Error('Failed to load patient data');
      }

      const chartData = await chartResponse.json();
      const appointments = chartData.appointments || [];

      // Also try to fetch appointments directly from appointments endpoint if available
      let additionalAppointments = [];
      try {
        const appointmentsResponse = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/appointments`, {
          headers: {
            'Authorization': `Bearer ${getStorefrontToken()}`,
            'Content-Type': 'application/json'
          }
        });

        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          additionalAppointments = appointmentsData.appointments || [];
        }
      } catch (e) {
        // Non-critical, continue with chart appointments
        console.warn('Could not fetch additional appointments:', e);
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
      <div class="appointments-wrapper" style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
        ${patientInfo ? `
          <div class="patient-info-section" style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="margin-top: 0;">Patient Information</h2>
            <div class="patient-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
              ${patientInfo.firstName || patientInfo.lastName ? `
                <div>
                  <strong>Name:</strong> ${(patientInfo.firstName || '') + ' ' + (patientInfo.lastName || '')}
                </div>
              ` : ''}
              ${patientInfo.email ? `
                <div>
                  <strong>Email:</strong> ${patientInfo.email}
                </div>
              ` : ''}
              ${patientInfo.mobilePhone ? `
                <div>
                  <strong>Phone:</strong> ${patientInfo.mobilePhone}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="appointments-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <h1 style="margin: 0;">My Appointments</h1>
          <button id="schedule-new-appointment-btn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: #3f72e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            Schedule New Appointment
          </button>
        </div>

        ${upcoming.length > 0 ? `
          <div class="appointments-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="margin-top: 0; color: #3f72e5;">Upcoming Appointments (${upcoming.length})</h2>
            <div class="appointments-list" style="display: grid; gap: 1rem;">
              ${upcoming.map(apt => renderAppointmentCard(apt)).join('')}
            </div>
          </div>
        ` : ''}

        ${past.length > 0 ? `
          <div class="appointments-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="margin-top: 0; color: #666;">Past Appointments (${past.length})</h2>
            <div class="appointments-list" style="display: grid; gap: 1rem;">
              ${past.map(apt => renderAppointmentCard(apt)).join('')}
            </div>
          </div>
        ` : ''}

        ${appointments.length === 0 ? `
          <div class="no-appointments" style="text-align: center; padding: 3rem; background: #f9f9f9; border-radius: 8px;">
            <h3 style="color: #666; margin-bottom: 1rem;">No Appointments Found</h3>
            <p style="color: #999; margin-bottom: 1.5rem;">You don't have any appointments scheduled yet.</p>
            <button id="schedule-first-appointment-btn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: #3f72e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
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

  function renderAppointmentCard(apt) {
    const startTime = new Date(apt.startTime || apt.StartTime || 0);
    const endTime = new Date(apt.endTime || apt.EndTime || startTime.getTime() + 30 * 60000);
    const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || 'Scheduled').toLowerCase();
    const appointmentName = apt.appointmentName || apt.AppointmentName || 'Appointment';
    const appointmentType = apt.appointmentType || apt.AppointmentType || 'Consultation';
    const meetingLink = apt.meetingLink || apt.MeetingLink || apt.telemedicineLink || 
                       (apt.notes && apt.notes.match(/https?:\/\/[^\s]+/)?.[0]) || null;
    
    const isUpcoming = startTime > new Date();
    const statusColor = status.includes('cancelled') ? '#d32f2f' : 
                       status.includes('completed') ? '#666' : 
                       isUpcoming ? '#4caf50' : '#666';
    
    return `
      <div class="appointment-card" style="padding: 1.5rem; background: ${isUpcoming ? '#f0f7ff' : '#f9f9f9'}; border: 1px solid ${isUpcoming ? '#3f72e5' : '#e2e2e2'}; border-radius: 8px; transition: all 0.3s ease;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
          <div>
            <h3 style="margin: 0 0 0.5rem 0; color: #1a1c1d;">${appointmentName}</h3>
            <p style="margin: 0; color: #666; font-size: 0.9rem;">${appointmentType}</p>
          </div>
          <span style="padding: 0.25rem 0.75rem; background: ${statusColor}; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 600; text-transform: capitalize;">
            ${status}
          </span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
          <div>
            <strong style="color: #666; font-size: 0.9rem;">Date & Time</strong>
            <p style="margin: 0.25rem 0 0 0; color: #1a1c1d; font-weight: 500;">
              ${startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p style="margin: 0.25rem 0 0 0; color: #666; font-size: 0.9rem;">
              ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
              ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          
          ${meetingLink ? `
            <div>
              <strong style="color: #666; font-size: 0.9rem;">Telemedicine Link</strong>
              <p style="margin: 0.25rem 0 0 0;">
                <a href="${meetingLink}" target="_blank" style="color: #3f72e5; text-decoration: none; font-weight: 500;">
                  Join Meeting →
                </a>
              </p>
            </div>
          ` : ''}
        </div>

        ${apt.notes ? `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e2e2;">
            <strong style="color: #666; font-size: 0.9rem;">Notes</strong>
            <p style="margin: 0.25rem 0 0 0; color: #666; font-size: 0.9rem;">${apt.notes}</p>
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
      // Fallback: redirect to Cowlendar booking page
      const cowlendarUrl = '/apps/cowlendar/book' + (customerId ? `?customer=${customerId}` : '');
      window.location.href = cowlendarUrl;
    }
  }

  function showError(message) {
    const container = document.getElementById('my-appointments-container');
    if (container) {
      container.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 3rem; color: #d32f2f;">
          <h2>Error</h2>
          <p>${message}</p>
          <a href="/account/login" style="color: #3f72e5; text-decoration: none; margin-top: 1rem; display: inline-block;">
            Please log in to view your appointments
          </a>
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

