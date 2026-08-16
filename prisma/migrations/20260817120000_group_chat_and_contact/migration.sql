-- Adds the group_chat_messages and contact_messages tables that were introduced
-- in the schema but never migrated. Written idempotently (IF NOT EXISTS / guarded
-- constraints) so it is a no-op on databases already synced via `prisma db push`,
-- and creates everything on fresh environments.

-- CreateTable: group_chat_messages
CREATE TABLE IF NOT EXISTS "group_chat_messages" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "text" TEXT,
    "fileUrl" VARCHAR(500),
    "fileType" VARCHAR(50),
    "fileName" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "group_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contact_messages
CREATE TABLE IF NOT EXISTS "contact_messages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_chat_messages_groupId_createdAt_idx"
    ON "group_chat_messages" ("groupId", "createdAt");

-- AddForeignKey (guarded for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_chat_messages_groupId_fkey') THEN
    ALTER TABLE "group_chat_messages"
      ADD CONSTRAINT "group_chat_messages_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_chat_messages_senderId_fkey') THEN
    ALTER TABLE "group_chat_messages"
      ADD CONSTRAINT "group_chat_messages_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
