-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the moodboard storage bucket + RLS policies for public read + anon upload.
-- Also adds gen_random_uuid() defaults to all tables that need it for PostgREST inserts.

-- ═══════════════════════════════════════════════════════════════
-- 1. STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'moodboard',
  'moodboard',
  true,
  10485760,  -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Public read — anyone can view moodboard images
CREATE POLICY IF NOT EXISTS "moodboard_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'moodboard');

-- 3. Anon + authenticated can upload
CREATE POLICY IF NOT EXISTS "moodboard_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'moodboard');

-- 4. Anon + authenticated can update (needed for upsert)
CREATE POLICY IF NOT EXISTS "moodboard_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'moodboard');

-- ═══════════════════════════════════════════════════════════════
-- 5. UUID DEFAULTS — Prisma uses @default(uuid()) which only works
--    through the Prisma client. PostgREST/Supabase JS needs Postgres-
--    level defaults. This adds gen_random_uuid() to all id columns.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE "User"            ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Team"            ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TeamMember"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ProjectMember"   ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Project"         ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Scene"           ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Shot"            ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Entity"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Document"        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Milestone"       ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "MilestonePerson" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ActionItem"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Thread"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ThreadMessage"   ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "MoodboardTab"    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "MoodboardRef"    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Location"        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Folder"          ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Resource"        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
