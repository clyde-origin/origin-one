# @origin-one/db

This package does one thing: own the database schema, migrations, and client.

## What lives here
- Prisma schema
- All migrations
- Database client exported for use by all apps
- Seed images manifest + fetched bytes (`src/seed-images/`, `seed-images/files/`)

## Rules
- Schema changes here must be coordinated with packages/schema type changes
- Never import from apps
- Never contain business logic

## Seed images

Visual surfaces (locations, moodboards, props/wardrobe/hmu, cast headshots,
crew avatars) are seeded from a manifest at `src/seed-images/manifest.ts`.

- One-time fetch: `pnpm --filter @origin-one/db db:fetch-images`
  (needs OPENAI_API_KEY + PEXELS_API_KEY in .env; ~$5 spend).
- Routine seed: `pnpm --filter @origin-one/db prisma db seed`
  (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env; no API spend).
- Image bytes live in `seed-images/files/` and are committed to the repo.
- Bad image? Edit the manifest entry and run
  `pnpm db:fetch-images --force --only=<projectKey>.<surface>.<slug>`.
- Spec: `docs/superpowers/specs/2026-04-27-seed-images-design.md`
