-- Auth PR #0 — add Resource.teamId NOT NULL with backfill
-- Reference: docs/superpowers/specs/2026-04-26-auth-design.md
-- Reference: docs/superpowers/plans/2026-04-27-auth.md (PR 0)
--
-- Sets up tenant boundary for Resource RLS in PR #4. Cross-project Resources
-- (projectId IS NULL) now scope by team rather than leaking to all
-- authenticated users when external testers arrive.

-- Step 1: Add nullable column
ALTER TABLE "Resource" ADD COLUMN "teamId" TEXT;

-- Step 2: Backfill from Project for project-scoped resources
UPDATE "Resource" r
SET "teamId" = p."teamId"
FROM "Project" p
WHERE r."projectId" = p.id;

-- Step 3: Backfill cross-project resources (projectId IS NULL) from Origin Point team
-- Origin Point is the only team currently — single team backfill is unambiguous.
UPDATE "Resource"
SET "teamId" = (SELECT id FROM "Team" WHERE name = 'Origin Point' LIMIT 1)
WHERE "teamId" IS NULL;

-- Step 4: Verify no nulls remain before NOT NULL
DO $$
DECLARE
  v_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null FROM "Resource" WHERE "teamId" IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % Resource rows still have null teamId', v_null;
  END IF;
END $$;

-- Step 5: Lock NOT NULL + FK + index
ALTER TABLE "Resource" ALTER COLUMN "teamId" SET NOT NULL;
ALTER TABLE "Resource"
  ADD CONSTRAINT "Resource_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE;

CREATE INDEX "Resource_teamId_idx" ON "Resource"("teamId");
