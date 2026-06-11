/**
 * Input Validation Utilities
 * Comprehensive validation for all input types
 */

import { validateEmail, validateURL, validateLength, sanitizeInput } from './security.js';

/**
 * Validate and sanitize text input
 */
export const validateText = (value, options = {}) => {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    pattern = null,
    sanitize = true,
  } = options;

  if (required && (!value || value.trim().length === 0)) {
    return { isValid: false, error: 'This field is required' };
  }

  if (!value) {
    return { isValid: true, value: '' };
  }

  let sanitizedValue = sanitize ? sanitizeInput(value) : value;

  if (!validateLength(sanitizedValue, minLength, maxLength)) {
    return {
      isValid: false,
      error: `Length must be between ${minLength} and ${maxLength} characters`,
    };
  }

  if (pattern && !pattern.test(sanitizedValue)) {
    return { isValid: false, error: 'Invalid format' };
  }

  return { isValid: true, value: sanitizedValue };
};

/**
 * Validate email
 */
export const validateEmailInput = (email, required = false) => {
  if (required && (!email || email.trim().length === 0)) {
    return { isValid: false, error: 'Email is required' };
  }

  if (!email) {
    return { isValid: true, value: '' };
  }

  const sanitized = sanitizeInput(email.trim().toLowerCase());

  if (!validateEmail(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Validate URL
 */
export const validateURLInput = (url, required = false) => {
  if (required && (!url || url.trim().length === 0)) {
    return { isValid: false, error: 'URL is required' };
  }

  if (!url) {
    return { isValid: true, value: '' };
  }

  const sanitized = sanitizeInput(url.trim());

  if (!validateURL(sanitized)) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  return { isValid: true, value: sanitized };
};

/**
 * Strip spaces and comma group separators so "1,268.37" parses like 1268.37 (common in locale-formatted inputs).
 */
export const normalizeDecimalInputString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim().replace(/[\s,]/g, '');
};

/** Parse a user-entered decimal; NaN if empty or not a finite number. */
export const parseDecimalInput = (value) => {
  const s = normalizeDecimalInputString(value);
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Validate number
 */
export const validateNumber = (value, options = {}) => {
  const {
    required = false,
    min = -Infinity,
    max = Infinity,
    integer = false,
  } = options;

  const isEmptyString = typeof value === 'string' && value.trim() === '';

  if (required && (value === null || value === undefined || value === '' || isEmptyString)) {
    return { isValid: false, error: 'This field is required' };
  }

  if (value === null || value === undefined || value === '' || isEmptyString) {
    return { isValid: true, value: null };
  }

  const num = Number(normalizeDecimalInputString(value));

  if (isNaN(num)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, error: 'Must be an integer' };
  }

  if (num < min || num > max) {
    return { isValid: false, error: `Must be between ${min} and ${max}` };
  }

  return { isValid: true, value: num };
};

/**
 * Validate phone number (national or international).
 * @param {object} [options]
 * @param {boolean} [options.international=false] - Use 7–15 digits (E.164) for any country
 * @param {number} [options.minDigits] - Override minimum digit count
 * @param {number} [options.maxDigits=15] - Maximum digit count
 */
export const validatePhone = (phone, required = false, options = {}) => {
  const international = options.international === true;
  const minDigits = options.minDigits ?? (international ? 7 : 10);
  const maxDigits = options.maxDigits ?? 15;

  if (required && (!phone || phone.trim().length === 0)) {
    return { isValid: false, error: 'Phone number is required' };
  }

  if (!phone) {
    return { isValid: true, value: '' };
  }

  const trimmed = phone.trim();
  if (!/^[\d+\s().-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: international
        ? 'Use only digits, +, spaces, hyphens, or parentheses'
        : 'Invalid phone number format',
    };
  }

  const cleaned = trimmed.replace(/\D/g, '');
  const phoneRegex = new RegExp(`^[0-9]{${minDigits},${maxDigits}}$`);

  if (!phoneRegex.test(cleaned)) {
    return {
      isValid: false,
      error: international
        ? `Enter a valid phone number with country code (${minDigits}–${maxDigits} digits)`
        : 'Invalid phone number format',
    };
  }

  return { isValid: true, value: cleaned };
};

/**
 * Validate date
 */
export const validateDate = (date, options = {}) => {
  const { required = false, minDate = null, maxDate = null } = options;

  if (required && (!date || date.trim().length === 0)) {
    return { isValid: false, error: 'Date is required' };
  }

  if (!date) {
    return { isValid: true, value: null };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  if (minDate && dateObj < new Date(minDate)) {
    return { isValid: false, error: `Date must be after ${minDate}` };
  }

  if (maxDate && dateObj > new Date(maxDate)) {
    return { isValid: false, error: `Date must be before ${maxDate}` };
  }

  return { isValid: true, value: dateObj.toISOString() };
};

/**
 * Validate file
 */
export const validateFile = (file, options = {}) => {
  const {
    required = false,
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  if (required && !file) {
    return { isValid: false, error: 'File is required' };
  }

  if (!file) {
    return { isValid: true, value: null };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: `File size must be less than ${maxSize / 1024 / 1024}MB` };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'File type not allowed' };
  }

  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return { isValid: false, error: `File extension must be one of: ${allowedExtensions.join(', ')}` };
    }
  }

  return { isValid: true, value: file };
};

/**
 * Validate form data
 */
export const validateForm = (formData, schema) => {
  const errors = {};
  const values = {};

  for (const [key, validator] of Object.entries(schema)) {
    const result = validator(formData[key]);
    if (!result.isValid) {
      errors[key] = result.error;
    } else {
      values[key] = result.value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values,
  };
};

