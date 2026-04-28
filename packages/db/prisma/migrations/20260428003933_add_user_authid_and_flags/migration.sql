-- Auth PR #1 — add User.authId, partner Role, EntityAttachment.uploadedById NOT NULL,
--             Project.is_demo, ProjectMember.canEdit
-- Reference: docs/superpowers/specs/2026-04-26-auth-design.md
-- Reference: docs/superpowers/plans/2026-04-27-auth.md (PR 1)

-- ─── 1. User.authId ──────────────────────────────────────────────────────
-- Nullable UUID with UNIQUE constraint and FK to auth.users.
-- Populated by the invite-binding handler on first sign-in (PR #6).
-- ON DELETE SET NULL preserves User row + authored content if auth.users
-- row is removed; user becomes un-claimable until re-invited.
ALTER TABLE "User" ADD COLUMN "authId" UUID;
ALTER TABLE "User" ADD CONSTRAINT "User_authId_key" UNIQUE ("authId");
ALTER TABLE "User"
  ADD CONSTRAINT "User_authId_fkey"
  FOREIGN KEY ("authId") REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. Role enum: add 'partner' ─────────────────────────────────────────
-- Partner UI/RLS deferred — schema-ready only so future work doesn't need
-- another schema PR.
ALTER TYPE "Role" ADD VALUE 'partner';

-- ─── 3. EntityAttachment.uploadedById NOT NULL ───────────────────────────
-- Verified 2026-04-28: 82 rows, all with non-null uploadedById. Safe flip.
ALTER TABLE "EntityAttachment" ALTER COLUMN "uploadedById" SET NOT NULL;

-- ─── 4. Project.is_demo flag ─────────────────────────────────────────────
ALTER TABLE "Project" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Mark the 6 canonical demo projects on Origin Point team.
-- Names per back-to-one-seed-v1.html (locked seed). User-created or test
-- projects (e.g., "Test") are deliberately excluded.
UPDATE "Project" SET "is_demo" = true
WHERE "name" IN (
  'Simple Skin Promo',
  'Full Send',
  'In Vino Veritas',
  'Flexibility Course A',
  'Natural Order',
  'The Weave'
);

-- ─── 5. ProjectMember.canEdit flag ───────────────────────────────────────
ALTER TABLE "ProjectMember" ADD COLUMN "canEdit" BOOLEAN NOT NULL DEFAULT false;

-- Producer / director rows backfill to true (they always have full edit access).
-- Crew rows stay false; producer flips trusted contributors to true via UI later.
UPDATE "ProjectMember" SET "canEdit" = true WHERE role IN ('producer', 'director');

-- Verification: count flags applied
DO $$
DECLARE
  v_demo INTEGER;
  v_canedit INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_demo FROM "Project" WHERE "is_demo" = true;
  IF v_demo <> 6 THEN
    RAISE EXCEPTION 'is_demo backfill: expected 6 projects, got %', v_demo;
  END IF;
  SELECT COUNT(*) INTO v_canedit FROM "ProjectMember" WHERE "canEdit" = true;
  RAISE NOTICE 'canEdit=true backfilled on % ProjectMember rows', v_canedit;
END $$;
