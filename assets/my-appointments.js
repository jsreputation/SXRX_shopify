// My Appointments - Patient Appointment Management
// Displays patient's appointments from Tebra EHR and allows scheduling

(function() {
  'use strict';

  const MY_APPOINTMENTS_VERSION = '2026-01-20-1';
  const BACKEND_API = 'https://intermomentary-hendrix-phreatic.ngrok-free.dev';
  let currentCustomerId = null;
  let appointmentsData = null;
  let lastPatientInfo = null;
  let countdownIntervals = [];
  const APPT_SORT_KEY = 'sxrx_appt_sort_key';
  const APPT_SORT_DIR = 'sxrx_appt_sort_dir';
  let appointmentsUiState = {
    // Table-only UI
    sortKey: 'start', // start | name | status | type
    sortDir: 'desc', // asc | desc
    searchTerm: '',
    sectionFilter: 'all'
  };

  console.log(`[SXRX] my-appointments loaded (${MY_APPOINTMENTS_VERSION})`, { BACKEND_API });

  function safeGetStorage(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSetStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Restore persisted UI state (best effort)
  try {
    const k = safeGetStorage(APPT_SORT_KEY);
    const d = safeGetStorage(APPT_SORT_DIR);
    if (k) appointmentsUiState.sortKey = k;
    if (d === 'asc' || d === 'desc') appointmentsUiState.sortDir = d;
  } catch (e) {}

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
    // This header is handled by ngrok itself and prevents the HTML warning interstitial.
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
    if (value instanceof Date) {
      return { date: isNaN(value.getTime()) ? null : value, hasDate: true, hasTime: true, raw: value.toISOString?.() || String(value) };
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return { date: isNaN(d.getTime()) ? null : d, hasDate: true, hasTime: true, raw: String(value) };
    }

    const raw = String(value).trim();
    if (!raw) return { date: null, hasDate: false, hasTime: false, raw: '' };

    // Time-only values like "12:24:41" (observed from backend) have no date info.
    const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      return { date: null, hasDate: false, hasTime: true, raw };
    }

    // Try to normalize "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
    const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      const hasTime = raw.includes(':');
      const hasDate = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw);
      return { date: null, hasDate, hasTime, raw };
    }
    return { date: d, hasDate: true, hasTime: raw.includes(':'), raw };
  }

  function getAppointmentStartMeta(apt) {
    return parseAppointmentDateTime(apt.startTime || apt.StartTime || apt.StartDate || apt.start_date || apt.start || null);
  }

  function getAppointmentEndMeta(apt) {
    return parseAppointmentDateTime(apt.endTime || apt.EndTime || apt.EndDate || apt.end_date || apt.end || null);
  }

  function getAppointmentCoreFields(apt) {
    const appointmentName = apt.appointmentName || apt.AppointmentName || 'Appointment';
    const appointmentType = apt.appointmentType || apt.AppointmentType || 'Consultation';
    const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || 'Scheduled').toLowerCase();
    const startMeta = getAppointmentStartMeta(apt);
    const endMeta = getAppointmentEndMeta(apt);
    const startTime = startMeta.date;
    const endTime = endMeta.date;
    const meetingLink =
      apt.meetingLink ||
      apt.MeetingLink ||
      apt.telemedicineLink ||
      (apt.notes && apt.notes.match(/https?:\/\/[^\s]+(?:meet\.google\.com|zoom\.us)[^\s]*/i)?.[0]) ||
      null;
    const appointmentId = apt.id || apt.ID || apt.AppointmentID || apt.AppointmentId;
    return { appointmentId, appointmentName, appointmentType, status, startMeta, endMeta, startTime, endTime, meetingLink };
  }

  function compareNullable(a, b, direction = 'asc') {
    const dir = direction === 'desc' ? -1 : 1;
    const aNull = a === null || a === undefined || a === '';
    const bNull = b === null || b === undefined || b === '';
    if (aNull && bNull) return 0;
    if (aNull) return 1; // nulls always last
    if (bNull) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }) * dir;
  }

  function sortAppointmentsList(list) {
    const key = appointmentsUiState.sortKey || 'start';
    const dir = appointmentsUiState.sortDir || 'desc';
    const arr = Array.isArray(list) ? [...list] : [];

    return arr.sort((a, b) => {
      const fa = getAppointmentCoreFields(a);
      const fb = getAppointmentCoreFields(b);

      if (key === 'start') {
        const ta = fa.startTime ? fa.startTime.getTime() : null;
        const tb = fb.startTime ? fb.startTime.getTime() : null;
        return compareNullable(ta, tb, dir);
      }

      if (key === 'name') return compareNullable(fa.appointmentName, fb.appointmentName, dir);
      if (key === 'status') return compareNullable(fa.status, fb.status, dir);
      if (key === 'type') return compareNullable(fa.appointmentType, fb.appointmentType, dir);

      return 0;
    });
  }

  function setAppointmentsSort(sortKey, sortDir) {
    syncAppointmentsUiFromDom();
    if (sortKey) appointmentsUiState.sortKey = sortKey;
    if (sortDir) appointmentsUiState.sortDir = sortDir;
    safeSetStorage(APPT_SORT_KEY, appointmentsUiState.sortKey);
    safeSetStorage(APPT_SORT_DIR, appointmentsUiState.sortDir);
    if (appointmentsData) renderAppointments(appointmentsData, lastPatientInfo);
  }

  function syncAppointmentsUiFromDom() {
    try {
      const search = document.getElementById('appointments-search');
      const filter = document.getElementById('appointments-filter');
      if (search) appointmentsUiState.searchTerm = String(search.value || '');
      if (filter) appointmentsUiState.sectionFilter = String(filter.value || 'all');
    } catch (e) {}
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
      
      .appointments-header-content h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #1a1c1d;
        margin: 0 0 0.5rem 0;
        letter-spacing: -0.02em;
      }
      
      .appointments-header-content p {
        color: #666;
        margin: 0;
        font-size: 1rem;
      }
      
      .appointments-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      
      .btn {
        padding: 0.875rem 1.75rem;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        font-size: 1rem;
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
      
      .btn-danger {
        background: #dc2626;
        color: white;
      }
      
      .btn-danger:hover {
        background: #b91c1c;
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

      .controls-right {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      /* Table-only: no view toggle */

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

      .table-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .table-link {
        color: #3f72e5;
        font-weight: 700;
        text-decoration: none;
      }

      .table-link:hover {
        text-decoration: underline;
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
      
      .appointment-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      
      .btn-sm {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
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
      
      .countdown-timer {
        display: inline-block;
        padding: 0.5rem 1rem;
        background: #fff3e0;
        color: #e65100;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.875rem;
        margin-top: 0.5rem;
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
      
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
      }
      
      .modal.show {
        display: flex;
      }
      
      .modal-content {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }
      
      .modal-header h3 {
        margin: 0;
        font-size: 1.5rem;
      }
      
      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      }
      
      .modal-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
        justify-content: flex-end;
      }
      
      @media (max-width: 768px) {
        .appointments-wrapper {
          padding: 1rem;
        }
        
        .appointments-header {
          flex-direction: column;
          align-items: stretch;
        }
        
        .appointments-actions {
          width: 100%;
        }
        
        .btn {
          flex: 1;
          justify-content: center;
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
  
  async function loadAppointments() {
    try {
      addStyles();
      showLoading();
      
      // Get customer ID from Shopify
      const customerId = resolveCustomerId();
      if (!customerId) {
        showError('We could not detect your customer session. Please refresh the page. If the issue persists, log out and log back in.');
        return;
      }

      currentCustomerId = customerId;
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

  async function loadAppointmentsForCustomer(customerId, showRetry = false) {
    try {
      // Clear existing countdown intervals
      countdownIntervals.forEach(interval => clearInterval(interval));
      countdownIntervals = [];
      
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
      
      console.log(`🔍 [MY-APPOINTMENTS] Loading appointments for customer ${customerId}`, {
        hasStorefrontToken: !!storefrontToken,
        hasShopifyToken: !!shopifyCustomerToken,
        isNgrokBackend: isNgrokBackend(),
        headerKeys: Array.from(headers.keys ? headers.keys() : [])
      });
      
      // First, get patient chart to get Tebra patient ID
      const chartResponse = await fetch(withNgrokSkip(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`), {
        headers
      });

      if (!chartResponse.ok) {
        const errorData = await readErrorPayload(chartResponse);
        console.error(`❌ [MY-APPOINTMENTS] Chart API error:`, chartResponse.status, errorData);
        
        if (chartResponse.status === 401 || chartResponse.status === 403) {
          showError('Authentication failed. Please log in and try again.', showRetry);
          return;
        }
        if (chartResponse.status === 404) {
          showError('No patient record found. Please complete a questionnaire or book an appointment first.', showRetry);
          return;
        }
        throw new Error(errorData.message || 'Failed to load patient data');
      }

      const chartData = await readJsonOrThrow(chartResponse);
      const appointments = chartData.appointments || [];

      // Also try to fetch appointments directly from appointments endpoint if available
      let additionalAppointments = [];
      try {
        const appointmentsResponse = await fetch(withNgrokSkip(`${BACKEND_API}/api/shopify/customers/${customerId}/appointments`), {
          headers
        });

        if (appointmentsResponse.ok) {
          const appointmentsData = await readJsonOrThrow(appointmentsResponse);
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
      appointmentsData = allAppointments;
      
      renderAppointments(allAppointments, chartData.patient);
    } catch (error) {
      console.error('Error loading appointments:', error);
      showError('Error loading your appointments. Please try again later.', showRetry);
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
      const timeA = getAppointmentStartMeta(a).date?.getTime() || 0;
      const timeB = getAppointmentStartMeta(b).date?.getTime() || 0;
      if (timeA !== timeB) return timeB - timeA; // Descending order

      const idA = String(a.id || a.ID || a.AppointmentID || a.AppointmentId || '');
      const idB = String(b.id || b.ID || b.AppointmentID || b.AppointmentId || '');
      return idB.localeCompare(idA);
    });
  }

  function renderAppointments(appointments, patientInfo) {
    const container = document.getElementById('my-appointments-container');
    if (!container) return;

    lastPatientInfo = patientInfo || null;

    // Separate appointments into upcoming/past (no "Date Pending" view)
    let upcoming = [];
    let past = [];
    const now = Date.now();

    appointments.forEach(apt => {
      const status = (apt.status || apt.appointmentStatus || apt.AppointmentStatus || '').toLowerCase();
      const startMeta = getAppointmentStartMeta(apt);
      const startMs = startMeta.date ? startMeta.date.getTime() : null;

      if (status.includes('cancelled') || status.includes('completed')) {
        past.push(apt);
        return;
      }

      if (!startMs) {
        // If the clinic didn't provide a full datetime, treat non-cancelled/non-completed as upcoming.
        upcoming.push(apt);
        return;
      }

      if (startMs > now) upcoming.push(apt);
      else past.push(apt);
    });

    upcoming = sortAppointmentsList(upcoming);
    past = sortAppointmentsList(past);

    const sortValue = `${appointmentsUiState.sortKey}:${appointmentsUiState.sortDir}`;

    const renderSection = (sectionKey, title, items, isUpcomingSection) => {
      if (!items || items.length === 0) return '';

      return `
        <div class="appointments-section" data-section="${sectionKey}">
          <h2 style="color: ${sectionKey === 'upcoming' ? '#3f72e5' : '#666'};">${title} (${items.length})</h2>
          <div class="sxrx-table-wrap">
            <table class="sxrx-table">
              <thead>
                <tr>
                  <th class="sortable" data-sort-key="name">Appointment</th>
                  <th class="sortable" data-sort-key="start">Date</th>
                  <th>Time</th>
                  <th class="sortable" data-sort-key="status">Status</th>
                  <th>Telemedicine</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(apt => renderAppointmentRow(apt, !!isUpcomingSection)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

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
          <div class="appointments-header-content">
            <h1>My Appointments</h1>
            <p>Manage and view all your scheduled appointments</p>
          </div>
          <div class="appointments-actions">
            <button class="btn btn-secondary" onclick="window.refreshAppointments()" id="refresh-btn">
              🔄 Refresh
            </button>
            <button class="btn btn-secondary" onclick="window.printAppointments()">
              🖨️ Print
            </button>
            <button class="btn btn-secondary" onclick="window.exportAppointments()">
              📥 Export
            </button>
            <button id="schedule-new-appointment-btn" class="btn btn-primary">
              + Schedule New Appointment
            </button>
          </div>
        </div>

        <div class="search-filter-bar">
          <input type="text" class="search-input" id="appointments-search" placeholder="Search appointments..." oninput="window.filterAppointments()">
          <div class="controls-right">
            <select class="filter-select" id="appointments-sort" aria-label="Sort appointments">
              <option value="start:desc">Sort: Date (newest)</option>
              <option value="start:asc">Sort: Date (oldest)</option>
              <option value="name:asc">Sort: Name (A–Z)</option>
              <option value="name:desc">Sort: Name (Z–A)</option>
              <option value="status:asc">Sort: Status (A–Z)</option>
              <option value="status:desc">Sort: Status (Z–A)</option>
              <option value="type:asc">Sort: Type (A–Z)</option>
              <option value="type:desc">Sort: Type (Z–A)</option>
            </select>
          <select class="filter-select" id="appointments-filter" onchange="window.filterAppointments()">
            <option value="all">All Appointments</option>
            <option value="upcoming">Upcoming Only</option>
            <option value="past">Past Only</option>
          </select>
          </div>
        </div>

        ${renderSection('upcoming', 'Upcoming Appointments', upcoming, true)}

        ${renderSection('past', 'Past Appointments', past, false)}

        ${appointments.length === 0 ? `
          <div class="no-appointments">
            <div class="no-appointments-icon">📅</div>
            <h3>No Appointments Found</h3>
            <p>You don't have any appointments scheduled yet.</p>
            <button id="schedule-first-appointment-btn" class="btn btn-primary">
              + Schedule Your First Appointment
            </button>
          </div>
        ` : ''}
      </div>
      
      <!-- Cancel Confirmation Modal -->
      <div id="cancel-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Cancel Appointment</h3>
            <button class="close-btn" onclick="window.closeCancelModal()">&times;</button>
          </div>
          <p>Are you sure you want to cancel this appointment? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="window.closeCancelModal()">Keep Appointment</button>
            <button class="btn btn-danger" id="confirm-cancel-btn">Yes, Cancel Appointment</button>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;

    // Init controls
    const searchInput = document.getElementById('appointments-search');
    if (searchInput) searchInput.value = appointmentsUiState.searchTerm || '';
    const sectionFilter = document.getElementById('appointments-filter');
    if (sectionFilter) sectionFilter.value = appointmentsUiState.sectionFilter || 'all';

    const sortSelect = document.getElementById('appointments-sort');
    if (sortSelect) {
      sortSelect.value = sortValue;
      sortSelect.addEventListener('change', (e) => {
        const v = String(e.target.value || 'start:desc');
        const [k, d] = v.split(':');
        setAppointmentsSort(k, d);
      });
    }

    const sortableHeaders = container.querySelectorAll('th.sortable[data-sort-key]');
    sortableHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-key') || 'start';
        const nextDir = appointmentsUiState.sortKey === key && appointmentsUiState.sortDir === 'asc' ? 'desc' : 'asc';
        setAppointmentsSort(key, nextDir);
      });
    });

    // Apply current filter/search after rerender
    try { filterAppointments(); } catch (e) {}

    // Add event listeners for schedule buttons
    const scheduleBtn = document.getElementById('schedule-new-appointment-btn');
    const scheduleFirstBtn = document.getElementById('schedule-first-appointment-btn');
    
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', handleScheduleClick);
    }
    if (scheduleFirstBtn) {
      scheduleFirstBtn.addEventListener('click', handleScheduleClick);
    }
    
    // Initialize countdown timers for upcoming appointments
    upcoming.forEach(apt => {
      const startTime = getAppointmentStartMeta(apt).date;
      if (startTime && startTime.getTime() > Date.now()) {
        initCountdown(apt.id || apt.ID, startTime);
      }
    });
  }

  function renderAppointmentRow(apt, isUpcoming) {
    const { appointmentId, appointmentName, appointmentType, status, startMeta, endMeta, startTime, endTime, meetingLink } = getAppointmentCoreFields(apt);

    let statusClass = 'status-scheduled';
    if (status.includes('cancelled')) statusClass = 'status-cancelled';
    else if (status.includes('completed')) statusClass = 'status-completed';

    const canCancel = !status.includes('cancelled') && !status.includes('completed') && (!startTime || startTime.getTime() > Date.now());
    const canCalendar = !!startTime;

    const dateLabel = startTime
      ? startTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
      : 'Not provided';

    const timeLabel = startTime
      ? `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${(endTime || new Date(startTime.getTime() + 30 * 60000)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : `${startMeta.raw || 'N/A'}${endMeta.raw ? ` - ${endMeta.raw}` : ''}`;

    const searchable = `${appointmentName} ${appointmentType} ${status}`.toLowerCase();

    return `
      <tr class="${isUpcoming ? 'row-upcoming' : ''}" data-appointment-id="${appointmentId}" data-searchable="${searchable}">
        <td>
          <p class="table-title">${appointmentName}</p>
          <p class="table-subtitle">${appointmentType}</p>
        </td>
        <td><span class="${startTime ? '' : 'table-muted'}">${dateLabel}</span></td>
        <td><span class="${startTime ? '' : 'table-muted'}">${timeLabel}</span></td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>${meetingLink ? `<a href="${meetingLink}" target="_blank" class="table-link">Join</a>` : `<span class="table-muted">—</span>`}</td>
        <td>
          <div class="table-actions">
            ${canCalendar ? `<button class="btn btn-sm btn-secondary" onclick="window.addToCalendar('${appointmentId}')">📅 Calendar</button>` : ''}
            ${canCancel ? `<button class="btn btn-sm btn-danger" onclick="window.showCancelModal('${appointmentId}')">Cancel</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  function renderAppointmentCard(apt, isUpcoming) {
    const { appointmentId, appointmentName, appointmentType, status, startMeta, endMeta, startTime, endTime, meetingLink } = getAppointmentCoreFields(apt);
    
    let statusClass = 'status-scheduled';
    if (status.includes('cancelled')) {
      statusClass = 'status-cancelled';
    } else if (status.includes('completed')) {
      statusClass = 'status-completed';
    }
    
    const canCancel = !status.includes('cancelled') && !status.includes('completed') && (!startTime || startTime.getTime() > Date.now());
    const canCalendar = !!startTime;
    
    return `
      <div class="appointment-card ${isUpcoming ? 'upcoming' : ''}" data-appointment-id="${appointmentId}" data-searchable="${appointmentName.toLowerCase()} ${appointmentType.toLowerCase()}">
        <div class="appointment-header">
          <div class="appointment-title">
            <h3>${appointmentName}</h3>
            <p class="appointment-type">${appointmentType}</p>
            ${isUpcoming ? `<div class="countdown-timer" id="countdown-${appointmentId}"></div>` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
            <span class="status-badge ${statusClass}">${status}</span>
            ${canCancel ? `
              <div class="appointment-actions">
                ${canCalendar ? `<button class="btn btn-sm btn-secondary" onclick="window.addToCalendar('${appointmentId}')">📅 Add to Calendar</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="window.showCancelModal('${appointmentId}')">Cancel</button>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="appointment-details">
          <div class="detail-item">
            <span class="detail-label">Date</span>
            <span class="detail-value date">${startTime ? startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Time</span>
            <span class="detail-value">${
              startTime
                ? `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${(endTime || new Date(startTime.getTime() + 30 * 60000)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                : `${startMeta.raw || 'N/A'}${endMeta.raw ? ` - ${endMeta.raw}` : ''}`
            }</span>
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

  function initCountdown(appointmentId, startTime) {
    const updateCountdown = () => {
      const now = new Date();
      const diff = startTime - now;
      
      if (diff <= 0) {
        const element = document.getElementById(`countdown-${appointmentId}`);
        if (element) {
          element.textContent = 'Appointment time has arrived';
        }
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      const element = document.getElementById(`countdown-${appointmentId}`);
      if (element) {
        if (days > 0) {
          element.textContent = `⏰ ${days}d ${hours}h ${minutes}m until appointment`;
        } else if (hours > 0) {
          element.textContent = `⏰ ${hours}h ${minutes}m until appointment`;
        } else {
          element.textContent = `⏰ ${minutes}m until appointment`;
        }
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    countdownIntervals.push(interval);
  }

  function filterAppointments() {
    const searchTerm = (document.getElementById('appointments-search')?.value || '').toLowerCase();
    const filterType = document.getElementById('appointments-filter')?.value || 'all';

    // Persist UI state so rerenders keep user choices
    appointmentsUiState.searchTerm = document.getElementById('appointments-search')?.value || '';
    appointmentsUiState.sectionFilter = filterType;
    
    const sections = document.querySelectorAll('.appointments-section[data-section]');
    sections.forEach(section => {
      const sectionType = section.getAttribute('data-section');
      if (filterType !== 'all' && sectionType !== filterType) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      
      const cards = section.querySelectorAll('[data-searchable]');
      cards.forEach(card => {
        const searchable = card.getAttribute('data-searchable') || '';
        const matchesSearch = !searchTerm || searchable.includes(searchTerm);
        card.style.display = matchesSearch ? '' : 'none';
      });
    });
  }

  window.showCancelModal = function(appointmentId) {
    const modal = document.getElementById('cancel-modal');
    if (modal) {
      modal.classList.add('show');
      const confirmBtn = document.getElementById('confirm-cancel-btn');
      if (confirmBtn) {
        confirmBtn.onclick = () => cancelAppointment(appointmentId);
      }
    }
  };

  window.closeCancelModal = function() {
    const modal = document.getElementById('cancel-modal');
    if (modal) {
      modal.classList.remove('show');
    }
  };

  async function cancelAppointment(appointmentId) {
    if (!currentCustomerId) {
      alert('Unable to cancel appointment. Please refresh the page.');
      return;
    }
    
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      const storefrontToken = getStorefrontToken();
      const shopifyCustomerToken = window.Shopify?.customerAccessToken || 
                                  sessionStorage.getItem('shopify_customer_access_token') ||
                                  localStorage.getItem('shopify_customer_access_token');
      
      if (storefrontToken) {
        headers['Authorization'] = `Bearer ${storefrontToken}`;
      } else if (shopifyCustomerToken) {
        headers['shopify_access_token'] = shopifyCustomerToken;
      }
      
      const response = await fetch(`${BACKEND_API}/api/shopify/customers/${currentCustomerId}/appointments/${appointmentId}/cancel`, {
        method: 'PUT',
        headers: headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to cancel appointment');
      }
      
      window.closeCancelModal();
      alert('Appointment cancelled successfully.');
      await loadAppointmentsForCustomer(currentCustomerId);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert(`Failed to cancel appointment: ${error.message || 'Please try again later.'}`);
    }
  }

  window.addToCalendar = function(appointmentId) {
    if (!appointmentsData) return;
    
    const appointment = appointmentsData.find(apt => (apt.id || apt.ID || apt.AppointmentID || apt.AppointmentId) === appointmentId);
    if (!appointment) return;
    
    const startTime = getAppointmentStartMeta(appointment).date;
    if (!startTime) {
      alert('This appointment does not include a full date/time, so it cannot be added to your calendar yet.');
      return;
    }
    const endTime = getAppointmentEndMeta(appointment).date || new Date(startTime.getTime() + 30 * 60000);
    const appointmentName = appointment.appointmentName || appointment.AppointmentName || 'Appointment';
    
    // Create iCal format
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SXRX//Appointment//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startTime)}`,
      `DTEND:${formatDate(endTime)}`,
      `SUMMARY:${appointmentName}`,
      `DESCRIPTION:${appointment.notes || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icalContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointment-${appointmentId}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.refreshAppointments = async function() {
    if (!currentCustomerId) return;
    const btn = document.getElementById('refresh-btn');
    if (btn) {
      btn.classList.add('refreshing');
      btn.disabled = true;
    }
    await loadAppointmentsForCustomer(currentCustomerId);
    if (btn) {
      btn.classList.remove('refreshing');
      btn.disabled = false;
    }
  };

  window.filterAppointments = filterAppointments;
  window.setAppointmentsSort = setAppointmentsSort;

  window.printAppointments = function() {
    window.print();
  };

  window.exportAppointments = function() {
    if (!appointmentsData || appointmentsData.length === 0) {
      alert('No appointments to export');
      return;
    }
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      appointments: appointmentsData.map(apt => ({
        id: apt.id || apt.ID,
        appointmentName: apt.appointmentName || apt.AppointmentName,
        appointmentType: apt.appointmentType || apt.AppointmentType,
        startTime: apt.startTime || apt.StartTime,
        endTime: apt.endTime || apt.EndTime,
        status: apt.status || apt.appointmentStatus || apt.AppointmentStatus,
        notes: apt.notes || apt.Notes,
        meetingLink: apt.meetingLink || apt.MeetingLink
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function handleScheduleClick(event) {
    event.preventDefault();
    
    // Get patient context if available
    const customerId = resolveCustomerId();
    
    // Use schedule-integration.js if available, or redirect to Cowlendar
    if (window.openCowlendarBooking) {
      window.openCowlendarBooking({ customerId });
    } else {
      // Fallback: redirect to appointment booking product page
      window.location.href = '/products/appointment-booking' + (customerId ? `?customer=${customerId}` : '');
    }
  }

  function showError(message, showRetry = false) {
    const container = document.getElementById('my-appointments-container');
    if (container) {
      addStyles();
      const isLoggedIn = !!(window.SXRX?.isLoggedIn || document.body.classList.contains('customer-logged-in'));
      container.innerHTML = `
        <div class="error-message">
          <h2>⚠️ Unable to Load Appointments</h2>
          <p>${message}</p>
          ${showRetry && currentCustomerId ? `
            <button class="btn btn-primary" onclick="window.refreshAppointments()">🔄 Retry</button>
          ` : ''}
          ${isLoggedIn ? `<a href="/pages/my-appointments" class="btn btn-primary">Refresh page</a>` : `<a href="/account/login" class="btn btn-primary" data-no-instant>Log in</a>`}
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
