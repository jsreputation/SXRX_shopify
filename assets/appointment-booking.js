// shopify_new/assets/appointment-booking.js
// Direct appointment booking UI for /pages/book-appointment (Cowlendar removed)

(function () {
  'use strict';

  const BACKEND_API = window.BACKEND_API || 'https://api.sxrx.us';
  const VERSION = '2026-01-23-7';
  console.log(`[SXRX] appointment-booking loaded (${VERSION})`, { BACKEND_API });

  function isLoggedIn() {
    return !!(window.SXRX?.isLoggedIn || window.Shopify?.customer?.id || document.body.classList.contains('customer-logged-in'));
  }

  function detectStateFromStore() {
    // Prefer store subdomain hint: sxrx-ca.myshopify.com / sxrx-ca.com
    const host = window.location.hostname.toLowerCase();
    const m = host.match(/sxrx-([a-z]{2})\./);
    if (m) return m[1].toUpperCase();
    // Fallback to CA (your primary store)
    return 'CA';
  }

  /**
   * Get logged-in customer information
   * Tries multiple sources to get customer data
   */
  function getCustomerInfo() {
    // Try window.Shopify.customer (available on customer account pages)
    if (window.Shopify?.customer) {
      return {
        email: window.Shopify.customer.email,
        firstName: window.Shopify.customer.first_name,
        lastName: window.Shopify.customer.last_name,
        phone: window.Shopify.customer.phone
      };
    }
    
    // Try window.SXRX (set by theme.liquid when customer is logged in)
    if (window.SXRX?.customerEmail) {
      return {
        email: window.SXRX.customerEmail,
        firstName: window.SXRX.customerFirstName || '',
        lastName: window.SXRX.customerLastName || '',
        phone: window.SXRX.customerPhone || null
      };
    }
    
    // Try to get from meta tags or data attributes
    const customerEmailMeta = document.querySelector('meta[name="customer-email"]');
    const customerNameMeta = document.querySelector('meta[name="customer-name"]');
    
    if (customerEmailMeta) {
      const email = customerEmailMeta.getAttribute('content');
      const nameParts = customerNameMeta?.getAttribute('content')?.split(' ') || [];
      return {
        email: email,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: null
      };
    }
    
    return null;
  }
  
  /**
   * Fetch customer info from backend if not available in frontend
   */
  async function fetchCustomerInfo() {
    const customerId = window.SXRX?.customerId || window.Shopify?.customer?.id;
    if (!customerId) return null;
    
    try {
      const storefrontToken = window.storefrontToken || 
                             window.Shopify?.customerAccessToken ||
                             sessionStorage.getItem('shopify_customer_access_token') ||
                             localStorage.getItem('shopify_customer_access_token');
      
      const headers = { 'Content-Type': 'application/json' };
      if (storefrontToken) {
        headers['Authorization'] = `Bearer ${storefrontToken}`;
        headers['shopify_access_token'] = storefrontToken;
      }
      
      const res = await fetch(`${BACKEND_API}/api/shopify/customers/${customerId}/chart`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.patient) {
          return {
            email: data.patient.email,
            firstName: data.patient.firstName || data.patient.first_name,
            lastName: data.patient.lastName || data.patient.last_name,
            phone: data.patient.mobilePhone || data.patient.phone
          };
        }
      }
    } catch (err) {
      console.warn('[APPOINTMENT-BOOKING] Failed to fetch customer info from backend:', err);
    }
    
    return null;
  }

  function createContainer() {
    const existing = document.getElementById('sxrx-appointment-booking');
    if (existing) return existing;

    const container = document.createElement('div');
    container.id = 'sxrx-appointment-booking';
    container.style.maxWidth = '720px';
    container.style.margin = '24px auto';
    container.style.padding = '16px';
    container.style.border = '1px solid rgba(0,0,0,0.08)';
    container.style.borderRadius = '12px';
    container.style.background = '#fff';

    const anchor =
      document.querySelector('[data-product-form]') ||
      document.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('main') ||
      document.body;

    anchor.parentNode.insertBefore(container, anchor.nextSibling);
    return container;
  }

  function render(container, html) {
    container.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchAvailability(state, fromDate, toDate) {
    const url = new URL(`${BACKEND_API}/api/availability/${encodeURIComponent(state)}`);
    if (fromDate) url.searchParams.set('fromDate', fromDate);
    if (toDate) url.searchParams.set('toDate', toDate);
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Failed to fetch availability (status ${res.status}). ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    // Handle different response formats: data, availability, or slots array
    return data;
  }

  /**
   * Get CSRF token from backend
   * @param {string} email - User email to ensure sessionId matches
   */
  async function getCSRFToken(email) {
    try {
      // Normalize email to lowercase for consistency
      const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
      
      // Include email as query parameter so backend can use it for sessionId
      const url = new URL(`${BACKEND_API}/api/csrf-token`);
      if (normalizedEmail) {
        url.searchParams.set('email', normalizedEmail);
      }
      
      const res = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include' // Include cookies
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[APPOINTMENT-BOOKING] CSRF token fetched successfully', { email: normalizedEmail });
        return data.token;
      } else {
        console.warn('[APPOINTMENT-BOOKING] Failed to fetch CSRF token:', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      console.warn('[APPOINTMENT-BOOKING] Failed to fetch CSRF token:', err);
    }
    return null;
  }

  /**
   * Get storefront token from various sources
   * Matches implementation from my-appointments.js and my-chart.js
   */
  function getStorefrontToken() {
    // Try window.storefrontToken first (set by registration/login)
    if (window.storefrontToken) {
      return window.storefrontToken;
    }
    
    // Try Shopify customer access token
    if (window.Shopify?.customerAccessToken) {
      return window.Shopify.customerAccessToken;
    }
    
    // Try sessionStorage
    try {
      const sessionToken = sessionStorage.getItem('storefrontToken') || 
                          sessionStorage.getItem('shopify_customer_access_token');
      if (sessionToken) return sessionToken;
    } catch (e) {
      // Ignore storage errors
    }
    
    // Try localStorage
    try {
      const localToken = localStorage.getItem('storefrontToken') || 
                        localStorage.getItem('shopify_customer_access_token');
      if (localToken) return localToken;
    } catch (e) {
      // Ignore storage errors
    }
    
    return null;
  }

  async function bookAppointment({ state, startTime, email, firstName, lastName, appointmentName, phone = null }) {
    // Use /api/tebra-appointment/book for direct booking (User Case 2: WITHOUT Questionnaire)
    // This endpoint accepts patientEmail and creates patient automatically if doesn't exist
    const customerId = window.SXRX?.customerId || window.Shopify?.customer?.id;
    const storefrontToken = getStorefrontToken();
    
    // Note: /api/appointments/book doesn't require authentication
    // But we still try to include token if available for better tracking
    if (!storefrontToken) {
      console.log('[APPOINTMENT-BOOKING] No authentication token found, but endpoint doesn\'t require it');
    }
    
    // Normalize email to lowercase for consistent CSRF sessionId matching
    // Do this ONCE at the start to ensure consistency
    const normalizedEmail = email ? String(email).toLowerCase().trim() : email;
    
    // Get CSRF token (include email so sessionId matches)
    const csrfToken = await getCSRFToken(normalizedEmail);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add CSRF token (required for POST requests)
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    // Add authentication if available (optional for /api/appointments/book)
    // But include it if we have it for better tracking
    if (storefrontToken) {
      headers['Authorization'] = `Bearer ${storefrontToken}`;
      headers['shopify_access_token'] = storefrontToken;
    }
    
    console.log('[APPOINTMENT-BOOKING] Booking appointment', {
      hasToken: !!storefrontToken,
      customerId: customerId,
      email: normalizedEmail
    });

    // Format payload for /api/appointments/book endpoint
    // This endpoint doesn't require authentication and accepts patientEmail
    // It will create/lookup patient by email automatically
    // Normalize phone: convert empty string to null
    const normalizedPhone = phone && phone.trim() ? phone.trim() : null;
    
    const payload = {
      patientEmail: normalizedEmail, // Patient will be created automatically if doesn't exist
      email: normalizedEmail, // Also include as 'email' for CSRF sessionId matching
      firstName: firstName || 'Guest',
      lastName: lastName || 'Customer',
      phone: normalizedPhone, // Include phone number if available (null if empty/missing)
      state: state, // Backend will get practiceId/providerId from providerMapping
      startTime: startTime,
      appointmentName: appointmentName || 'Direct Consultation'
    };
    
    console.log('[APPOINTMENT-BOOKING] Sending booking request with customer data', {
      email: normalizedEmail,
      firstName,
      lastName,
      phone,
      state,
      startTime
    });

    const res = await fetch(`${BACKEND_API}/api/appointments/book`, {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Include cookies (for CSRF token cookie)
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // If CSRF error, provide helpful message
      if (res.status === 403 && (data.error === 'CSRF_TOKEN_MISSING' || data.error === 'CSRF_TOKEN_INVALID' || data.message?.includes('CSRF'))) {
        throw new Error('Security token expired. Please refresh the page and try again.');
      }
      
      // If validation error, show specific field errors
      if (res.status === 400 && data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map(err => {
          const fieldName = err.field || 'unknown';
          const message = err.message || 'Invalid value';
          const value = err.value !== undefined ? ` (value: ${err.value})` : '';
          return `${fieldName}: ${message}${value}`;
        }).join('\n');
        console.error('[APPOINTMENT-BOOKING] Validation errors:', data.errors);
        throw new Error(`Validation failed:\n${errorMessages}`);
      }
      
      throw new Error(data.message || data.error || 'Failed to book appointment');
    }
    return data;
  }

  function formatSlotLabel(slot) {
    const start = new Date(slot.startTime || slot.start || slot.date);
    const end = new Date(slot.endTime || slot.end || (start.getTime() + 30 * 60000));
    const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const t1 = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const t2 = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${day} • ${t1}–${t2}`;
  }

  /**
   * Group slots by date for calendar display
   */
  function groupSlotsByDate(slots) {
    const grouped = {};
    slots.forEach(slot => {
      const start = new Date(slot.startTime || slot.start || slot.date);
      const dateKey = start.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return grouped;
  }

  /**
   * Get days in a week (for week view)
   */
  function getWeekDays(startDate) {
    const days = [];
    const start = new Date(startDate);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }

  /**
   * Get days in a month (for month view)
   */
  function getMonthDays(year, month) {
    const days = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday of week containing first day
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday of week containing last day
    
    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  /**
   * Render calendar view with day/week/month options
   */
  function renderCalendar(slots, selectedDate = new Date(), currentSelectedSlot = null, currentView = 'week') {
    const groupedSlots = groupSlotsByDate(slots);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let calendarHtml = '';
    
    // View toggle buttons
    calendarHtml += `
      <div style="display:flex;gap:8px;margin-bottom:16px;justify-content:center;">
        <button id="sxrx-view-day" class="sxrx-view-btn ${currentView === 'day' ? 'active' : ''}" data-view="day">Day</button>
        <button id="sxrx-view-week" class="sxrx-view-btn ${currentView === 'week' ? 'active' : ''}" data-view="week">Week</button>
        <button id="sxrx-view-month" class="sxrx-view-btn ${currentView === 'month' ? 'active' : ''}" data-view="month">Month</button>
      </div>
    `;

    if (currentView === 'day') {
      // Day view - show slots for selected date
      const dateKey = selectedDate.toISOString().split('T')[0];
      const daySlots = groupedSlots[dateKey] || [];
      
      calendarHtml += `
        <div class="sxrx-calendar-day">
          <div class="sxrx-calendar-header" style="text-align:center;margin-bottom:16px;">
            <button id="sxrx-prev-day" style="float:left;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">←</button>
            <h3 style="margin:0;display:inline-block;">${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
            <button id="sxrx-next-day" style="float:right;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">→</button>
          </div>
          <div class="sxrx-slots-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:12px;">
            ${daySlots.length > 0 ? daySlots.map((slot, idx) => {
              const start = new Date(slot.startTime || slot.start || slot.date);
              const end = new Date(slot.endTime || slot.end || (start.getTime() + 30 * 60000));
              const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const isSelected = currentSelectedSlot && (currentSelectedSlot.startTime || currentSelectedSlot.start) === (slot.startTime || slot.start);
              return `
                <button class="sxrx-slot-btn ${isSelected ? 'selected' : ''}" 
                        data-slot-index="${idx}" 
                        data-start-time="${escapeHtml(slot.startTime || slot.start || '')}"
                        style="padding:12px;border:2px solid ${isSelected ? '#3f72e5' : '#ddd'};border-radius:8px;background:${isSelected ? '#eff6ff' : '#fff'};cursor:pointer;text-align:center;">
                  <div style="font-weight:600;color:#1a1c1d;">${timeStr}</div>
                  <div style="font-size:0.85rem;color:#666;margin-top:4px;">30 min</div>
                </button>
              `;
            }).join('') : '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#666;">No slots available for this day</div>'}
          </div>
        </div>
      `;
    } else if (currentView === 'week') {
      // Week view - show 7 days with slots
      const weekDays = getWeekDays(selectedDate);
      calendarHtml += `
        <div class="sxrx-calendar-week">
          <div class="sxrx-calendar-header" style="text-align:center;margin-bottom:16px;">
            <button id="sxrx-prev-week" style="float:left;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">←</button>
            <h3 style="margin:0;display:inline-block;">Week of ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
            <button id="sxrx-next-week" style="float:right;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">→</button>
          </div>
          <div class="sxrx-week-grid" style="display:grid;grid-template-columns:repeat(7, 1fr);gap:12px;">
            ${weekDays.map(day => {
              const dateKey = day.toISOString().split('T')[0];
              const daySlots = groupedSlots[dateKey] || [];
              const isToday = day.toISOString().split('T')[0] === today.toISOString().split('T')[0];
              return `
                <div class="sxrx-week-day" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:${isToday ? '#f0f7ff' : '#fff'};">
                  <div style="font-weight:600;margin-bottom:8px;text-align:center;color:${isToday ? '#3f72e5' : '#1a1c1d'};">
                    ${day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style="font-size:0.9rem;margin-bottom:12px;text-align:center;color:#666;">
                    ${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    ${daySlots.slice(0, 3).map((slot, idx) => {
                      const start = new Date(slot.startTime || slot.start || slot.date);
                      const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const isSelected = currentSelectedSlot && (currentSelectedSlot.startTime || currentSelectedSlot.start) === (slot.startTime || slot.start);
                      return `
                        <button class="sxrx-slot-btn-small ${isSelected ? 'selected' : ''}" 
                                data-start-time="${escapeHtml(slot.startTime || slot.start || '')}"
                                style="padding:6px 8px;border:1px solid ${isSelected ? '#3f72e5' : '#ddd'};border-radius:6px;background:${isSelected ? '#eff6ff' : '#f9fafb'};cursor:pointer;font-size:0.85rem;text-align:center;">
                          ${timeStr}
                        </button>
                      `;
                    }).join('')}
                    ${daySlots.length > 3 ? `<div style="text-align:center;font-size:0.8rem;color:#666;margin-top:4px;">+${daySlots.length - 3} more</div>` : ''}
                    ${daySlots.length === 0 ? '<div style="text-align:center;font-size:0.8rem;color:#9ca3af;">No slots</div>' : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // Month view - show calendar grid
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      const monthDays = getMonthDays(year, month);
      const monthStart = new Date(year, month, 1);
      
      calendarHtml += `
        <div class="sxrx-calendar-month">
          <div class="sxrx-calendar-header" style="text-align:center;margin-bottom:16px;">
            <button id="sxrx-prev-month" style="float:left;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">←</button>
            <h3 style="margin:0;display:inline-block;">${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <button id="sxrx-next-month" style="float:right;padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;">→</button>
          </div>
          <div class="sxrx-month-grid" style="display:grid;grid-template-columns:repeat(7, 1fr);gap:8px;">
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Sun</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Mon</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Tue</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Wed</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Thu</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Fri</div>
            <div style="text-align:center;font-weight:600;padding:8px;color:#666;font-size:0.85rem;">Sat</div>
            ${monthDays.map(day => {
              const dateKey = day.toISOString().split('T')[0];
              const daySlots = groupedSlots[dateKey] || [];
              const isToday = dateKey === today.toISOString().split('T')[0];
              const isCurrentMonth = day.getMonth() === month;
              return `
                <div class="sxrx-month-day ${!isCurrentMonth ? 'other-month' : ''}" 
                     style="min-height:80px;border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:${isToday ? '#f0f7ff' : isCurrentMonth ? '#fff' : '#f9fafb'};">
                  <div style="font-weight:${isToday ? '700' : '600'};margin-bottom:4px;color:${isToday ? '#3f72e5' : isCurrentMonth ? '#1a1c1d' : '#9ca3af'};">
                    ${day.getDate()}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;">
                    ${daySlots.slice(0, 2).map((slot, idx) => {
                      const start = new Date(slot.startTime || slot.start || slot.date);
                      const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const isSelected = currentSelectedSlot && (currentSelectedSlot.startTime || currentSelectedSlot.start) === (slot.startTime || slot.start);
                      return `
                        <button class="sxrx-slot-btn-tiny ${isSelected ? 'selected' : ''}" 
                                data-start-time="${escapeHtml(slot.startTime || slot.start || '')}"
                                style="padding:4px 6px;border:1px solid ${isSelected ? '#3f72e5' : '#ddd'};border-radius:4px;background:${isSelected ? '#eff6ff' : '#f3f4f6'};cursor:pointer;font-size:0.75rem;text-align:center;width:100%;">
                          ${timeStr}
                        </button>
                      `;
                    }).join('')}
                    ${daySlots.length > 2 ? `<div style="font-size:0.7rem;color:#9ca3af;text-align:center;">+${daySlots.length - 2}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return calendarHtml;
  }

  /**
   * Add calendar styles
   */
  function addCalendarStyles() {
    if (document.getElementById('sxrx-calendar-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'sxrx-calendar-styles';
    style.textContent = `
      .sxrx-view-btn {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }
      .sxrx-view-btn:hover {
        background: #f5f5f5;
      }
      .sxrx-view-btn.active {
        background: #3f72e5;
        color: white;
        border-color: #3f72e5;
      }
      .sxrx-slot-btn {
        transition: all 0.2s;
      }
      .sxrx-slot-btn:hover {
        border-color: #3f72e5 !important;
        background: #f0f7ff !important;
        transform: translateY(-2px);
      }
      .sxrx-slot-btn.selected {
        border-color: #3f72e5 !important;
        background: #eff6ff !important;
        box-shadow: 0 2px 8px rgba(63, 114, 229, 0.3);
      }
      .sxrx-slot-btn-small {
        transition: all 0.2s;
      }
      .sxrx-slot-btn-small:hover {
        border-color: #3f72e5 !important;
        background: #f0f7ff !important;
      }
      .sxrx-slot-btn-tiny {
        transition: all 0.2s;
      }
      .sxrx-slot-btn-tiny:hover {
        border-color: #3f72e5 !important;
        background: #f0f7ff !important;
      }
      .sxrx-month-day.other-month {
        opacity: 0.5;
      }
      @media (max-width: 768px) {
        .sxrx-week-grid {
          grid-template-columns: 1fr !important;
        }
        .sxrx-month-grid {
          grid-template-columns: repeat(7, 1fr) !important;
          gap: 4px !important;
        }
        .sxrx-month-day {
          min-height: 60px !important;
          padding: 4px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function init() {
    // Only support /pages/book-appointment (product page option removed)
    if (!window.location.pathname.includes('/pages/book-appointment')) return;

    if (!isLoggedIn()) {
      const redirectUrl = `/account/login?redirect=${encodeURIComponent('/pages/book-appointment')}`;
      window.location.href = redirectUrl;
      return;
    }

    const container = createContainer();
    const state = detectStateFromStore();
    const fromDate = new Date().toISOString().slice(0, 10);
    const toDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // Initialize calendar state
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let selectedSlot = null;
    let allSlots = [];
    let calendarView = 'week'; // 'day', 'week', 'month'

    render(
      container,
      `<h2 style="margin:0 0 8px;">Schedule an appointment</h2>
       <p style="margin:0 0 16px;color:#555;">Select an available time slot to book your consultation.</p>
       <div id="sxrx-booking-status" style="margin-bottom:12px;color:#555;">Loading available times…</div>
       <div id="sxrx-booking-form"></div>`
    );

    try {
      const availability = await fetchAvailability(state, fromDate, toDate);
      // Handle paginated response from /api/availability/:state
      // Response format: { data: [...], pagination: {...}, ... }
      allSlots = (availability.data || availability.availability || availability.slots || []);

      if (!allSlots.length) {
        render(document.getElementById('sxrx-booking-status'), 'No slots available right now. Please try again later.');
        return;
      }

      // Get customer info from frontend or fetch from backend
      let customerInfo = getCustomerInfo();
      if (!customerInfo) {
        // Try to fetch from backend
        customerInfo = await fetchCustomerInfo();
      }
      
      if (!customerInfo || !customerInfo.email) {
        render(document.getElementById('sxrx-booking-status'), '<span style="color:#b00020;">Unable to load your account information. Please refresh the page or contact support.</span>');
        return;
      }

      // Determine appointment label based on context
      // For direct booking (this page), use "Direct Consultation"
      // If coming from questionnaire with red flags, it would be "Consultation" (handled in questionnaire-scheduling.js)
      const appointmentLabel = 'Direct Consultation';

      // Add calendar styles
      addCalendarStyles();

      // Initial selected date (today)
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const formHtml = `
        <div style="display:grid;gap:16px;">
          <div style="padding:12px;background:#f5f5f5;border-radius:8px;font-size:0.9rem;">
            <div style="font-weight:600;margin-bottom:4px;">Booking for:</div>
            <div>${escapeHtml(customerInfo.firstName || '')} ${escapeHtml(customerInfo.lastName || '')} (${escapeHtml(customerInfo.email)})</div>
          </div>
          <div style="padding:12px;background:#e8f5e9;border-radius:8px;border-left:4px solid #4caf50;">
            <div style="font-weight:600;color:#2e7d32;font-size:1.1rem;">${escapeHtml(appointmentLabel)}</div>
          </div>
          <div style="margin-top:8px;">
            <div style="font-weight:600;margin-bottom:12px;color:#1a1c1d;">Select Available Time Slot (${escapeHtml(state)})</div>
            <div id="sxrx-calendar-container"></div>
          </div>
          <div id="sxrx-selected-slot-info" style="display:none;padding:12px;background:#eff6ff;border-radius:8px;border:2px solid #3f72e5;">
            <div style="font-weight:600;margin-bottom:4px;color:#3f72e5;">Selected Appointment:</div>
            <div id="sxrx-selected-slot-text" style="color:#1a1c1d;"></div>
          </div>
          <button id="sxrx-book-btn" class="btn btn-primary" style="padding:12px;border-radius:10px;font-weight:600;" disabled>Book appointment</button>
          <div id="sxrx-booking-msg" style="color:#555;"></div>
        </div>
      `;

      render(document.getElementById('sxrx-booking-status'), '');
      render(document.getElementById('sxrx-booking-form'), formHtml);

      // Render initial calendar
      const updateCalendar = () => {
        const container = document.getElementById('sxrx-calendar-container');
        if (container) {
          container.innerHTML = renderCalendar(allSlots, currentDate, selectedSlot, calendarView);
          attachCalendarEventListeners();
        }
      };

      // Attach event listeners for calendar interactions
      const attachCalendarEventListeners = () => {
        // View toggle buttons
        ['day', 'week', 'month'].forEach(view => {
          const btn = document.getElementById(`sxrx-view-${view}`);
          if (btn) {
            btn.addEventListener('click', () => {
              calendarView = view;
              // Adjust currentDate based on view
              if (view === 'day') {
                // Keep current date
              } else if (view === 'week') {
                // Adjust to start of week
                currentDate.setDate(currentDate.getDate() - currentDate.getDay());
              } else if (view === 'month') {
                // Adjust to first day of month
                currentDate.setDate(1);
              }
              updateCalendar();
            });
          }
        });

        // Navigation buttons
        const prevDay = document.getElementById('sxrx-prev-day');
        const nextDay = document.getElementById('sxrx-next-day');
        const prevWeek = document.getElementById('sxrx-prev-week');
        const nextWeek = document.getElementById('sxrx-next-week');
        const prevMonth = document.getElementById('sxrx-prev-month');
        const nextMonth = document.getElementById('sxrx-next-month');

        if (prevDay) prevDay.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 1); updateCalendar(); });
        if (nextDay) nextDay.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 1); updateCalendar(); });
        if (prevWeek) prevWeek.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 7); updateCalendar(); });
        if (nextWeek) nextWeek.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 7); updateCalendar(); });
        if (prevMonth) prevMonth.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateCalendar(); });
        if (nextMonth) nextMonth.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateCalendar(); });

        // Slot selection buttons
        document.querySelectorAll('.sxrx-slot-btn, .sxrx-slot-btn-small, .sxrx-slot-btn-tiny').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const startTime = btn.getAttribute('data-start-time');
            if (!startTime) return;

            // Find the slot object
            const slot = allSlots.find(s => (s.startTime || s.start || '') === startTime);
            if (!slot) return;

            // Update selected slot
            selectedSlot = slot;
            
            // Re-render calendar to show selection across all views
            updateCalendar();
            
            // Show selected slot info
            const infoDiv = document.getElementById('sxrx-selected-slot-info');
            const textDiv = document.getElementById('sxrx-selected-slot-text');
            const bookBtn = document.getElementById('sxrx-book-btn');
            
            if (infoDiv && textDiv && bookBtn) {
              const start = new Date(slot.startTime || slot.start || slot.date);
              const end = new Date(slot.endTime || slot.end || (start.getTime() + 30 * 60000));
              const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              const timeStr = `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
              
              textDiv.textContent = `${dateStr} at ${timeStr}`;
              infoDiv.style.display = 'block';
              bookBtn.disabled = false;
            }
          });
        });
      }

      // Initial calendar render
      updateCalendar();

      // Book appointment button
      document.getElementById('sxrx-book-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('sxrx-booking-msg');
        const btn = document.getElementById('sxrx-book-btn');
        
        if (!selectedSlot) {
          msg.style.color = '#b00020';
          msg.textContent = 'Please select a time slot first.';
          return;
        }

        msg.textContent = 'Booking…';
        btn.disabled = true;

        try {
          if (!customerInfo || !customerInfo.email) {
            throw new Error('Customer information is required. Please refresh the page.');
          }

          const startTime = selectedSlot.startTime || selectedSlot.start;
          if (!startTime) {
            throw new Error('Invalid time slot selected.');
          }

          // Backend calculates endTime automatically (30 minutes)
          const result = await bookAppointment({ 
            state, 
            startTime: startTime, 
            email: customerInfo.email, 
            firstName: customerInfo.firstName || '', 
            lastName: customerInfo.lastName || '',
            phone: customerInfo.phone || null,
            appointmentName: appointmentLabel
          });
          
          msg.style.color = 'green';
          msg.textContent = result.message || 'Appointment booked successfully! Check your email for confirmation.';
          
          // Redirect to my-appointments page after 2 seconds
          setTimeout(() => {
            window.location.href = '/pages/my-appointments';
          }, 2000);
        } catch (err) {
          msg.style.color = '#b00020';
          const errorMsg = err?.message || 'Failed to book appointment. Please try again.';
          msg.textContent = errorMsg;
          console.error('[APPOINTMENT-BOOKING] Booking error:', err);
          
          // If authentication error, redirect to login
          if (errorMsg.includes('Authentication') || errorMsg.includes('Unauthorized') || errorMsg.includes('login')) {
            setTimeout(() => {
              window.location.href = `/account/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            }, 2000);
          }
        } finally {
          btn.disabled = false;
        }
      });
    } catch (err) {
      render(document.getElementById('sxrx-booking-status'), `<span style="color:#b00020;">${escapeHtml(err.message || 'Failed to load availability')}</span>`);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

