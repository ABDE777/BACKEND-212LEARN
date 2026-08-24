-- Packs: bundles of existing courses at a reduced price, with a chosen
-- instructor per course and early-bird pricing. Idempotent.

CREATE TABLE IF NOT EXISTS "packs" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "thumbnail" VARCHAR(500),
    "price" DECIMAL(10,2) NOT NULL,
    "launchPrice" DECIMAL(10,2),
    "launchSeats" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'MAD',
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "packs_status_deletedAt_idx" ON "packs" ("status", "deletedAt");

CREATE TABLE IF NOT EXISTS "pack_courses" (
    "id" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "instructorId" UUID NOT NULL,
    CONSTRAINT "pack_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pack_courses_packId_courseId_key" ON "pack_courses" ("packId", "courseId");
CREATE INDEX IF NOT EXISTS "pack_courses_courseId_idx" ON "pack_courses" ("courseId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_courses_packId_fkey') THEN
    ALTER TABLE "pack_courses" ADD CONSTRAINT "pack_courses_packId_fkey"
      FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_courses_courseId_fkey') THEN
    ALTER TABLE "pack_courses" ADD CONSTRAINT "pack_courses_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_courses_instructorId_fkey') THEN
    ALTER TABLE "pack_courses" ADD CONSTRAINT "pack_courses_instructorId_fkey"
      FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
