import { getJaasConfig, signJaasJwt } from './jaas.js';

// Mock environment variables
const originalEnv = process.env;

describe('JaaS Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getJaasConfig', () => {
    it('should return configuration when all environment variables are set', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      process.env.JAAS_DOMAIN = 'test.domain.com';

      const config = getJaasConfig();

      expect(config).toEqual({
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

      expect(config.domain).toBe('8x8.vc');
    });

    it('should throw error when JAAS_APP_ID is missing', () => {
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      delete process.env.JAAS_APP_ID;

      expect(() => getJaasConfig()).toThrow('JAAS_APP_ID is required');
    });

    it('should throw error when JAAS_API_KEY_ID is missing', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      delete process.env.JAAS_API_KEY_ID;

      expect(() => getJaasConfig()).toThrow('JAAS_API_KEY_ID is required');
    });

    it('should throw error when JAAS_PRIVATE_KEY is missing', () => {
      process.env.JAAS_APP_ID = 'test-app-id';
      process.env.JAAS_API_KEY_ID = 'test-api-key-id';
      delete process.env.JAAS_PRIVATE_KEY;

      expect(() => getJaasConfig()).toThrow('JAAS_PRIVATE_KEY is required');
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

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
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

      expect(payload.iss).toBe('chat');
      expect(payload.aud).toBe('jitsi');
      expect(payload.sub).toBe('test-app-id');
      expect(payload.room).toBe(roomSlug);
      expect(payload.context.user.id).toBe(user.id);
      expect(payload.context.user.name).toBe(user.name);
      expect(payload.context.user.email).toBe(user.email);
      expect(payload.context.user.moderator).toBe(moderator);
    });

    it('should set correct moderator features', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(payload.context.features.livestreaming).toBe(true);
      expect(payload.context.features.recording).toBe(true);
      expect(payload.context.features.transcription).toBe(true);
      expect(payload.context.features['file-upload']).toBe(true);
    });

    it('should set correct participant features', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = false;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(payload.context.features.livestreaming).toBe(false);
      expect(payload.context.features.recording).toBe(false);
      expect(payload.context.features.transcription).toBe(false);
      expect(payload.context.features['file-upload']).toBe(false);
    });

    it('should set correct expiration time', () => {
      const user = { id: 'user-123', name: 'Test User' };
      const roomSlug = 'test-room-123';
      const moderator = true;
      const ttlMinutes = 60;

      const now = Math.floor(Date.now() / 1000);
      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(payload.exp).toBeGreaterThan(now);
      expect(payload.exp).toBeLessThanOrEqual(now + ttlMinutes * 60 + 5); // Allow 5 second buffer
      expect(payload.nbf).toBeLessThanOrEqual(now);
    });

    it('should handle missing user fields gracefully', () => {
      const user = { id: 'user-123' }; // Missing name, email, avatar
      const roomSlug = 'test-room-123';
      const moderator = false;
      const ttlMinutes = 60;

      const token = signJaasJwt({ user, roomSlug, moderator, ttlMinutes });
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(payload.context.user.id).toBe('user-123');
      expect(payload.context.user.name).toBe('Participant');
      expect(payload.context.user.email).toBe('');
      expect(payload.context.user.avatar).toBe('');
    });
  });
});
