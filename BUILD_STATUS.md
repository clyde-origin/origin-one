# Back to One — Build Status
Update this file at the end of every Claude Code session. This is the single source of truth for where the build actually is.

Last updated: April 24, 2026 (post PR #7 merge, start of sequence-to-Auth push)

---

## Current Focus

**Anchor:** The resolve to complete the project effectively and efficiently. No fixed calendar date for Auth or first dogfood. Each feature lands as a complete arc (schema PR → UI PR → merge) before the next begins. Main green at every stop.

**Immediate work:** Cleanup bundle (docs, richer timecard seed, role toggle, CrewPanel extraction, polish) → Script drag-reorder → FAB safe-area → Phase 1A milestone.

**After 1A, in sequence:** Location cleanup → Location parent/child UI → Storage discipline PR → Location images → Department enum conversion → PropSourced schema → PropSourced UI → WardrobeSourced schema → WardrobeSourced UI → InventoryItem schema → Inventory page → Inventory hub preview → Crew Profile v2 schema → avatars bucket → Crew Profile v2 UI → Auth.

**Dogfood trigger:** Tyler + Kelly run the app when every surface is honest and the data is real enough to think with.

---

## Recent — Apr 23 night session (four PRs shipped)

| PR | Status | Notes |
|---|---|---|
| #4 — 0_init migration baseline tracked | ✅ Merged | Fresh-clone blocker cleared. Single-file, single-commit PR. |
| #5 — CrewTimecard schema + TimecardStatus enum | ✅ Merged | Caught `Location_entityId_idx` drift during `--create-only` migration; removed stray DROP INDEX from PR. Drift folded into Location cleanup PR (#8). |
| #6 — CrewTimecard seed (35 entries, 6 projects) | ✅ Merged | Caught ProjectMember-vs-User identity question at design time. Includes reopened case with full lifecycle trace. |
| #7 — CrewTimecard UI full feature | ✅ Merged | Three commits: affordances + Producer Overview + Individual Week View with log/submit/approve/reopen. Viewer shim in place pending Auth. CrewPanel.tsx at 1335 lines — extraction queued. |

Main at `c5e9e3e`. Crew Timecards complete end-to-end. Phase 1A is 2 features from milestone.

---

## Sequence to Auth

Each row is a complete PR (schema or UI). Strict order — next row doesn't start until previous is merged.

### Cleanup bundle

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Doc sync — BUILD_STATUS, CLAUDE files, MOVIELABS_ALIGNMENT | 🟡 In flight | Four files, one commit |
| 2 | Richer timecard seed (~200+ rows, varied states) | ⬜ | Replaces current 35-entry seed |
| 3 | Role toggle Producer ⇄ Crew on login page | ⬜ | Pre-Auth testing affordance |
| 4 | CrewPanel.tsx extraction | ⬜ | Pure refactor — split timecards sub-components to `components/hub/timecards/` |
| 5 | Polish bundle — background glow + Action items panel height | ⬜ | Single PR |

### Phase 1A close

| # | Feature | Status | Notes |
|---|---|---|---|
| 6 | Script drag-reorder | ⬜ | Shot numbers are permanent identifiers per DECISIONS.md — reorder changes Story Order only |
| 7 | FAB safe-area-inset rollout | ⬜ | Cross-cutting; FAB used throughout app |
| — | **Phase 1A milestone marker** | — | Hit when #6 and #7 land |

### Location — narrative→production pattern

| # | Feature | Status | Notes |
|---|---|---|---|
| 8 | Location cleanup + drift reconciliation | ⬜ | 5 unpaired `Entity(type='location')` rows in P2+P4, `Location_entityId_idx` drift, `approved` audit, EntityDrawer locations-tab fix |
| 9 | Location parent/child UI | ⬜ | Mirror Character/Cast pattern |
| 10 | Storage discipline PR | ⬜ | Pull existing `moodboard` setup into Prisma migrations. Audit `storyboard` bucket. Establishes bucket-migration pattern |
| 11 | Location images feature | ⬜ | `locations` bucket migration with auth-check RLS + `uploadLocationImage` helper + UI wiring |

### Props — narrative→production pattern

| # | Feature | Status | Notes |
|---|---|---|---|
| 12 | Department enum conversion | ⬜ | Solo PR, irreversible |
| 13 | PropSourced schema | ⬜ | 1:1 FK to `Entity(type='prop')` per Location precedent. Lift-and-break migration: `metadata.status` → typed `PropStatus` enum column on PropSourced |
| 14 | PropSourced UI on Art page | ⬜ | Drop the `metadata.status` read path. Mirror Location UI pattern |

### Wardrobe — narrative→production pattern

| # | Feature | Status | Notes |
|---|---|---|---|
| 15 | WardrobeSourced schema | ⬜ | Same shape as PropSourced with its own status enum |
| 16 | WardrobeSourced UI on Wardrobe page | ⬜ | Mirror PropSourced UI pattern |

### Inventory

| # | Feature | Status | Notes |
|---|---|---|---|
| 17 | InventoryItem schema | ⬜ | `ImportSource` limited to `manual`/`pdf`/`excel` — `api` dropped as premature optionality |
| 18 | Inventory page | ⬜ | Reference: `inventory-page.html` |
| 19 | Inventory hub preview | ⬜ | |

### Crew Profile v2

| # | Feature | Status | Notes |
|---|---|---|---|
| 20 | Crew Profile v2 schema | ⬜ | `phone`/`avatarUrl` on User (global); `notes`/`skills` on ProjectMember (project-scoped) |
| 21 | `avatars` bucket + helper | ⬜ | New bucket ships with auth-check RLS. `uploadAvatar` helper |
| 22 | Crew Profile v2 UI | ⬜ | phone/notes/skills edit + avatar upload. Draft HTML reference first |

### Auth

| # | Feature | Status | Notes |
|---|---|---|---|
| 23 | Supabase Auth wiring + session management | ⬜ | |
| 24 | RLS policies across all tables + tighten existing moodboard/storyboard policies | ⬜ | Scope grows with every table added above |
| 25 | Replace viewer shim in CrewPanel with real Auth session | ⬜ | Single-spot `useMemo` swap |
| 26 | Vercel deploy + fresh-login smoke test across all surfaces | ⬜ | |

### Dogfood

| # | Feature | Status | Notes |
|---|---|---|---|
| — | Tyler + Kelly first-production run | ⬜ | Ships when every surface above is honest and the data is real enough to think with |

---

## Phase 1A — Remaining Work

Closes milestone.

| Feature | Status | Notes |
|---|---|---|
| Crew Timecards | ✅ Done | PRs #5, #6, #7 (Apr 23) |
| Script drag-reorder | ⬜ | Sequence #6 |
| FAB safe-area-inset rollout | ⬜ | Sequence #7 |

---

## Back to One — Core Pages (designed, build status)

| Page / Module | HTML Reference | Built |
|---|---|---|
| Project selection | ✅ project-selection.html | ✅ Done |
| Hub | ✅ hub-full-preview.html | ✅ Done |
| One Arc — Script | ✅ scenemaker-script.html | ✅ Done |
| One Arc — Shotlist | ✅ scenemaker-shotlist.html | ✅ Done |
| One Arc — Storyboard | ✅ scenemaker-storyboard.html | ✅ Done |
| Crew panel | ✅ crew-panel.html | ✅ Done (+ Timecards) |
| Crew Timecards UI | ✅ timecards-ui-reference.html | ✅ Done (Apr 23) |
| Art page | ✅ back-to-one-art-page.html | ✅ Done (PropSourced UI upcoming) |
| Casting | ✅ back-to-one-casting-page.html | ✅ Done |
| Locations | ✅ locations-art-casting.html | ✅ Done — parent/child UI + images upcoming |
| Workflow | ✅ back-to-one-workflow-page.html | ✅ Done |
| Chat | ✅ chat.html | ✅ Done |
| Threads (inbox + detail wiring) | ✅ threads-full.html | ✅ Done |
| Tone / Moodboard | ✅ tone-moodboard.html | ✅ Done (seed Apr 20) |
| Inventory | ✅ inventory-page.html | ⬜ Upcoming |
| Crew Profile v2 | ⬜ needs HTML reference | ⬜ Upcoming (draft HTML first) |
| FAB | ✅ fab-arc-preview.html | 🟡 Done (safe-area rollout pending) |

---

## Foundation

| Item | Status | Notes |
|---|---|---|
| PWA scaffold | ✅ Done | Next.js 14, TypeScript, Tailwind, Supabase, React Query, Zod, Framer Motion |
| Monorepo (Turborepo + pnpm) | ✅ Done | back-to-one active; one-arc + one-lore as stubs |
| Deployed to Vercel | ✅ Done | |
| packages/schema, db, ui, auth | ✅ Done | |
| packages/sync (offline-first) | ⬜ Not started | Deferred until set conditions require it |
| CLAUDE.md files | ✅ Done | Updated Apr 24 with OMC alignment and sequence-to-Auth framing |

---

## Decisions locked on upcoming PRs

These decisions were made during planning and should carry into the PR work. Reference here so Claude Code prompts don't re-open settled questions.

**PropSourced / WardrobeSourced:**
- 1:1 FK to Entity (not 1:many). Pickup-options pattern (child table like `PropSourceOption`) added later only if a real production surfaces the need. Follows Location precedent.
- Lift-and-break migration: existing `Entity.metadata.status` values on props migrate into typed `PropStatus` enum column on PropSourced. The `metadata.status` read path in the Art page is dropped in the UI PR. `metadata.imageUrl` and `metadata.tags` remain on Entity unless explicitly lifted.
- Wardrobe status enum is distinct from Prop status — don't reuse.

**InventoryItem:**
- `ImportSource` enum limited to `manual`, `pdf`, `excel`. The `api` value is dropped as premature optionality — add later when a real integration ships.
- No role-gating UI placeholder. Auth renders real enforcement or nothing renders.

**Crew Profile v2:**
- `phone`, `avatarUrl` on User (global, doesn't change by project).
- `notes`, `skills` on ProjectMember (project-scoped, can vary per production).
- Role dropdown uses existing `Role` enum — UI change only.
- Avatar upload depends on `avatars` bucket + helper (shipped in immediate preceding PR).

**Storage buckets:**
- New buckets (`locations`, `avatars`) ship their setup SQL in Prisma migrations, not manual scripts.
- All new buckets ship with `auth.role() = 'authenticated'` RLS from day one.
- Existing permissive `moodboard` / `storyboard` policies are a known open door — tightened on Auth day along with table RLS.

---

## Known Issues / Cleanup Queue

Organized by severity. Non-blocking unless noted.

### Drift and data

| Item | Notes |
|---|---|
| **`Location_entityId_idx` drift** | Index exists in live DB, not declared in `schema.prisma`. Surfaced via `--create-only` during Timecards schema PR. Folded into Location cleanup PR (sequence #8). |
| P2 + P4 unpaired `Entity(type='location')` rows | 5 rows without paired Location records. Folded into Location cleanup PR (#8). |
| `approved` Boolean on Location | Audit for redundancy with LocationStatus enum. Folded into Location cleanup PR (#8). Kept separate today (aesthetic sign-off vs. booking — distinct concerns). |
| Storyboard bucket setup not committed | App code references `storyboard` bucket but the setup SQL isn't in repo. Folded into Storage discipline PR (#10). |

### Code structure and quality

| Item | Notes |
|---|---|
| **CrewPanel.tsx extraction** | File grew to 1335 lines during Timecards UI build. Extract timecards sub-components to `components/hub/timecards/` (ProducerOverview, IndividualWeekView, shared WeekNavBar/StatusPill/week math). Pure refactor, no behavior change. Cleanup bundle (#4). |
| BRAND_TOKENS.md full migration to Tailwind config | Currently tokens are documented but not wired into Tailwind config. Every new component uses inline hex. When this migrates, the inline-hex pattern becomes a find-and-replace. |

### Demo and testing

| Item | Notes |
|---|---|
| **Richer timecard seed** | Current 35 entries too sparse for realistic demo — fills only one slice of one week on most projects. Replace with ~200+ rows distributed across eligible crew × shoot days per project. Cleanup bundle (#2). |
| **Role toggle Producer ⇄ Crew on login page** | Pre-Auth testing affordance so crew mode is actually testable. Cleanup bundle (#3). |
| Talent seeded as ProjectMember in `Other` dept | 11 talent rows parked in `Other` department. Eventually moves to dedicated Talent table. When that ships, the timecards eligibility rule simplifies from `!IN ('Client','Other')` to `!= 'Client'`. |

### Timecards follow-ups (from PR #7 Apr 23)

| Item | Notes |
|---|---|
| Viewer-identity shim → Auth session | Single-spot `useMemo` in CrewPanel. Swapped in Auth PR (#25). |
| Reopener/approver name attribution | Currently falls back to "Producer" label. Pass `allCrew` down to resolve real names. Cosmetic. |
| Split-day entries multi-card variant | Schema allows multiple entries per (crew, day). UI currently shows only first. Add multi-card variant if seed or user input creates split-days. |
| Optimistic updates on approve/reopen/submit | Current pattern is invalidate-on-success. Codebase-wide pattern (not yet established). |
| EntryEditor description length validation | Client-side limit on description. Non-urgent. |

### Architectural threads for future

| Item | Notes |
|---|---|
| Formotion appeared in build graph Apr 23 night | Supposed to be parked pending brand architecture conversation. Appears in `pnpm -w build` output. Confirm whether it should stay in active build set or get extracted. |
| `markThreadRead` firing frequency check | Needs audit — may be over-firing. |
| milestone ThreadRowBadge offset on thin rows | Visual tweak, noted Apr 23. |
| **OMC vocabulary alignment pass** | DECISIONS.md and schema comments should use Movielabs OMC v2.8 terminology (Narrative/Production, Depiction/Portrayal) to make the architecture legible to industry audience. Small doc PR after dogfooding. |

### Deferred until after dogfooding

| Item | Notes |
|---|---|
| Folder structure in project selection | Not painful at 6 projects. Build when real pain surfaces. |
| Long-press drag-reorder as universal pattern | Build once as shared primitive; apply per-surface. Don't scatter per-feature implementations. |
| Location parent/child deeper semantics | Current model is 1:many Entity→Location. Questions like geographic containment (Vineyard → Barrel Room) are separate from narrative→production pairing. Revisit post-dogfooding if real productions surface the need. |
| Props / Wardrobe pickup-options child tables | If a real production needs multiple sourcing records per scripted prop/wardrobe, add `PropSourceOption` / `WardrobeSourceOption` as child tables under the 1:1 PropSourced / WardrobeSourced. |
| Camera Metadata per shot (OMC/SMPTE RIS OSVP) | Long-term interop concern. Ships when post workflow requires it. |
| OMC-aligned RDF/JSON-LD schema publication | Interop publication for Movielabs community. Long-term. |

---

## Seed Data — current state

| Item | Count | Notes |
|---|---|---|
| Projects | 6 | Locked — see `back-to-one-seed-v1.html` |
| ProjectMembers | 73 | Includes 11 talent + 2 clients (timecard-ineligible) + 60 eligible crew |
| Scenes | 18 | |
| Shots | 85 | |
| WorkflowNodes | 39 | |
| WorkflowEdges | 33 | |
| Deliverables | 20 | |
| MoodboardTabs | 6 | |
| MoodboardRefs | 30 | |
| Threads | 26 | 9 unread / 10 read / 7 resolved |
| ThreadMessages | 50 | |
| ThreadReads | 10 | |
| CrewTimecards | 35 | Pending replacement with ~200+ rows (cleanup bundle #2) |

---

## Operational Notes

- **Prisma generate before seed** after every schema change — `pnpm --filter @origin-one/db prisma generate`. Skipping this wiped the DB mid-seed Apr 19.
- **Supabase connection:** session pooler port 5432 for both DATABASE_URL and DIRECT_URL. Username `postgres.sgnjlzcffaptwzxtbefp`. Host `aws-0-us-west-2.pooler.supabase.com`. Transaction pooler (6543) on same host refuses this username format.
- **Prisma is canonical** — all schema changes via `prisma migrate dev` → commit → deploy. No direct Supabase Studio edits.
- **Storage is canonical too** — bucket and RLS SQL lives in Prisma migrations, not `scripts/setup-storage.sql`. Storage discipline PR (#10) brings existing moodboard setup into alignment.
- **Schema changes require dedicated PRs.** Never ride on feature branches. Schema PR → `prisma generate` → seed update if needed → all-three-apps compile → UI PR → merge. Then next feature.
- **`git fetch origin` before any branch-pointer operation** referencing remote tracking refs. `origin/main` is a cached pointer that only updates on fetch.

---

## Phase 1 Complete Milestone

A full Origin Point production — pre through post — runs entirely inside Back to One.

**External beta begins only after:** every feature in the sequence above ships + Auth lands + Tyler/Kelly dogfood session informs any final adjustments.

---

## Movielabs / OMC alignment

The narrative→production split at the core of Back to One's schema (Entity → Cast/Location/PropSourced/WardrobeSourced) mirrors Movielabs OMC v2.8's Narrative/Production element distinction with Portrayal (for Characters) and Depiction (for objects/places).

Planned conversation with Chris Vienneau at Movielabs after first dogfood — see `MOVIELABS_ALIGNMENT.md` for the schema-mapping document prepared for that conversation. Target outcome: feedback on our alignment, discussion of potential 2030 Greenlight / implementer case study fit, and guidance on controlled vocabulary sync.

Do not let OMC alignment drive speculative schema work. The discipline remains: if a real production needs it, model it. OMC vocabulary alignment is for documentation legibility, not schema expansion.
