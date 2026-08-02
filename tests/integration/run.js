/**
 * Integration runner — skips cleanly when the API is down (CI-safe).
 * Set REQUIRE_SERVER=1 to fail instead of skip when the API is unreachable.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isServerUp } from './http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function runNode(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

const up = await isServerUp();
if (!up) {
  if (process.env.REQUIRE_SERVER === '1') {
    console.error('❌ API server required but not reachable at API_BASE_URL / localhost:5000');
    process.exit(1);
  }
  console.log('⏭️  Integration suite skipped (server offline). Unit tests still run via `npm test`.');
  process.exit(0);
}

const scripts = [
  path.join(__dirname, 'commerce.test.js'),
];

let failed = 0;
for (const script of scripts) {
  const code = await runNode(script);
  if (code !== 0) failed += 1;
}

process.exit(failed === 0 ? 0 : 1);
