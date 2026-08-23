-- Adds the course_chat_messages table: one chat per course shared by the
-- course instructor(s) and every enrolled student. Idempotent so it is a no-op
-- on databases already synced via `prisma db push`.

-- CreateTable: course_chat_messages
CREATE TABLE IF NOT EXISTS "course_chat_messages" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "text" TEXT,
    "fileUrl" VARCHAR(500),
    "fileType" VARCHAR(50),
    "fileName" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_chat_messages_courseId_createdAt_idx"
    ON "course_chat_messages" ("courseId", "createdAt");

-- AddForeignKey (guarded for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_chat_messages_courseId_fkey') THEN
    ALTER TABLE "course_chat_messages"
      ADD CONSTRAINT "course_chat_messages_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_chat_messages_senderId_fkey') THEN
    ALTER TABLE "course_chat_messages"
      ADD CONSTRAINT "course_chat_messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
