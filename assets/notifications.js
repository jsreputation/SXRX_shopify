// notifications.js
// Notification center component with toast notifications and badge counts

(function() {
  'use strict';
  
  const NOTIFICATION_STORAGE_KEY = 'sxrx_notifications';
  const MAX_NOTIFICATIONS = 50;
  const AUTO_DISMISS_DELAY = 5000; // 5 seconds
  
  // Notification types
  const NotificationType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };
  
  // Notification state
  let notifications = [];
  let unreadCount = 0;
  
  /**
   * Initialize notification system
   */
  function init() {
    loadNotifications();
    createNotificationCenter();
    createToastContainer();
    updateBadgeCount();
  }
  
  /**
   * Load notifications from localStorage
   */
  function loadNotifications() {
    try {
      const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        notifications = data.notifications || [];
        unreadCount = notifications.filter(n => !n.read).length;
      }
    } catch (error) {
      console.warn('[NOTIFICATIONS] Failed to load notifications:', error);
      notifications = [];
      unreadCount = 0;
    }
  }
  
  /**
   * Save notifications to localStorage
   */
  function saveNotifications() {
    try {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
        notifications: notifications.slice(-MAX_NOTIFICATIONS), // Keep only last 50
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('[NOTIFICATIONS] Failed to save notifications:', error);
    }
  }
  
  /**
   * Create notification center UI
   */
  function createNotificationCenter() {
    // Check if already exists
    if (document.getElementById('notification-center')) {
      return;
    }
    
    const center = document.createElement('div');
    center.id = 'notification-center';
    center.className = 'notification-center';
    center.innerHTML = `
      <div class="notification-center-header">
        <h3>Notifications</h3>
        <button class="notification-center-close" aria-label="Close notifications">
          <span>&times;</span>
        </button>
      </div>
      <div class="notification-center-actions">
        <button class="notification-mark-all-read" data-action="mark-all-read">
          Mark all as read
        </button>
        <button class="notification-clear-all" data-action="clear-all">
          Clear all
        </button>
      </div>
      <div class="notification-center-list" id="notification-list">
        ${renderNotificationList()}
      </div>
      <div class="notification-center-empty" id="notification-empty" style="display: ${notifications.length === 0 ? 'block' : 'none'};">
        <p>No notifications</p>
      </div>
    `;
    
    // Add styles
    if (!document.getElementById('notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-styles';
      styles.textContent = getNotificationStyles();
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(center);
    
    // Add event listeners
    center.querySelector('.notification-center-close').addEventListener('click', () => {
      center.classList.remove('active');
    });
    
    center.querySelector('[data-action="mark-all-read"]').addEventListener('click', () => {
      markAllAsRead();
    });
    
    center.querySelector('[data-action="clear-all"]').addEventListener('click', () => {
      clearAllNotifications();
    });
    
    // Close on outside click
    center.addEventListener('click', (e) => {
      if (e.target === center) {
        center.classList.remove('active');
      }
    });
  }
  
  /**
   * Create toast container
   */
  function createToastContainer() {
    if (document.getElementById('toast-container')) {
      return;
    }
    
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  /**
   * Show toast notification
   */
  function showToast(message, type = NotificationType.INFO, options = {}) {
    const {
      duration = AUTO_DISMISS_DELAY,
      persistent = false,
      action = null
    } = options;
    
    const container = document.getElementById('toast-container');
    if (!container) {
      createToastContainer();
      return showToast(message, type, options);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const icon = getIconForType(type);
    toast.innerHTML = `
      <div class="toast-content">
        ${icon ? `<span class="toast-icon">${icon}</span>` : ''}
        <span class="toast-message">${escapeHtml(message)}</span>
      </div>
      ${action ? `
        <button class="toast-action" data-action="${action.label}">
          ${escapeHtml(action.label)}
        </button>
      ` : ''}
      <button class="toast-close" aria-label="Close notification">
        <span>&times;</span>
      </button>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      dismissToast(toast);
    });
    
    // Action button
    if (action) {
      toast.querySelector('.toast-action').addEventListener('click', () => {
        if (action.onClick) {
          action.onClick();
        }
        dismissToast(toast);
      });
    }
    
    // Auto-dismiss
    if (!persistent && duration > 0) {
      setTimeout(() => {
        dismissToast(toast);
      }, duration);
    }
    
    return toast;
  }
  
  /**
   * Dismiss toast
   */
  function dismissToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
  
  /**
   * Add notification to center
   */
  function addNotification(message, type = NotificationType.INFO, options = {}) {
    const notification = {
      id: generateId(),
      message: message,
      type: type,
      timestamp: new Date().toISOString(),
      read: false,
      ...options
    };
    
    notifications.unshift(notification); // Add to beginning
    unreadCount++;
    
    // Limit notifications
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    }
    
    saveNotifications();
    updateNotificationList();
    updateBadgeCount();
    
    // Also show as toast if enabled
    if (options.showToast !== false) {
      showToast(message, type, options);
    }
    
    return notification;
  }
  
  /**
   * Mark notification as read
   */
  function markAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      unreadCount = Math.max(0, unreadCount - 1);
      saveNotifications();
      updateNotificationList();
      updateBadgeCount();
    }
  }
  
  /**
   * Mark all notifications as read
   */
  function markAllAsRead() {
    notifications.forEach(n => {
      n.read = true;
    });
    unreadCount = 0;
    saveNotifications();
    updateNotificationList();
    updateBadgeCount();
  }
  
  /**
   * Clear all notifications
   */
  function clearAllNotifications() {
    if (confirm('Are you sure you want to clear all notifications?')) {
      notifications = [];
      unreadCount = 0;
      saveNotifications();
      updateNotificationList();
      updateBadgeCount();
    }
  }
  
  /**
   * Update notification list UI
   */
  function updateNotificationList() {
    const list = document.getElementById('notification-list');
    const empty = document.getElementById('notification-empty');
    
    if (!list) return;
    
    list.innerHTML = renderNotificationList();
    
    if (empty) {
      empty.style.display = notifications.length === 0 ? 'block' : 'none';
    }
  }
  
  /**
   * Render notification list HTML
   */
  function renderNotificationList() {
    if (notifications.length === 0) {
      return '';
    }
    
    return notifications.map(notification => {
      const icon = getIconForType(notification.type);
      const timeAgo = getTimeAgo(notification.timestamp);
      const readClass = notification.read ? 'read' : 'unread';
      
      return `
        <div class="notification-item ${readClass}" data-id="${notification.id}">
          <div class="notification-item-content">
            ${icon ? `<span class="notification-icon">${icon}</span>` : ''}
            <div class="notification-details">
              <p class="notification-message">${escapeHtml(notification.message)}</p>
              <span class="notification-time">${timeAgo}</span>
            </div>
          </div>
          <button class="notification-mark-read" aria-label="Mark as read">
            <span>&times;</span>
          </button>
        </div>
      `;
    }).join('');
    
    // Add event listeners after rendering
    setTimeout(() => {
      document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (!e.target.closest('.notification-mark-read')) {
            const id = item.dataset.id;
            markAsRead(id);
          }
        });
      });
      
      document.querySelectorAll('.notification-mark-read').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.closest('.notification-item').dataset.id;
          markAsRead(id);
        });
      });
    }, 0);
  }
  
  /**
   * Update badge count
   */
  function updateBadgeCount() {
    // Update badge in notification center button (if exists)
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : '';
      badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    
    // Update document title
    if (unreadCount > 0) {
      const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = document.title.replace(/^\(\d+\)\s*/, '');
    }
  }
  
  /**
   * Get icon for notification type
   */
  function getIconForType(type) {
    const icons = {
      [NotificationType.SUCCESS]: '✓',
      [NotificationType.ERROR]: '✕',
      [NotificationType.WARNING]: '⚠',
      [NotificationType.INFO]: 'ℹ'
    };
    return icons[type] || '';
  }
  
  /**
   * Get time ago string
   */
  function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
  
  /**
   * Generate unique ID
   */
  function generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Get notification styles
   */
  function getNotificationStyles() {
    return `
      /* Notification Center */
      .notification-center {
        position: fixed;
        top: 0;
        right: -400px;
        width: 400px;
        max-width: 90vw;
        height: 100vh;
        background: #fff;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
        z-index: 10000;
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      
      .notification-center.active {
        right: 0;
      }
      
      .notification-center-header {
        padding: 1rem;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .notification-center-header h3 {
        margin: 0;
        font-size: 1.25rem;
      }
      
      .notification-center-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .notification-center-actions {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        gap: 0.5rem;
      }
      
      .notification-center-actions button {
        padding: 0.5rem 1rem;
        border: 1px solid #ddd;
        background: #fff;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.875rem;
      }
      
      .notification-center-actions button:hover {
        background: #f5f5f5;
      }
      
      .notification-center-list {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem 0;
      }
      
      .notification-item {
        padding: 1rem;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        transition: background 0.2s;
      }
      
      .notification-item:hover {
        background: #f9f9f9;
      }
      
      .notification-item.unread {
        background: #f0f7ff;
      }
      
      .notification-item-content {
        display: flex;
        gap: 0.75rem;
        flex: 1;
      }
      
      .notification-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
      }
      
      .notification-details {
        flex: 1;
      }
      
      .notification-message {
        margin: 0 0 0.25rem 0;
        font-size: 0.9375rem;
      }
      
      .notification-time {
        font-size: 0.75rem;
        color: #666;
      }
      
      .notification-mark-read {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
      }
      
      .notification-mark-read:hover {
        opacity: 1;
      }
      
      .notification-center-empty {
        padding: 2rem;
        text-align: center;
        color: #999;
      }
      
      /* Toast Notifications */
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 400px;
        pointer-events: none;
      }
      
      .toast {
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-width: 300px;
        max-width: 100%;
        pointer-events: auto;
        transform: translateX(400px);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }
      
      .toast.show {
        transform: translateX(0);
        opacity: 1;
      }
      
      .toast.hide {
        transform: translateX(400px);
        opacity: 0;
      }
      
      .toast-success {
        border-left: 4px solid #4caf50;
      }
      
      .toast-error {
        border-left: 4px solid #f44336;
      }
      
      .toast-warning {
        border-left: 4px solid #ff9800;
      }
      
      .toast-info {
        border-left: 4px solid #2196f3;
      }
      
      .toast-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
      }
      
      .toast-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
      }
      
      .toast-message {
        flex: 1;
        font-size: 0.9375rem;
      }
      
      .toast-action {
        padding: 0.5rem 1rem;
        border: 1px solid #ddd;
        background: #fff;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.875rem;
        white-space: nowrap;
      }
      
      .toast-action:hover {
        background: #f5f5f5;
      }
      
      .toast-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        flex-shrink: 0;
      }
      
      .toast-close:hover {
        opacity: 1;
      }
      
      /* Notification Badge */
      .notification-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #f44336;
        color: #fff;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 0.75rem;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
        display: none;
      }
      
      /* Mobile Responsive */
      @media (max-width: 768px) {
        .notification-center {
          width: 100vw;
          right: -100vw;
        }
        
        .toast-container {
          right: 10px;
          left: 10px;
          max-width: none;
        }
        
        .toast {
          min-width: auto;
          width: 100%;
        }
      }
    `;
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose API
  window.SXRX = window.SXRX || {};
  window.SXRX.Notifications = {
    show: showToast,
    add: addNotification,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    clearAll: clearAllNotifications,
    getUnreadCount: () => unreadCount,
    getNotifications: () => [...notifications],
    openCenter: () => {
      const center = document.getElementById('notification-center');
      if (center) {
        center.classList.add('active');
      }
    },
    closeCenter: () => {
      const center = document.getElementById('notification-center');
      if (center) {
        center.classList.remove('active');
      }
    },
    NotificationType: NotificationType
  };
  
  // Alias for convenience
  window.SXRX.showNotification = showToast;
  
})();
