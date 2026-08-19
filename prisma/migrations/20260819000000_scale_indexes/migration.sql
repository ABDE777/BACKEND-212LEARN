-- Scalability hardening: indexes for the hottest / fastest-growing tables, plus
-- a one-time email normalization so index-using (case-sensitive) email lookups
-- match rows that were stored with mixed case. Written idempotently so it is a
-- no-op on databases already synced via `prisma db push`.

-- audit_logs grows fastest (one row per user action) and is filtered/sorted by
-- these columns; without indexes every audit-page load full-scans the table.
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx"    ON "audit_logs" ("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"    ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx"  ON "audit_logs" ("resource");

-- Per-user notification lookups + unread counts.
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications" ("userId", "isRead");

-- Phone availability check (signup) filters by phone; index it so it is not a
-- sequential scan at scale.
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users" ("phone");

-- Normalize any existing mixed-case/whitespace emails to lowercase+trimmed so
-- the index-using findUnique login matches them. No-op when already normalized;
-- the unique constraint guards against (already-absent) case-only duplicates.
UPDATE "users" SET "email" = LOWER(TRIM("email")) WHERE "email" <> LOWER(TRIM("email"));
