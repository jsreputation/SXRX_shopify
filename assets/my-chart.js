// My Chart - Patient Medical Records
// Displays patient's medical records from Tebra EHR and questionnaire data

(function() {
  'use strict';

  const BACKEND_API = 'https://api.sxrx.us';
  
  async function loadPatientChart() {
    try {
      // Get customer ID from Shopify
      const customerId = window.Shopify?.customer?.id;
      if (!customerId) {
        // Try to get from URL or sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        const storedCustomerId = urlParams.get('customer') || sessionStorage.getItem('customerId');
        
        if (!storedCustomerId) {
          showError('Please log in to view your chart.');
          return;
        }
        
        // Use stored customer ID
        await loadChartForCustomer(storedCustomerId);
        return;
      }

      await loadChartForCustomer(customerId);
    } catch (error) {
      console.error('Error loading chart:', error);
      showError('Error loading your medical chart. Please try again later.');
    }
  }

  async function loadChartForCustomer(customerId) {
    try {
      const response = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`, {
        headers: {
          'Authorization': `Bearer ${getStorefrontToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          showError('No chart found. Please complete a questionnaire first.');
          return;
        }
        throw new Error('Failed to load chart data');
      }

      const data = await response.json();
      renderChart(data);
    } catch (error) {
      console.error('Error loading chart:', error);
      showError('Error loading your medical chart. Please try again later.');
    }
  }

  function renderChart(data) {
    const container = document.getElementById('my-chart-container');
    if (!container) return;
    
    const patientInfo = data.patient || {};
    const questionnaire = data.questionnaire || {};
    
    const html = `
      <div class="chart-wrapper" style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
        ${patientInfo.firstName || patientInfo.lastName ? `
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
              ${patientInfo.dateOfBirth ? `
                <div>
                  <strong>Date of Birth:</strong> ${new Date(patientInfo.dateOfBirth).toLocaleDateString()}
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
        
        ${questionnaire.submittedAt ? `
          <div class="questionnaire-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="margin-top: 0;">Questionnaire</h2>
            <p><strong>Submitted:</strong> ${new Date(questionnaire.submittedAt).toLocaleString()}</p>
            ${questionnaire.summary ? `
              <div style="margin-top: 1rem;">
                <strong>Summary:</strong>
                <p>${questionnaire.summary}</p>
              </div>
            ` : ''}
            ${questionnaire.evaluation ? `
              <div style="margin-top: 1rem;">
                <strong>Evaluation:</strong>
                <p>${questionnaire.evaluation.requiresConsult ? 
                  '<span style="color: #ff9800;">Consultation required</span>' : 
                  '<span style="color: #4caf50;">Approved for purchase</span>'}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="chart-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
          <h2 style="margin-top: 0;">Medical Documents</h2>
          <div class="chart-items" style="display: grid; gap: 1rem;">
            ${data.documents && data.documents.length > 0 ? data.documents.map(doc => `
              <div class="chart-item" style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem;">${doc.name || 'Document'}</h3>
                <p class="doc-date" style="margin: 0.25rem 0; color: #666;">
                  <strong>Date:</strong> ${doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : 'N/A'}
                </p>
                <p class="doc-status" style="margin: 0.25rem 0; color: #666;">
                  <strong>Status:</strong> ${doc.status || 'Unknown'}
                </p>
                ${doc.notes ? `
                  <p class="doc-notes" style="margin: 0.5rem 0 0 0; color: #666;">${doc.notes}</p>
                ` : ''}
              </div>
            `).join('') : '<p style="color: #666;">No documents found.</p>'}
          </div>
        </div>
        
        <div class="chart-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
          <h2 style="margin-top: 0;">Prescriptions</h2>
          <div class="prescriptions-list" style="display: grid; gap: 1rem;">
            ${data.prescriptions && data.prescriptions.length > 0 ? data.prescriptions.map(rx => `
              <div class="prescription-item" style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem;">${rx.name || 'Prescription'}</h3>
                <p style="margin: 0.25rem 0; color: #666;">
                  <strong>Date:</strong> ${rx.date ? new Date(rx.date).toLocaleDateString() : 'N/A'}
                </p>
                <p style="margin: 0.25rem 0; color: #666;">
                  <strong>Status:</strong> ${rx.status || 'Unknown'}
                </p>
                ${rx.pharmacy ? `
                  <p style="margin: 0.25rem 0; color: #666;">
                    <strong>Pharmacy:</strong> ${rx.pharmacy}
                  </p>
                ` : ''}
              </div>
            `).join('') : '<p style="color: #666;">No prescriptions found.</p>'}
          </div>
        </div>

        ${data.appointments && data.appointments.length > 0 ? `
          <div class="chart-section" style="background: #fff; border: 1px solid #e2e2e2; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="margin-top: 0;">Appointments</h2>
            <div class="appointments-list" style="display: grid; gap: 1rem;">
              ${data.appointments.map(apt => `
                <div class="appointment-item" style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">
                  <h3 style="margin-top: 0; margin-bottom: 0.5rem;">${apt.appointmentName || 'Appointment'}</h3>
                  <p style="margin: 0.25rem 0; color: #666;">
                    <strong>Date:</strong> ${apt.startTime ? new Date(apt.startTime).toLocaleString() : 'N/A'}
                  </p>
                  <p style="margin: 0.25rem 0; color: #666;">
                    <strong>Status:</strong> ${apt.status || 'Unknown'}
                  </p>
                  ${apt.meetingLink ? `
                    <p style="margin: 0.5rem 0 0 0;">
                      <a href="${apt.meetingLink}" target="_blank" style="color: #3f72e5; text-decoration: none;">
                        Join Meeting →
                      </a>
                    </p>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    container.innerHTML = html;
  }

  function showError(message) {
    const container = document.getElementById('my-chart-container');
    if (container) {
      container.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 3rem; color: #d32f2f;">
          <h2>Error</h2>
          <p>${message}</p>
          <a href="/account/login" style="color: #3f72e5; text-decoration: none; margin-top: 1rem; display: inline-block;">
            Please log in to view your chart
          </a>
        </div>
      `;
    }
  }

  function getStorefrontToken() {
    return window.storefrontToken || '';
  }

  // Load chart on page load
  document.addEventListener('DOMContentLoaded', loadPatientChart);
})();

