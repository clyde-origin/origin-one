-- Storyboard SELECT policy — drift repair
--
-- Production storyboard_select drifted from the canonical source after the
-- 20260428153150_rls_perf_initplan_wrap migration applied. A hand-edit added
-- a 3-table join (Shot/Scene/Project) plus an is_demo escape hatch and
-- accidentally introduced a typo: `s.id = (storage.foldername(p.name))[1]`
-- references the Project NAME column instead of the storage object's name.
-- The fallback predicate could never match, so all 85 seed-images uploaded
-- under the shotId-first convention were silently denied (the Hub + scenemaker
-- fell back to the colored gradient placeholder).
--
-- This migration re-asserts the canonical predicate from the perf-wrap
-- migration: dual support for projectId-first (in-app upload helper) and
-- shotId-first (seed-images pipeline) paths, both gated by is_project_member,
-- with auth.uid() init-plan wrapped per the perf pass.
--
-- Backed by DECISIONS Apr 29, 2026 — Storyboard RLS drift repair.

DROP POLICY IF EXISTS "storyboard_select" ON storage.objects;

CREATE POLICY "storyboard_select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'storyboard'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (
    -- Convention A: first folder is projectId (uploadStoryboardImage helper
    -- + post-2026-04-29 seed convention)
    public.is_project_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
    OR
    -- Convention B: first folder is shotId (legacy seed-images pipeline,
    -- pre-2026-04-29). Walk Shot → Scene → Project to verify membership.
    EXISTS (
      SELECT 1 FROM "Shot" s
      JOIN "Scene" sc ON sc.id = s."sceneId"
      WHERE s.id = (storage.foldername(name))[1]
        AND public.is_project_member(sc."projectId"::uuid, (select auth.uid()))
    )
  )
);
