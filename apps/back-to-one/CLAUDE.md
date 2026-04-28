# Back to One

Full production operating system. Next.js 14 PWA (web, mobile browser).

Last updated: April 24, 2026

---

## What this app does

- Script writing and editing (One Arc module embedded)
- Shotlist building (One Arc module embedded)
- Storyboarding (One Arc module embedded)
- Pre-production scheduling and strip board
- Crew and vendor management (with dept sorting)
- Art department tracking (props, HMU, wardrobe)
- Casting management
- Location management
- Workflow / pipeline visualization
- Chat
- Threads (polymorphic, 14 attachable entity types)
- Deliverables tracking (embedded in Workflow)
- Crew Timecards (full feature — log/submit/approve/reopen)

## What this app does NOT do

- World-building, character profiles, mythology (that's One Lore — not yet built)
- No lore management of any kind

## Current status

Active development. Phase 1A is two features from milestone (Script drag-reorder + FAB safe-area). After 1A, in sequence: Location parent/child + images, Storage discipline, PropSourced, WardrobeSourced, Department enum conversion, Inventory, Crew Profile v2, then Auth. See `BUILD_STATUS.md` for the full feature-by-feature sequence and locked decisions.

## Reference files

**Always read the relevant HTML reference file before building any page.**
Location: `apps/back-to-one/reference/`

Key reference files:
- `back-to-one-workflow-page.html` — Workflow page
- `back-to-one-art-page.html` — Art page
- `back-to-one-casting-page.html` — Casting page
- `back-to-one-seed-v1.html` — Locked seed data (6 projects)
- `timecards-ui-reference.html` — Timecards UI reference
- `crew-timecards-schema-v2.prisma` — Timecards schema reference
- `crew-timecards-seed-v2.md` — Timecards seed reference
- `scenemaker-script.html`, `scenemaker-shotlist.html`, `scenemaker-storyboard.html` — One Arc modules
- `hub-full-preview.html` — Hub layout
- `crew-panel.html` — Crew module
- `chat.html` — Chat
- `threads-full.html` — Threads full page
- `tone-moodboard.html` — Tone/moodboard module
- `timeline-full.html` — Timeline module
- `inventory-page.html` — Inventory page (upcoming build)
- `back-to-one-entity-attachments.html` — Polymorphic image-gallery pattern (locations, props, wardrobe, hmu, moodboard refs, future cast reference photos)

## One Arc — embedded in Back to One

One Arc script/shotlist/board functionality is built as embedded modules within Back to One, not a separate app. The standalone One Arc app is a future build. Entity routing:
- One Arc Props (Entity type: prop) → Art page props section
- One Arc Characters (Entity type: character) → Casting page
- One Arc Locations → Location table → Locations pre-pro section
- One Arc Wardrobe (Entity type: wardrobe) → Wardrobe page (upcoming)

## Narrative → Production pairing (OMC-aligned)

This is the central organizing pattern in Back to One's schema:

| Narrative element (from script) | Production element (real-world) | Shape | Status |
|---|---|---|---|
| Character (Entity) | Cast | 1:1 FK | ✅ live |
| Location (Entity) | Location | 1:1 FK | ✅ live (parent/child UI upcoming) |
| Prop (Entity) | PropSourced | 1:1 FK | ⬜ upcoming |
| Wardrobe (Entity) | WardrobeSourced | 1:1 FK | ⬜ upcoming |

Every scripted entity has a production-side counterpart. The narrative identity is canonical; the production row extends it with real-world sourcing and lifecycle information.

**PropSourced / WardrobeSourced decisions locked:**
- 1:1 FK to Entity, following the Location precedent. Pickup-options pattern (child table) added later only if a real production surfaces the need.
- "Lift and break" migration for existing `Entity.metadata.status` values on props — migrate into typed `PropStatus` enum column on PropSourced, drop the `metadata.status` read path in the Art page. `metadata.imageUrl` and `metadata.tags` remain on Entity unless explicitly lifted.
- WardrobeSourced follows the exact same shape with its own status enum.

This mirrors Movielabs OMC v2.8's Narrative/Production distinction with Portrayal (Characters) and Depiction (objects and places). Use OMC terminology in PR descriptions where it adds clarity.

## Shot numbers

Shot numbers are permanent identifiers (e.g. 12A stays 12A regardless of reordering).
Story Order is canonical source of truth. Shoot Order is a production overlay.

## Seed data — 6 projects (locked)

1. Simple Skin Promo — Lumière Skincare
2. Full Send — Vanta
3. In Vino Veritas — Napa Collective
4. Flexibility Course A — Kaia Mori
5. Natural Order — Meridian Climate
6. The Weave — B Story / FRACTURE universe

Crew and cast are real production roles per project, not stock demo names. See `BUILD_STATUS.md` for current seed totals.

Current timecard seed is 35 entries — pending replacement with ~200+ rows distributed across eligible crew × shoot days with varied states.

## Platform rules

Every feature must work on a phone, in low signal, under pressure.
Offline-first is a requirement, not a feature (`packages/sync` — deferred until set conditions require it).

## Design system

- Colors: dark cinematic. Background `#04040a`. Accent per-project (18 options).
- Phase colors: pre `#e8a020` / prod `#6470f3` / post `#00b894`.
- Typography: Geist Sans (body) + Geist Mono (labels/timestamps).
- Full tokens in `BRAND_TOKENS.md` (not yet fully wired into Tailwind — tokens live in doc; components reference inline hex matching doc values).
- Sheet border-radius: 20px globally.
- Replace-in-place navigation within sheets; avoid nested modals.

## Storage

Supabase Storage state (see root `CLAUDE.md` for the discipline — bucket setup lives in Prisma migrations, new buckets ship with authenticated-check RLS):

| Bucket | Setup location | RLS | App code |
|---|---|---|---|
| `moodboard` | Prisma migration `20260426170000_storage_discipline_moodboard_storyboard` | Permissive (anon) — tightens on Auth day | `uploadMoodboardImage`, `deleteMoodboardRef` in `queries.ts` |
| `storyboard` | Prisma migration `20260426170000_storage_discipline_moodboard_storyboard` | Permissive (anon) — tightens on Auth day | `uploadStoryboardImage` in `queries.ts` |
| `entity-attachments` | Prisma migration `20260426190000_add_entity_attachment` | Permissive (anon) — tightens on Auth day; see DECISIONS "EntityAttachment storage" | `uploadEntityAttachment`, `deleteEntityAttachment` in `queries.ts` |
| `avatars` | Prisma migration `20260427020000_add_avatars_bucket` | Permissive (anon) — tightens on Auth day; see DECISIONS "Avatars storage" | `uploadAvatar`, `removeAvatar` in `queries.ts` |
| `receipts` | Prisma migrations `20260426200000_add_budget_core` (bucket + 5MB + MIME allowlist) and `20260427180000_receipts_pre_auth_permissive` (loosen RLS) | Permissive (anon) on `storage.objects` policies; bucket stays `public=false` so files reach via signed URL only — tightens on Auth day; see DECISIONS "Receipts storage" | `uploadExpenseReceipt`, `getReceiptSignedUrl`, `deleteExpenseReceipt`, `validateReceiptFile` in `queries.ts` |

Schema columns persisting Storage URLs: `User.avatarUrl`, `Shot.imageUrl`, `MoodboardRef.imageUrl`, `Location.imageUrl`, `Talent.imageUrl`. Some have upload paths wired (Shot via storyboard, MoodboardRef via moodboard); others are dormant pending feature work.

## Timecards architecture

- Layer state: `'list' | 'overview' | 'detail' | 'week'`
- Viewer shim: `useMemo` at top of CrewPanel resolves producer from `allCrew`. Single-spot swap when Auth lands.
- Mutations use React Query with `invalidateQueries` pattern (no optimistic updates, matching codebase convention).
- Eligibility filter: department NOT IN ('Client', 'Other') — temporary, simplifies to `!= 'Client'` after talent-as-ProjectMember cleanup.

## Imports from

- `@origin-one/schema`
- `@origin-one/ui`
- `@origin-one/auth`
- `@origin-one/sync`
- `@origin-one/db`

## Does not import from

- `apps/one-arc`
- `apps/one-lore`
- `apps/api` (direct — goes through shared backend only)
