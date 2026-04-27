-- Follow-up to 20260426203000_user_project_folders. Prisma's `@updatedAt`
-- decorator only updates the column on app-side mutations; the column
-- needs an explicit DB-level DEFAULT for direct PostgREST inserts (which
-- the Supabase JS client uses) not to violate NOT NULL on first-write.
--
-- See GOTCHAS.md → "Prisma defaults are client-level only" for the
-- precedent set by the Thread.updatedAt fix.

ALTER TABLE "UserProjectFolder" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "UserProjectPlacement" ALTER COLUMN "updatedAt" SET DEFAULT now();
