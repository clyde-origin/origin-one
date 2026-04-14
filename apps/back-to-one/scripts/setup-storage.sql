-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Creates the moodboard storage bucket + RLS policies for public read + anon upload.

-- 1. Create bucket
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
