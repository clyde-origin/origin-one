-- Storage discipline: bring moodboard + storyboard bucket setup into Prisma
-- migrations. Closes BUILD_STATUS #10. Establishes the bucket-migration
-- pattern that the upcoming `locations` and `avatars` buckets will follow.
--
-- Live-DB snapshot (Apr 26, 2026) showed drift this migration normalizes:
--   • moodboard had 6 policies — 3 canonical (script-named, underscored) plus
--     3 dashboard-added duplicates (moodboard_select / _insert / _update).
--     Drops the 3 duplicates; canonical 3 remain.
--   • storyboard had 3 policies with spaces in their names ("storyboard public
--     read", etc.) — dashboard-created. Drops those; recreates 3 canonical
--     policies with the moodboard naming convention.
--   • storyboard bucket had NULL file_size_limit and NULL allowed_mime_types
--     — preserved as-is. Tightening to a size cap and MIME allowlist happens
--     on Auth day along with table RLS (CLAUDE.md "Storage").
--
-- Policies remain permissive (anon read/write) for both buckets — matches
-- existing live behavior. Auth-day work locks them down alongside the
-- rest of the RLS pass.
--
-- Idempotent: ON CONFLICT DO UPDATE on bucket rows; DROP POLICY IF EXISTS
-- before each CREATE.

-- ─── moodboard bucket ────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('moodboard', 'moodboard', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop dashboard-duplicate moodboard policies (live DB has 6; only 3 canonical).
DROP POLICY IF EXISTS "moodboard_select" ON storage.objects;
DROP POLICY IF EXISTS "moodboard_insert" ON storage.objects;
DROP POLICY IF EXISTS "moodboard_update" ON storage.objects;

-- Recreate the 3 canonical moodboard policies.
DROP POLICY IF EXISTS "moodboard_public_read" ON storage.objects;
DROP POLICY IF EXISTS "moodboard_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "moodboard_anon_update" ON storage.objects;

CREATE POLICY "moodboard_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'moodboard');

CREATE POLICY "moodboard_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'moodboard');

CREATE POLICY "moodboard_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'moodboard');

-- ─── storyboard bucket ───────────────────────────────────────────────────
-- Bucket exists in live DB with no size or MIME restrictions. Captured as-is
-- here; tightening (size cap, MIME allowlist) happens on Auth day.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('storyboard', 'storyboard', true, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop dashboard-named storyboard policies (live names use spaces).
DROP POLICY IF EXISTS "storyboard public read" ON storage.objects;
DROP POLICY IF EXISTS "storyboard anon insert" ON storage.objects;
DROP POLICY IF EXISTS "storyboard anon update" ON storage.objects;

-- Recreate canonical 3 storyboard policies (mirrors moodboard naming).
DROP POLICY IF EXISTS "storyboard_public_read" ON storage.objects;
DROP POLICY IF EXISTS "storyboard_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "storyboard_anon_update" ON storage.objects;

CREATE POLICY "storyboard_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'storyboard');

CREATE POLICY "storyboard_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'storyboard');

CREATE POLICY "storyboard_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'storyboard');
