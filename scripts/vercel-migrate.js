/**
 * Apply pending Prisma migrations on Vercel deploys.
 *
 * The Vercel build only runs `prisma generate` (via postinstall), so schema
 * changes shipped in prisma/migrations/ were never applied to the production
 * database — new tables (e.g. packs) ended up missing and their endpoints 500'd.
 *
 * This runs `prisma migrate deploy` ONLY during a Vercel build (VERCEL=1) with a
 * DATABASE_URL present, so local `npm install` is never affected. `migrate
 * deploy` is safe and idempotent at the migration-history level: it applies only
 * migrations not yet recorded in `_prisma_migrations`, and never resets data.
 */
import { execSync } from 'node:child_process';

const onVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

if (!onVercel || !process.env.DATABASE_URL) {
  console.log('[deploy] Skipping "prisma migrate deploy" (not a Vercel deploy or no DATABASE_URL).');
  process.exit(0);
}

try {
  console.log('[deploy] Applying pending Prisma migrations…');
  execSync('prisma migrate deploy', { stdio: 'inherit' });
  console.log('[deploy] Migrations up to date.');
} catch (err) {
  console.error('[deploy] "prisma migrate deploy" failed:', err.message);
  // Fail the build so a broken migration is visible and the previous (working)
  // deployment keeps serving instead of shipping a schema-mismatched build.
  process.exit(1);
}
