// My Chart - Patient Medical Records
// Displays patient's medical records from Tebra EHR and questionnaire data

(function() {
  'use strict';

  const MY_CHART_VERSION = '2026-01-20-1';
  const BACKEND_API = window.BACKEND_API || 'https://api.sxrx.us';
  let currentCustomerId = null;
  let chartData = null;
  const CHART_SORT_KEY = 'sxrx_chart_sort_state';
  let chartUiState = {
    searchTerm: '',
    filter: 'all'
  };
  let chartSortState = {
    documents: { key: 'date', dir: 'desc' }, // date | name | status
    prescriptions: { key: 'date', dir: 'desc' }, // date | name | status
    appointments: { key: 'start', dir: 'desc' } // start | name | status
  };

  console.log(`[SXRX] my-chart loaded (${MY_CHART_VERSION})`, { BACKEND_API });

  // Restore persisted sort state (best-effort)
  try {
    const raw = sessionStorage.getItem(CHART_SORT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') chartSortState = { ...chartSortState, ...parsed };
    }
  } catch (e) {}

  function persistChartSort() {
    try { sessionStorage.setItem(CHART_SORT_KEY, JSON.stringify(chartSortState)); } catch (e) {}
  }

  function isNgrokBackend() {
    return /ngrok/i.test(BACKEND_API);
  }

  function withNgrokSkip(url) {
    try {
      if (!isNgrokBackend()) return url;
      const u = new URL(url);
      if (!u.searchParams.has('ngrok-skip-browser-warning')) {
        u.searchParams.set('ngrok-skip-browser-warning', '1');
      }
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function addNgrokBypassHeader(headers) {
    if (!isNgrokBackend()) return;
    if (headers && typeof headers.set === 'function') {
      headers.set('ngrok-skip-browser-warning', '1');
      return;
    }
    headers['ngrok-skip-browser-warning'] = '1';
  }

  async function readJsonOrThrow(res) {
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json') || ct.includes('+json')) {
      return await res.json();
    }
    const text = await res.text().catch(() => '');
    const preview = text ? text.slice(0, 300) : '(empty body)';
    throw new Error(`Expected JSON but received ${ct || 'unknown content-type'} (status ${res.status}). Preview: ${preview}`);
  }

  async function readErrorPayload(res) {
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json') || ct.includes('+json')) {
      return await res.json().catch(() => ({}));
    }
    const text = await res.text().catch(() => '');
    return { nonJson: true, preview: text.slice(0, 300) };
  }

  function parseAppointmentDateTime(value) {
    if (value == null) return { date: null, hasDate: false, hasTime: false, raw: '' };
    const raw = String(value).trim();
    if (!raw) return { date: null, hasDate: false, hasTime: false, raw: '' };

    // Time-only values like "12:24:41" (observed from backend) have no date info.
    const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) return { date: null, hasDate: false, hasTime: true, raw };

    const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      const hasTime = raw.includes(':');
      const hasDate = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw);
      return { date: null, hasDate, hasTime, raw };
    }
    return { date: d, hasDate: true, hasTime: raw.includes(':'), raw };
  }

  function resolveCustomerId() {
    const candidates = [
      window.Shopify?.customer?.id,
      window.SXRX?.customerId,
      window.ShopifyAnalytics?.meta?.page?.customerId,
      window.__st?.cid,
      sessionStorage.getItem('customerId'),
      new URLSearchParams(window.location.search).get('customer')
    ].filter(Boolean);

    const id = candidates.length ? String(candidates[0]) : null;
    if (id) {
      try { sessionStorage.setItem('customerId', id); } catch (e) {}
    }
    return id;
  }
  
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e8e8e8;
        flex-wrap: wrap;
        gap: 1rem;
      }
      
      .chart-header-content h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #1a1c1d;
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.02em;
      }
      
      .chart-header-content p {
        color: #666;
        margin: 0;
        font-size: 1rem;
      }
      
      .chart-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      
      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9375rem;
        cursor: pointer;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #3f72e5 0%, #5a8ef7 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(63, 114, 229, 0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(63, 114, 229, 0.4);
      }
      
      .btn-secondary {
        background: #f0f0f0;
        color: #1a1c1d;
      }
      
      .btn-secondary:hover {
        background: #e0e0e0;
      }
      
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
      }
      
      .search-filter-bar {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .search-input {
        flex: 1;
        min-width: 200px;
        padding: 0.75rem 1rem;
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        font-size: 0.9375rem;
      }
      
      .search-input:focus {
        outline: none;
        border-color: #3f72e5;
        box-shadow: 0 0 0 3px rgba(63, 114, 229, 0.1);
      }
      
      .filter-select {
        padding: 0.75rem 1rem;
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        font-size: 0.9375rem;
        background: white;
        cursor: pointer;
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

      .sxrx-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid #e8e8e8;
        border-radius: 12px;
        background: #fff;
      }

      .sxrx-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        min-width: 760px;
      }

      .sxrx-table thead th {
        position: sticky;
        top: 0;
        background: #f9fafb;
        z-index: 1;
        text-align: left;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b7280;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid #e5e7eb;
        white-space: nowrap;
      }

      .sxrx-table thead th.sortable {
        cursor: pointer;
        user-select: none;
      }

      .sxrx-table tbody td {
        padding: 0.95rem 1rem;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: top;
        font-size: 0.95rem;
        color: #111827;
      }

      .sxrx-table tbody tr:hover td {
        background: #fafafa;
      }

      .table-muted {
        color: #6b7280;
        font-size: 0.875rem;
      }

      .table-title {
        font-weight: 700;
        color: #111827;
        margin: 0;
      }

      .table-subtitle {
        margin: 0.2rem 0 0 0;
        color: #6b7280;
        font-size: 0.875rem;
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
        margin: 0 0 1rem 0;
      }
      
      .error-guidance {
        font-size: 0.9375rem;
        color: #666;
        margin: 0 0 1.5rem 0;
        font-style: italic;
      }
      
      .error-message .btn {
        margin: 0.5rem;
      }
      
      .hidden {
        display: none !important;
      }
      
      .refresh-btn {
        position: relative;
      }
      
      .refresh-btn.refreshing::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        right: 1rem;
      }
      
      @media (max-width: 768px) {
        .chart-wrapper {
          padding: 1rem;
        }
        
        .chart-header {
          flex-direction: column;
          align-items: stretch;
        }
        
        .chart-actions {
          width: 100%;
        }
        
        .btn {
          flex: 1;
          justify-content: center;
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
        
        .search-filter-bar {
          flex-direction: column;
        }
        
        .search-input {
          width: 100%;
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
      const customerId = resolveCustomerId();
      if (!customerId) {
        showError({ code: 'CUSTOMER_NOT_FOUND', message: 'We could not detect your customer session. Please refresh the page. If the issue persists, log out and log back in.' });
        return;
      }

      currentCustomerId = customerId;
      await loadChartForCustomer(customerId);
    } catch (error) {
      console.error('Error loading chart:', error);
      showError(error);
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

  async function loadChartForCustomer(customerId, showRetry = false) {
    try {
      // Build headers - try multiple auth methods
      const headers = new Headers();
      
      // Try to get Shopify customer access token from various sources
      const storefrontToken = getStorefrontToken();
      const shopifyCustomerToken = window.Shopify?.customerAccessToken || 
                                  sessionStorage.getItem('shopify_customer_access_token') ||
                                  localStorage.getItem('shopify_customer_access_token');
      
      if (storefrontToken) {
        headers.set('Authorization', `Bearer ${storefrontToken}`);
      } else if (shopifyCustomerToken) {
        headers.set('shopify_access_token', shopifyCustomerToken);
      }

      addNgrokBypassHeader(headers);
      
      console.log(`🔍 [MY-CHART] Loading chart for customer ${customerId}`, {
        hasStorefrontToken: !!storefrontToken,
        hasShopifyToken: !!shopifyCustomerToken,
        isNgrokBackend: isNgrokBackend(),
        headers: Array.from(headers.keys ? headers.keys() : [])
      });
      
      const response = await fetch(withNgrokSkip(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`), {
        headers
      });

      if (!response.ok) {
        const errorData = await readErrorPayload(response);
        console.error(`❌ [MY-CHART] API error:`, response.status, errorData);
        
        if (response.status === 401 || response.status === 403) {
          showError({ code: 'AUTHENTICATION_FAILED', message: 'Authentication failed. Please log in and try again.' }, showRetry);
          return;
        }
        if (response.status === 404) {
          showError({ code: 'PATIENT_NOT_FOUND', message: 'No chart found. Please complete a questionnaire or book an appointment first.' }, showRetry);
          return;
        }
        throw new Error(errorData.message || `Failed to load chart data (${response.status})`);
      }

      const data = await readJsonOrThrow(response);
      chartData = data;
      console.log(`✅ [MY-CHART] Chart data loaded:`, {
        hasPatient: !!data.patient,
        documentsCount: data.totalDocuments || 0,
        prescriptionsCount: data.totalPrescriptions || 0,
        appointmentsCount: data.totalAppointments || 0
      });
      renderChart(data);
    } catch (error) {
      console.error('❌ [MY-CHART] Error loading chart:', error);
      showError(error, showRetry);
    }
  }

  function renderChart(data) {
    const container = document.getElementById('my-chart-container');
    if (!container) return;
    
    const patientInfo = data.patient || {};
    const questionnaire = data.questionnaire || {};
    
    const safeDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const cmp = (a, b, dir) => {
      const mul = dir === 'desc' ? -1 : 1;
      const aNull = a === null || a === undefined || a === '';
      const bNull = b === null || b === undefined || b === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul;
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }) * mul;
    };

    const sortDocs = (docs) => {
      const s = chartSortState.documents || { key: 'date', dir: 'desc' };
      const list = Array.isArray(docs) ? [...docs] : [];
      return list.sort((x, y) => {
        if (s.key === 'name') return cmp(x.name || '', y.name || '', s.dir);
        if (s.key === 'status') return cmp(x.status || '', y.status || '', s.dir);
        const dx = safeDate(x.documentDate || x.DocumentDate || x.createdAt || x.CreatedDate);
        const dy = safeDate(y.documentDate || y.DocumentDate || y.createdAt || y.CreatedDate);
        return cmp(dx ? dx.getTime() : null, dy ? dy.getTime() : null, s.dir);
      });
    };

    const sortRx = (rxs) => {
      const s = chartSortState.prescriptions || { key: 'date', dir: 'desc' };
      const list = Array.isArray(rxs) ? [...rxs] : [];
      return list.sort((x, y) => {
        if (s.key === 'name') return cmp(x.name || '', y.name || '', s.dir);
        if (s.key === 'status') return cmp(x.status || '', y.status || '', s.dir);
        const dx = safeDate(x.date || x.Date);
        const dy = safeDate(y.date || y.Date);
        return cmp(dx ? dx.getTime() : null, dy ? dy.getTime() : null, s.dir);
      });
    };

    const sortAppts = (apts) => {
      const s = chartSortState.appointments || { key: 'start', dir: 'desc' };
      const list = Array.isArray(apts) ? [...apts] : [];
      return list.sort((x, y) => {
        const sx = parseAppointmentDateTime(x.startTime || x.StartTime || x.startDateTime || x.StartDateTime || 0);
        const sy = parseAppointmentDateTime(y.startTime || y.StartTime || y.startDateTime || y.StartDateTime || 0);
        if (s.key === 'name') return cmp(x.appointmentName || '', y.appointmentName || '', s.dir);
        if (s.key === 'status') return cmp(x.status || '', y.status || '', s.dir);
        return cmp(sx.date ? sx.date.getTime() : null, sy.date ? sy.date.getTime() : null, s.dir);
      });
    };

    const docsSorted = sortDocs(data.documents || []);
    const rxSorted = sortRx(data.prescriptions || []);
    const apptsSorted = sortAppts(data.appointments || []);

    const sortArrow = (section, key) => {
      const s = chartSortState[section];
      if (!s || s.key !== key) return '';
      return s.dir === 'asc' ? ' ▲' : ' ▼';
    };

    const html = `
      <div class="chart-wrapper">
        <div class="chart-header">
          <div class="chart-header-content">
            <h1>My Medical Chart</h1>
            <p>Your complete medical records and health information</p>
          </div>
          <div class="chart-actions">
            <button class="btn btn-secondary" onclick="window.refreshChart()" id="refresh-btn">
              🔄 Refresh
            </button>
            <button class="btn btn-secondary" onclick="window.printChart()">
              🖨️ Print
            </button>
            <button class="btn btn-secondary" onclick="window.exportChart()">
              📥 Export
            </button>
            <a href="/pages/my-appointments" class="btn btn-primary">
              📅 View Appointments
            </a>
          </div>
        </div>
        
        <div class="search-filter-bar">
          <input type="text" class="search-input" id="chart-search" placeholder="Search documents, prescriptions...">
          <select class="filter-select" id="chart-filter">
            <option value="all">All Items</option>
            <option value="documents">Documents Only</option>
            <option value="prescriptions">Prescriptions Only</option>
            <option value="appointments">Appointments Only</option>
          </select>
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
          <div class="questionnaire-card section-card" data-type="questionnaire">
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
        
        <div class="section-card" data-type="documents" id="documents-section">
          <h2>Medical Documents (${data.documents?.length || 0})</h2>
          ${docsSorted.length > 0 ? `
            <div class="sxrx-table-wrap">
              <table class="sxrx-table">
                <thead>
                  <tr>
                    <th class="sortable" data-sort-section="documents" data-sort-key="name">Name${sortArrow('documents','name')}</th>
                    <th class="sortable" data-sort-section="documents" data-sort-key="date">Date${sortArrow('documents','date')}</th>
                    <th class="sortable" data-sort-section="documents" data-sort-key="status">Status${sortArrow('documents','status')}</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${docsSorted.map(doc => {
                    const dd = safeDate(doc.documentDate || doc.DocumentDate || doc.createdAt || doc.CreatedDate);
                    const note = doc.notes || '';
                    const searchable = `${doc.name || ''} ${note}`.toLowerCase();
                    return `
                      <tr data-searchable="${searchable}">
                        <td><p class="table-title">${doc.name || 'Document'}</p></td>
                        <td><span class="${dd ? '' : 'table-muted'}">${dd ? dd.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A'}</span></td>
                        <td><span class="status-badge ${doc.status === 'Completed' ? 'status-completed' : doc.status === 'Active' ? 'status-active' : 'status-pending'}">${doc.status || 'Unknown'}</span></td>
                        <td><span class="${note ? '' : 'table-muted'}">${note ? note : '—'}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">📄</div>
              <h3>No Documents Found</h3>
              <p>Your medical documents will appear here once they are added to your chart.</p>
            </div>
          `}
        </div>
        
        <div class="section-card" data-type="prescriptions" id="prescriptions-section">
          <h2>Prescriptions (${data.prescriptions?.length || 0})</h2>
          ${rxSorted.length > 0 ? `
            <div class="sxrx-table-wrap">
              <table class="sxrx-table">
                <thead>
                  <tr>
                    <th class="sortable" data-sort-section="prescriptions" data-sort-key="name">Medication${sortArrow('prescriptions','name')}</th>
                    <th class="sortable" data-sort-section="prescriptions" data-sort-key="date">Date${sortArrow('prescriptions','date')}</th>
                    <th class="sortable" data-sort-section="prescriptions" data-sort-key="status">Status${sortArrow('prescriptions','status')}</th>
                    <th>Pharmacy</th>
                  </tr>
                </thead>
                <tbody>
                  ${rxSorted.map(rx => {
                    const dd = safeDate(rx.date || rx.Date);
                    const searchable = `${rx.name || ''} ${rx.pharmacy || ''}`.toLowerCase();
                    return `
                      <tr data-searchable="${searchable}">
                        <td><p class="table-title">${rx.name || 'Prescription'}</p></td>
                        <td><span class="${dd ? '' : 'table-muted'}">${dd ? dd.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A'}</span></td>
                        <td><span class="status-badge ${rx.status === 'Active' ? 'status-active' : rx.status === 'Completed' ? 'status-completed' : 'status-pending'}">${rx.status || 'Unknown'}</span></td>
                        <td><span class="${rx.pharmacy ? '' : 'table-muted'}">${rx.pharmacy || '—'}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">💊</div>
              <h3>No Prescriptions Found</h3>
              <p>Your prescriptions will appear here once they are added to your chart.</p>
            </div>
          `}
        </div>

        ${data.appointments && data.appointments.length > 0 ? `
          <div class="section-card" data-type="appointments" id="appointments-section">
            <h2>Recent Appointments (${data.appointments.length})</h2>
            <div class="sxrx-table-wrap">
              <table class="sxrx-table">
                <thead>
                  <tr>
                    <th class="sortable" data-sort-section="appointments" data-sort-key="name">Appointment${sortArrow('appointments','name')}</th>
                    <th class="sortable" data-sort-section="appointments" data-sort-key="start">Start${sortArrow('appointments','start')}</th>
                    <th class="sortable" data-sort-section="appointments" data-sort-key="status">Status${sortArrow('appointments','status')}</th>
                    <th>Telemedicine</th>
                  </tr>
                </thead>
                <tbody>
                  ${apptsSorted.slice(0, 10).map(apt => {
                    const startMeta = parseAppointmentDateTime(apt.startTime || apt.startDateTime || 0);
                    const startTime = startMeta.date;
                    const searchable = `${apt.appointmentName || ''} ${apt.status || ''}`.toLowerCase();
                    return `
                      <tr data-searchable="${searchable}">
                        <td><p class="table-title">${apt.appointmentName || 'Appointment'}</p></td>
                        <td><span class="${startTime ? '' : 'table-muted'}">${startTime ? startTime.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }) : (startMeta.raw || 'N/A')}</span></td>
                        <td><span class="status-badge ${apt.status === 'Scheduled' ? 'status-active' : apt.status === 'Completed' ? 'status-completed' : 'status-pending'}">${apt.status || 'Scheduled'}</span></td>
                        <td>${apt.meetingLink ? `<a href="${apt.meetingLink}" target="_blank" class="meeting-link">Join Meeting</a>` : `<span class="table-muted">—</span>`}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
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

    // Restore filter/search state and wire listeners
    const searchInput = document.getElementById('chart-search');
    if (searchInput) {
      searchInput.value = chartUiState.searchTerm || '';
      searchInput.addEventListener('input', filterChart);
    }
    const filterSelect = document.getElementById('chart-filter');
    if (filterSelect) {
      filterSelect.value = chartUiState.filter || 'all';
      filterSelect.addEventListener('change', filterChart);
    }

    // Attach sorting listeners (avoid inline onclick due to CSP)
    const sortHeaders = container.querySelectorAll('th.sortable[data-sort-section][data-sort-key]');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const section = th.getAttribute('data-sort-section');
        const key = th.getAttribute('data-sort-key');
        if (section && key && window.setChartSort) window.setChartSort(section, key);
      });
    });

    // Apply current filter/search after rerender
    try { filterChart(); } catch (e) {}
  }

  window.setChartSort = function(section, key) {
    if (!chartSortState[section]) return;
    const cur = chartSortState[section];
    const nextDir = cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc';
    chartSortState = { ...chartSortState, [section]: { key, dir: nextDir } };
    persistChartSort();
    if (chartData) renderChart(chartData);
    // Re-apply search filter after rerender
    try { filterChart(); } catch (e) {}
  };

  function filterChart() {
    const searchTermRaw = (document.getElementById('chart-search')?.value || '');
    const searchTerm = searchTermRaw.toLowerCase();
    const filterType = document.getElementById('chart-filter')?.value || 'all';

    // Persist UI state so rerenders keep user choices
    chartUiState.searchTerm = searchTermRaw;
    chartUiState.filter = filterType;
    
    // Filter sections
    const sections = document.querySelectorAll('.section-card[data-type]');
    sections.forEach(section => {
      const sectionType = section.getAttribute('data-type');
      if (filterType !== 'all' && sectionType !== filterType) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      
      // Filter items within section
      const items = section.querySelectorAll('[data-searchable]');
      items.forEach(item => {
        const searchable = item.getAttribute('data-searchable') || '';
        const matchesSearch = !searchTerm || searchable.includes(searchTerm);
        item.style.display = matchesSearch ? '' : 'none';
      });
    });
  }

  window.refreshChart = async function() {
    if (!currentCustomerId) return;
    const btn = document.getElementById('refresh-btn');
    if (btn) {
      btn.classList.add('refreshing');
      btn.disabled = true;
    }
    await loadChartForCustomer(currentCustomerId);
    if (btn) {
      btn.classList.remove('refreshing');
      btn.disabled = false;
    }
  };

  window.filterChart = filterChart;

  window.printChart = function() {
    window.print();
  };

  window.exportChart = function() {
    if (!chartData) {
      alert('No data to export');
      return;
    }
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      patient: chartData.patient,
      questionnaire: chartData.questionnaire,
      documents: chartData.documents,
      prescriptions: chartData.prescriptions,
      appointments: chartData.appointments
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical-chart-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function showError(error, showRetry = false) {
    const container = document.getElementById('my-chart-container');
    if (container) {
      addStyles();
      
      const errorMessages = window.SXRX?.ErrorMessages;
      const userMessage = errorMessages?.getUserFriendlyMessage(error) || 
                          (typeof error === 'string' ? error : error?.message || 'An error occurred');
      const actionableGuidance = errorMessages?.getActionableGuidance(error);
      const isTransient = errorMessages?.isTransientError(error) || false;
      
      const isLoggedIn = !!(window.SXRX?.isLoggedIn || document.body.classList.contains('customer-logged-in'));
      container.innerHTML = `
        <div class="error-message">
          <h2>⚠️ Unable to Load Chart</h2>
          <p>${userMessage}</p>
          ${actionableGuidance ? `<p class="error-guidance">💡 ${actionableGuidance}</p>` : ''}
          ${(showRetry || isTransient) && currentCustomerId ? `
            <button class="btn btn-primary" onclick="window.refreshChart()">🔄 Retry</button>
          ` : ''}
          ${isLoggedIn ? `<a href="/pages/my-chart" class="btn btn-primary">Refresh page</a>` : `<a href="/account/login" class="btn btn-primary" data-no-instant>Log in</a>`}
        </div>
      `;
    }
  }

  function getStorefrontToken() {
    return window.storefrontToken || '';
  }

  // Load mobile styles
  if (typeof window !== 'undefined') {
    const mobileStylesScript = document.createElement('script');
    mobileStylesScript.src = '/assets/mobile-styles.js';
    mobileStylesScript.async = true;
    document.head.appendChild(mobileStylesScript);
  }

  // Load chart on page load
  document.addEventListener('DOMContentLoaded', loadPatientChart);
})();
