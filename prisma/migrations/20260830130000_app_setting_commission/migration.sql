-- Global instructor payout share (%) on the AppSetting singleton. The platform
-- keeps the remainder. Read live by pack settlement and analytics/earnings.
-- Additive & idempotent.

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "instructorSharePct" INTEGER NOT NULL DEFAULT 70;
