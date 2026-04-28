-- Auth-014 perf — wrap auth.uid() in (select auth.uid()) across all policies
--
-- Supabase performance advisor flagged 93 RLS policies re-evaluating
-- auth.uid() per row. Wrapping in (select auth.uid()) makes Postgres treat
-- the call as an init plan (one evaluation per query, cached for all rows).
--
-- Strategy: keep helper-fn signatures the same; wrap auth.uid() at every
-- policy call site. Also add 42 missing FK indices that RLS chain queries
-- benefit from.

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1 — drop every policy this Auth bundle created
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  policy_names TEXT[] := ARRAY[
    'team_select','team_update',
    'team_member_select','team_member_insert','team_member_delete',
    'project_select','project_insert','project_update','project_delete',
    'project_member_select','project_member_insert','project_member_update','project_member_delete',
    'workflownode_select','workflownode_write',
    'workflowedge_select','workflowedge_write',
    'milestone_select','milestone_write',
    'deliverable_select','deliverable_write',
    'scene_select','scene_write',
    'entity_select','entity_write',
    'location_select','location_write',
    'shootday_select','shootday_write',
    'shotlistversion_select','shotlistversion_write',
    'propsourced_select','propsourced_write',
    'wardrobesourced_select','wardrobesourced_write',
    'inventoryitem_select','inventoryitem_write',
    'talent_select','talent_write',
    'moodboardtab_select','moodboardtab_write',
    'thread_select','thread_write',
    'chatchannel_select','chatchannel_write',
    'chatmessage_select','chatmessage_write',
    'actionitem_select','actionitem_write',
    'document_select','document_write',
    'folder_select','folder_write',
    'moodboardref_select','moodboardref_write',
    'entityattachment_select','entityattachment_write',
    'crew_timecard_select','crew_timecard_insert','crew_timecard_update','crew_timecard_delete',
    'shot_select','shot_write',
    'thread_message_select','thread_message_write',
    'thread_read_select','thread_read_write',
    'milestone_person_select','milestone_person_write',
    'talent_assignment_select','talent_assignment_write',
    'user_select','user_update',
    'user_project_folder_all','user_project_placement_all',
    'resource_select','resource_write',
    'budget_select','budget_write',
    'budgetversion_select','budgetversion_write',
    'budgetaccount_select','budgetaccount_write',
    'budgetline_select','budgetline_write',
    'budgetvariable_select','budgetvariable_write',
    'budgetmarkup_select','budgetmarkup_write',
    'expense_select','expense_write',
    'budget_line_amount_select','budget_line_amount_write'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = ANY(policy_names)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Storage bucket policies separately
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname LIKE 'moodboard_%' OR policyname LIKE 'storyboard_%'
           OR policyname LIKE 'entity_attachments_%' OR policyname LIKE 'avatars_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2 — recreate everything with (select auth.uid()) wrap
-- ═══════════════════════════════════════════════════════════════════════

-- Shape 1: Team-scoped
CREATE POLICY "team_select" ON "Team" FOR SELECT
  USING (public.is_team_member(id::uuid, (select auth.uid())));
CREATE POLICY "team_update" ON "Team" FOR UPDATE
  USING (public.is_team_member(id::uuid, (select auth.uid())))
  WITH CHECK (public.is_team_member(id::uuid, (select auth.uid())));

CREATE POLICY "team_member_select" ON "TeamMember" FOR SELECT
  USING (public.is_team_member("teamId"::uuid, (select auth.uid())));
CREATE POLICY "team_member_insert" ON "TeamMember" FOR INSERT
  WITH CHECK (public.is_team_member("teamId"::uuid, (select auth.uid())));
CREATE POLICY "team_member_delete" ON "TeamMember" FOR DELETE
  USING (public.is_team_member("teamId"::uuid, (select auth.uid())));

-- Project
CREATE POLICY "project_select" ON "Project" FOR SELECT
  USING (
    public.is_team_member("teamId"::uuid, (select auth.uid()))
    OR public.is_project_member(id::uuid, (select auth.uid()))
  );
CREATE POLICY "project_insert" ON "Project" FOR INSERT
  WITH CHECK (public.is_team_member("teamId"::uuid, (select auth.uid())));
CREATE POLICY "project_update" ON "Project" FOR UPDATE
  USING (public.has_producer_access(id::uuid, (select auth.uid())))
  WITH CHECK (public.has_producer_access(id::uuid, (select auth.uid())));
CREATE POLICY "project_delete" ON "Project" FOR DELETE
  USING (public.is_team_member("teamId"::uuid, (select auth.uid())));

-- ProjectMember
CREATE POLICY "project_member_select" ON "ProjectMember" FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "ProjectMember"."projectId"
            AND (public.is_team_member(p."teamId"::uuid, (select auth.uid()))
                 OR public.is_project_member(p.id::uuid, (select auth.uid()))))
  );
CREATE POLICY "project_member_insert" ON "ProjectMember" FOR INSERT
  WITH CHECK (public.has_producer_access("projectId"::uuid, (select auth.uid())));
CREATE POLICY "project_member_update" ON "ProjectMember" FOR UPDATE
  USING (
    public.has_producer_access("projectId"::uuid, (select auth.uid()))
    OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ProjectMember"."userId" AND u."authId" = (select auth.uid()))
  )
  WITH CHECK (
    public.has_producer_access("projectId"::uuid, (select auth.uid()))
    OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ProjectMember"."userId" AND u."authId" = (select auth.uid()))
  );
CREATE POLICY "project_member_delete" ON "ProjectMember" FOR DELETE
  USING (public.has_producer_access("projectId"::uuid, (select auth.uid())));

-- Bulk-applied tables (Shape 2)
DO $$
DECLARE
  table_name TEXT;
  producer_only TEXT[] := ARRAY['WorkflowNode','WorkflowEdge','Milestone','Deliverable'];
  high_trust   TEXT[] := ARRAY['Scene','Entity','Location','ShootDay','ShotlistVersion',
                               'PropSourced','WardrobeSourced','InventoryItem','Talent','MoodboardTab'];
  operational  TEXT[] := ARRAY['Thread','ChatChannel','ChatMessage','ActionItem','Document',
                               'Folder','MoodboardRef','EntityAttachment'];
BEGIN
  FOREACH table_name IN ARRAY producer_only LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), (select auth.uid()))
         OR public.is_project_member(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.has_producer_access(%I."projectId"::uuid, (select auth.uid())))
         WITH CHECK (public.has_producer_access(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
  END LOOP;

  FOREACH table_name IN ARRAY high_trust LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), (select auth.uid()))
         OR public.is_project_member(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.has_high_trust_write(%I."projectId"::uuid, (select auth.uid())))
         WITH CHECK (public.has_high_trust_write(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
  END LOOP;

  FOREACH table_name IN ARRAY operational LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), (select auth.uid()))
         OR public.is_project_member(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (public.is_project_member(%I."projectId"::uuid, (select auth.uid())))
         WITH CHECK (public.is_project_member(%I."projectId"::uuid, (select auth.uid())))',
      lower(table_name), table_name, table_name, table_name);
  END LOOP;
END $$;

-- CrewTimecard
CREATE POLICY "crew_timecard_select" ON "CrewTimecard" FOR SELECT USING (
  public.has_producer_access("projectId"::uuid, (select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = (select auth.uid())
  )
);
CREATE POLICY "crew_timecard_insert" ON "CrewTimecard" FOR INSERT WITH CHECK (
  public.has_producer_access("projectId"::uuid, (select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = (select auth.uid())
  )
);
CREATE POLICY "crew_timecard_update" ON "CrewTimecard" FOR UPDATE USING (
  public.has_producer_access("projectId"::uuid, (select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm.id = "CrewTimecard"."crewMemberId"
      AND u."authId" = (select auth.uid())
  )
);
CREATE POLICY "crew_timecard_delete" ON "CrewTimecard" FOR DELETE USING (
  public.has_producer_access("projectId"::uuid, (select auth.uid()))
);

-- Chain tables
CREATE POLICY "shot_select" ON "Shot" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = s."projectId"), (select auth.uid()))
               OR public.is_project_member(s."projectId"::uuid, (select auth.uid()))))
);
CREATE POLICY "shot_write" ON "Shot" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND public.has_high_trust_write(s."projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId"
          AND public.has_high_trust_write(s."projectId"::uuid, (select auth.uid())))
);

CREATE POLICY "thread_message_select" ON "ThreadMessage" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), (select auth.uid()))
               OR public.is_project_member(t."projectId"::uuid, (select auth.uid()))))
);
CREATE POLICY "thread_message_write" ON "ThreadMessage" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND public.is_project_member(t."projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadMessage"."threadId"
          AND public.is_project_member(t."projectId"::uuid, (select auth.uid())))
);

CREATE POLICY "thread_read_select" ON "ThreadRead" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Thread" t WHERE t.id = "ThreadRead"."threadId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), (select auth.uid()))
               OR public.is_project_member(t."projectId"::uuid, (select auth.uid()))))
);
CREATE POLICY "thread_read_write" ON "ThreadRead" FOR ALL USING (
  EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ThreadRead"."userId" AND u."authId" = (select auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "User" u WHERE u.id = "ThreadRead"."userId" AND u."authId" = (select auth.uid()))
);

CREATE POLICY "milestone_person_select" ON "MilestonePerson" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = m."projectId"), (select auth.uid()))
               OR public.is_project_member(m."projectId"::uuid, (select auth.uid()))))
);
CREATE POLICY "milestone_person_write" ON "MilestonePerson" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND public.has_producer_access(m."projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Milestone" m WHERE m.id = "MilestonePerson"."milestoneId"
          AND public.has_producer_access(m."projectId"::uuid, (select auth.uid())))
);

CREATE POLICY "talent_assignment_select" ON "TalentAssignment" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND (public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = t."projectId"), (select auth.uid()))
               OR public.is_project_member(t."projectId"::uuid, (select auth.uid()))))
);
CREATE POLICY "talent_assignment_write" ON "TalentAssignment" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND public.has_high_trust_write(t."projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "Talent" t WHERE t.id = "TalentAssignment"."talentId"
          AND public.has_high_trust_write(t."projectId"::uuid, (select auth.uid())))
);

-- User (uses current_user_id() helper from auth-008; that helper bypasses RLS via SECURITY DEFINER)
CREATE POLICY "user_select" ON "User" FOR SELECT USING (
  "authId" = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM "TeamMember" tm_target
    JOIN "TeamMember" tm_me ON tm_me."teamId" = tm_target."teamId"
    WHERE tm_target."userId" = "User".id
      AND tm_me."userId" = public.current_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM "ProjectMember" pm_target
    JOIN "ProjectMember" pm_me ON pm_me."projectId" = pm_target."projectId"
    WHERE pm_target."userId" = "User".id
      AND pm_me."userId" = public.current_user_id()
  )
);
CREATE POLICY "user_update" ON "User" FOR UPDATE
  USING ("authId" = (select auth.uid()))
  WITH CHECK ("authId" = (select auth.uid()));

-- Per-user state
CREATE POLICY "user_project_folder_all" ON "UserProjectFolder" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectFolder"."userId" AND u."authId" = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectFolder"."userId" AND u."authId" = (select auth.uid())));

CREATE POLICY "user_project_placement_all" ON "UserProjectPlacement" FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectPlacement"."userId" AND u."authId" = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserProjectPlacement"."userId" AND u."authId" = (select auth.uid())));

-- Resource
CREATE POLICY "resource_select" ON "Resource" FOR SELECT USING (
  public.is_team_member("teamId"::uuid, (select auth.uid()))
  OR ("projectId" IS NOT NULL AND public.is_project_member("projectId"::uuid, (select auth.uid())))
);
CREATE POLICY "resource_write" ON "Resource" FOR ALL USING (
  public.is_team_member("teamId"::uuid, (select auth.uid()))
  OR ("projectId" IS NOT NULL AND public.has_producer_access("projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  public.is_team_member("teamId"::uuid, (select auth.uid()))
  OR ("projectId" IS NOT NULL AND public.has_producer_access("projectId"::uuid, (select auth.uid())))
);

-- Budget
CREATE POLICY "budget_select" ON "Budget" FOR SELECT
  USING (public.has_producer_access("projectId"::uuid, (select auth.uid())));
CREATE POLICY "budget_write" ON "Budget" FOR ALL
  USING (public.has_producer_access("projectId"::uuid, (select auth.uid())))
  WITH CHECK (public.has_producer_access("projectId"::uuid, (select auth.uid())));

DO $$
DECLARE
  table_name TEXT;
  budget_chain TEXT[] := ARRAY['BudgetVersion','BudgetAccount','BudgetLine','BudgetVariable','BudgetMarkup','Expense'];
BEGIN
  FOREACH table_name IN ARRAY budget_chain LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (
         EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                 AND public.has_producer_access(b."projectId"::uuid, (select auth.uid()))))',
      lower(table_name), table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL
         USING (EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                AND public.has_producer_access(b."projectId"::uuid, (select auth.uid()))))
         WITH CHECK (EXISTS (SELECT 1 FROM "Budget" b WHERE b.id = %I."budgetId"
                AND public.has_producer_access(b."projectId"::uuid, (select auth.uid()))))',
      lower(table_name), table_name, table_name, table_name);
  END LOOP;
END $$;

CREATE POLICY "budget_line_amount_select" ON "BudgetLineAmount" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, (select auth.uid())))
);
CREATE POLICY "budget_line_amount_write" ON "BudgetLineAmount" FOR ALL USING (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, (select auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM "BudgetLine" bl
          JOIN "Budget" b ON b.id = bl."budgetId"
          WHERE bl.id = "BudgetLineAmount"."lineId"
          AND public.has_producer_access(b."projectId"::uuid, (select auth.uid())))
);

-- Storage policies
CREATE POLICY "moodboard_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "moodboard_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "moodboard_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "moodboard_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));

-- Storyboard with both path conventions (auth-009)
CREATE POLICY "storyboard_select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'storyboard'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (
    public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM "Shot" s
      JOIN "Scene" sc ON sc.id = s."sceneId"
      WHERE s.id = (storage.foldername(name))[1]
        AND public.is_project_member(sc."projectId"::uuid, (select auth.uid()))
    )
  )
);
CREATE POLICY "storyboard_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "storyboard_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "storyboard_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));

-- Entity-attachments (path or table fallback)
CREATE POLICY "entity_attachments_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'entity-attachments'
    AND (
      ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
       AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())))
      OR EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, (select auth.uid()))
      )
    )
  );
CREATE POLICY "entity_attachments_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'entity-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())));
CREATE POLICY "entity_attachments_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'entity-attachments'
    AND (
      ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
       AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())))
      OR EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, (select auth.uid()))
      )
    ));
CREATE POLICY "entity_attachments_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'entity-attachments'
    AND (
      ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
       AND public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid())))
      OR EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, (select auth.uid()))
      )
    ));

-- Avatars (public read; owner writes)
CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_self" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars'
    AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = (storage.foldername(name))[1] AND u."authId" = (select auth.uid())));
CREATE POLICY "avatars_update_self" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars'
    AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = (storage.foldername(name))[1] AND u."authId" = (select auth.uid())));
CREATE POLICY "avatars_delete_self" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars'
    AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = (storage.foldername(name))[1] AND u."authId" = (select auth.uid())));

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3 — add missing FK indices flagged by advisor
-- ═══════════════════════════════════════════════════════════════════════

-- FK columns confirmed via information_schema.columns. Thread/ThreadMessage
-- use createdBy (not authorId); WorkflowNode uses assigneeId.
CREATE INDEX IF NOT EXISTS "ActionItem_assignedTo_idx" ON "ActionItem" ("assignedTo");
CREATE INDEX IF NOT EXISTS "ActionItem_projectId_idx"  ON "ActionItem" ("projectId");
CREATE INDEX IF NOT EXISTS "BudgetMarkup_accountId_idx"  ON "BudgetMarkup" ("accountId");
CREATE INDEX IF NOT EXISTS "BudgetMarkup_versionId_idx"  ON "BudgetMarkup" ("versionId");
CREATE INDEX IF NOT EXISTS "BudgetVariable_versionId_idx" ON "BudgetVariable" ("versionId");
CREATE INDEX IF NOT EXISTS "ChatMessage_recipientId_idx" ON "ChatMessage" ("recipientId");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx"    ON "ChatMessage" ("senderId");
CREATE INDEX IF NOT EXISTS "ChatMessage_projectId_idx"   ON "ChatMessage" ("projectId");
CREATE INDEX IF NOT EXISTS "ChatMessage_channelId_idx"   ON "ChatMessage" ("channelId");
CREATE INDEX IF NOT EXISTS "ChatChannel_projectId_idx"   ON "ChatChannel" ("projectId");
CREATE INDEX IF NOT EXISTS "CrewTimecard_approvedBy_idx" ON "CrewTimecard" ("approvedBy");
CREATE INDEX IF NOT EXISTS "CrewTimecard_reopenedBy_idx" ON "CrewTimecard" ("reopenedBy");
CREATE INDEX IF NOT EXISTS "Deliverable_projectId_idx"  ON "Deliverable" ("projectId");
CREATE INDEX IF NOT EXISTS "Document_createdBy_idx"     ON "Document" ("createdBy");
CREATE INDEX IF NOT EXISTS "Document_projectId_idx"     ON "Document" ("projectId");
CREATE INDEX IF NOT EXISTS "Entity_projectId_idx"       ON "Entity" ("projectId");
CREATE INDEX IF NOT EXISTS "Folder_projectId_idx"       ON "Folder" ("projectId");
CREATE INDEX IF NOT EXISTS "Location_projectId_idx"     ON "Location" ("projectId");
CREATE INDEX IF NOT EXISTS "Milestone_projectId_idx"    ON "Milestone" ("projectId");
CREATE INDEX IF NOT EXISTS "MilestonePerson_userId_idx" ON "MilestonePerson" ("userId");
CREATE INDEX IF NOT EXISTS "MoodboardRef_projectId_idx" ON "MoodboardRef" ("projectId");
CREATE INDEX IF NOT EXISTS "MoodboardRef_tabId_idx"     ON "MoodboardRef" ("tabId");
CREATE INDEX IF NOT EXISTS "MoodboardTab_projectId_idx" ON "MoodboardTab" ("projectId");
CREATE INDEX IF NOT EXISTS "Project_teamId_idx"         ON "Project" ("teamId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx"   ON "ProjectMember" ("userId");
CREATE INDEX IF NOT EXISTS "Resource_createdBy_idx"     ON "Resource" ("createdBy");
CREATE INDEX IF NOT EXISTS "Resource_folderId_idx"      ON "Resource" ("folderId");
CREATE INDEX IF NOT EXISTS "Resource_projectId_idx"     ON "Resource" ("projectId");
CREATE INDEX IF NOT EXISTS "Scene_projectId_idx"        ON "Scene" ("projectId");
CREATE INDEX IF NOT EXISTS "ShootDay_locationId_idx"    ON "ShootDay" ("locationId");
CREATE INDEX IF NOT EXISTS "Shot_sceneId_idx"           ON "Shot" ("sceneId");
CREATE INDEX IF NOT EXISTS "ShotlistVersion_projectId_idx" ON "ShotlistVersion" ("projectId");
CREATE INDEX IF NOT EXISTS "Talent_projectId_idx"       ON "Talent" ("projectId");
CREATE INDEX IF NOT EXISTS "TalentAssignment_entityId_idx" ON "TalentAssignment" ("entityId");
CREATE INDEX IF NOT EXISTS "TalentAssignment_talentId_idx" ON "TalentAssignment" ("talentId");
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx"      ON "TeamMember" ("userId");
CREATE INDEX IF NOT EXISTS "Thread_createdBy_idx"       ON "Thread" ("createdBy");
CREATE INDEX IF NOT EXISTS "Thread_resolvedBy_idx"      ON "Thread" ("resolvedBy");
CREATE INDEX IF NOT EXISTS "ThreadMessage_createdBy_idx" ON "ThreadMessage" ("createdBy");
CREATE INDEX IF NOT EXISTS "UserProjectPlacement_folderId_idx" ON "UserProjectPlacement" ("folderId");
CREATE INDEX IF NOT EXISTS "UserProjectPlacement_projectId_idx" ON "UserProjectPlacement" ("projectId");
CREATE INDEX IF NOT EXISTS "WorkflowEdge_projectId_idx" ON "WorkflowEdge" ("projectId");
CREATE INDEX IF NOT EXISTS "WorkflowEdge_sourceId_idx"  ON "WorkflowEdge" ("sourceId");
CREATE INDEX IF NOT EXISTS "WorkflowEdge_targetId_idx"  ON "WorkflowEdge" ("targetId");
CREATE INDEX IF NOT EXISTS "WorkflowNode_assigneeId_idx" ON "WorkflowNode" ("assigneeId");
CREATE INDEX IF NOT EXISTS "WorkflowNode_projectId_idx" ON "WorkflowNode" ("projectId");
