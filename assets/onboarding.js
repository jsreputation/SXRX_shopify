// Onboarding Flow - Welcome Tour and Progress Indicators
// Provides guided tour for first-time users and progress indicators

(function() {
  'use strict';

  const ONBOARDING_STORAGE_KEY = 'sxrx_onboarding_completed';
  const ONBOARDING_VERSION = '1.0.0';

  /**
   * Check if user has completed onboarding
   */
  function hasCompletedOnboarding() {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!stored) return false;
      const data = JSON.parse(stored);
      return data.version === ONBOARDING_VERSION && data.completed === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  function markOnboardingCompleted() {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        version: ONBOARDING_VERSION,
        completed: true,
        completedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Failed to save onboarding completion:', e);
    }
  }

  /**
   * Show progress indicator for multi-step processes
   * @param {Object} options - Progress options
   * @param {number} options.currentStep - Current step (1-based)
   * @param {number} options.totalSteps - Total number of steps
   * @param {string} options.containerId - Container ID to show progress in
   */
  function showProgressIndicator({ currentStep, totalSteps, containerId }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const percentage = (currentStep / totalSteps) * 100;
    
    const progressHTML = `
      <div class="progress-indicator" style="margin: 1.5rem 0;">
        <div class="progress-steps" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          ${Array.from({ length: totalSteps }, (_, i) => {
            const step = i + 1;
            const isActive = step === currentStep;
            const isCompleted = step < currentStep;
            return `
              <div class="progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
                   style="flex: 1; text-align: center; padding: 0.5rem; position: relative;">
                <div class="step-circle" style="
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  background: ${isCompleted ? '#4caf50' : isActive ? '#3f72e5' : '#e0e0e0'};
                  color: white;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 600;
                  margin-bottom: 0.25rem;
                ">${isCompleted ? '✓' : step}</div>
                <div class="step-label" style="font-size: 0.75rem; color: ${isActive ? '#3f72e5' : '#666'};">
                  Step ${step}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="progress-bar" style="
          width: 100%;
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
        ">
          <div class="progress-fill" style="
            width: ${percentage}%;
            height: 100%;
            background: linear-gradient(90deg, #3f72e5 0%, #5a8ef7 100%);
            transition: width 0.3s ease;
          "></div>
        </div>
        <div class="progress-text" style="text-align: center; margin-top: 0.5rem; color: #666; font-size: 0.875rem;">
          Step ${currentStep} of ${totalSteps}
        </div>
      </div>
    `;

    // Insert or update progress indicator
    let progressEl = container.querySelector('.progress-indicator');
    if (progressEl) {
      progressEl.outerHTML = progressHTML;
    } else {
      container.insertAdjacentHTML('afterbegin', progressHTML);
    }
  }

  /**
   * Show tooltip for a specific element
   * @param {Object} options - Tooltip options
   * @param {HTMLElement} options.element - Element to attach tooltip to
   * @param {string} options.text - Tooltip text
   * @param {string} options.position - Tooltip position (top, bottom, left, right)
   */
  function showTooltip({ element, text, position = 'top' }) {
    if (!element || !text) return;

    // Remove existing tooltip
    const existing = document.querySelector('.onboarding-tooltip');
    if (existing) existing.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: #1a1c1d;
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      z-index: 10000;
      max-width: 250px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    switch (position) {
      case 'top':
        tooltip.style.top = `${rect.top - tooltipRect.height - 10}px`;
        tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltipRect.width / 2)}px`;
        break;
      case 'bottom':
        tooltip.style.top = `${rect.bottom + 10}px`;
        tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltipRect.width / 2)}px`;
        break;
      case 'left':
        tooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltipRect.height / 2)}px`;
        break;
      case 'right':
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2) - (tooltipRect.height / 2)}px`;
        break;
    }

    // Add arrow
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      width: 0;
      height: 0;
      border: 6px solid transparent;
    `;
    
    switch (position) {
      case 'top':
        arrow.style.bottom = '-12px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderTopColor = '#1a1c1d';
        break;
      case 'bottom':
        arrow.style.top = '-12px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderBottomColor = '#1a1c1d';
        break;
      case 'left':
        arrow.style.right = '-12px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderLeftColor = '#1a1c1d';
        break;
      case 'right':
        arrow.style.left = '-12px';
        arrow.style.top = '50%';
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderRightColor = '#1a1c1d';
        break;
    }
    
    tooltip.appendChild(arrow);

    // Remove on click
    setTimeout(() => {
      document.addEventListener('click', function removeTooltip() {
        tooltip.remove();
        document.removeEventListener('click', removeTooltip);
      }, { once: true });
    }, 100);
  }

  /**
   * Start welcome tour for first-time users
   * @param {Array} steps - Array of tour steps
   */
  function startWelcomeTour(steps = []) {
    if (hasCompletedOnboarding()) return;

    const defaultSteps = [
      {
        selector: '#my-appointments-container',
        title: 'Welcome to Your Appointments',
        text: 'Here you can view and manage all your appointments.',
        position: 'bottom'
      },
      {
        selector: '.appointments-header',
        title: 'Quick Actions',
        text: 'Use the search and filter options to find specific appointments.',
        position: 'bottom'
      },
      {
        selector: '.btn-primary',
        title: 'Book Appointment',
        text: 'Click here to book a new appointment.',
        position: 'top'
      }
    ];

    const tourSteps = steps.length > 0 ? steps : defaultSteps;
    let currentStep = 0;

    function showNextStep() {
      if (currentStep >= tourSteps.length) {
        markOnboardingCompleted();
        return;
      }

      const step = tourSteps[currentStep];
      const element = document.querySelector(step.selector);
      
      if (!element) {
        currentStep++;
        showNextStep();
        return;
      }

      // Highlight element
      element.style.outline = '3px solid #3f72e5';
      element.style.outlineOffset = '4px';
      element.style.transition = 'outline 0.3s ease';

      // Show tooltip
      showTooltip({
        element,
        text: `${step.title}\n\n${step.text}`,
        position: step.position || 'top'
      });

      // Add next button
      const nextBtn = document.createElement('button');
      nextBtn.textContent = currentStep === tourSteps.length - 1 ? 'Got it!' : 'Next';
      nextBtn.className = 'btn btn-primary';
      nextBtn.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 10001;
        min-height: 44px;
        padding: 0.875rem 1.5rem;
      `;
      nextBtn.onclick = () => {
        element.style.outline = '';
        nextBtn.remove();
        currentStep++;
        showNextStep();
      };
      document.body.appendChild(nextBtn);
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showNextStep);
    } else {
      setTimeout(showNextStep, 500);
    }
  }

  // Export to global namespace
  window.SXRX = window.SXRX || {};
  window.SXRX.Onboarding = {
    hasCompletedOnboarding,
    markOnboardingCompleted,
    showProgressIndicator,
    showTooltip,
    startWelcomeTour
  };

  // Auto-start tour on appointments page if not completed
  if (window.location.pathname.includes('my-appointments') || 
      document.getElementById('my-appointments-container')) {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (!hasCompletedOnboarding()) {
          startWelcomeTour();
        }
      }, 1000);
    });
  }
})();
