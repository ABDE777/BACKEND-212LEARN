import { createRequire } from 'module';
import dns from 'dns/promises';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError } from '../middleware/error.js';

const require = createRequire(import.meta.url);
const rawDisposableDomains = require('disposable-email-domains');
const disposableDomainsSet = new Set(rawDisposableDomains);

// Extra known temporary/disposable services
const extraDisposableDomains = [
  'tempmail.com', 'temp-mail.org', 'tempmail.io', 'tempmail.net',
  '10minutemail.com', '10minutemail.net', '10minmail.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.biz',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
  'mailinator.com', 'mailinator2.com', 'mailinater.com',
  'mohmal.com', 'dispostable.com', 'trashmail.com', 'trashmail.net',
  'getairmail.com', 'fakemailgenerator.com', 'generator.email',
  'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  'inboxkitten.com', 'burnermail.io', 'mytemp.email', 'crazymailing.com'
];
extraDisposableDomains.forEach((d) => disposableDomainsSet.add(d));

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
 * Check if domain is a known disposable/temporary email provider.
 * @param {string} email
 * @returns {boolean}
 */
export const isDisposableEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase().trim();
  return disposableDomainsSet.has(domain);
};

/**
 * Check if the email domain has active DNS MX records.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export const hasValidMxRecord = async (email) => {
  try {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].toLowerCase().trim();
    // 3.5 second timeout guard so DNS hiccups never block registration indefinitely
    const resolveWithTimeout = Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 3500)),
    ]);
    const mxRecords = await resolveWithTimeout;
    return Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (err) {
    if (err.message === 'DNS_TIMEOUT') return true; // Fail open on timeout to avoid blocking genuine users
    return false;
  }
};

/**
 * Validate email format and reject disposable/temporary email services.
 * @param {string} email - Email to validate
 * @throws {AppError} If email is invalid or disposable
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new AppError('Format d\'adresse email invalide.', 400, 'VALIDATION_ERROR');
  }

  if (isDisposableEmail(email)) {
    throw new AppError(
      'Les adresses emails temporaires ou jetables (tempmail) ne sont pas autorisées. Veuillez utiliser une adresse email valide et permanente.',
      400,
      'VALIDATION_ERROR'
    );
  }
};

/**
 * Async validation: format + disposable check + DNS MX check.
 * @param {string} email
 */
export const validateEmailAsync = async (email) => {
  validateEmail(email);

  const hasMx = await hasValidMxRecord(email);
  if (!hasMx) {
    throw new AppError(
      'Le domaine de cette adresse email ne possède pas de serveur de messagerie valide ou n\'existe pas.',
      400,
      'VALIDATION_ERROR'
    );
  }
};

/**
 * Validate phone number using libphonenumber-js.
 * Enforces valid international phone formats (defaults to Morocco 'MA' if country not specified).
 * @param {string} phone - Raw phone number string
 * @param {string} defaultCountry - Default country code (e.g. 'MA', 'FR', etc.)
 * @returns {string|null} - Formatted international phone number or null
 * @throws {AppError} If phone number is invalid
 */
export const validatePhoneNumber = (phone, defaultCountry = 'MA') => {
  if (!phone || !String(phone).trim()) return null;
  const raw = String(phone).trim();

  const phoneNumber = parsePhoneNumberFromString(raw, defaultCountry);
  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new AppError(
      'Numéro de téléphone invalide. Veuillez saisir un numéro de téléphone valide avec son indicatif (ex: +212 6 12 34 56 78 ou 06 12 34 56 78).',
      400,
      'VALIDATION_ERROR'
    );
  }

  return phoneNumber.formatInternational();
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
