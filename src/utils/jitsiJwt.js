import jwt from 'jsonwebtoken';

/**
 * Generate Jitsi JWT token for JaaS authentication
 * @param {string} roomName - The room name for the meeting
 * @param {object} user - User object { id, name, email, avatar, moderator }
 * @param {boolean} isModerator - Whether the user is a moderator
 * @returns {string} JWT token
 */
export function generateJitsiToken(roomName, user, isModerator = false) {
  const appId = process.env.JITSI_APP_ID;
  const appSecret = process.env.JITSI_APP_SECRET;
  const domain = process.env.JITSI_DOMAIN || '8x8.vc';

  if (!appId || !appSecret) {
    throw new Error('JITSI_APP_ID and JITSI_APP_SECRET must be set in environment variables');
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7200; // 2 hours expiration

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    iat: now,
    exp: exp,
    nbf: now,
    sub: appId,
    context: {
      features: {
        livestreaming: isModerator,
        'file-upload': isModerator,
        'outbound-call': isModerator,
        'sip-outbound-call': false,
        transcription: isModerator,
        'list-visitors': false,
        recording: isModerator,
        flip: false,
      },
      user: {
        'hidden-from-recorder': false,
        moderator: isModerator,
        name: user.name || 'Participant',
        id: user.id || 'anonymous',
        avatar: user.avatar || '',
        email: user.email || '',
      },
    },
    room: roomName,
  };

  return jwt.sign(payload, appSecret, { algorithm: 'HS256' });
}

/**
 * Generate Jitsi meeting URL with JaaS domain
 * @param {string} roomName - The room name for the meeting
 * @returns {string} JaaS meeting URL
 */
export function generateJitsiUrl(roomName) {
  const appId = process.env.JITSI_APP_ID;
  const domain = process.env.JITSI_DOMAIN || '8x8.vc';
  
  if (!appId) {
    // Fallback to meet.jit.si if no JaaS configured
    return `https://meet.jit.si/${roomName}`;
  }
  
  // JaaS format: https://8x8.vc/<appId>/<roomName>
  return `https://${domain}/${appId}/${roomName}`;
}
