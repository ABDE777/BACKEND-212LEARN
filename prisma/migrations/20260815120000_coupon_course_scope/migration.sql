-- Course-scoped coupons: a coupon may target a single course (null = global,
-- admin coupon) and record who created it. Columns are nullable; IF NOT EXISTS
-- and the guarded FK keep this migration replay-safe and a no-op where these
-- were already added via db push.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "courseId" UUID;
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "createdById" UUID;

CREATE INDEX IF NOT EXISTS "coupons_courseId_idx" ON "coupons"("courseId");
CREATE INDEX IF NOT EXISTS "coupons_createdById_idx" ON "coupons"("createdById");

DO $$ BEGIN
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
