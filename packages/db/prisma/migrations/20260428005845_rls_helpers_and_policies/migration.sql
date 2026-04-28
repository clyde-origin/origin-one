-- Auth PR #4 — RLS helpers + policies on every project-scoped table
-- Reference: docs/superpowers/specs/2026-04-26-auth-design.md (Role / RLS map)
-- Reference: docs/superpowers/plans/2026-04-27-auth.md (PR 4)
--
-- DO NOT MERGE THIS PR until PR #6 (sign-in mechanism) is ready to ship.
-- Once this migration applies, every query returns 0 rows for unauth'd
-- users — the app shows empty until a session exists.
--
-- Production snapshot REQUIRED before applying. RLS once on cannot be
-- cleanly toggled off without a destructive migration.

-- ═══════════════════════════════════════════════════════════════════════
-- HELPERS
-- ═══════════════════════════════════════════════════════════════════════

-- Returns TRUE if the auth user owns a TeamMember row in the target team.
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID, p_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "TeamMember" tm
    JOIN "User" u ON u.id = tm."userId"
    WHERE tm."teamId" = p_team_id::text
      AND u."authId" = p_auth_id
  )
$$;

-- Returns TRUE if the auth user owns a ProjectMember row on the target project.
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm."projectId" = p_project_id::text
      AND u."authId" = p_auth_id
  )
$$;

-- Producer-tier access = TeamMember on project's team OR producer/director
-- ProjectMember row on this specific project.
CREATE OR REPLACE FUNCTION public.has_producer_access(p_project_id UUID, p_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "Project" p
    WHERE p.id = p_project_id::text
      AND public.is_team_member(p."teamId"::uuid, p_auth_id)
  )
  OR EXISTS (
    SELECT 1
    FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm."projectId" = p_project_id::text
      AND u."authId" = p_auth_id
      AND pm.role IN ('producer', 'director')
  )
$$;

-- High-trust write access = producer-tier OR ProjectMember.canEdit = true
CREATE OR REPLACE FUNCTION public.has_high_trust_write(p_project_id UUID, p_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.has_producer_access(p_project_id, p_auth_id)
    OR EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      JOIN "User" u ON u.id = pm."userId"
      WHERE pm."projectId" = p_project_id::text
        AND u."authId" = p_auth_id
        AND pm."canEdit" = true
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_team_member(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_producer_access(UUID, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_high_trust_write(UUID, UUID) TO authenticated, anon, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 1 — Team-scoped (producer tier)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_select" ON "Team" FOR SELECT
  USING (public.is_team_member(id::uuid, auth.uid()));
CREATE POLICY "team_update" ON "Team" FOR UPDATE
  USING (public.is_team_member(id::uuid, auth.uid()))
  WITH CHECK (public.is_team_member(id::uuid, auth.uid()));

ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_member_select" ON "TeamMember" FOR SELECT
  USING (public.is_team_member("teamId"::uuid, auth.uid()));
CREATE POLICY "team_member_insert" ON "TeamMember" FOR INSERT
  WITH CHECK (public.is_team_member("teamId"::uuid, auth.uid()));
CREATE POLICY "team_member_delete" ON "TeamMember" FOR DELETE
  USING (public.is_team_member("teamId"::uuid, auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 2 — Project (special — has teamId for SELECT)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_select" ON "Project" FOR SELECT
  USING (
    public.is_team_member("teamId"::uuid, auth.uid())
    OR public.is_project_member(id::uuid, auth.uid())
  );
CREATE POLICY "project_insert" ON "Project" FOR INSERT
  WITH CHECK (public.is_team_member("teamId"::uuid, auth.uid()));
CREATE POLICY "project_update" ON "Project" FOR UPDATE
  USING (public.has_producer_access(id::uuid, auth.uid()))
  WITH CHECK (public.has_producer_access(id::uuid, auth.uid()));
CREATE POLICY "project_delete" ON "Project" FOR DELETE
  USING (public.is_team_member("teamId"::uuid, auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- ProjectMember (special — self-update on soft fields, producer add/remove)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_member_select" ON "ProjectMember" FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "ProjectMember"."projectId"
            AND (public.is_team_member(p."teamId"::uuid, auth.uid())
                 OR public.is_project_member(p.id::uuid, auth.uid())))
  );
CREATE POLICY "project_member_insert" ON "ProjectMember" FOR INSERT
  WITH CHECK (public.has_producer_access("projectId"::uuid, auth.uid()));
CREATE POLICY "project_member_update" ON "ProjectMember" FOR UPDATE
  USING (
    public.has_producer_access("projectId"::uuid, auth.uid())
    OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ProjectMember"."userId" AND u."authId" = auth.uid())
  )
  WITH CHECK (
    public.has_producer_access("projectId"::uuid, auth.uid())
    OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ProjectMember"."userId" AND u."authId" = auth.uid())
  );
CREATE POLICY "project_member_delete" ON "ProjectMember" FOR DELETE
  USING (public.has_producer_access("projectId"::uuid, auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 2 — Bulk-applied tables (direct projectId)
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  table_name TEXT;
  -- Producer-tier writes only
  producer_only_tables TEXT[] := ARRAY['WorkflowNode','WorkflowEdge','Milestone','Deliverable'];
  -- High-trust writes (producer-tier OR canEdit=true)
  high_trust_tables TEXT[] := ARRAY[
    'Scene','Entity','Location','ShootDay','ShotlistVersion',
    'PropSourced','WardrobeSourced','InventoryItem','Talent',
    'MoodboardTab'
  ];
  -- Operational writes (any project member)
  operational_tables TEXT[] := ARRAY[
    'Thread','ChatChannel','ChatMessage','ActionItem','Document','Folder',
    'MoodboardRef','EntityAttachment'
  ];
BEGIN
  FOREACH table_name IN ARRAY producer_only_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), auth.uid())
         OR public.is_project_member(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.has_producer_access(%I."projectId"::uuid, auth.uid()))
         WITH CHECK (public.has_producer_access(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
  END LOOP;

  FOREACH table_name IN ARRAY high_trust_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), auth.uid())
         OR public.is_project_member(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.has_high_trust_write(%I."projectId"::uuid, auth.uid()))
         WITH CHECK (public.has_high_trust_write(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
  END LOOP;

  FOREACH table_name IN ARRAY operational_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), auth.uid())
         OR public.is_project_member(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.is_project_member(%I."projectId"::uuid, auth.uid()))
         WITH CHECK (public.is_project_member(%I."projectId"::uuid, auth.uid()))',
      lower(table_name), table_name, table_name, table_name
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- CrewTimecard — special: own-row-only read for crew
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "CrewTimecard" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_timecard_select" ON "CrewTimecard" FOR SELECT USING (
  public.has_producer_access("projectId"::uuid, auth.uid())
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = auth.uid()
  )
);
CREATE POLICY "crew_timecard_insert" ON "CrewTimecard" FOR INSERT WITH CHECK (
  public.has_producer_access("projectId"::uuid, auth.uid())
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = auth.uid()
  )
);
CREATE POLICY "crew_timecard_update" ON "CrewTimecard" FOR UPDATE USING (
  public.has_producer_access("projectId"::uuid, auth.uid())
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = auth.uid()
  )
);
CREATE POLICY "crew_timecard_delete" ON "CrewTimecard" FOR DELETE USING (
  public.has_producer_access("projectId"::uuid, auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 2 — Chain tables (no direct projectId, walk via sibling FK)
-- ═══════════════════════════════════════════════════════════════════════

-- Shot — chains via sceneId → Scene.projectId
ALTER TABLE "Shot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shot_select" ON "Shot" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = s."projectId"), auth.uid())
               OR public.is_project_member(s."projectId"::uuid, auth.uid())))
);
CREATE POLICY "shot_write" ON "Shot" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND public.has_high_trust_write(s."projectId"::uuid, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND public.has_high_trust_write(s."projectId"::uuid, auth.uid()))
);

-- ThreadMessage — chains via threadId → Thread.projectId
ALTER TABLE "ThreadMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_message_select" ON "ThreadMessage" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), auth.uid())
               OR public.is_project_member(t."projectId"::uuid, auth.uid())))
);
CREATE POLICY "thread_message_write" ON "ThreadMessage" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND public.is_project_member(t."projectId"::uuid, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND public.is_project_member(t."projectId"::uuid, auth.uid()))
);

-- ThreadRead — chains via threadId; user owns own row
ALTER TABLE "ThreadRead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_read_select" ON "ThreadRead" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadRead"."threadId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), auth.uid())
               OR public.is_project_member(t."projectId"::uuid, auth.uid())))
);
CREATE POLICY "thread_read_write" ON "ThreadRead" FOR ALL USING (
  EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ThreadRead"."userId" AND u."authId" = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ThreadRead"."userId" AND u."authId" = auth.uid())
);

-- MilestonePerson — chains via milestoneId → Milestone.projectId
ALTER TABLE "MilestonePerson" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestone_person_select" ON "MilestonePerson" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = m."projectId"), auth.uid())
               OR public.is_project_member(m."projectId"::uuid, auth.uid())))
);
CREATE POLICY "milestone_person_write" ON "MilestonePerson" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND public.has_producer_access(m."projectId"::uuid, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND public.has_producer_access(m."projectId"::uuid, auth.uid()))
);

-- TalentAssignment — chains via talentId → Talent.projectId
ALTER TABLE "TalentAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "talent_assignment_select" ON "TalentAssignment" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), auth.uid())
               OR public.is_project_member(t."projectId"::uuid, auth.uid())))
);
CREATE POLICY "talent_assignment_write" ON "TalentAssignment" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND public.has_high_trust_write(t."projectId"::uuid, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND public.has_high_trust_write(t."projectId"::uuid, auth.uid()))
);

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 3 — User (self + visible-collaborator read)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_select" ON "User" FOR SELECT USING (
  "authId" = auth.uid()
  OR EXISTS (
    SELECT 1 FROM "TeamMember" tm
    JOIN "User" me ON me."authId" = auth.uid()
    JOIN "TeamMember" my_tm ON my_tm."userId" = me.id
    WHERE tm."userId" = "User".id AND tm."teamId" = my_tm."teamId"
  )
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" me ON me."authId" = auth.uid()
    JOIN "ProjectMember" my_pm ON my_pm."userId" = me.id
    WHERE pm."userId" = "User".id AND pm."projectId" = my_pm."projectId"
  )
);
CREATE POLICY "user_update" ON "User" FOR UPDATE
  USING ("authId" = auth.uid())
  WITH CHECK ("authId" = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════
-- SHAPE 4 — Per-user state
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "UserProjectFolder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_project_folder_all" ON "UserProjectFolder" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectFolder"."userId" AND u."authId" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectFolder"."userId" AND u."authId" = auth.uid()));

ALTER TABLE "UserProjectPlacement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_project_placement_all" ON "UserProjectPlacement" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectPlacement"."userId" AND u."authId" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectPlacement"."userId" AND u."authId" = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- Resource — teamId-scoped (cross-project) + projectId-scoped
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "Resource" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_select" ON "Resource" FOR SELECT USING (
  public.is_team_member("teamId"::uuid, auth.uid())
  OR ("projectId" IS NOT NULL AND public.is_project_member("projectId"::uuid, auth.uid()))
);
CREATE POLICY "resource_write" ON "Resource" FOR ALL USING (
  public.is_team_member("teamId"::uuid, auth.uid())
  OR ("projectId" IS NOT NULL AND public.has_producer_access("projectId"::uuid, auth.uid()))
) WITH CHECK (
  public.is_team_member("teamId"::uuid, auth.uid())
  OR ("projectId" IS NOT NULL AND public.has_producer_access("projectId"::uuid, auth.uid()))
);

-- ═══════════════════════════════════════════════════════════════════════
-- Budget family — PRODUCER-TIER ONLY (read + write)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_select" ON "Budget" FOR SELECT
  USING (public.has_producer_access("projectId"::uuid, auth.uid()));
CREATE POLICY "budget_write" ON "Budget" FOR ALL
  USING (public.has_producer_access("projectId"::uuid, auth.uid()))
  WITH CHECK (public.has_producer_access("projectId"::uuid, auth.uid()));

DO $$
DECLARE
  budget_chain_tables TEXT[] := ARRAY['BudgetVersion','BudgetAccount','BudgetLine','BudgetVariable','BudgetMarkup','Expense'];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY budget_chain_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                 AND public.has_producer_access(b."projectId"::uuid, auth.uid())))',
      lower(table_name), table_name, table_name
    );
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL
         USING (EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                AND public.has_producer_access(b."projectId"::uuid, auth.uid())))
         WITH CHECK (EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                AND public.has_producer_access(b."projectId"::uuid, auth.uid())))',
      lower(table_name), table_name, table_name, table_name
    );
  END LOOP;
END $$;

-- BudgetLineAmount — two-hop: lineId → BudgetLine.budgetId → Budget.projectId
ALTER TABLE "BudgetLineAmount" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_line_amount_select" ON "BudgetLineAmount" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, auth.uid()))
);
CREATE POLICY "budget_line_amount_write" ON "BudgetLineAmount" FOR ALL USING (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, auth.uid()))
);

-- ═══════════════════════════════════════════════════════════════════════
-- Revoke anon — Auth Day tightening of pre-Auth permissive grants (PR #76)
-- ═══════════════════════════════════════════════════════════════════════
-- After Auth, the PWA always has an authenticated session. The anon role
-- should have NO data privileges on public tables. RLS gates rows;
-- the role grant is the outer fence.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Reset future-table defaults so newly-created tables don't auto-grant anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
