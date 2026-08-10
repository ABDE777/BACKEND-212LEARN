import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getJaasConfig, signJaasJwt } from './jaas.js';

// Mock environment variables
const originalEnv = { ...process.env };

describe('JaaS Configuration', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getJaasConfig', () => {
    it('should return configuration when all environment variables are set', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      process.env.JAAS_DOMAIN = 'test.domain.com';

      const config = getJaasConfig();

      assert.deepEqual(config, {
        appId: 'test-app-id',
        apiKeyId: 'test-api-key-id',
        privateKey: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
        domain: 'test.domain.com',
      });
    });

    it('should use default domain when JAAS_DOMAIN is not set', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      delete process.env.JAAS_DOMAIN;

      const config = getJaasConfig();

      assert.equal(config.domain, '8x8.vc');
    });

    it('should throw error when JAAS_APP_ID is missing', () => {
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      delete process.env.JAAS_APP_ID;

      assert.throws(() => getJaasConfig(), /JAAS_APP_ID is required/);
    });

    it('should throw error when JAAS_API_KEY_ID is missing', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      delete process.env.JAAS_API_KEY_ID;

      assert.throws(() => getJaasConfig(), /JAAS_API_KEY_ID is required/);
    });

    it('should throw error when JAAS_PRIVATE_KEY is missing', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      delete process.env.JAAS_PRIVATE_KEY;

      assert.throws(() => getJaasConfig(), /JAAS_PRIVATE_KEY is required/);
    });
  });

  describe('signJaasJwt', () => {
    beforeEach(() => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCyfZOkWMIsnwD6
ADJKNhT3SgMINFQOk7vEmYcuSTLwaT7LVKCVdcOpa/8N8rKBPf/rPyn06S7n3/Es
HyN9/O+HlIUMb2PYiC82u+v50PTa0ylXT9ZRUENnbeBPauoYwrkMJ8flNAoqpC/J
7VzZPSwLkZEy4D/uIJUDS3++gfsZUWzcHvxxmrC7Dmr2CcULkXg51CYMQOm
-----END PRIVATE KEY-----`;
      process.env.JAAS_DOMAIN = '8x8.vc';
    });

    it('should generate a valid JWT token', () => {
      const user = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
      };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });

      assert.ok(token);
      assert.equal(typeof token, 'string');
      assert.equal(token.split('.').length, 3); // JWT has 3 parts
    });

    it('should include correct claims in the token', () => {
      const user = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });

      // Decode the token (without verification for testing purposes)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      assert.equal(payload.iss, 'chat');
      assert.equal(payload.aud, 'jitsi');
      assert.equal(payload.sub, 'test-app-id');
      assert.equal(payload.room, roomSlug);
      assert.equal(payload.context.user.id, user.id);
      assert.equal(payload.context.user.name, user.name);
      assert.equal(payload.context.user.email, user.email);
      assert.equal(payload.context.user.moderator, moderator);
    });

    it('should set correct moderator features', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      assert.equal(payload.context.features.livestreaming, true);
      assert.equal(payload.context.features.recording, true);
      assert.equal(payload.context.features.transcription, true);
      assert.equal(payload.context.features['file-upload'], true);
    });

    it('should set correct participant features', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = false;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      assert.equal(payload.context.features.livestreaming, false);
      assert.equal(payload.context.features.recording, false);
      assert.equal(payload.context.features.transcription, false);
      assert.equal(payload.context.features['file-upload'], false);
    });

    it('should set correct expiration time', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const now = Math.floor(Date.now() / 1000);
      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      assert.ok(payload.exp > now);
      assert.ok(payload.exp <= now + ttlMinutes * 60 + 5); // Allow 5 second buffer
      assert.ok(payload.nbf <= now);
    });

    it('should handle missing user fields gracefully', () => {
      const user = { id: 'user-123' }; // Missing name, email, avatar
      const roomSlug = 'test-room-123';
      const moderator = false;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      assert.equal(payload.context.user.id, 'user-123');
      assert.equal(payload.context.user.name, 'Participant');
      assert.equal(payload.context.user.email, '');
      assert.equal(payload.context.user.avatar, '');
    });
  });
});
