-- Course listing / filter indexes
CREATE INDEX IF NOT EXISTS "courses_status_deletedAt_idx" ON "courses"("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "courses_categoryId_idx" ON "courses"("categoryId");

-- Course instructor assignment uniqueness + lookup
DELETE FROM "course_instructors" a
USING "course_instructors" b
WHERE a.id > b.id
  AND a."courseId" = b."courseId"
  AND a."userId" = b."userId";

CREATE UNIQUE INDEX IF NOT EXISTS "course_instructors_courseId_userId_key"
  ON "course_instructors"("courseId", "userId");

CREATE INDEX IF NOT EXISTS "course_instructors_userId_idx" ON "course_instructors"("userId");
