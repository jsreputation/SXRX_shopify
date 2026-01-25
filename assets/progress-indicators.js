// shopify_new/assets/progress-indicators.js
// Progress indicators for multi-step flows

/**
 * Create a progress indicator
 * @param {Object} options - Progress options
 * @param {Array<string>} options.steps - Array of step names
 * @param {number} options.currentStep - Current step index (0-based)
 * @param {string} options.containerId - Container element ID
 * @returns {HTMLElement} Progress indicator element
 */
function createProgressIndicator(options = {}) {
  const {
    steps = [],
    currentStep = 0,
    containerId = 'progress-indicator'
  } = options;
  
  if (steps.length === 0) {
    console.warn('No steps provided for progress indicator');
    return null;
  }
  
  const container = document.getElementById(containerId) || document.createElement('div');
  container.id = containerId;
  container.className = 'progress-indicator';
  
  const progressHTML = `
    <div class="progress-steps">
      ${steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const stepNumber = index + 1;
        
        return `
          <div class="progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" data-step="${index}">
            <div class="progress-step-number">
              ${isCompleted ? '✓' : stepNumber}
            </div>
            <div class="progress-step-label">${step}</div>
          </div>
          ${index < steps.length - 1 ? '<div class="progress-connector"></div>' : ''}
        `;
      }).join('')}
    </div>
  `;
  
  container.innerHTML = progressHTML;
  
  return container;
}

/**
 * Update progress indicator
 * @param {string} containerId - Container element ID
 * @param {number} currentStep - Current step index (0-based)
 */
function updateProgressIndicator(containerId, currentStep) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Progress indicator container not found:', containerId);
    return;
  }
  
  const steps = container.querySelectorAll('.progress-step');
  steps.forEach((step, index) => {
    const isActive = index === currentStep;
    const isCompleted = index < currentStep;
    
    step.classList.remove('active', 'completed');
    if (isActive) {
      step.classList.add('active');
    } else if (isCompleted) {
      step.classList.add('completed');
    }
    
    const numberEl = step.querySelector('.progress-step-number');
    if (numberEl) {
      numberEl.textContent = isCompleted ? '✓' : (index + 1);
    }
  });
}

/**
 * Create a linear progress bar
 * @param {Object} options - Progress bar options
 * @param {number} options.value - Current progress value (0-100)
 * @param {string} options.containerId - Container element ID
 * @param {string} options.label - Optional label
 * @returns {HTMLElement} Progress bar element
 */
function createProgressBar(options = {}) {
  const {
    value = 0,
    containerId = 'progress-bar',
    label = null,
    showPercentage = true
  } = options;
  
  const container = document.getElementById(containerId) || document.createElement('div');
  container.id = containerId;
  container.className = 'progress-bar-container';
  
  const percentage = Math.min(100, Math.max(0, value));
  
  container.innerHTML = `
    ${label ? `<div class="progress-bar-label">${label}</div>` : ''}
    <div class="progress-bar-wrapper">
      <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      ${showPercentage ? `<div class="progress-bar-text">${Math.round(percentage)}%</div>` : ''}
    </div>
  `;
  
  return container;
}

/**
 * Update progress bar
 * @param {string} containerId - Container element ID
 * @param {number} value - Progress value (0-100)
 * @param {string} label - Optional label update
 */
function updateProgressBar(containerId, value, label = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Progress bar container not found:', containerId);
    return;
  }
  
  const percentage = Math.min(100, Math.max(0, value));
  const fill = container.querySelector('.progress-bar-fill');
  const text = container.querySelector('.progress-bar-text');
  const labelEl = container.querySelector('.progress-bar-label');
  
  if (fill) {
    fill.style.width = `${percentage}%`;
  }
  
  if (text) {
    text.textContent = `${Math.round(percentage)}%`;
  }
  
  if (label && labelEl) {
    labelEl.textContent = label;
  }
}

/**
 * Create a circular progress indicator
 * @param {Object} options - Progress options
 * @param {number} options.value - Current progress value (0-100)
 * @param {number} options.size - Size in pixels (default: 64)
 * @param {string} options.containerId - Container element ID
 * @returns {HTMLElement} Circular progress element
 */
function createCircularProgress(options = {}) {
  const {
    value = 0,
    size = 64,
    containerId = 'circular-progress',
    strokeWidth = 6
  } = options;
  
  const container = document.getElementById(containerId) || document.createElement('div');
  container.id = containerId;
  container.className = 'circular-progress-container';
  
  const percentage = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  container.innerHTML = `
    <svg class="circular-progress" width="${size}" height="${size}">
      <circle
        class="circular-progress-background"
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        stroke-width="${strokeWidth}"
      />
      <circle
        class="circular-progress-fill"
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${offset}"
      />
    </svg>
    <div class="circular-progress-text">${Math.round(percentage)}%</div>
  `;
  
  return container;
}

/**
 * Update circular progress
 * @param {string} containerId - Container element ID
 * @param {number} value - Progress value (0-100)
 */
function updateCircularProgress(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Circular progress container not found:', containerId);
    return;
  }
  
  const percentage = Math.min(100, Math.max(0, value));
  const size = parseInt(container.querySelector('.circular-progress').getAttribute('width'));
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  const fill = container.querySelector('.circular-progress-fill');
  const text = container.querySelector('.circular-progress-text');
  
  if (fill) {
    fill.style.strokeDashoffset = offset;
  }
  
  if (text) {
    text.textContent = `${Math.round(percentage)}%`;
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.ProgressIndicator = {
    create: createProgressIndicator,
    update: updateProgressIndicator,
    createBar: createProgressBar,
    updateBar: updateProgressBar,
    createCircular: createCircularProgress,
    updateCircular: updateCircularProgress
  };
}
