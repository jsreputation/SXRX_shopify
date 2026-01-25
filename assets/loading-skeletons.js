// shopify_new/assets/loading-skeletons.js
// Loading skeleton components for better perceived performance

/**
 * Create a skeleton loader element
 * @param {Object} options - Skeleton options
 * @param {string} options.type - Type of skeleton (card, list, form, table)
 * @param {number} options.count - Number of skeleton items (default: 1)
 * @param {string} options.className - Additional CSS classes
 * @returns {HTMLElement} Skeleton element
 */
function createSkeleton(options = {}) {
  const { type = 'card', count = 1, className = '' } = options;
  
  const container = document.createElement('div');
  container.className = `skeleton-container ${className}`;
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;
    
    switch (type) {
      case 'card':
        skeleton.innerHTML = `
          <div class="skeleton-header">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-subtitle"></div>
          </div>
          <div class="skeleton-body">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-short"></div>
          </div>
          <div class="skeleton-footer">
            <div class="skeleton-button"></div>
          </div>
        `;
        break;
        
      case 'list':
        skeleton.innerHTML = `
          <div class="skeleton-list-item">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line skeleton-short"></div>
            </div>
          </div>
        `;
        break;
        
      case 'form':
        skeleton.innerHTML = `
          <div class="skeleton-form-group">
            <div class="skeleton-label"></div>
            <div class="skeleton-input"></div>
          </div>
        `;
        break;
        
      case 'table':
        skeleton.innerHTML = `
          <div class="skeleton-table-row">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-short"></div>
          </div>
        `;
        break;
        
      case 'appointment':
        skeleton.innerHTML = `
          <div class="skeleton-appointment">
            <div class="skeleton-appointment-header">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-appointment-info">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-subtitle"></div>
              </div>
            </div>
            <div class="skeleton-appointment-body">
              <div class="skeleton-line"></div>
              <div class="skeleton-line skeleton-short"></div>
            </div>
            <div class="skeleton-appointment-actions">
              <div class="skeleton-button"></div>
              <div class="skeleton-button"></div>
            </div>
          </div>
        `;
        break;
        
      default:
        skeleton.innerHTML = '<div class="skeleton-line"></div>';
    }
    
    container.appendChild(skeleton);
  }
  
  return container;
}

/**
 * Show skeleton loader in a container
 * @param {string|HTMLElement} container - Container selector or element
 * @param {Object} options - Skeleton options
 */
function showSkeleton(container, options = {}) {
  const element = typeof container === 'string' 
    ? document.querySelector(container) 
    : container;
  
  if (!element) {
    console.warn('Skeleton container not found:', container);
    return null;
  }
  
  // Store original content
  if (!element.dataset.originalContent) {
    element.dataset.originalContent = element.innerHTML;
  }
  
  // Clear and show skeleton
  element.innerHTML = '';
  const skeleton = createSkeleton(options);
  element.appendChild(skeleton);
  element.classList.add('skeleton-loading');
  
  return skeleton;
}

/**
 * Hide skeleton loader and restore original content
 * @param {string|HTMLElement} container - Container selector or element
 * @param {HTMLElement} content - New content to show (optional)
 */
function hideSkeleton(container, content = null) {
  const element = typeof container === 'string' 
    ? document.querySelector(container) 
    : container;
  
  if (!element) {
    console.warn('Skeleton container not found:', container);
    return;
  }
  
  element.classList.remove('skeleton-loading');
  
  if (content) {
    element.innerHTML = '';
    element.appendChild(content);
  } else if (element.dataset.originalContent) {
    element.innerHTML = element.dataset.originalContent;
    delete element.dataset.originalContent;
  } else {
    element.innerHTML = '';
  }
}

/**
 * Show inline skeleton (doesn't replace content, shows alongside)
 * @param {string|HTMLElement} container - Container selector or element
 * @param {Object} options - Skeleton options
 * @returns {HTMLElement} Skeleton element
 */
function showInlineSkeleton(container, options = {}) {
  const element = typeof container === 'string' 
    ? document.querySelector(container) 
    : container;
  
  if (!element) {
    console.warn('Skeleton container not found:', container);
    return null;
  }
  
  const skeleton = createSkeleton(options);
  element.appendChild(skeleton);
  
  return skeleton;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.SkeletonLoader = {
    create: createSkeleton,
    show: showSkeleton,
    hide: hideSkeleton,
    showInline: showInlineSkeleton
  };
}
