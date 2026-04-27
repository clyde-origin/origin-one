-- Adds the `avatars` storage bucket — User avatar photos uploaded from the
-- Crew Profile v2 UI (#22). Closes BUILD_STATUS #21.
--
-- Ships permissive (public SELECT, anon INSERT/UPDATE/DELETE) — same posture
-- as `entity-attachments` and the legacy `moodboard`/`storyboard` buckets,
-- per DECISIONS.md "Avatars storage — v1 unsigned public URLs, RLS deferred."
-- Tightening to authenticated-only happens on Auth day along with table RLS.
--
-- Path convention: `{userId}/{rand}.{ext}`. Random per-file IDs make URLs
-- unguessable; uploadAvatar best-effort-deletes the old User.avatarUrl object
-- when replacing so we don't accumulate orphan storage objects per user.
--
-- Configuration: 5MB cap (avatars are typically much smaller; tighter than
-- the 10MB cap on entity-attachments since hero scout photos can be larger
-- than a profile pic), png/jpeg/webp.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_anon_insert"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_anon_update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_anon_delete"  ON storage.objects;

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_anon_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars');
