-- Codify the public-schema GRANTs that the live Supabase project needs
-- for the anon / authenticated / service_role roles to read + write.
--
-- WHY: The Supabase project ships with ZERO grants on public — every
-- role gets `permission denied for schema public` (42501). Clyde +
-- Claude added these manually via Supabase MCP during the PR 13
-- (#70 / Apr 27) smoke; without them, the PWA can't load demo
-- projects and the export routes can't read budget data. This
-- migration makes the same set reproducible across CI / prod / test /
-- fresh dev clones — without it, `migrate reset` leaves the DB
-- unusable.
--
-- Pattern: pre-Auth permissive — RLS on tables + storage stays the
-- enforcement layer (most tables have no RLS yet, which is intentional
-- for v1 dogfood). Tightened on Auth day's #24 RLS pass alongside
-- the storage-bucket tightening for moodboard / storyboard /
-- entity-attachments / avatars / receipts.
--
-- Idempotent: GRANT and ALTER DEFAULT PRIVILEGES are no-ops when the
-- privilege already exists.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public
  TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public
  TO service_role;

-- Future tables (created by Prisma in subsequent migrations) inherit
-- the same posture without a manual GRANT step.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
