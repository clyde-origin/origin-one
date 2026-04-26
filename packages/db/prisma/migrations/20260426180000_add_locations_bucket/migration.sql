-- Adds the `locations` storage bucket — production location photos uploaded
-- from the Locations page detail sheet (#11 Location images feature).
--
-- First bucket to ship with auth-check RLS (per CLAUDE.md "Storage" — new
-- buckets ship authenticated from day one). Establishes the pattern that
-- the upcoming `avatars` bucket will follow.
--
-- Policy shape:
--   • SELECT  — public. Image URLs in <img src> tags need unauthenticated
--     read so LocationCard can render thumbnails directly. (URLs are
--     non-guessable; this matches the existing moodboard pattern post-
--     normalization.)
--   • INSERT  — authenticated only. Pre-Auth this rejects every upload,
--     which is intended: the feature is wired but ungated until Auth (#23)
--     ships.
--   • UPDATE  — authenticated only (needed for upsert).
--
-- Configuration: 10MB cap, png/jpeg/webp — same as moodboard.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('locations', 'locations', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "locations_public_read"          ON storage.objects;
DROP POLICY IF EXISTS "locations_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "locations_authenticated_update" ON storage.objects;

CREATE POLICY "locations_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'locations');

CREATE POLICY "locations_authenticated_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'locations' AND auth.role() = 'authenticated');

CREATE POLICY "locations_authenticated_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'locations' AND auth.role() = 'authenticated');
