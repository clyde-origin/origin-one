-- Add Entity ↔ Location FK link + LocationStatus lifecycle enum.
-- Preserves existing Location.status string values by mapping them to the new
-- enum via an ALTER COLUMN ... USING clause. Mapping:
--   'booked'     → 'confirmed'
--   'scouting'   → 'scouting'
--   'in_talks'   → 'in_talks'
--   'no_contact' → 'unscouted'
--   anything else → 'unscouted' (safe default)

-- ─── New enum ────────────────────────────────────────────────────────────────
CREATE TYPE "LocationStatus" AS ENUM ('unscouted', 'scouting', 'in_talks', 'confirmed', 'passed');

-- ─── Add Location.entityId + FK to Entity ────────────────────────────────────
ALTER TABLE "Location" ADD COLUMN "entityId" TEXT;

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Location_entityId_idx" ON "Location"("entityId");

-- ─── Migrate Location.status from TEXT to LocationStatus ─────────────────────
-- Step 1: drop the old string default so ALTER TYPE doesn't fight us.
ALTER TABLE "Location" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: cast existing values into the new enum.
ALTER TABLE "Location"
  ALTER COLUMN "status" TYPE "LocationStatus"
  USING (
    CASE "status"
      WHEN 'booked'     THEN 'confirmed'::"LocationStatus"
      WHEN 'scouting'   THEN 'scouting'::"LocationStatus"
      WHEN 'in_talks'   THEN 'in_talks'::"LocationStatus"
      WHEN 'no_contact' THEN 'unscouted'::"LocationStatus"
      ELSE                   'unscouted'::"LocationStatus"
    END
  );

-- Step 3: set the new enum default.
ALTER TABLE "Location" ALTER COLUMN "status" SET DEFAULT 'unscouted'::"LocationStatus";
