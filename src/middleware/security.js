import { AppError } from './error.js';

// ─── 1. Memory-based Rate Limiter ──────────────────────────────────────────
// Simple, dependency-free sliding window rate limiter to protect auth/sensitive endpoints.
const rateLimitCache = new Map();

/**
 * Creates a rate limiter middleware.
 * @param {number} windowMs - Time window in milliseconds (e.g., 60000 for 1 minute)
 * @param {number} maxRequests - Max requests allowed in the window per IP
 * @param {string} message - Error message when rate limit is exceeded
 */
export const rateLimiter = (windowMs = 60000, maxRequests = 100, message = 'Too many requests. Please try again later.') => {
  return (req, res, next) => {
    // Skip rate limit in test/dev environments to prevent local test lockouts
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimitCache.has(ip)) {
      rateLimitCache.set(ip, []);
    }

    const requests = rateLimitCache.get(ip);
    // Filter out requests older than the sliding window
    const activeRequests = requests.filter((timestamp) => now - timestamp < windowMs);
    activeRequests.push(now);
    rateLimitCache.set(ip, activeRequests);

    if (activeRequests.length > maxRequests) {
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    next();
  };
};

// ─── 2. Input XSS Sanitizer ────────────────────────────────────────────────
// Recursively sanitizes string inputs to strip scripts, HTML tags, and suspicious protocols.
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // 1. Strip script tags and inline javascript
    let cleaned = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 2. Strip HTML tags generally to prevent code execution
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    // 3. Remove javascript: javascript/data/vbscript protocols
    cleaned = cleaned.replace(/(javascript|data|vbscript):/gi, '[removed]:');
    return cleaned.trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const newObj = {};
    for (const key of Object.keys(value)) {
      newObj[key] = sanitizeValue(value[key]);
    }
    return newObj;
  }
  return value;
};

/**
 * Middleware that sanitizes all incoming bodies, queries, and params to prevent XSS.
 */
export const xssSanitizer = (req, res, next) => {
  if (req.body)  req.body  = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

// ─── 3. HTTP Parameter Pollution (HPP) Preventer ───────────────────────────
/**
 * Middleware to protect against parameter pollution.
 * If query parameters are arrays instead of single strings when not expected,
 * it forces them to be the first string in the array.
 */
export const preventParameterPollution = (req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        // Force it to use only the first value
        req.query[key] = req.query[key][0];
      }
    }
  }
  next();
};
