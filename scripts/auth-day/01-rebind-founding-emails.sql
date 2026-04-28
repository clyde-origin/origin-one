-- Auth Day Step 01 — rebind founding-team emails
--
-- Run this BEFORE issuing Supabase auth invites to Clyde, Tyler, and Kelly.
-- The binding handler matches by email — if the auth.users.email doesn't
-- match the User.email column, the bind fails.
--
-- This file lives outside packages/db/prisma/migrations/ deliberately:
-- prisma migrate deploy does not understand `psql -v` substitution, so a
-- migration with this syntax would block all subsequent migrations. The
-- rebind is a one-time runbook step with secrets at apply time, not a
-- schema change tracked in _prisma_migrations.
--
-- Run with envs:
--
--   export CLYDE_REAL_EMAIL="..."
--   export TYLER_REAL_EMAIL="..."
--   export KELLY_REAL_EMAIL="..."
--
--   psql "$DATABASE_URL_PRODUCTION" \
--     -v clyde_email="$CLYDE_REAL_EMAIL" \
--     -v tyler_email="$TYLER_REAL_EMAIL" \
--     -v kelly_email="$KELLY_REAL_EMAIL" \
--     -f scripts/auth-day/01-rebind-founding-emails.sql
--
-- Verify:
--   SELECT name, email FROM "User"
--   WHERE name IN ('Clyde Bessey','Tyler Heckerman','Kelly Pratt');

DO $$
DECLARE
  v_clyde TEXT := :'clyde_email';
  v_tyler TEXT := :'tyler_email';
  v_kelly TEXT := :'kelly_email';
BEGIN
  -- Conflict guard: target real emails must not already exist on a
  -- non-founding User row.
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE email IN (v_clyde, v_tyler, v_kelly)
      AND name NOT IN ('Clyde Bessey','Tyler Heckerman','Kelly Pratt')
  ) THEN
    RAISE EXCEPTION 'Conflict: a target real email already exists on a non-founding User row';
  END IF;

  UPDATE "User" SET email = v_clyde
    WHERE name = 'Clyde Bessey'    AND email = 'clyde.bessey@originpoint.com';
  UPDATE "User" SET email = v_tyler
    WHERE name = 'Tyler Heckerman' AND email = 'tyler.heckerman@originpoint.com';
  UPDATE "User" SET email = v_kelly
    WHERE name = 'Kelly Pratt'     AND email = 'kelly.pratt@originpoint.com';

  -- Verify each updated.
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE name = 'Clyde Bessey'    AND email = v_clyde) THEN
    RAISE EXCEPTION 'Founding rebind failed: Clyde Bessey email did not update';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE name = 'Tyler Heckerman' AND email = v_tyler) THEN
    RAISE EXCEPTION 'Founding rebind failed: Tyler Heckerman email did not update';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE name = 'Kelly Pratt'     AND email = v_kelly) THEN
    RAISE EXCEPTION 'Founding rebind failed: Kelly Pratt email did not update';
  END IF;
END $$;
