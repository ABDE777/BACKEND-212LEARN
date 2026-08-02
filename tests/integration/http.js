import http from 'http';

const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';
const ROOT = BASE.replace(/\/api\/v1\/?$/, '');

export function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

export async function isServerUp() {
  try {
    const res = await request('GET', `${ROOT}/health`);
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function login(email, password = 'password123') {
  const res = await request('POST', '/auth/login', { email, password });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}
