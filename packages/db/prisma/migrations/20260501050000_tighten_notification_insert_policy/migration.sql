-- Tighten Notification insert policy. The original migration
-- (20260429231353_add_mentions_and_notifications) shipped with a stub
-- that allowed any authenticated user to insert a Notification with an
-- arbitrary userId/actorId/projectId — i.e. any signed-in user could
-- forge a notification appearing to come from any other user, deep-
-- linking anywhere in the app. The same migration left a TODO marking
-- this as the Auth-day target; this is that tightening.
--
-- New checks:
--   * actorId must resolve to the caller (User.authId = auth.uid())
--   * userId must NOT resolve to the caller (no self-notifications)
--   * projectId must be one the caller is a member of
--
-- The TODO in the original migration compared "actorId = auth.uid()"
-- directly, but actorId is User.id (the public table) while auth.uid()
-- is auth.users.id — they're different namespaces joined via User.authId.
-- Resolved here via an EXISTS join.

DROP POLICY IF EXISTS "Notification_insert_authenticated" ON "Notification";

CREATE POLICY "Notification_insert_authenticated"
  ON "Notification" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "Notification"."actorId"
        AND u."authId" = (select auth.uid())
    )
    AND public.is_project_member("Notification"."projectId"::uuid, (select auth.uid()))
    AND NOT EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "Notification"."userId"
        AND u."authId" = (select auth.uid())
    )
  );
