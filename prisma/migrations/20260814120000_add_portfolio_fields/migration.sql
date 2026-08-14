-- Portfolio fields on users (skills, languages, certifications, diplomas,
-- social links). JSONB, nullable. IF NOT EXISTS keeps the migration replay-safe
-- and a no-op on a DB where these were already added via db push.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "skills" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "languages" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "certifications" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "diplomas" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB;
