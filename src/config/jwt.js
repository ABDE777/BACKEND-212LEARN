import crypto from 'crypto';

/**
 * Central JWT secret resolution.
 * Production MUST set JWT_SECRET — no silent fallback.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production.');
  }

  // Local/dev only
  return 'dev-secret-key-212learn';
}

/**
 * Validate JWT secret strength on startup.
 * Ensures the secret has sufficient entropy to prevent brute force attacks.
 */
export function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
    }
    console.warn('[JWT] Using development secret key. Set JWT_SECRET in production.');
    return;
  }

  // Check minimum length (at least 32 characters for reasonable entropy)
  if (secret.length < 32) {
    throw new Error(`FATAL: JWT_SECRET is too short (${secret.length} chars). Minimum 32 characters required for security.`);
  }

  // Check for common weak secrets
  const weakPatterns = [
    'secret', 'password', '123456', 'qwerty', 'admin', 'test',
    'jwt', 'key', 'token', 'auth', 'default', 'change'
  ];

  const lowerSecret = secret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      throw new Error(`FATAL: JWT_SECRET contains weak pattern "${pattern}". Use a cryptographically secure random secret.`);
    }
  }

  console.log('[JWT] Secret validation passed.');
}
