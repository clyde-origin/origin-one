# Back to One

Full production operating system. Next.js PWA + Electron (desktop).

## What this app does
- Script writing and editing
- Shotlist building
- Storyboarding
- Pre-production scheduling and strip board
- Crew and vendor management
- Call sheet generation
- Shot tracking on set
- Post: asset handoff, delivery tracking, wrap reports

## What this app does NOT do
- World-building, character profiles, mythology (that's One Lore)
- No lore management of any kind
- No standalone script-to-board workflow without production context (that's One Arc)

## Current status
Next.js PWA scaffold exists. Remaining pages and auth are the active work.
Being migrated into monorepo under apps/back-to-one/.

## Phase sequence
1A — Shoot Day Core
1B — Pre-Production
1C — Writing and Visual
1D — Post

## Platform rules
Every feature must work on a phone, in low signal, under pressure.
Offline-first is not a feature — it is a requirement.

## Imports from
- @origin-one/schema
- @origin-one/ui
- @origin-one/auth
- @origin-one/sync
- @origin-one/db

## Does not import from
- apps/one-arc
- apps/one-lore
- apps/api (direct — goes through shared backend only)
