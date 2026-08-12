import { randomUUID } from 'crypto';

/**
 * Attach a request id for log correlation.
 * Honors incoming `x-request-id` from proxies/clients when present.
 */
export const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

/**
 * Redact secrets that appear as URL path segments so they never reach the logs.
 * Currently: the single-use password-reset token in /auth/reset-password/<token>.
 */
const redactSensitivePath = (url) => {
  if (!url) return url;
  return url.replace(/(\/auth\/reset-password\/)[^/?#]+/i, '$1[REDACTED]');
};

/**
 * Lightweight structured access logger (JSON lines).
 * Skips noisy health checks.
 */
export const accessLogger = (req, res, next) => {
  if (req.path === '/health') return next();

  const started = Date.now();
  res.on('finish', () => {
    const entry = {
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      msg: 'request',
      requestId: req.requestId,
      method: req.method,
      path: redactSensitivePath(req.originalUrl || req.url),
      status: res.statusCode,
      durationMs: Date.now() - started,
    };
    const line = JSON.stringify(entry);
    if (entry.level === 'error') console.error(line);
    else if (entry.level === 'warn') console.warn(line);
    else if (process.env.NODE_ENV !== 'test') console.log(line);
  });

  next();
};
