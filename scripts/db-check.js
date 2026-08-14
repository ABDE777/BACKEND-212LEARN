#!/usr/bin/env node
/**
 * db-check — read-only health check for the 212LEARN database.
 *
 * Verifies connectivity, that the expected tables/columns exist, that the
 * Prisma migration history is clean (no failed / unfinished migrations), and
 * prints row counts for the core tables. Exits non-zero if connectivity fails
 * or a required table/column is missing, so it can double as a CI / post-deploy
 * smoke check:  npm run db:check
 */
import prisma from '../src/config/prisma.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}!${RESET} ${m}`);
const fail = (m) => console.log(`${RED}✗${RESET} ${m}`);
const head = (m) => console.log(`\n${DIM}── ${m} ──${RESET}`);

// Required (table, column, expected-type-substring | null = presence only).
const REQUIRED_COLUMNS = [
  ['student_profiles', 'experienceYears', 'character varying'],
  ['instructor_profiles', 'expertiseDomain', 'character varying'],
  ['instructor_profiles', 'experienceYears', 'character varying'],
  ['users', 'passwordChangedAt', 'timestamp'],
  ['users', 'socialLinks', 'jsonb'],
  ['users', 'certifications', 'jsonb'],
];

async function main() {
  let problems = 0;

  // 1. Connectivity ──────────────────────────────────────────────────────────
  head('Connectivity');
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok('database reachable');
  } catch (err) {
    fail(`cannot reach database: ${err.message}`);
    // Nothing else will work — bail out hard.
    process.exitCode = 1;
    return;
  }

  // 2. Required tables & columns ───────────────────────────────────────────────
  head('Schema (required tables & columns)');
  for (const [table, column, expectedType] of REQUIRED_COLUMNS) {
    const rows = await prisma.$queryRaw`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
      LIMIT 1
    `;
    if (rows.length === 0) {
      fail(`${table}.${column} — MISSING`);
      problems++;
    } else if (expectedType && !rows[0].data_type.includes(expectedType)) {
      warn(`${table}.${column} — present but type is "${rows[0].data_type}" (expected ~"${expectedType}")`);
    } else {
      ok(`${table}.${column} — ${rows[0].data_type}`);
    }
  }

  // 3. Migration history ───────────────────────────────────────────────────────
  head('Migration history (_prisma_migrations)');
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at ASC
    `;
    if (migrations.length === 0) {
      warn('no rows in _prisma_migrations (schema may have been applied via db push)');
    }
    // A migration_name can legitimately have several rows: a failed/rolled-back
    // attempt followed by a successful re-apply (what `resolve --rolled-back` +
    // `migrate deploy` leaves behind). Group by name — a later success supersedes
    // earlier failed attempts, so only flag a name that has NO successful row.
    const byName = new Map();
    for (const m of migrations) {
      if (!byName.has(m.migration_name)) byName.set(m.migration_name, []);
      byName.get(m.migration_name).push(m);
    }
    for (const [name, rows] of byName) {
      const applied = rows.some((r) => r.finished_at && !r.rolled_back_at);
      const superseded = rows.length - (applied ? 1 : 0);
      if (applied) {
        const note = superseded > 0
          ? ` ${DIM}(superseded ${superseded} earlier failed attempt${superseded > 1 ? 's' : ''})${RESET}`
          : '';
        ok(`${name}${note}`);
      } else if (rows.some((r) => r.rolled_back_at)) {
        fail(`${name} — ROLLED BACK / failed, never re-applied`);
        problems++;
      } else {
        fail(`${name} — not finished (in progress or failed mid-apply)`);
        problems++;
      }
    }
  } catch (err) {
    warn(`could not read _prisma_migrations: ${err.message}`);
  }

  // 4. Row counts ───────────────────────────────────────────────────────────────
  head('Row counts');
  const [
    usersByRole,
    courses,
    enrollments,
    paymentsByStatus,
    coupons,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }).catch(() => null),
    prisma.course.count().catch(() => null),
    prisma.enrollment.count().catch(() => null),
    prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }).catch(() => null),
    prisma.coupon.count().catch(() => null),
  ]);

  if (usersByRole) {
    const total = usersByRole.reduce((s, r) => s + r._count._all, 0);
    const breakdown = usersByRole.map((r) => `${r.role}:${r._count._all}`).join(', ');
    ok(`users: ${total} ${DIM}(${breakdown})${RESET}`);
  }
  if (courses !== null) ok(`courses: ${courses}`);
  if (enrollments !== null) ok(`enrollments: ${enrollments}`);
  if (paymentsByStatus) {
    const total = paymentsByStatus.reduce((s, r) => s + r._count._all, 0);
    const breakdown = paymentsByStatus.map((r) => `${r.status}:${r._count._all}`).join(', ') || 'none';
    ok(`payments: ${total} ${DIM}(${breakdown})${RESET}`);
  }
  if (coupons !== null) ok(`coupons: ${coupons}`);

  // Summary ─────────────────────────────────────────────────────────────────────
  head('Summary');
  if (problems === 0) {
    ok('all checks passed');
  } else {
    fail(`${problems} problem(s) found — see above`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    fail(`unexpected error: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
