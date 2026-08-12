-- Instructor: add "Domaine d'expertise" as a field distinct from specialization ("Spécialité")
ALTER TABLE "instructor_profiles" ADD COLUMN IF NOT EXISTS "expertiseDomain" VARCHAR(255);

-- experienceYears: switch from an integer to a range token ('<1', '1-2', '3-5', '6-10', '>10')
ALTER TABLE "student_profiles"
  ALTER COLUMN "experienceYears" TYPE VARCHAR(10) USING "experienceYears"::text;

ALTER TABLE "instructor_profiles"
  ALTER COLUMN "experienceYears" TYPE VARCHAR(10) USING "experienceYears"::text;
