/**
 * My Account Dashboard
 * User-friendly account dashboard that replaces Shopify's default account page
 */

(function() {
  'use strict';

  const BACKEND_API = window.BACKEND_API || 'https://api.sxrx.us';

  /**
   * Get storefront token from various sources
   */
  function getStorefrontToken() {
    if (window.storefrontToken) return window.storefrontToken;
    if (window.Shopify?.customerAccessToken) return window.Shopify.customerAccessToken;
    if (sessionStorage.getItem('storefrontToken')) return sessionStorage.getItem('storefrontToken');
    if (localStorage.getItem('storefrontToken')) return localStorage.getItem('storefrontToken');
    if (sessionStorage.getItem('shopify_customer_access_token')) return sessionStorage.getItem('shopify_customer_access_token');
    if (localStorage.getItem('shopify_customer_access_token')) return localStorage.getItem('shopify_customer_access_token');
    return null;
  }

  /**
   * Get customer info from window objects
   */
  function getCustomerInfo() {
    if (window.Shopify?.customer) {
      return {
        email: window.Shopify.customer.email,
        firstName: window.Shopify.customer.first_name,
        lastName: window.Shopify.customer.last_name,
        phone: window.Shopify.customer.phone
      };
    }
    
    if (window.SXRX) {
      return {
        email: window.SXRX.customerEmail,
        firstName: window.SXRX.customerFirstName || '',
        lastName: window.SXRX.customerLastName || '',
        phone: window.SXRX.customerPhone || null
      };
    }
    
    return null;
  }

  /**
   * Format phone number for display
   */
  function formatPhone(phone) {
    if (!phone) return 'Not set';
    return phone;
  }

  /**
   * Display account information
   */
  function displayAccountInfo(customer) {
    const container = document.getElementById('account-info-display');
    if (!container) return;

    const info = getCustomerInfo() || customer;
    
    container.innerHTML = `
      <div>
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">Name</div>
        <div style="font-weight: 600; color: #1a1c1d;">
          ${(info.firstName || '')} ${(info.lastName || '')}
        </div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">Email</div>
        <div style="font-weight: 600; color: #1a1c1d;">
          ${info.email || 'Not set'}
        </div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">Phone</div>
        <div style="font-weight: 600; color: #1a1c1d;">
          ${formatPhone(info.phone)}
        </div>
      </div>
    `;
  }

  /**
   * Load recent orders
   */
  async function loadRecentOrders() {
    const container = document.getElementById('recent-orders');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <p>Loading orders...</p>
      </div>
    `;

    // Try to get orders from Shopify customer object (available on account pages)
    if (window.Shopify?.customer?.orders && Array.isArray(window.Shopify.customer.orders)) {
      const orders = window.Shopify.customer.orders.slice(0, 5);
      if (orders.length > 0) {
        displayOrders(orders);
        return;
      }
    }

    // Fallback: Show message with link to orders page
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
        <p style="margin-bottom: 12px;">No recent orders found.</p>
        <a href="/account/orders" class="button" style="text-decoration: none; display: inline-block;">View All Orders</a>
      </div>
    `;
  }

  /**
   * Display orders
   */
  function displayOrders(orders) {
    const container = document.getElementById('recent-orders');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <p>No recent orders.</p>
        </div>
      `;
      return;
    }

    const ordersHtml = orders.map(order => {
      // Format order date
      let orderDate = 'N/A';
      if (order.created_at) {
        try {
          orderDate = new Date(order.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        } catch (e) {
          orderDate = 'N/A';
        }
      }
      
      // Get order number/name
      const orderNumber = order.order_number || order.name || order.id || 'N/A';
      
      // Get item count
      const itemCount = order.line_items_count || order.line_item_count || (order.line_items ? order.line_items.length : 0);
      
      // Format price (handle both cents and decimal formats)
      let price = '0.00';
      let currency = order.currency || 'USD';
      if (order.total_price) {
        const priceNum = typeof order.total_price === 'string' 
          ? parseFloat(order.total_price) 
          : order.total_price;
        // If price is in cents (large number), divide by 100
        price = priceNum > 1000 ? (priceNum / 100).toFixed(2) : priceNum.toFixed(2);
      }
      
      // Get order URL - try multiple formats
      let orderUrl = `/account/orders/${orderNumber}`;
      if (order.customer_url) {
        orderUrl = order.customer_url;
      } else if (order.url) {
        orderUrl = order.url;
      }
      
      // Get status
      const status = order.financial_status_label || order.financial_status || order.status || 'Paid';
      const statusColor = status.toLowerCase().includes('paid') || status.toLowerCase().includes('confirmed') 
        ? '#10b981' 
        : '#f59e0b';
      
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #e5e7eb; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f9fafb'" onmouseout="this.style.backgroundColor='transparent'">
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">
              <a href="${orderUrl}" style="color: #3f72e5; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#3f72e5'">
                Order ${orderNumber}
              </a>
            </div>
            <div style="font-size: 0.85rem; color: #666;">
              ${orderDate} • ${itemCount} item${itemCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: #1a1c1d;">
              $${price} ${currency}
            </div>
            <div style="font-size: 0.85rem; color: ${statusColor}; margin-top: 4px; font-weight: 500;">
              ${status}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = ordersHtml;
  }

  /**
   * Load customer data from backend
   */
  async function loadCustomerData() {
    const loadingDiv = document.getElementById('account-loading');
    const dashboardDiv = document.getElementById('account-dashboard');
    const storefrontToken = getStorefrontToken();

    if (!storefrontToken) {
      // Not logged in, redirect to login
      window.location.href = '/account/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_API}/api/shopify-storefront/me`, {
        headers: {
          'Authorization': `Bearer ${storefrontToken}`,
          'shopify_access_token': storefrontToken
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load account data');
      }

      const data = await response.json();
      
      if (data.success && data.customer) {
        displayAccountInfo(data.customer);
        loadRecentOrders();
        
        // Show dashboard, hide loading
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (dashboardDiv) dashboardDiv.style.display = 'block';
      } else {
        throw new Error('Invalid account data');
      }
    } catch (error) {
      console.error('[MY-ACCOUNT] Error loading account data:', error);
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <p style="color: #dc2626; margin-bottom: 16px;">Failed to load account information.</p>
            <a href="/account/login" class="button">Log In</a>
          </div>
        `;
      }
    }
  }

  /**
   * Initialize
   */
  function init() {
    // Check if customer is logged in
    const customerInfo = getCustomerInfo();
    if (!customerInfo && !getStorefrontToken()) {
      // Not logged in, redirect to login
      window.location.href = '/account/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    // Load account data
    loadCustomerData();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
