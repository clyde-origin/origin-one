-- Fix the avatars storage policies. The intent of the policy was to allow the
-- signed-in user to write to paths whose first folder segment is their User.id:
--
--   EXISTS (SELECT 1 FROM "User" u
--             WHERE u.id = (storage.foldername(name))[1]
--               AND u."authId" = auth.uid())
--
-- but unqualified `name` inside the subquery resolves to the INNER table alias
-- `u.name` (Postgres binds to the innermost matching column), which is the
-- user's display name. `storage.foldername('Clyde Bessey')` returns an empty
-- array, `[][1]` is NULL, the equality fails, and EXISTS is always false —
-- avatar upload reliably 400s with "new row violates row-level security
-- policy" no matter how correct the path is.
--
-- Fix: disambiguate with `objects.name` so the storage row's name is used.
--
-- Same fix applied to insert / update / delete; the public SELECT policy is
-- correct as-is and is left untouched.

DROP POLICY IF EXISTS "avatars_insert_self" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_self" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_self" ON storage.objects;

CREATE POLICY "avatars_insert_self" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(objects.name))[1]
        AND u."authId" = (select auth.uid())
    )
  );

CREATE POLICY "avatars_update_self" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(objects.name))[1]
        AND u."authId" = (select auth.uid())
    )
  );

CREATE POLICY "avatars_delete_self" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = (storage.foldername(objects.name))[1]
        AND u."authId" = (select auth.uid())
    )
  );
