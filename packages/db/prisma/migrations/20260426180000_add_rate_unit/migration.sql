-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('day', 'hour');

-- AlterTable
ALTER TABLE "CrewTimecard" ADD COLUMN "rateUnit" "RateUnit";

-- Data backfill: heuristic — rate >= 100 → 'day', rate < 100 → 'hour'.
-- Spot-verified 2026-04-26 against 124 non-null rows: all are >= 250 (day rates).
-- The < 100 branch is a no-op against current data but stays in for defensible
-- defaulting on any future hourly inserts. Rows with rate IS NULL keep
-- rateUnit NULL (legacy; surfaced in UI for fix-up).
UPDATE "CrewTimecard" SET "rateUnit" = 'day'  WHERE "rate" IS NOT NULL AND "rate" >= 100;
UPDATE "CrewTimecard" SET "rateUnit" = 'hour' WHERE "rate" IS NOT NULL AND "rate" < 100;
