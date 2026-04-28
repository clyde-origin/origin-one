-- Loosen the receipts bucket's storage.objects RLS to match the
-- pre-Auth permissive posture of moodboard / storyboard /
-- entity-attachments / avatars (see CLAUDE.md storage discipline +
-- DECISIONS.md "Receipts storage").
--
-- WHY: PR 14 (#72) browser smoke surfaced that the localStorage-only
-- viewer-shim does NOT establish a Supabase auth session. The
-- `auth.role() = 'authenticated'` check on the original receipts
-- policies (PR 4 / 20260426200000_add_budget_core) denied every
-- browser upload. Two options to unblock dogfood:
--   1. Wire a real auth flow now (out of scope — Auth is its own arc).
--   2. Mirror the existing permissive pattern; tighten on Auth day.
--
-- Picking (2) — same trade as moodboard/storyboard/entity-attachments/
-- avatars. Bucket stays `public=false` so files can ONLY be reached
-- via signed URLs (still better than fully public). Producer-only
-- access is enforced at the UI layer; anyone with anon key + path can
-- fetch a signed URL pre-Auth, which is acceptable for the closed-set
-- dogfood (Tyler + Kelly). Sealed alongside the #24 RLS pass on Auth
-- day.
--
-- Idempotent — DROP POLICY IF EXISTS before each CREATE.

DROP POLICY IF EXISTS "receipts_auth_read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_anon_delete" ON storage.objects;

CREATE POLICY "receipts_anon_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_anon_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_anon_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_anon_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts');
