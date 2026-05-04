-- Team-shared project organization (folders + placements).
--
-- Replaces per-user UserProjectFolder + UserProjectPlacement with team-scoped
-- TeamProjectFolder + TeamProjectPlacement so every member of a team sees the
-- same project-selection layout (folders, colors, ordering) on /projects.
--
-- Data migration strategy ("B" — most-recently-active user wins):
--   For each team, pick the member whose UserProjectPlacement records have
--   the most recent updatedAt. Tiebreak: oldest TeamMember.createdAt (the
--   founding member). Copy that user's folders + placements into the new
--   team-scoped tables; their layout becomes the team's starting point.
--
-- Archive state on PROJECTS is unaffected — Project.status='archived' is
-- already on the team-owned Project model and was always team-shared.

-- ── Step 1: Create new team-scoped tables. ──────────────────

CREATE TABLE "TeamProjectFolder" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId"   TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT 'Untitled',
  color      TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamProjectFolder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"(id) ON DELETE CASCADE
);
CREATE INDEX "TeamProjectFolder_teamId_sortOrder_idx" ON "TeamProjectFolder"("teamId", "sortOrder");
CREATE INDEX "TeamProjectFolder_teamId_archived_idx"  ON "TeamProjectFolder"("teamId", archived);

CREATE TABLE "TeamProjectPlacement" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId"    TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "folderId"  TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamProjectPlacement_teamId_fkey"    FOREIGN KEY ("teamId")    REFERENCES "Team"(id)              ON DELETE CASCADE,
  CONSTRAINT "TeamProjectPlacement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"(id)           ON DELETE CASCADE,
  CONSTRAINT "TeamProjectPlacement_folderId_fkey"  FOREIGN KEY ("folderId")  REFERENCES "TeamProjectFolder"(id) ON DELETE SET NULL,
  CONSTRAINT "TeamProjectPlacement_teamId_projectId_key" UNIQUE ("teamId", "projectId")
);
CREATE INDEX "TeamProjectPlacement_teamId_folderId_sortOrder_idx" ON "TeamProjectPlacement"("teamId", "folderId", "sortOrder");

-- ── Step 2: Pick the "winning" user per team. ────────────────
-- A temp table is faster + clearer than re-running the CTE for both INSERTs.

CREATE TEMP TABLE chosen_user_per_team AS
WITH user_activity AS (
  SELECT
    tm."teamId",
    tm."userId",
    COALESCE(MAX(upp."updatedAt"), '1970-01-01'::timestamp) AS last_activity,
    tm."createdAt"                                          AS member_since
  FROM "TeamMember" tm
  LEFT JOIN "UserProjectPlacement" upp ON upp."userId" = tm."userId"
  GROUP BY tm."teamId", tm."userId", tm."createdAt"
)
SELECT DISTINCT ON ("teamId")
  "teamId",
  "userId"
FROM user_activity
ORDER BY "teamId", last_activity DESC, member_since ASC;

-- ── Step 3: Copy folders → team-scoped table. ────────────────
-- Folder ids are preserved so placement.folderId references stay valid.

INSERT INTO "TeamProjectFolder" (id, "teamId", name, color, "sortOrder", archived, "createdAt", "updatedAt")
SELECT
  upf.id,
  cupt."teamId",
  upf.name,
  upf.color,
  upf."sortOrder",
  upf.archived,
  upf."createdAt",
  upf."updatedAt"
FROM "UserProjectFolder" upf
JOIN chosen_user_per_team cupt ON cupt."userId" = upf."userId";

-- ── Step 4: Copy placements → team-scoped table. ─────────────
-- Sanity join on Project.teamId guards against a stale placement whose
-- project was reassigned to a different team since the placement row was
-- last touched. Such rows are silently dropped (the user's view of that
-- project disappears in the new team layout, which matches the truth that
-- the project no longer belongs to the team).

INSERT INTO "TeamProjectPlacement" (id, "teamId", "projectId", "folderId", "sortOrder", "createdAt", "updatedAt")
SELECT
  upp.id,
  cupt."teamId",
  upp."projectId",
  upp."folderId",
  upp."sortOrder",
  upp."createdAt",
  upp."updatedAt"
FROM "UserProjectPlacement" upp
JOIN chosen_user_per_team cupt ON cupt."userId" = upp."userId"
JOIN "Project" p              ON p.id = upp."projectId" AND p."teamId" = cupt."teamId";

-- ── Step 5: Recreate the reorder_home_grid RPC for team-scoped tables. ──
-- The previous RPC (migration 20260503180000_reorder_home_grid_rpc) referenced
-- the user-scoped tables that we're about to drop, so it must be replaced
-- before the DROP TABLE below or the function will be dropped by cascade.

DROP FUNCTION IF EXISTS public.reorder_home_grid(text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.reorder_home_grid(
  p_team_id text,
  p_folders jsonb,
  p_placements jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  IF jsonb_array_length(p_folders) > 0 THEN
    UPDATE "TeamProjectFolder" AS f
    SET "sortOrder" = (item->>'sortOrder')::int,
        "updatedAt" = now_ts
    FROM jsonb_array_elements(p_folders) AS item
    WHERE f.id = (item->>'id')::text
      AND f."teamId" = p_team_id;
  END IF;

  IF jsonb_array_length(p_placements) > 0 THEN
    INSERT INTO "TeamProjectPlacement" (
      "teamId", "projectId", "folderId", "sortOrder", "createdAt", "updatedAt"
    )
    SELECT
      p_team_id,
      (item->>'projectId')::text,
      NULL,
      (item->>'sortOrder')::int,
      now_ts,
      now_ts
    FROM jsonb_array_elements(p_placements) AS item
    ON CONFLICT ("teamId", "projectId") DO UPDATE
    SET "sortOrder" = EXCLUDED."sortOrder",
        "folderId" = NULL,
        "updatedAt" = now_ts;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_home_grid(text, jsonb, jsonb) TO authenticated, anon;

-- ── Step 6: RLS on new team-scoped tables. ───────────────────
-- The previous user-scoped tables had RLS policies (user_project_folder_all
-- + user_project_placement_all in 20260428005845_rls_helpers_and_policies)
-- that gated access by the row's userId. The team-scoped equivalents gate
-- by team membership using public.is_team_member().

ALTER TABLE "TeamProjectFolder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_project_folder_all" ON "TeamProjectFolder" FOR ALL
  USING      (public.is_team_member("teamId"::uuid, auth.uid()))
  WITH CHECK (public.is_team_member("teamId"::uuid, auth.uid()));

ALTER TABLE "TeamProjectPlacement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_project_placement_all" ON "TeamProjectPlacement" FOR ALL
  USING      (public.is_team_member("teamId"::uuid, auth.uid()))
  WITH CHECK (public.is_team_member("teamId"::uuid, auth.uid()));

-- ── Step 7: Drop old user-scoped tables. ─────────────────────
-- Cascades drop the old user_project_folder_all + user_project_placement_all
-- policies along with the tables.

DROP TABLE IF EXISTS "UserProjectPlacement";
DROP TABLE IF EXISTS "UserProjectFolder";
