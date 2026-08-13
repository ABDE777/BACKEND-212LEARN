import { AppError } from '../middleware/error.js';

/**
 * Validate UUID format
 * @param {string} uuid - The UUID to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {AppError} If UUID is invalid
 */
export const validateUUID = (uuid, fieldName = 'ID') => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid || !uuidRegex.test(uuid)) {
    throw new AppError(`Invalid ${fieldName} format. UUID required.`, 400, 'VALIDATION_ERROR');
  }
  return true;
};

/**
 * Validate required fields
 * @param {object} body - Request body
 * @param {string[]} fields - Array of required field names
 * @throws {AppError} If any required field is missing
 */
export const validateRequired = (body, fields) => {
  const missing = fields.filter(field => {
    const val = body[field];
    return val === undefined || val === null || (typeof val === 'string' && !val.trim());
  });
  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}.`, 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @throws {AppError} If email is invalid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new AppError('Invalid email format.', 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate password strength.
 * Requires at least 8 characters and a mix of letters and numbers — a light
 * baseline that rejects the weakest passwords without frustrating users.
 * @param {string} password
 * @param {string} fieldName - Name of the field for error messages
 * @throws {AppError} If the password is too weak
 */
export const validatePassword = (password, fieldName = 'Password') => {
  const pw = String(password ?? '');
  if (pw.length < 8) {
    throw new AppError(`${fieldName} must be at least 8 characters.`, 400, 'VALIDATION_ERROR');
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw new AppError(`${fieldName} must contain both letters and numbers.`, 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate enum value
 * @param {*} value - Value to check
 * @param {string[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error message
 * @throws {AppError} If value is not in allowed values
 */
export const validateEnum = (value, allowedValues, fieldName = 'field') => {
  console.log('Validating:', value, 'against:', allowedValues, 'for field:', fieldName);
  if (!allowedValues.includes(value)) {
    throw new AppError(`Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}.`, 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate number range
 * @param {number} value - Value to check
 * @param {object} options - { min, max }
 * @param {string} fieldName - Name of the field for error message
 * @throws {AppError} If value is out of range
 */
export const validateNumberRange = (value, { min, max }, fieldName = 'field') => {
  if (min !== undefined && value < min) {
    throw new AppError(`${fieldName} must be at least ${min}.`, 400, 'VALIDATION_ERROR');
  }
  if (max !== undefined && value > max) {
    throw new AppError(`${fieldName} must be at most ${max}.`, 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate date string
 * @param {string} dateStr - Date string to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {AppError} If date is invalid
 */
export const validateDate = (dateStr, fieldName = 'date') => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName} format. Use ISO 8601 format.`, 400, 'VALIDATION_ERROR');
  }
  return date;
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {string} fieldName - Name of the field for error message
 * @throws {AppError} If URL is invalid
 */
export const validateURL = (url, fieldName = 'URL') => {
  try {
    new URL(url);
  } catch {
    throw new AppError(`Invalid ${fieldName} format.`, 400, 'VALIDATION_ERROR');
  }
};

/**
 * Validate that a value is an http(s) URL.
 * Rejects dangerous schemes like javascript: and data:, which the input
 * sanitizer does not strip and which become XSS sinks if the frontend renders
 * the value into an href/src (e.g. course thumbnails, avatars).
 * @param {string} url
 * @param {string} fieldName - Name of the field for error messages
 * @throws {AppError} If the URL is missing, malformed, or not http(s)
 */
export const validateHttpUrl = (url, fieldName = 'URL') => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(`Invalid ${fieldName} format.`, 400, 'VALIDATION_ERROR');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(`${fieldName} must be an http(s) URL.`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
};

/**
 * Common error codes for frontend reference
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
};
