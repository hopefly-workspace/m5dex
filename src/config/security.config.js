/**
 * Security Configuration
 * Centralized security settings
 */

export const securityConfig = {
  // API Configuration (same-origin /api; proxy/rewrite se CORS nahi aata)
  api: {
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3', 10),
  },

  // CSRF Protection
  csrf: {
    enabled: import.meta.env.VITE_ENABLE_CSRF === 'true',
    tokenLength: 64,
  },

  // Token Storage
  tokens: {
    storageKey: import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ark_auth_token',
    refreshKey: import.meta.env.VITE_REFRESH_TOKEN_KEY || 'ark_refresh_token',
    storageType: 'sessionStorage', // More secure than localStorage
  },

  // Rate Limiting
  rateLimit: {
    enabled: true,
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },

  // Input Validation
  validation: {
    maxStringLength: 10000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
  },

  // Security Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  },

  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust based on needs
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", '/api'],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
};

export default securityConfig;

