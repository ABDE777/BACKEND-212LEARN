-- Pack purchases + revenue-share ledger (Phase 2). Idempotent.

CREATE TABLE IF NOT EXISTS "pack_purchases" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "packId"               UUID NOT NULL,
  "userId"               UUID NOT NULL,
  "amount"               DECIMAL(10,2) NOT NULL,
  "currency"             VARCHAR(10) NOT NULL DEFAULT 'MAD',
  "provider"             VARCHAR(50) NOT NULL,
  "transactionReference" VARCHAR(255) NOT NULL,
  "status"               VARCHAR(50) NOT NULL,
  "isLaunchPrice"        BOOLEAN NOT NULL DEFAULT false,
  "mtcn"                 VARCHAR(50),
  "receiptUrl"           VARCHAR(500),
  "rib"                  VARCHAR(50),
  "transferReceiptUrl"   VARCHAR(500),
  "verifiedBy"           UUID,
  "verifiedAt"           TIMESTAMP(3),
  "notes"                TEXT,
  "paidAt"               TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pack_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pack_purchases_transactionReference_key" ON "pack_purchases" ("transactionReference");
CREATE INDEX IF NOT EXISTS "pack_purchases_status_provider_idx" ON "pack_purchases" ("status", "provider");
CREATE INDEX IF NOT EXISTS "pack_purchases_packId_idx" ON "pack_purchases" ("packId");
CREATE INDEX IF NOT EXISTS "pack_purchases_userId_idx" ON "pack_purchases" ("userId");

CREATE TABLE IF NOT EXISTS "revenue_shares" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "packPurchaseId"   UUID NOT NULL,
  "packId"           UUID NOT NULL,
  "courseId"         UUID NOT NULL,
  "instructorId"     UUID NOT NULL,
  "grossAmount"      DECIMAL(10,2) NOT NULL,
  "commissionPct"    DECIMAL(5,2) NOT NULL,
  "commissionAmount" DECIMAL(10,2) NOT NULL,
  "netAmount"        DECIMAL(10,2) NOT NULL,
  "currency"         VARCHAR(10) NOT NULL DEFAULT 'MAD',
  "status"           VARCHAR(50) NOT NULL DEFAULT 'pending',
  "paidOutAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenue_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "revenue_shares_instructorId_status_idx" ON "revenue_shares" ("instructorId", "status");
CREATE INDEX IF NOT EXISTS "revenue_shares_packId_idx" ON "revenue_shares" ("packId");
CREATE INDEX IF NOT EXISTS "revenue_shares_packPurchaseId_idx" ON "revenue_shares" ("packPurchaseId");

-- Foreign keys (guarded so re-runs never error).
DO $$ BEGIN
  ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_packPurchaseId_fkey"
    FOREIGN KEY ("packPurchaseId") REFERENCES "pack_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "revenue_shares" ADD CONSTRAINT "revenue_shares_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
