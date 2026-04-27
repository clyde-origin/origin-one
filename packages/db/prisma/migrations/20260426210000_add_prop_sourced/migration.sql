-- PropSourced — production-side prop tracking. Closes BUILD_STATUS #13.
-- Lift-and-break: existing Entity.metadata.status values for prop entities
-- migrate into a typed PropStatus column on a new PropSourced row. The Art
-- page read path (entity.metadata.status) is dropped in the next PR (#14).
-- metadata.imageUrl and metadata.tags remain on Entity (per BUILD_STATUS
-- Apr 24 lock).
--
-- Mapping (locked Apr 26 2026):
--   metadata.status='needed'    → PropSourced.status='needed'
--   metadata.status='sourced'   → PropSourced.status='sourced'
--   metadata.status='confirmed' → PropSourced.status='ready'   (rename)
--   metadata.status='hero'      → PropSourced.status='ready' AND isHero=true
--   metadata.status missing/other → PropSourced.status='needed' (default)
--
-- 'hero' was a TS-only category that never seeded any rows; mapping is
-- defensive. Reference: DECISIONS.md "PropSourced schema" entry.
--
-- Idempotent: only inserts PropSourced rows for prop entities that don't
-- already have one (via SELECT … LEFT JOIN … WHERE PropSourced.id IS NULL).

-- ─── 1. PropStatus enum ───────────────────────────────────────────────────
CREATE TYPE "PropStatus" AS ENUM ('needed', 'sourced', 'ready');

-- ─── 2. PropSourced table ─────────────────────────────────────────────────
CREATE TABLE "PropSourced" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "projectId" TEXT         NOT NULL,
  "entityId"  TEXT,
  "status"    "PropStatus" NOT NULL DEFAULT 'needed',
  "isHero"    BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropSourced_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropSourced_entityId_key" ON "PropSourced"("entityId");
CREATE INDEX        "PropSourced_projectId_idx" ON "PropSourced"("projectId");

ALTER TABLE "PropSourced"
  ADD CONSTRAINT "PropSourced_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropSourced"
  ADD CONSTRAINT "PropSourced_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "Entity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 3. Backfill — one PropSourced row per existing Entity(type='prop') ───
-- Lift metadata.status into the typed column. Skips entities that already
-- have a PropSourced row (idempotent against re-runs).
INSERT INTO "PropSourced" ("id", "projectId", "entityId", "status", "isHero", "updatedAt")
SELECT
  gen_random_uuid(),
  e."projectId",
  e."id",
  CASE
    WHEN e."metadata"->>'status' = 'needed'    THEN 'needed'::"PropStatus"
    WHEN e."metadata"->>'status' = 'sourced'   THEN 'sourced'::"PropStatus"
    WHEN e."metadata"->>'status' = 'confirmed' THEN 'ready'::"PropStatus"
    WHEN e."metadata"->>'status' = 'hero'      THEN 'ready'::"PropStatus"
    ELSE                                            'needed'::"PropStatus"
  END,
  CASE WHEN e."metadata"->>'status' = 'hero' THEN true ELSE false END,
  CURRENT_TIMESTAMP
FROM "Entity" e
LEFT JOIN "PropSourced" ps ON ps."entityId" = e."id"
WHERE e."type" = 'prop' AND ps."id" IS NULL;
