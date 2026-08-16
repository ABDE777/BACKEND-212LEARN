-- Single active session per account: bumped on every login; tokens whose `tv`
-- claim no longer matches are rejected.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
