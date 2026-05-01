-- Align operational-table WRITE policy with SELECT policy.
--
-- Operational tables (Thread, ChatChannel, ChatMessage, ActionItem, Document,
-- Folder, MoodboardRef, EntityAttachment) currently allow:
--
--   SELECT: is_team_member OR is_project_member
--   WRITE : is_project_member  ← asymmetric
--
-- Effect of the asymmetry: a team-tier producer who creates a brand-new project
-- but has no explicit ProjectMember row on it can read everything, but every
-- ActionItem / Thread / chat message they try to create is silently rejected
-- by RLS. The sheet just closes with no item appearing.
--
-- Fix: make WRITE accept the same set as SELECT — anyone who is a TeamMember of
-- the project's team OR a ProjectMember of the project can write operational
-- rows. Producer-tier and high-trust tables are unchanged.

DO $$
DECLARE
  table_name TEXT;
  operational TEXT[] := ARRAY['Thread','ChatChannel','ChatMessage','ActionItem',
                              'Document','Folder','MoodboardRef','EntityAttachment'];
BEGIN
  FOREACH table_name IN ARRAY operational LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON %I', lower(table_name), table_name);
    EXECUTE format(
      'CREATE POLICY "%s_write" ON %I FOR ALL USING (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), (select auth.uid()))
         OR public.is_project_member(%I."projectId"::uuid, (select auth.uid()))
       ) WITH CHECK (
         public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = %I."projectId"), (select auth.uid()))
         OR public.is_project_member(%I."projectId"::uuid, (select auth.uid()))
       )',
      lower(table_name), table_name, table_name, table_name, table_name, table_name);
  END LOOP;
END $$;
