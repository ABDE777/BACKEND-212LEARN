// ─── Fast In-Memory & Redis Response Cache ─────────────────────────────────────
// Caches public API responses (categories, published courses, stats) for high speed.

const memoryCache = new Map();

/**
 * Cache middleware for Express GET endpoints
 * @param {number} ttlSeconds Time-to-live in seconds
 */
export const cacheMiddleware = (ttlSeconds = 60) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authorized requests with sensitive user headers if needed,
    // or include authorization token in cache key
    const authHeader = req.headers.authorization || '';
    const cacheKey = `${req.originalUrl || req.url}__auth:${authHeader.slice(-12)}`;

    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      return res.status(cached.status).json(cached.body);
    }

    // Intercept res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(cacheKey, {
          status: res.statusCode,
          body,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate cached endpoints by URL prefix or pattern
 * @param {string} keyPattern Partial match string (e.g. '/api/v1/courses')
 */
export const clearCachePattern = (keyPattern) => {
  for (const key of memoryCache.keys()) {
    if (key.includes(keyPattern)) {
      memoryCache.delete(key);
    }
  }
};
