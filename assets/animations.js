// shopify_new/assets/animations.js
// Success animations and smooth transitions

/**
 * Show success animation
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function showSuccessAnimation(element, options = {}) {
  const {
    message = 'Success!',
    duration = 3000,
    position = 'top',
    showIcon = true,
    onComplete = null
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) {
    console.warn('Element not found for success animation:', element);
    return;
  }
  
  // Create success overlay
  const overlay = document.createElement('div');
  overlay.className = 'success-animation-overlay';
  overlay.innerHTML = `
    <div class="success-animation-content">
      ${showIcon ? '<div class="success-icon">✓</div>' : ''}
      <div class="success-message">${message}</div>
    </div>
  `;
  
  // Add to element
  el.style.position = 'relative';
  el.appendChild(overlay);
  
  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });
  
  // Remove after duration
  setTimeout(() => {
    overlay.classList.add('hide');
    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, 300);
  }, duration);
}

/**
 * Show success toast notification
 * @param {string} message - Success message
 * @param {Object} options - Toast options
 */
function showSuccessToast(message, options = {}) {
  const {
    duration = 3000,
    position = 'top-right',
    showIcon = true,
    type = 'success'
  } = options;
  
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = `toast-container toast-${position}`;
    document.body.appendChild(container);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${showIcon ? '<div class="toast-icon">✓</div>' : ''}
    <div class="toast-message">${message}</div>
    <button class="toast-close" aria-label="Close">×</button>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Close handlers
  const closeToast = () => {
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  };
  
  toast.querySelector('.toast-close').addEventListener('click', closeToast);
  
  // Auto-close
  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
  
  return toast;
}

/**
 * Animate element with fade in
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function fadeIn(element, options = {}) {
  const {
    duration = 300,
    delay = 0,
    from = 0,
    to = 1
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;
  
  el.style.opacity = from;
  el.style.transition = `opacity ${duration}ms ease-in-out`;
  
  setTimeout(() => {
    el.style.opacity = to;
  }, delay);
}

/**
 * Animate element with slide in
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function slideIn(element, options = {}) {
  const {
    direction = 'up',
    duration = 300,
    delay = 0
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;
  
  const directions = {
    up: { from: 'translateY(20px)', to: 'translateY(0)' },
    down: { from: 'translateY(-20px)', to: 'translateY(0)' },
    left: { from: 'translateX(20px)', to: 'translateX(0)' },
    right: { from: 'translateX(-20px)', to: 'translateX(0)' }
  };
  
  const transform = directions[direction] || directions.up;
  
  el.style.opacity = '0';
  el.style.transform = transform.from;
  el.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
  
  setTimeout(() => {
    el.style.opacity = '1';
    el.style.transform = transform.to;
  }, delay);
}

/**
 * Animate element with scale
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function scaleIn(element, options = {}) {
  const {
    duration = 300,
    delay = 0,
    from = 0.8,
    to = 1
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;
  
  el.style.opacity = '0';
  el.style.transform = `scale(${from})`;
  el.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
  
  setTimeout(() => {
    el.style.opacity = '1';
    el.style.transform = `scale(${to})`;
  }, delay);
}

/**
 * Pulse animation
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function pulse(element, options = {}) {
  const {
    duration = 1000,
    iterations = 3
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;
  
  el.style.animation = `pulse ${duration}ms ease-in-out ${iterations}`;
  
  setTimeout(() => {
    el.style.animation = '';
  }, duration * iterations);
}

/**
 * Shake animation (for errors)
 * @param {string|HTMLElement} element - Element to animate
 * @param {Object} options - Animation options
 */
function shake(element, options = {}) {
  const {
    duration = 500
  } = options;
  
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;
  
  el.style.animation = `shake ${duration}ms ease-in-out`;
  
  setTimeout(() => {
    el.style.animation = '';
  }, duration);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.Animations = {
    showSuccess: showSuccessAnimation,
    showToast: showSuccessToast,
    fadeIn,
    slideIn,
    scaleIn,
    pulse,
    shake
  };
}
