-- WardrobeSourced — production-side wardrobe tracking. Closes BUILD_STATUS #15.
-- Mirrors the PropSourced shape (1:1 nullable FK, @unique on entityId, lift-and-
-- break) with a wardrobe-specific status enum that adds a `fitted` state.
-- Distinct from PropStatus per DECISIONS.md "Narrative→Production cardinality
-- rule" (1:1) + "WardrobeSourced schema" (4-state enum, no isHero).
--
-- Mapping (locked Apr 27 2026):
--   metadata.status='needed'    → WardrobeSourced.status='needed'
--   metadata.status='sourced'   → WardrobeSourced.status='sourced'
--   metadata.status='confirmed' → WardrobeSourced.status='ready'   (rename, same as PropSourced)
--   metadata.status='fitted'    → WardrobeSourced.status='fitted'  (defensive — no seed rows)
--   metadata.status missing/other → WardrobeSourced.status='needed' (default)
--
-- Idempotent: LEFT JOIN guard skips entities that already have a WardrobeSourced
-- row (matching the PropSourced migration pattern that recovered cleanly from
-- the partial-commit anomaly observed in #13's deploy).

-- ─── 1. WardrobeStatus enum ───────────────────────────────────────────────
CREATE TYPE "WardrobeStatus" AS ENUM ('needed', 'sourced', 'fitted', 'ready');

-- ─── 2. WardrobeSourced table ─────────────────────────────────────────────
CREATE TABLE "WardrobeSourced" (
  "id"        TEXT             NOT NULL DEFAULT gen_random_uuid(),
  "projectId" TEXT             NOT NULL,
  "entityId"  TEXT,
  "status"    "WardrobeStatus" NOT NULL DEFAULT 'needed',
  "createdAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "WardrobeSourced_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WardrobeSourced_entityId_key" ON "WardrobeSourced"("entityId");
CREATE INDEX        "WardrobeSourced_projectId_idx" ON "WardrobeSourced"("projectId");

ALTER TABLE "WardrobeSourced"
  ADD CONSTRAINT "WardrobeSourced_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WardrobeSourced"
  ADD CONSTRAINT "WardrobeSourced_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 3. Backfill — one WardrobeSourced row per Entity(type='wardrobe') ────
INSERT INTO "WardrobeSourced" ("id", "projectId", "entityId", "status", "updatedAt")
SELECT
  gen_random_uuid(),
  e."projectId",
  e."id",
  CASE
    WHEN e."metadata"->>'status' = 'needed'    THEN 'needed'::"WardrobeStatus"
    WHEN e."metadata"->>'status' = 'sourced'   THEN 'sourced'::"WardrobeStatus"
    WHEN e."metadata"->>'status' = 'confirmed' THEN 'ready'::"WardrobeStatus"
    WHEN e."metadata"->>'status' = 'fitted'    THEN 'fitted'::"WardrobeStatus"
    ELSE                                            'needed'::"WardrobeStatus"
  END,
  CURRENT_TIMESTAMP
FROM "Entity" e
LEFT JOIN "WardrobeSourced" ws ON ws."entityId" = e."id"
WHERE e."type" = 'wardrobe' AND ws."id" IS NULL;
