import { AppError } from './error.js';

// Hand-rolled server-side input sanitizer (no DOM dependency needed for text).
const sanitizeValue = (value, key = '') => {
  // Skip sanitization for experienceYears field which contains valid enum values with < and >
  if (key === 'experienceYears' && typeof value === 'string') {
    return value.trim();
  }
  
  if (typeof value === 'string') {
    // Strip angle brackets so stored text can't carry HTML/script tags. Do NOT
    // HTML-entity-encode quotes/ampersands here: escaping is an OUTPUT concern,
    // React already escapes on render, and encoding on input corrupted stored
    // text (apostrophes were saved and shown as "&#x27;").
    return value.replace(/[<>]/g, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, index));
  }
  if (value !== null && typeof value === 'object') {
    const newObj = {};
    for (const key of Object.keys(value)) {
      newObj[key] = sanitizeValue(value[key], key);
    }
    return newObj;
  }
  return value;
};

// ─── Rate limit store (memory + optional Upstash Redis REST) ─────────────────
const rateLimitCache = new Map();
const CLEANUP_EVERY_MS = 60_000;
let lastCleanupAt = Date.now();

function cleanupMemoryStore(windowMs) {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_EVERY_MS) return;
  lastCleanupAt = now;
  for (const [key, timestamps] of rateLimitCache.entries()) {
    const active = timestamps.filter((t) => now - t < windowMs);
    if (active.length === 0) rateLimitCache.delete(key);
    else rateLimitCache.set(key, active);
  }
}

function clientKey(req, prefix) {
  // req.ip is trust-proxy-aware (see app.set('trust proxy', ...) in index.js): with
  // exactly one trusted hop configured, Express takes the IP the platform's edge
  // proxy appended to X-Forwarded-For, not whatever a client puts in that header.
  // Do NOT parse req.headers['x-forwarded-for'] directly here — a client can set
  // that header to any value, which previously let requests dodge rate limiting
  // by sending a different fake IP on every request.
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${prefix}:${ip}`;
}

async function upstashIncr(key, windowMs) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;

  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  const windowStart = now - windowMs;

  // Sliding window via sorted set
  const pipeline = [
    ['ZREMRANGEBYSCORE', key, 0, windowStart],
    ['ZADD', key, now, member],
    ['ZCARD', key],
    ['PEXPIRE', key, windowMs],
  ];

  const res = await fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  });

  if (!res.ok) {
    console.warn('[rateLimit] Upstash pipeline failed:', res.status);
    return null;
  }

  const results = await res.json();
  // ZCARD result is 3rd command → results[2].result
  const count = Number(results?.[2]?.result ?? 0);
  return Number.isFinite(count) ? count : null;
}

function memoryIncr(key, windowMs) {
  cleanupMemoryStore(windowMs);
  const now = Date.now();
  const requests = (rateLimitCache.get(key) || []).filter((t) => now - t < windowMs);
  requests.push(now);
  rateLimitCache.set(key, requests);
  return requests.length;
}

/**
 * Creates a rate limiter middleware.
 * Uses Upstash Redis REST when UPSTASH_REDIS_REST_URL + TOKEN are set (recommended on Vercel).
 * Falls back to in-memory sliding window (per-instance only on serverless).
 *
 * @param {number} windowMs
 * @param {number} maxRequests
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.prefix] - key prefix (e.g. 'auth', 'global')
 * @param {boolean} [options.enforceInDev] - also enforce in development (default false)
 * @param {(req) => (string|null)} [options.keyBy] - derive the bucket key from the
 *        request (e.g. the target account email) instead of the client IP. When it
 *        returns a falsy value the limiter is skipped for that request. Use this for
 *        per-account throttling (password reset / OTP) so an attacker cannot spread
 *        an attack on one account across many IPs.
 */
export const rateLimiter = (
  windowMs = 60000,
  maxRequests = 100,
  message = 'Too many requests. Please try again later.',
  options = {}
) => {
  const { prefix = 'rl', enforceInDev = false, keyBy = null } = options;

  return async (req, res, next) => {
    try {
      if (process.env.NODE_ENV === 'test') return next();
      if (process.env.NODE_ENV === 'development' && !enforceInDev) return next();

      // In production, require Upstash Redis for distributed rate limiting
      if (process.env.NODE_ENV === 'production') {
        const base = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!base || !token) {
          console.error('[rateLimit] FATAL: Upstash Redis credentials missing in production');
          return next(new AppError(
            'Server configuration error: Rate limiting infrastructure not available',
            500,
            'SERVER_CONFIGURATION_ERROR'
          ));
        }
      }

      let key;
      if (keyBy) {
        const sub = keyBy(req);
        if (!sub) return next(); // nothing to key on for this request → skip
        key = `${prefix}:${String(sub).trim().toLowerCase()}`;
      } else {
        key = clientKey(req, prefix);
      }
      let count = await upstashIncr(key, windowMs);
      if (count === null) {
        count = memoryIncr(key, windowMs);
      }

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));

      if (count > maxRequests) {
        return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
      }

      next();
    } catch (error) {
      // Fail open on rate-limit infrastructure errors (don't take the API down)
      console.warn('[rateLimit] error, allowing request:', error.message);
      next();
    }
  };
};

// ─── 2. Input XSS Sanitizer ────────────────────────────────────────────────
export const xssSanitizer = (req, res, next) => {
  if (req.body)  req.body  = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

// ─── 3. HTTP Parameter Pollution (HPP) Preventer ───────────────────────────
export const preventParameterPollution = (req, res, next) => {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0];
      }
    }
  }
  next();
};
