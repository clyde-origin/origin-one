-- Broaden CallSheet / ScheduleBlock / call-sheet-attachments write access
-- to include Production-department crew (1st AD, PA, Production
-- Coordinator), matching the canEditCallSheet helper in
-- apps/back-to-one/src/lib/auth/call-sheet-permissions.ts.
--
-- The previous migration (20260501030000_call_sheet_schedule_block_rls)
-- used has_high_trust_write, which checks ProjectMember.canEdit = true
-- OR producer-tier. Production-department crew have canEdit = false
-- under the current binding (lib/auth/binding.ts only sets canEdit for
-- producer/director), so the AD/PA flow that the UI explicitly allows
-- ("crew with department === 'Production' can edit and send") would
-- have failed at the DB layer.
--
-- Fix: introduce can_edit_call_sheet() helper that overlays the
-- Production-department check on top of has_high_trust_write, and
-- swap the four policies (call sheet write, attachments insert/update/
-- delete) to use it. Read paths are unchanged.
--
-- When the upcoming Department-enum-conversion arc lands, swap the
-- string literal 'Production' for the enum member; the helper is the
-- single point of update.

CREATE OR REPLACE FUNCTION public.can_edit_call_sheet(p_project_id UUID, p_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.has_high_trust_write(p_project_id, p_auth_id)
    OR EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      JOIN "User" u ON u.id = pm."userId"
      WHERE pm."projectId" = p_project_id::text
        AND u."authId" = p_auth_id
        AND pm."department" = 'Production'
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_call_sheet(UUID, UUID) TO authenticated, anon, service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- Replace WRITE policies on the four call-sheet tables
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "scheduleblock_write"        ON "ScheduleBlock";
DROP POLICY IF EXISTS "callsheet_write"            ON "CallSheet";
DROP POLICY IF EXISTS "callsheetrecipient_write"   ON "CallSheetRecipient";
DROP POLICY IF EXISTS "callsheetdelivery_write"    ON "CallSheetDelivery";

CREATE POLICY "scheduleblock_write" ON "ScheduleBlock" FOR ALL
  USING (public.can_edit_call_sheet("ScheduleBlock"."projectId"::uuid, (select auth.uid())))
  WITH CHECK (public.can_edit_call_sheet("ScheduleBlock"."projectId"::uuid, (select auth.uid())));

CREATE POLICY "callsheet_write" ON "CallSheet" FOR ALL
  USING (public.can_edit_call_sheet("CallSheet"."projectId"::uuid, (select auth.uid())))
  WITH CHECK (public.can_edit_call_sheet("CallSheet"."projectId"::uuid, (select auth.uid())));

CREATE POLICY "callsheetrecipient_write" ON "CallSheetRecipient" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = "CallSheetRecipient"."callSheetId"
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = "CallSheetRecipient"."callSheetId"
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  );

CREATE POLICY "callsheetdelivery_write" ON "CallSheetDelivery" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "CallSheetRecipient" csr
      JOIN "CallSheet" cs ON cs.id = csr."callSheetId"
      WHERE csr.id = "CallSheetDelivery"."recipientId"
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "CallSheetRecipient" csr
      JOIN "CallSheet" cs ON cs.id = csr."callSheetId"
      WHERE csr.id = "CallSheetDelivery"."recipientId"
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Replace WRITE policies on call-sheet-attachments storage objects
-- (insert / update / delete; SELECT was already project-member-scoped)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "call_sheet_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "call_sheet_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "call_sheet_attachments_delete" ON storage.objects;

CREATE POLICY "call_sheet_attachments_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  );

CREATE POLICY "call_sheet_attachments_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  );

CREATE POLICY "call_sheet_attachments_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'call-sheet-attachments'
    AND EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = (storage.foldername(name))[1]
        AND public.can_edit_call_sheet(cs."projectId"::uuid, (select auth.uid()))
    )
  );
