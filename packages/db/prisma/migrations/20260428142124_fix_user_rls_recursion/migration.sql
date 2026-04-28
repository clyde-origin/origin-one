-- Auth-008 hotfix — fix infinite recursion in User SELECT policy
--
-- The original auth-004 User policy joined the User table to find "me"
-- (the current authenticated user's User row), which triggered the User
-- RLS again, which re-joined User, etc. → 42P17 infinite recursion.
--
-- Fix: introduce a SECURITY DEFINER helper public.current_user_id() that
-- bypasses User RLS to return the calling user's User.id. Replace the
-- recursive User SELECT policy with one that uses the helper instead of
-- a User self-join.

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT id FROM "User" WHERE "authId" = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "user_select" ON "User";

CREATE POLICY "user_select" ON "User" FOR SELECT USING (
  "authId" = auth.uid()
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
