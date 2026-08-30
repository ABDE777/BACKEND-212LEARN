-- Additional categories a course belongs to, beyond its required primary
-- categoryId. Lets a course be discoverable under several categories.
-- Additive & idempotent: the existing courses.categoryId column is untouched.

CREATE TABLE IF NOT EXISTS "course_categories" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_categories_courseId_categoryId_key" ON "course_categories" ("courseId", "categoryId");
CREATE INDEX IF NOT EXISTS "course_categories_categoryId_idx" ON "course_categories" ("categoryId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_categories_courseId_fkey') THEN
    ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_categories_categoryId_fkey') THEN
    ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
