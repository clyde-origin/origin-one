-- Auth PR #3 — drop non-producer TeamMember rows
-- Reference: docs/superpowers/specs/2026-04-26-auth-design.md (tenant model)
-- Reference: docs/superpowers/plans/2026-04-27-auth.md (PR 3)
--
-- Tenant model: TeamMember = "team-tier access" (producer only). Crew is
-- ProjectMember-only. Drop every TeamMember row whose user has no producer
-- ProjectMember in that team. For Origin Point this leaves 3 rows
-- (Clyde, Tyler, Kelly).

DELETE FROM "TeamMember" tm
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectMember" pm
  JOIN "Project" p ON p.id = pm."projectId"
  WHERE pm."userId" = tm."userId"
    AND p."teamId" = tm."teamId"
    AND pm.role = 'producer'
);

-- Verification: Origin Point should have exactly 3 TeamMember rows.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM "TeamMember" tm
  JOIN "Team" t ON t.id = tm."teamId"
  WHERE t.name = 'Origin Point';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Tenant cleanup failed: Origin Point has % TeamMember rows, expected 3', v_count;
  END IF;
END $$;
