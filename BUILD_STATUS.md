# Back to One — Build Status
Update this file at the end of every Claude Code session. This is the single source of truth for where the build actually is.

Last updated: April 23, 2026

---

## Current Focus

**Active:** Phase 1A — completing the production OS before Auth + external beta  
**Next up:** Crew timecards · Script drag-reorder · FAB safe-area rollout  
**Deferred until after 1A milestone:** Auth, Settings

---

## Recent — Apr 23 session

| PR | Status | Notes |
|---|---|---|
| Thread surfaces across detail sheets + list-view badges (PR #3) | ✅ Merged | Unified thread surfaces + list-view badges across all detail sheets. Ten detail sheets wired with shared `useDetailSheetThreads` hook. Ten list views wired with shared `ThreadRowBadge`. Cast/Character separation preserved (cast → Talent.id, character → Entity.id). Characters dropdown on Casting opens shared `EntityDetailSheet`. Also rolls in ArtDetailSheet save-on-blur fix + `getArtItems` id tiebreaker. |

---

## Recent — Apr 20 session

Four PRs merged on top of yesterday's foundational work.

| PR | Status | Notes |
|---|---|---|
| Workflow + Deliverables + Moodboards seed (PR #2b.1) | ✅ Merged | 39 WorkflowNodes, 33 WorkflowEdges, 20 Deliverables, 6 MoodboardTabs, 30 MoodboardRefs across all 6 projects. Rafi Torres + Cleo Strand hoisted to global crew scope (now on P1 + P5). |
| Threads seed data (PR #2b.2) | ✅ Merged | 26 threads: 9 unread / 10 recent / 7 resolved. Covers 13 of 14 threadable types (scene skipped — no detail sheet). Realistic production voice grounded in each project's content. |
| Supabase connection migration | ✅ Resolved | Switched from direct connection to session pooler (port 5432 for both DATABASE_URL and DIRECT_URL) with `postgres.<projectref>` username. |
| Entity ↔ Location FK + LocationStatus enum (PR #2c.0) | ✅ Merged | FK link (Location.entityId nullable, Entity.locations back-relation), LocationStatus enum (unscouted/scouting/in_talks/confirmed/passed), P6 script-accurate locations (Mojave / Malibu Creek / Joshua Tree), P1 lifecycle examples (scouting + passed alternatives). Migration preserves existing string values via USING mapping. |

---

## Phase 1A — Remaining Work

Ordered by priority. All of these ship before Phase 1A milestone triggers Auth + external beta.

| Feature | Status | Notes |
|---|---|---|
| Workflow page | ✅ Done | 927 lines, fully built. BUILD_STATUS previously had this wrong. |
| Threads — schema | ✅ Done | Apr 19 |
| Threads — seed (PR #2b) | ✅ Done | Apr 20 |
| Threads — wire detail sheets + list badges (PR #3) | ✅ Done | Apr 23. 10 detail sheets + 10 list views. |
| Chat | ⬜ Not started | Reference: chat.html |
| Deliverables page | ⬜ Not started | Seed data in place (20 deliverables). No dedicated UI yet. |
| Crew timecards | ⬜ Not started | |
| Script drag-reorder | ⬜ Not started | Core interaction — shotlist reordering without opening detail sheet. |
| FAB safe-area-inset rollout | ⬜ Not started | FAB used throughout app — safe-area handling is cross-cutting, not cosmetic. |

**Deferred (decide based on real production run):**
- Scene detail sheet — small feature, unblocks `scene` as threadable type. Decide if needed when a real production run surfaces the gap.

---

## After Phase 1A Milestone

Triggers: a real production runs pre-through-post inside Back to One.

| Feature | Status |
|---|---|
| Auth (Supabase native) | ⬜ Deferred until 1A complete |
| Settings (user profile, project settings) | ⬜ Deferred until 1A complete |
| External beta | ⬜ Post-auth |

---

## Back to One — Core Pages (designed, build status)

| Page / Module | HTML Reference | Built |
|---|---|---|
| Project selection | ✅ project-selection.html, selection-screen.html | ✅ Done |
| Hub | ✅ multiple hub-*.html files | ✅ Done |
| One Arc — Script | ✅ scenemaker-script.html | ✅ Done |
| One Arc — Shotlist | ✅ scenemaker-shotlist.html | ✅ Done |
| One Arc — Storyboard | ✅ scenemaker-storyboard.html | ✅ Done |
| One Arc — States | ✅ scenemaker-states.html | ✅ Done |
| Crew panel | ✅ crew-panel.html | ✅ Done (dept sorting + grouping live) |
| Art page | ✅ back-to-one-art-page.html | ✅ Done |
| Casting | ✅ back-to-one-casting-page.html | ✅ Done |
| Locations | ✅ locations-art-casting.html | ✅ Done |
| Workflow | ✅ back-to-one-workflow-page.html | ✅ Done |
| Chat | ✅ chat.html | ⬜ Not started |
| Threads full page | ✅ threads-full.html | ✅ Done (inbox + detail sheet wiring complete as of PR #3) |
| Tone / Moodboard | ✅ tone-moodboard.html | ⬜ Not started |
| Timeline | ✅ timeline-full.html, timeline-states.html | ⬜ Not started |
| Global panels | ✅ global-panels.html | ⬜ Not started |
| Empty states | ✅ empty-states.html | ✅ Done |
| Action items | ✅ action-items-*.html | ✅ Done |
| FAB | ✅ fab-arc-preview.html | ✅ Done (safe-area rollout pending) |

---

## Foundation

| Item | Status | Notes |
|---|---|---|
| PWA scaffold | ✅ Done | Next.js 14, TypeScript, Tailwind, Supabase, React Query, Zod, Framer Motion |
| Monorepo (Turborepo + pnpm) | ✅ Done | apps/back-to-one active; apps/one-arc + one-lore as stubs |
| Deployed to Vercel | ✅ Done | |
| packages/schema | ✅ Done | |
| packages/db (Prisma + migrations) | ✅ Done | Baselined Apr 19. `prisma migrate dev` canonical. Session pooler (:5432) for both URLs. |
| packages/ui | ✅ Done | |
| packages/auth (Supabase native) | ✅ Done | |
| packages/sync (offline-first) | ⬜ Not started | Deferred — build when set conditions require it |
| CLAUDE.md files across packages | ✅ Done | |

---

## Seed Data (Apr 20 re-seed)

All 6 projects populated with scenes, shots, crew, entities, milestones, action items, locations, workflow pipelines, deliverables, moodboards, and threads.

**Totals:** 6 projects, 18 scenes, 85 shots, 73 ProjectMembers, 18 Locations, 39 WorkflowNodes, 33 WorkflowEdges, 20 Deliverables, 6 MoodboardTabs, 30 MoodboardRefs, 26 Threads, 50 ThreadMessages, 10 ThreadReads, 7 resolved threads.

Reference file: back-to-one-seed-v1.html (locked). Locations/moodboards currently render with gradient fallbacks — see Image Seed in Known Issues.

---

## Entity Routing (locked)

One Arc entities route directly into Back to One — same record, no handoff:
- One Arc Props (entity type: prop) → Art page props section
- One Arc Characters (entity type: character) → Casting page
- One Arc Locations → Location table → Locations pre-pro section (pairing schema landed in PR #2c.0; creative-location stream pending — see Known Issues)

---

## Known Issues / Cleanup Queue

Non-blocking but tracked. Address when priority allows.

| Item | Notes |
|---|---|
| **Location creative stream missing** | EntityDrawer's "locations" tab queries the Location table, same as the Locations page — so Entity(type='location') has no UI surface of its own. Violates the Entity-vs-production-record threading rule for locations (Cast/Character split is correctly enforced). Follow-up PR: point EntityDrawer's locations tab at Entity(type='location') rows and wire a separate 'character'-style stream keyed by Entity.id. Needs a seed pass to ensure every Entity(type='location') row exists and pairs correctly. |
| **Crew page canonical detail surface** | Thread wiring on the Crew surface is live only inside the Hub preview modal (`CrewDetailSheet` in HubContent). The Crew page itself uses a distinct `MemberPanel` pattern with no thread trigger. Follow-up PR: promote `CrewDetailSheet` pattern (or build a canonical crew detail sheet) onto the Crew page and wire `useDetailSheetThreads` with `attachedToType='crew'`, `attachedToId=User.id`. |
| **Milestone list-view badge offset on thin rows** | ThreadRowBadge sits slightly low on the thin timeline milestone rows because the -6/-6 offset was calibrated against square/card surfaces. Follow-up: add an optional per-caller offset prop on `ThreadRowBadge` and tune timeline's usage. Polish only. |
| **`0_init` migration untracked** | `packages/db/prisma/migrations/0_init/migration.sql` exists on disk in local checkouts but is not tracked in any branch's git history (never committed after the Apr 19 baseline). Live DB has it recorded as applied. A fresh clone would miss it. Follow-up: commit 0_init (the SQL that represents the pre-Prisma snapshot) so fresh clones and CI can `prisma migrate resolve --applied 0_init` reliably. |
| **`Location.approved` vs `LocationStatus` redundancy** | Post-PR #2c.0, status has a `confirmed` value. Approved Boolean and confirmed status may be tracking the same thing in practice. Also, the Approved/Option inline button on LocationCard likely duplicates status. Follow-up: observe real production usage; if 1:1, collapse approved into status in a schema follow-up. Decision captured in DECISIONS.md. |
| **Pre-merge-reset fetch protocol** | Apr 21 staleness incident: `git branch -f main origin/main` was run without a fresh `git fetch` beforehand, which silently reset local main to a pre-merge snapshot and caused a branch to be cut from stale history. Follow-up: document as a rule in GOTCHAS.md — always `git fetch origin` before resetting or retargeting a local branch to an upstream ref. |
| **Broader brand-token migration** | BRAND_TOKENS.md was created with the Thread System section only. Many other surfaces still use inline hex — project colors, status colors, shot size pills, milestone status colors, etc. Follow-up: systematic migration of remaining inline-hex consumers to tokens, one surface at a time. |
| **P2 + P4 unpaired location entities** | 5 Entity(type='location') rows across P2 and P4 don't match Location row names. Same drift the P6 fix resolved. Same fix pattern: rename or pair. Cleanup before external beta. |
| **Image seed data across all 6 projects** | All visual surfaces render with gradient fallbacks. Need images for shot storyboards, props, wardrobe/HMU refs, cast headshots, location scouting photos, moodboard refs. Big creative PR — decide approach (external URLs / Supabase Storage / AI-generated) before executing. |
| **Talent seeded as ProjectMember** | Aria Stone, Marco Silva, Zoe Park, Dev Okafor, Paul Navarro, Marcus Trent, Jin Ho, Kaia Mori, James North, Leo Marsh, Vera Koss — all lead actors / athletes / subjects / VO talent / instructors. Currently tagged `Other` department because they shouldn't be in ProjectMember at all. Small dedicated PR to move them to Talent table. |
| **Old SQL seed (`002_seed_data.sql`)** | Historical Astra Lumina / Drifting / Freehand data. Preserved as historical record per standard migration discipline — never edit applied migrations. |
| **Two stashes on local** | `stash@{0}` (wip-local-notes) and `stash@{1}` (WIP on 69ffa5a). Triage when convenient. |
| **Dana Vance thread on P3** | Thread creator Dana is a P6 crew member, not P3. Schema allows it. Not broken, but worth a future decision about whether thread creators should be restricted to project members. |

---

## Operational Notes

- **After any schema change:** regenerate Prisma client before seeding — `pnpm --filter @origin-one/db prisma generate`. Skipping this wiped the DB mid-seed on Apr 19.
- **Supabase connection:** session pooler on port 5432 for both DATABASE_URL and DIRECT_URL. Username `postgres.sgnjlzcffaptwzxtbefp`. Host `aws-0-us-west-2.pooler.supabase.com`.
- **Prisma is canonical:** no more Supabase Studio schema edits. All changes via `prisma migrate dev` → commit → deploy.

---

## Phase 1 Complete Milestone

A full Origin Point production — pre through post — runs entirely inside Back to One. External beta begins only after this milestone is hit.

**Current estimate:** Chat → Deliverables page → Crew Timecards → Script drag-reorder → FAB safe-area → milestone review → Auth → external beta.
