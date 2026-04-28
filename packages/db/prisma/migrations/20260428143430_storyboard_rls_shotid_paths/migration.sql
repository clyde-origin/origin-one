-- Auth-009 hotfix — storyboard RLS supports BOTH path conventions
--
-- The auth-005 storyboard SELECT policy assumed the upload helper convention
-- `<projectId>/<shotId>.<ext>`, but the seed-images pipeline uploads as
-- `<shotId>/<filename>` (first folder = Shot.id, not Project.id). All 85
-- seeded shot images were rejected by RLS post-Auth Day.
--
-- Fix: accept either projectId-first OR shotId-first paths, chaining shotId
-- through Scene.projectId.
-- Already applied live via MCP execute_sql; this migration captures the fix
-- in source for migrate deploy reproducibility.

DROP POLICY IF EXISTS "storyboard_select" ON storage.objects;

CREATE POLICY "storyboard_select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'storyboard'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (
    -- Convention A: first folder is projectId (uploadStoryboardImage helper)
    public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
    OR
    -- Convention B: first folder is shotId (seed-images pipeline)
    EXISTS (
      SELECT 1 FROM "Shot" s
      JOIN "Scene" sc ON sc.id = s."sceneId"
      WHERE s.id = (storage.foldername(name))[1]
        AND public.is_project_member(sc."projectId"::uuid, auth.uid())
    )
  )
);
