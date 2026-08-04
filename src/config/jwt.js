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
