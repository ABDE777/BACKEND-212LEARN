-- Singleton platform settings. Replay-safe: create the table if missing and
-- seed the single "app" row idempotently.
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id"                  TEXT NOT NULL,
  "siteName"            TEXT NOT NULL DEFAULT '212 Learn',
  "supportEmail"        TEXT NOT NULL DEFAULT 'support@212learn.com',
  "currency"            TEXT NOT NULL DEFAULT 'MAD',
  "wafacashAutoApprove" BOOLEAN NOT NULL DEFAULT false,
  "requireKyc"          BOOLEAN NOT NULL DEFAULT true,
  "allowRegistrations"  BOOLEAN NOT NULL DEFAULT true,
  "maintenanceMode"     BOOLEAN NOT NULL DEFAULT false,
  "emailNotifications"  BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_settings" ("id") VALUES ('app') ON CONFLICT ("id") DO NOTHING;
