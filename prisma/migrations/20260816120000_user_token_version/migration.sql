-- Single active session per account: bumped on every login; tokens whose `tv`
-- claim no longer matches are rejected.
-- NOTE: the Prisma model `User` is mapped to the table "users" (@@map("users")).
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
