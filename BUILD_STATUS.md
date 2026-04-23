# Back to One — Build Status
Update this file at the end of every Claude Code session. This is the single source of truth for where the build actually is.

Last updated: April 20, 2026

---

## Current Focus

**Active:** Phase 1A — completing the production OS before Auth + external beta  
**Next up:** PR #2c detail sheet thread wiring  
**Deferred until after 1A milestone:** Auth, Settings

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
| Threads — wire detail sheets (PR #2c) | ⬜ Not started | Replicate ShotDetailSheet trigger pattern across Casting, Art, Locations, Workflow, Deliverables, Milestones, Action Items, Crew, etc. |
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
| Locations | ✅ locations-art-casting.html | ✅ Done (Entity-Location pairing pending) |
| Workflow | ✅ back-to-one-workflow-page.html | ✅ Done |
| Chat | ✅ chat.html | ⬜ Not started |
| Threads full page | ✅ threads-full.html | 🟡 Inbox live; detail sheet wiring pending (PR #2c) |
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
- One Arc Locations → Location table → Locations pre-pro section (pairing schema pending — see Known Issues)

---

## Known Issues / Cleanup Queue

Non-blocking but tracked. Address when priority allows.

| Item | Notes |
|---|---|
| **P2 + P4 unpaired location entities** | 5 Entity(type='location') rows across P2 and P4 don't match Location row names. Same drift the P6 fix resolved. Same fix pattern: rename or pair. Cleanup before external beta. |
| **Image seed data across all 6 projects** | All visual surfaces render with gradient fallbacks. Need images for shot storyboards, props, wardrobe/HMU refs, cast headshots, location scouting photos, moodboard refs. Big creative PR — decide approach (external URLs / Supabase Storage / AI-generated) before executing. |
| **Talent seeded as ProjectMember** | Aria Stone, Marco Silva, Zoe Park, Dev Okafor, Paul Navarro, Marcus Trent, Jin Ho, Kaia Mori, James North, Leo Marsh, Vera Koss — all lead actors / athletes / subjects / VO talent / instructors. Currently tagged `Other` department because they shouldn't be in ProjectMember at all. Small dedicated PR to move them to Talent table. |
| **BRAND_TOKENS.md not in repo** | Source of truth lives in chat context only. Commit when file is located. |
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

**Current estimate:** PR #2c detail sheet wiring → Chat → Deliverables page → Crew Timecards → Script drag-reorder → FAB safe-area → milestone review → Auth → external beta.
