-- Tighten storage policies for the two buckets that shipped with
-- pre-Auth permissive RLS and now need a real fence:
--   * call-sheet-attachments — created in 20260430110000_add_call_sheet
--                              with FOR ALL USING (bucket_id = ...)
--   * receipts               — loosened in 20260427180000_receipts_pre_auth_permissive
--                              with FOR ALL USING (bucket_id = ...)
--
-- Both buckets are public=false so files reach via signed URLs. With
-- the existing policies, any caller (anon or authenticated) holding the
-- bucket id and a path could read or overwrite arbitrary objects. The
-- policies below restrict each operation to project members on the
-- owning project.
--
-- Path conventions (set by the upload helpers in lib/db/queries.ts):
--   call-sheet-attachments: ${callSheetId}/${ts}-${rand}.${ext}
--   receipts:               ${projectId}/${lineId}/${ts}-${rand}.${ext}
--
-- Server-side flows that need RLS bypass (cron dispatch, service-role
-- admin client) continue to work unchanged.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE so re-running
-- the migration in dev environments doesn't fail.

-- ═══════════════════════════════════════════════════════════════════════
-- Drop existing permissive policies
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "call_sheet_attachments_anon_all" ON storage.objects;

DROP POLICY IF EXISTS "receipts_anon_read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_delete" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════════════
-- call-sheet-attachments — chain via callSheetId folder → CallSheet.projectId
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "call_sheet_attachments_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND (
          public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = cs."projectId"), (select auth.uid()))
          OR public.is_project_member(cs."projectId"::uuid, (select auth.uid()))
        )
    )
  );

CREATE POLICY "call_sheet_attachments_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  );

CREATE POLICY "call_sheet_attachments_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  );

CREATE POLICY "call_sheet_attachments_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- receipts — path[1] is projectId UUID
-- Budget RLS is producer-only (see 20260428005845 §"Budget family"); the
-- receipts bucket policies match that posture so a crew member can't
-- pull receipt PDFs they couldn't otherwise see in the budget UI.
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "receipts_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_producer_access((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );

CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_producer_access((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );

CREATE POLICY "receipts_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_producer_access((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );

CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_producer_access((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );
