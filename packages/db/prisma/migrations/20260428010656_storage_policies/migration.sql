-- Auth PR #5 — storage policies (Auth Day tightening)
-- Reference: docs/superpowers/specs/2026-04-26-auth-design.md (Storage section)
-- Reference: docs/superpowers/plans/2026-04-27-auth.md (PR 5)
--
-- DO NOT MERGE until PR #5b (signed URLs) is also ready and PR #6 (sign-in)
-- is ready to ship in lockstep.
--
-- After this migration applies:
-- - moodboard / storyboard / entity-attachments image fetches require auth.
-- - getPublicUrl() URLs against these buckets stop resolving.
-- - PR #5b's useStorageImage hook + uploadEntityAttachment path change
--   must be live for the app to render images.

-- ═══════════════════════════════════════════════════════════════════════
-- Drop existing permissive policies
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        policyname LIKE 'moodboard_%'
        OR policyname LIKE 'storyboard_%'
        OR policyname LIKE 'entity_attachments_%'
        OR policyname LIKE 'avatars_%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s" ON storage.objects', policy_record.policyname);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Bucket-level public flag flips
-- ═══════════════════════════════════════════════════════════════════════

UPDATE storage.buckets SET public = false WHERE id IN ('moodboard','storyboard','entity-attachments');
-- avatars stays public:true for display URLs (writes/deletes still locked).
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- ═══════════════════════════════════════════════════════════════════════
-- moodboard policies — path: ${projectId}/${ts}-${rand}.${ext}
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "moodboard_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "moodboard_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "moodboard_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "moodboard_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'moodboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- storyboard policies — path: ${projectId}/${shotId}.${ext}
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "storyboard_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "storyboard_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "storyboard_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "storyboard_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'storyboard'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- entity-attachments policies — path: ${projectId}/${type}/${id}/${rand}.${ext}
--   (PR #5b updates uploadEntityAttachment to use this format)
-- For row-existing fallback (e.g. legacy paths if any): also accept rows
-- that resolve via the EntityAttachment table.
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "entity_attachments_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'entity-attachments'
    AND (
      -- Path-based check (new format)
      (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
      )
      OR
      -- Row-based fallback (old format, if any rows ever land before PR #5b)
      EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, auth.uid())
      )
    )
  );
CREATE POLICY "entity_attachments_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'entity-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "entity_attachments_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'entity-attachments'
    AND (
      (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
      )
      OR
      EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, auth.uid())
      )
    )
  );
CREATE POLICY "entity_attachments_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'entity-attachments'
    AND (
      (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
      )
      OR
      EXISTS (
        SELECT 1 FROM "EntityAttachment" ea
        WHERE ea."storagePath" = name
        AND public.is_project_member(ea."projectId"::uuid, auth.uid())
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- avatars policies — path: ${userId}/${rand}.${ext}
-- Public read for display; writes/deletes locked to the user themselves.
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_self" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(name))[1]
        AND u."authId" = auth.uid()
    )
  );
CREATE POLICY "avatars_update_self" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(name))[1]
        AND u."authId" = auth.uid()
    )
  );
CREATE POLICY "avatars_delete_self" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(name))[1]
        AND u."authId" = auth.uid()
    )
  );
