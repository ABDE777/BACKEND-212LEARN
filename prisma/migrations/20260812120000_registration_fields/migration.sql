-- Profile tables originally entered the DB via `prisma db push` and were never
-- captured by a CreateTable migration. Create them here (idempotently) so the
-- migration history replays cleanly on a fresh DB / shadow DB / CI. On a DB that
-- already has them (via db push) the IF NOT EXISTS guards make this a no-op.
CREATE TABLE IF NOT EXISTS "student_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "situation" VARCHAR(50) NOT NULL DEFAULT 'student',
    "school" VARCHAR(255),
    "fieldOfStudy" VARCHAR(255),
    "educationLevel" VARCHAR(50),
    "academicYearStart" TIMESTAMP(3),
    "academicYearEnd" TIMESTAMP(3),
    "companyName" VARCHAR(255),
    "department" VARCHAR(255),
    "position" VARCHAR(255),
    "sector" VARCHAR(255),
    "experienceYears" VARCHAR(10),
    "interests" TEXT,
    "learningObjective" TEXT,
    "currentLevel" VARCHAR(50),
    "group" VARCHAR(50),
    "isSelfDirected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_userId_key" ON "student_profiles"("userId");

CREATE TABLE IF NOT EXISTS "instructor_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "situation" VARCHAR(50) NOT NULL DEFAULT 'employed',
    "expertiseDomain" VARCHAR(255),
    "specialization" VARCHAR(255) NOT NULL,
    "organization" VARCHAR(255),
    "department" VARCHAR(255),
    "position" VARCHAR(255),
    "sector" VARCHAR(255),
    "experienceYears" VARCHAR(10) NOT NULL,
    "teachingMode" VARCHAR(50) NOT NULL,
    "teachingDomains" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "instructor_profiles_userId_key" ON "instructor_profiles"("userId");

-- Foreign keys (guarded so a re-run / already-pushed DB doesn't error on a dup)
DO $$ BEGIN
  ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Original intent of this migration ────────────────────────────────────────
-- Instructor: add "Domaine d'expertise" as a field distinct from specialization ("Spécialité")
ALTER TABLE "instructor_profiles" ADD COLUMN IF NOT EXISTS "expertiseDomain" VARCHAR(255);

-- experienceYears: switch from an integer to a range token ('<1', '1-2', '3-5', '6-10', '>10')
ALTER TABLE "student_profiles"
  ALTER COLUMN "experienceYears" TYPE VARCHAR(10) USING "experienceYears"::text;

ALTER TABLE "instructor_profiles"
  ALTER COLUMN "experienceYears" TYPE VARCHAR(10) USING "experienceYears"::text;
