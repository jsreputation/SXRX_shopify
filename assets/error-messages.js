// Error Messages - Centralized error message mapping
// Maps technical errors to user-friendly messages

(function() {
  'use strict';

  // Error message mapping
  const ERROR_MESSAGES = {
    // Authentication errors
    'UNAUTHORIZED': 'Please log in to continue.',
    'FORBIDDEN': 'You do not have permission to access this resource.',
    'AUTHENTICATION_FAILED': 'Authentication failed. Please log in and try again.',
    
    // Patient/User errors
    'PATIENT_NOT_FOUND': 'Patient record not found. Please complete a questionnaire first.',
    'TEBRA_PATIENT_NOT_FOUND': 'Please complete your registration first.',
    'CUSTOMER_NOT_FOUND': 'Customer account not found. Please register first.',
    
    // Questionnaire errors
    'QUESTIONNAIRE_NOT_COMPLETED': 'Please complete the questionnaire before checkout.',
    'QUESTIONNAIRE_REQUIRED': 'A questionnaire is required for this product.',
    'RED_FLAGS_DETECTED': 'A consultation is required before purchase. Please book an appointment.',
    
    // Appointment errors
    'APPOINTMENT_SLOT_TAKEN': 'This time slot is no longer available. Please select another time.',
    'APPOINTMENT_NOT_FOUND': 'Appointment not found.',
    'APPOINTMENT_CREATION_FAILED': 'Failed to book appointment. Please try again.',
    'APPOINTMENT_UPDATE_FAILED': 'Failed to update appointment. Please try again.',
    'APPOINTMENT_DELETE_FAILED': 'Failed to cancel appointment. Please try again.',
    'NO_AVAILABLE_SLOTS': 'No available appointment slots. Please try a different date or contact us.',
    
    // Network errors
    'NETWORK_ERROR': 'Connection failed. Please check your internet and try again.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'FETCH_FAILED': 'Failed to connect to server. Please try again later.',
    
    // Server errors
    'INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
    'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable. Please try again later.',
    'BAD_GATEWAY': 'Service error. Please try again later.',
    
    // Validation errors
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'MISSING_REQUIRED_FIELDS': 'Please fill in all required fields.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'INVALID_PHONE': 'Please enter a valid phone number.',
    
    // State/Product errors
    'STATE_NOT_SUPPORTED': 'This product is not available in your state.',
    'PRODUCT_NOT_AVAILABLE': 'This product is currently unavailable.',
    
    // Document errors
    'DOCUMENT_NOT_FOUND': 'Document not found.',
    'DOCUMENT_CREATION_FAILED': 'Failed to save document. Please try again.',
    
    // Rate limiting
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
    
    // Generic fallbacks
    'UNKNOWN_ERROR': 'An error occurred. Please try again.',
    'DEFAULT': 'Something went wrong. Please try again later.'
  };

  /**
   * Get user-friendly error message from error code or message
   * @param {string|Error} error - Error code, error message, or Error object
   * @returns {string} User-friendly error message
   */
  function getUserFriendlyMessage(error) {
    if (!error) return ERROR_MESSAGES.DEFAULT;
    
    // Handle Error objects
    let errorCode = null;
    let errorMessage = null;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorCode = error.code || error.name;
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorCode = error;
    } else if (error && typeof error === 'object') {
      errorCode = error.code || error.error || error.type;
      errorMessage = error.message || error.msg;
    }
    
    // Try to match error code first
    if (errorCode) {
      const codeUpper = String(errorCode).toUpperCase();
      if (ERROR_MESSAGES[codeUpper]) {
        return ERROR_MESSAGES[codeUpper];
      }
    }
    
    // Try to match error message
    if (errorMessage) {
      const msgUpper = String(errorMessage).toUpperCase();
      for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
        if (msgUpper.includes(key) || msgUpper.includes(key.replace(/_/g, ' '))) {
          return value;
        }
      }
    }
    
    // Return default message
    return ERROR_MESSAGES.DEFAULT;
  }

  /**
   * Get actionable guidance for error
   * @param {string|Error} error - Error code or Error object
   * @returns {string|null} Actionable guidance or null
   */
  function getActionableGuidance(error) {
    if (!error) return null;
    
    const errorCode = error instanceof Error ? (error.code || error.name) : error;
    const codeUpper = String(errorCode).toUpperCase();
    
    const guidance = {
      'PATIENT_NOT_FOUND': 'Complete a questionnaire to create your patient record.',
      'QUESTIONNAIRE_NOT_COMPLETED': 'Complete the questionnaire before proceeding to checkout.',
      'APPOINTMENT_SLOT_TAKEN': 'Select a different time slot from the available options.',
      'NETWORK_ERROR': 'Check your internet connection and try again.',
      'AUTHENTICATION_FAILED': 'Log out and log back in, then try again.',
      'STATE_NOT_SUPPORTED': 'Contact us to find out if this product is available in your area.',
      'RATE_LIMIT_EXCEEDED': 'Wait a few seconds before trying again.'
    };
    
    return guidance[codeUpper] || null;
  }

  /**
   * Check if error is transient (should retry)
   * @param {string|Error} error - Error code or Error object
   * @returns {boolean} True if error is transient
   */
  function isTransientError(error) {
    if (!error) return false;
    
    const errorCode = error instanceof Error ? (error.code || error.name) : error;
    const codeUpper = String(errorCode).toUpperCase();
    
    const transientErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'FETCH_FAILED',
      'SERVICE_UNAVAILABLE',
      'BAD_GATEWAY',
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL_ERROR'
    ];
    
    return transientErrors.includes(codeUpper);
  }

  // Export to global namespace
  window.SXRX = window.SXRX || {};
  window.SXRX.ErrorMessages = {
    getUserFriendlyMessage,
    getActionableGuidance,
    isTransientError,
    ERROR_MESSAGES
  };
})();
