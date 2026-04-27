import type { ImageEntry } from './paths'

// Single source of truth for every seed image. Populated mechanically from
// packages/db/prisma/seed.ts — every Location, MoodboardRef, narrative Entity
// (prop/wardrobe/hmu/character→cast Talent), and seeded crew User gets one entry.
//
// Operator workflow:
//   1. Run `pnpm --filter @origin-one/db db:fetch-images` to populate
//      packages/db/seed-images/files/ from this manifest.
//   2. `git add packages/db/seed-images/files/ && git commit`
//   3. `pnpm --filter @origin-one/db prisma db seed` reads the files and
//      uploads them through Supabase Storage.
//
// Bad output? Edit the entry, run with `--force --only=<filter>`, recommit.

export const MANIFEST: ImageEntry[] = [
  // Populated in Task 7.
]
