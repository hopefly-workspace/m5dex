/**
 * Error Handler
 * Secure error handling without exposing sensitive information
 */

/**
 * Sanitize error messages for production
 */
export const sanitizeError = (error, isProduction = false) => {
  if (!isProduction) {
    return error;
  }

  // Don't expose internal errors in production
  const genericError = 'An error occurred. Please try again later.';

  // Only expose safe error messages
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Network error. Please check your connection.';
  }

  if (error.message && error.message.includes('timeout')) {
    return 'Request timeout. Please try again.';
  }

  if (error.message && error.message.includes('401')) {
    return 'Authentication required. Please login.';
  }

  if (error.message && error.message.includes('403')) {
    return 'Access denied.';
  }

  if (error.message && error.message.includes('404')) {
    return 'Resource not found.';
  }

  if (error.message && error.message.includes('429')) {
    return 'Too many requests. Please try again later.';
  }

  if (error.message && error.message.includes('500')) {
    return 'Server error. Please try again later.';
  }

  return genericError;
};

/**
 * Log error securely (don't log sensitive data)
 */
export const logError = (error, context = {}) => {
  const isProduction = import.meta.env.PROD;
  
  // Don't log sensitive information
  const safeContext = {
    ...context,
    // Remove sensitive fields
    password: undefined,
    token: undefined,
    authorization: undefined,
    apiKey: undefined,
  };

  if (isProduction) {
    // In production, send to error tracking service (e.g., Sentry)
    console.error('Error:', sanitizeError(error, true), safeContext);
  } else {
    // In development, show full error
    console.error('Error:', error, safeContext);
  }
};

/**
 * Error boundary helper
 */
export class SecurityError extends Error {
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

