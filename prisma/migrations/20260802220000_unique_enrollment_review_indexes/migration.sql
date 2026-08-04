-- Deduplicate enrollments before adding unique(userId, courseId).
-- Prefer enrollment that has a PAID payment, else any payment, else newest.

WITH ranked_enrollments AS (
  SELECT
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e."userId", e."courseId"
      ORDER BY
        CASE COALESCE(p.status, '')
          WHEN 'PAID' THEN 0
          WHEN 'WAITING_VERIFICATION' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'REJECTED' THEN 3
          WHEN 'REFUNDED' THEN 4
          ELSE 5
        END,
        e."enrolledAt" DESC
    ) AS rn
  FROM "enrollments" AS e
  LEFT JOIN "payments" AS p ON p."enrollmentId" = e.id
)
DELETE FROM "enrollments"
WHERE id IN (SELECT id FROM ranked_enrollments WHERE rn > 1);

-- Deduplicate reviews before adding unique(userId, courseId). Keep newest.
WITH ranked_reviews AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "courseId"
      ORDER BY "reviewDate" DESC
    ) AS rn
  FROM "reviews"
)
DELETE FROM "reviews"
WHERE id IN (SELECT id FROM ranked_reviews WHERE rn > 1);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_userId_courseId_key"
  ON "enrollments"("userId", "courseId");

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_userId_courseId_key"
  ON "reviews"("userId", "courseId");

-- Performance indexes
CREATE INDEX IF NOT EXISTS "enrollments_userId_idx" ON "enrollments"("userId");
CREATE INDEX IF NOT EXISTS "enrollments_courseId_idx" ON "enrollments"("courseId");
CREATE INDEX IF NOT EXISTS "payments_status_provider_idx" ON "payments"("status", "provider");
CREATE INDEX IF NOT EXISTS "reviews_courseId_idx" ON "reviews"("courseId");
