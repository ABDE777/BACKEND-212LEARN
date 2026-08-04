import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getJwtSecret } from '../../src/config/jwt.js';

describe('getJwtSecret', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'my-secret';
    process.env.NODE_ENV = 'production';
    assert.equal(getJwtSecret(), 'my-secret');
  });

  it('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
  });

  it('allows a dev fallback outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    assert.equal(getJwtSecret(), 'dev-secret-key-212learn');
  });
});
