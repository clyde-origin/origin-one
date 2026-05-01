-- RLS for the four Daily Schedule + Call Sheets tables.
--
-- The original migrations (20260430100000_add_schedule_block,
-- 20260430110000_add_call_sheet, 20260430120000_add_call_sheet_distribution)
-- shipped during the final pre-Auth window with `GRANT ALL ... TO anon,
-- authenticated, service_role` and no RLS — matching the pre-Auth permissive
-- pattern. With Auth shipped, the post-Auth grant revoke (20260428005845
-- §"Revoke anon") removed `anon` privileges, but the four tables here were
-- created AFTER that migration and therefore retain `authenticated` ALL
-- grants with no row-level fence. Any signed-in user could SELECT or modify
-- every project's CallSheet, recipient list, delivery state, and schedule.
--
-- Shape: high_trust_write — SELECT for any project member (so crew can
-- see the call sheet they're called for), WRITE for producer-tier OR
-- ProjectMember.canEdit = true (matches the existing Scene / ShootDay
-- pattern used for project-management data).
--
-- The public token confirm/view routes (/c/[token]/*) use the
-- service-role admin client and therefore bypass RLS, which is the
-- correct posture: the token itself is the capability, not the
-- session. Server-side dispatch (cron + send route) likewise uses
-- service-role.
--
-- Perf: all auth.uid() calls wrapped in (select auth.uid()) per the
-- 20260428153150_rls_perf_initplan_wrap pattern.

-- ═══════════════════════════════════════════════════════════════════════
-- ScheduleBlock — direct projectId
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "ScheduleBlock" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduleblock_select" ON "ScheduleBlock" FOR SELECT
  USING (
    public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = "ScheduleBlock"."projectId"), (select auth.uid()))
    OR public.is_project_member("ScheduleBlock"."projectId"::uuid, (select auth.uid()))
  );

CREATE POLICY "scheduleblock_write" ON "ScheduleBlock" FOR ALL
  USING (public.has_high_trust_write("ScheduleBlock"."projectId"::uuid, (select auth.uid())))
  WITH CHECK (public.has_high_trust_write("ScheduleBlock"."projectId"::uuid, (select auth.uid())));

-- ═══════════════════════════════════════════════════════════════════════
-- CallSheet — direct projectId
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "CallSheet" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callsheet_select" ON "CallSheet" FOR SELECT
  USING (
    public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = "CallSheet"."projectId"), (select auth.uid()))
    OR public.is_project_member("CallSheet"."projectId"::uuid, (select auth.uid()))
  );

CREATE POLICY "callsheet_write" ON "CallSheet" FOR ALL
  USING (public.has_high_trust_write("CallSheet"."projectId"::uuid, (select auth.uid())))
  WITH CHECK (public.has_high_trust_write("CallSheet"."projectId"::uuid, (select auth.uid())));

-- ═══════════════════════════════════════════════════════════════════════
-- CallSheetRecipient — chains via callSheetId → CallSheet.projectId
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "CallSheetRecipient" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callsheetrecipient_select" ON "CallSheetRecipient" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = "CallSheetRecipient"."callSheetId"
        AND (
          public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = cs."projectId"), (select auth.uid()))
          OR public.is_project_member(cs."projectId"::uuid, (select auth.uid()))
        )
    )
  );

CREATE POLICY "callsheetrecipient_write" ON "CallSheetRecipient" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = "CallSheetRecipient"."callSheetId"
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      WHERE cs.id = "CallSheetRecipient"."callSheetId"
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- CallSheetDelivery — chains recipientId → CallSheetRecipient.callSheetId
--                     → CallSheet.projectId
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "CallSheetDelivery" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callsheetdelivery_select" ON "CallSheetDelivery" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "CallSheetRecipient" csr
      JOIN "CallSheet" cs ON cs.id = csr."callSheetId"
      WHERE csr.id = "CallSheetDelivery"."recipientId"
        AND (
          public.is_team_member((SELECT "teamId"::uuid FROM "Project" WHERE id = cs."projectId"), (select auth.uid()))
          OR public.is_project_member(cs."projectId"::uuid, (select auth.uid()))
        )
    )
  );

CREATE POLICY "callsheetdelivery_write" ON "CallSheetDelivery" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "CallSheetRecipient" csr
      JOIN "CallSheet" cs ON cs.id = csr."callSheetId"
      WHERE csr.id = "CallSheetDelivery"."recipientId"
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "CallSheetRecipient" csr
      JOIN "CallSheet" cs ON cs.id = csr."callSheetId"
      WHERE csr.id = "CallSheetDelivery"."recipientId"
        AND public.has_high_trust_write(cs."projectId"::uuid, (select auth.uid()))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- FK indices for chain lookups (RLS hot path)
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "CallSheetRecipient_callSheetId_idx_rls"
  ON "CallSheetRecipient"("callSheetId");
CREATE INDEX IF NOT EXISTS "CallSheetDelivery_recipientId_idx_rls"
  ON "CallSheetDelivery"("recipientId");

-- ═══════════════════════════════════════════════════════════════════════
-- Revoke anon — these tables were created after the original anon-revoke
-- migration so they re-granted anon ALL via the pre-Auth permissive
-- pattern. Mirror the post-Auth posture from 20260428005845.
-- ═══════════════════════════════════════════════════════════════════════

REVOKE ALL ON TABLE "ScheduleBlock"      FROM anon;
REVOKE ALL ON TABLE "CallSheet"          FROM anon;
REVOKE ALL ON TABLE "CallSheetRecipient" FROM anon;
REVOKE ALL ON TABLE "CallSheetDelivery"  FROM anon;
