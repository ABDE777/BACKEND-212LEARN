-- Composite indexes for the hottest admin/user-listing filters.
CREATE INDEX IF NOT EXISTS "users_role_deletedAt_idx" ON "users" ("role", "deletedAt");
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users" ("deletedAt");
