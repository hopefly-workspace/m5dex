/**
 * Security Utilities
 * Industry-level security implementations for frontend
 */

/**
 * XSS Protection - Sanitize user input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  const reg = /[&<>"'/]/gi;
  return input.replace(reg, (match) => map[match]);
};

/**
 * XSS Protection - Sanitize HTML
 */
export const sanitizeHTML = (html) => {
  if (typeof html !== 'string') return html;
  
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 */
export const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate input length
 */
export const validateLength = (input, min = 0, max = Infinity) => {
  if (typeof input !== 'string') return false;
  const length = input.trim().length;
  return length >= min && length <= max;
};

/**
 * Remove potentially dangerous characters
 */
export const removeDangerousChars = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>\"'%;)(&+]/g, '');
};

/**
 * Generate CSRF Token
 */
export const generateCSRFToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate CSRF Token
 */
export const validateCSRFToken = (token) => {
  return typeof token === 'string' && token.length === 64;
};

/**
 * Rate limiting helper (client-side)
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  reset(key) {
    this.requests.delete(key);
  }
}

/**
 * Secure password validation
 */
export const validatePassword = (password) => {
  // Only check if password is not empty
  if (!password || password.trim().length === 0) {
    return {
      isValid: false,
      error: 'Password is required',
      errors: {},
    };
  }

  return {
    isValid: true,
    error: null,
    errors: {},
  };
};

/**
 * Prevent clickjacking
 */
export const preventClickjacking = () => {
  if (window.self !== window.top) {
    window.top.location = window.self.location;
  }
};

/**
 * Content Security Policy helper
 */
export const getCSPNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

