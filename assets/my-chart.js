// My Chart - Patient Medical Records
// Displays patient's medical records from Tebra EHR and questionnaire data

(function() {
  'use strict';

  const BACKEND_API = 'https://intermomentary-hendrix-phreatic.ngrok-free.dev';
  
  // Add professional styles
  function addStyles() {
    if (document.getElementById('my-chart-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'my-chart-styles';
    style.textContent = `
      .chart-wrapper {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #1a1c1d;
        line-height: 1.6;
      }
      
      .chart-header {
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e8e8e8;
      }
      
      .chart-header h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #1a1c1d;
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.02em;
      }
      
      .chart-header p {
        color: #666;
        margin: 0;
        font-size: 1rem;
      }
      
      .section-card {
        background: #ffffff;
        border: 1px solid #e8e8e8;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        transition: box-shadow 0.2s ease;
      }
      
      .section-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      
      .section-card h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1a1c1d;
        margin: 0 0 1.5rem 0;
        padding-bottom: 1rem;
        border-bottom: 2px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .section-card h2::before {
        content: '';
        width: 4px;
        height: 24px;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        border-radius: 2px;
      }
      
      .patient-info-card {
        background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
        border: 1px solid #e0e7ff;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
      }
      
      .patient-info-card h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #1a1c1d;
        margin: 0 0 1.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      
      .patient-info-card h2::before {
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
      
      .document-grid, .prescription-grid, .appointment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1.5rem;
      }
      
      .document-card, .prescription-card, .appointment-card {
        background: #fafafa;
        border: 1px solid #e8e8e8;
        border-radius: 10px;
        padding: 1.5rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .document-card::before, .prescription-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
      }
      
      .document-card:hover, .prescription-card:hover, .appointment-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: #d0d0d0;
      }
      
      .document-card h3, .prescription-card h3, .appointment-card h3 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #1a1c1d;
        margin: 0 0 1rem 0;
      }
      
      .document-meta, .prescription-meta {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1rem;
      }
      
      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #666;
      }
      
      .meta-item strong {
        font-weight: 600;
        color: #444;
        min-width: 80px;
      }
      
      .status-badge {
        display: inline-block;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .status-active {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      .status-pending {
        background: #fff3e0;
        color: #e65100;
      }
      
      .status-completed {
        background: #e3f2fd;
        color: #1565c0;
      }
      
      .questionnaire-card {
        background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%);
        border: 1px solid #ffe082;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
      }
      
      .questionnaire-card h2::before {
        content: '📋';
        font-size: 1.5rem;
      }
      
      .evaluation-badge {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        margin-top: 0.5rem;
      }
      
      .evaluation-approved {
        background: #e8f5e9;
        color: #2e7d32;
      }
      
      .evaluation-consultation {
        background: #fff3e0;
        color: #e65100;
      }
      
      .empty-state {
        text-align: center;
        padding: 3rem 2rem;
        color: #999;
      }
      
      .empty-state-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      
      .empty-state h3 {
        font-size: 1.25rem;
        color: #666;
        margin: 0 0 0.5rem 0;
      }
      
      .empty-state p {
        color: #999;
        margin: 0;
      }
      
      .meeting-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        color: white;
        text-decoration: none;
        border-radius: 8px;
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
        padding: 0.75rem 1.5rem;
        background: #3f72e5;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
      }
      
      .error-message a:hover {
        background: #2d5cd4;
        transform: translateY(-2px);
      }
      
      @media (max-width: 768px) {
        .chart-wrapper {
          padding: 1rem;
        }
        
        .section-card {
          padding: 1.5rem;
        }
        
        .document-grid, .prescription-grid, .appointment-grid {
          grid-template-columns: 1fr;
        }
        
        .patient-details {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  async function loadPatientChart() {
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

  function showLoading() {
    const container = document.getElementById('my-chart-container');
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading your medical chart...</p>
        </div>
      `;
    }
  }

  async function loadChartForCustomer(customerId) {
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
      
      console.log(`🔍 [MY-CHART] Loading chart for customer ${customerId}`, {
        hasStorefrontToken: !!storefrontToken,
        hasShopifyToken: !!shopifyCustomerToken,
        headers: Object.keys(headers)
      });
      
      const response = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`, {
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [MY-CHART] API error:`, response.status, errorData);
        
        if (response.status === 401 || response.status === 403) {
          showError('Authentication failed. Please log in and try again.');
          return;
        }
        if (response.status === 404) {
          showError('No chart found. Please complete a questionnaire or book an appointment first.');
          return;
        }
        throw new Error(errorData.message || `Failed to load chart data (${response.status})`);
      }

      const data = await response.json();
      console.log(`✅ [MY-CHART] Chart data loaded:`, {
        hasPatient: !!data.patient,
        documentsCount: data.totalDocuments || 0,
        prescriptionsCount: data.totalPrescriptions || 0,
        appointmentsCount: data.totalAppointments || 0
      });
      renderChart(data);
    } catch (error) {
      console.error('❌ [MY-CHART] Error loading chart:', error);
      showError(`Error loading your medical chart: ${error.message || 'Please try again later.'}`);
    }
  }

  function renderChart(data) {
    const container = document.getElementById('my-chart-container');
    if (!container) return;
    
    const patientInfo = data.patient || {};
    const questionnaire = data.questionnaire || {};
    
    const html = `
      <div class="chart-wrapper">
        <div class="chart-header">
          <h1>My Medical Chart</h1>
          <p>Your complete medical records and health information</p>
        </div>
        
        ${patientInfo.firstName || patientInfo.lastName || patientInfo.email ? `
          <div class="patient-info-card">
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
              ${patientInfo.dateOfBirth ? `
                <div class="patient-detail-item">
                  <span class="patient-detail-label">Date of Birth</span>
                  <span class="patient-detail-value">${new Date(patientInfo.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
        
        ${questionnaire.submittedAt ? `
          <div class="questionnaire-card section-card">
            <h2>Questionnaire</h2>
            <div class="document-meta">
              <div class="meta-item">
                <strong>Submitted:</strong>
                <span>${new Date(questionnaire.submittedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              ${questionnaire.summary ? `
                <div style="margin-top: 1rem;">
                  <strong style="color: #444; display: block; margin-bottom: 0.5rem;">Summary:</strong>
                  <p style="color: #666; margin: 0; line-height: 1.6;">${questionnaire.summary}</p>
                </div>
              ` : ''}
              ${questionnaire.evaluation ? `
                <div style="margin-top: 1rem;">
                  <strong style="color: #444; display: block; margin-bottom: 0.5rem;">Evaluation:</strong>
                  <span class="evaluation-badge ${questionnaire.evaluation.requiresConsult ? 'evaluation-consultation' : 'evaluation-approved'}">
                    ${questionnaire.evaluation.requiresConsult ? '⚠️ Consultation Required' : '✅ Approved for Purchase'}
                  </span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <div class="section-card">
          <h2>Medical Documents</h2>
          <div class="document-grid">
            ${data.documents && data.documents.length > 0 ? data.documents.map(doc => `
              <div class="document-card">
                <h3>${doc.name || 'Document'}</h3>
                <div class="document-meta">
                  <div class="meta-item">
                    <strong>Date:</strong>
                    <span>${doc.documentDate ? new Date(doc.documentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                  </div>
                  <div class="meta-item">
                    <strong>Status:</strong>
                    <span class="status-badge ${doc.status === 'Completed' ? 'status-completed' : doc.status === 'Active' ? 'status-active' : 'status-pending'}">${doc.status || 'Unknown'}</span>
                  </div>
                  ${doc.notes ? `
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e8e8e8;">
                      <p style="color: #666; margin: 0; font-size: 0.875rem; line-height: 1.5;">${doc.notes}</p>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('') : `
              <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <h3>No Documents Found</h3>
                <p>Your medical documents will appear here once they are added to your chart.</p>
              </div>
            `}
          </div>
        </div>
        
        <div class="section-card">
          <h2>Prescriptions</h2>
          <div class="prescription-grid">
            ${data.prescriptions && data.prescriptions.length > 0 ? data.prescriptions.map(rx => `
              <div class="prescription-card">
                <h3>${rx.name || 'Prescription'}</h3>
                <div class="prescription-meta">
                  <div class="meta-item">
                    <strong>Date:</strong>
                    <span>${rx.date ? new Date(rx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                  </div>
                  <div class="meta-item">
                    <strong>Status:</strong>
                    <span class="status-badge ${rx.status === 'Active' ? 'status-active' : rx.status === 'Completed' ? 'status-completed' : 'status-pending'}">${rx.status || 'Unknown'}</span>
                  </div>
                  ${rx.pharmacy ? `
                    <div class="meta-item">
                      <strong>Pharmacy:</strong>
                      <span>${rx.pharmacy}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('') : `
              <div class="empty-state">
                <div class="empty-state-icon">💊</div>
                <h3>No Prescriptions Found</h3>
                <p>Your prescriptions will appear here once they are added to your chart.</p>
              </div>
            `}
          </div>
        </div>

        ${data.appointments && data.appointments.length > 0 ? `
          <div class="section-card">
            <h2>Recent Appointments</h2>
            <div class="appointment-grid">
              ${data.appointments.slice(0, 3).map(apt => {
                const startTime = new Date(apt.startTime || 0);
                const isUpcoming = startTime > new Date();
                return `
                  <div class="appointment-card" style="background: ${isUpcoming ? '#f0f7ff' : '#fafafa'}; border-color: ${isUpcoming ? '#3f72e5' : '#e8e8e8'};">
                    <h3>${apt.appointmentName || 'Appointment'}</h3>
                    <div class="document-meta">
                      <div class="meta-item">
                        <strong>Date:</strong>
                        <span>${startTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div class="meta-item">
                        <strong>Time:</strong>
                        <span>${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <div class="meta-item">
                        <strong>Status:</strong>
                        <span class="status-badge ${apt.status === 'Scheduled' ? 'status-active' : apt.status === 'Completed' ? 'status-completed' : 'status-pending'}">${apt.status || 'Scheduled'}</span>
                      </div>
                      ${apt.meetingLink ? `
                        <a href="${apt.meetingLink}" target="_blank" class="meeting-link">Join Meeting</a>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ${data.appointments.length > 3 ? `
              <div style="text-align: center; margin-top: 1.5rem;">
                <a href="/pages/my-appointments" style="color: #3f72e5; text-decoration: none; font-weight: 600;">
                  View All Appointments →
                </a>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
    
    container.innerHTML = html;
  }

  function showError(message) {
    const container = document.getElementById('my-chart-container');
    if (container) {
      addStyles();
      container.innerHTML = `
        <div class="error-message">
          <h2>⚠️ Unable to Load Chart</h2>
          <p>${message}</p>
          <a href="/account/login">Please log in to view your chart</a>
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
