import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/error.js';

function getPrivateKey() {
  const raw = process.env.JAAS_PRIVATE_KEY;
  if (!raw) {
    throw new AppError('JAAS_PRIVATE_KEY environment variable is required.', 500, 'JAAS_NOT_CONFIGURED');
  }
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export function getJaasConfig() {
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_API_KEY_ID;
  const domain = process.env.JAAS_DOMAIN || '8x8.vc';

  if (!appId || !kid) {
    throw new AppError('JAAS_APP_ID and JAAS_API_KEY_ID environment variables are required.', 500, 'JAAS_NOT_CONFIGURED');
  }
  return { appId, kid, domain };
}

/**
 * Sign a JaaS JWT scoped to one user, one room, one meeting window.
 * @param {object} params
 * @param {{id:string,firstName:string,lastName:string,email:string,avatar?:string}} params.user
 * @param {string} params.roomSlug     - the room part only, WITHOUT the AppID prefix.
 * @param {boolean} params.moderator   - true for instructor/admin, false for students.
 * @param {number} [params.ttlMinutes] - token lifetime; default 120.
 */
export function signJaasJwt({ user, roomSlug, moderator, ttlMinutes = 120 }) {
  const { appId, kid } = getJaasConfig();
  const privateKey = getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: roomSlug,
    exp: now + ttlMinutes * 60,
    nbf: now - 10,
    context: {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        avatar: user.avatar || '',
        moderator: moderator ? 'true' : 'false',
      },
      features: {
        livestreaming: moderator,
        recording: moderator,
        transcription: moderator,
        'outbound-call': false,
      },
    },
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256', header: { kid } });
}
