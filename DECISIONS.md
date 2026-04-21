# Origin One — Decision Log

Every significant architectural or strategic decision lives here.
Before relitigating any call, read this file first.

Last updated: April 20, 2026

---

## Decision format

**Decision:** What was decided  
**Date:** When  
**Rationale:** Why this and not something else  
**Tradeoffs:** What we gave up  
**Revisit trigger:** What would make us reconsider  

---

## Decisions

---

### Monorepo — Turborepo + pnpm

**Decision:** All three apps and all shared packages live in a single monorepo.  
**Date:** April 2026  
**Rationale:** Shared schema requires a shared codebase. Separate repos recreate the silo problem in code — the exact problem Origin One exists to solve in production workflows.  
**Tradeoffs:** More complex initial setup. Monorepo tooling has a learning curve.  
**Revisit trigger:** Never. This is structural.

---

### Build order — Back to One first

**Decision:** Active development sequence is Back to One → One Arc → One Lore.  
**Date:** April 2026  
**Rationale:** Most acute user pain is on set, not in pre-production writing. Proving the foundation on real productions before expanding. Back to One is already a PWA — it has a head start.  
**Tradeoffs:** One Arc and One Lore users wait longer.  
**Revisit trigger:** Never. The order is intentional and non-negotiable.

---

### Plan all three apps, build only Back to One

**Decision:** Architecture, schema, and CLAUDE.md files reflect the full three-app system from day one. Active development stays on Back to One only.  
**Date:** April 2026  
**Rationale:** Architecture needs full picture to make right decisions. Claude Code needs full system context from day one.  
**Tradeoffs:** Upfront planning time before shipping features.  
**Revisit trigger:** Never.

---

### Auth — Supabase native (not Clerk)

**Decision:** Auth across all three apps handled by Supabase native auth, not Clerk.  
**Date:** April 2026 (revised from original Clerk decision)  
**Rationale:** Supabase is already in the stack. One Supabase project handles auth across all three apps natively. No third-party dependency, no migration needed, no additional pricing layer.  
**Tradeoffs:** Less opinionated SSO flow than Clerk. More custom work for role/team management.  
**Revisit trigger:** Supabase auth becomes insufficient for multi-tenant role complexity at scale.

---

### Auth timing — after Phase 1A complete

**Decision:** Auth is the last thing built before external beta, not the first. Phase 1A milestone (a real production runs pre-through-post inside Back to One) must complete before Auth is wired.  
**Date:** April 2026  
**Rationale:** Wiring auth early creates friction in every dev session. The build moves faster without it. Auth is a wrapper, not a foundation — it doesn't block building screens.  
**Tradeoffs:** App is not externally beta-ready until auth is done. Internal testing only in the meantime.  
**Revisit trigger:** External beta required before 1A complete.

---

### Phase 1A scope — definition of complete (Apr 20)

**Decision:** Phase 1A ships all of: Workflow, Threads (schema + seed + detail sheet wiring), Chat, Deliverables page, Crew timecards, Script drag-reorder, FAB safe-area-inset rollout. Scene detail sheet deferred — decide during real production run.  
**Date:** April 20, 2026  
**Rationale:** These features define "a production can run through Back to One pre-through-post." Every feature here traces to a real production moment. Scene detail sheet might not be needed — decide based on actual production workflow when tested.  
**Tradeoffs:** Larger 1A than originally scoped (Shoot Day Core + Pre-Pro). But Auth + external beta cost requires all core features to be present.  
**Revisit trigger:** Real production run reveals a feature gap not on this list (add to 1A) or a feature on this list not used (defer to 1B).

---

### One Arc embedded in Back to One (not standalone yet)

**Decision:** One Arc script/shotlist/board functionality is built as modules within Back to One for now. The standalone One Arc app is a future build.  
**Date:** April 2026  
**Rationale:** Gets One Arc functionality in front of real users faster. Back to One users need script-to-shotlist workflow. Building standalone One Arc first would delay both apps.  
**Tradeoffs:** Standalone One Arc app (desktop-first, no production overhead) is delayed.  
**Revisit trigger:** When Back to One is proven and One Arc standalone becomes the active build phase.

---

### Entity routing — One Arc entities route into Back to One

**Decision:** One Arc entities route directly into Back to One — same record, no handoff.  
**Date:** April 2026  
**Rationale:** This is the technical expression of ONE. No export. No re-entry. Same record everywhere.  
- One Arc Props (entity type: prop) → Art page props section  
- One Arc Characters (entity type: character) → Casting page  
- One Arc Locations → Location table → Locations pre-pro section  
**Tradeoffs:** Requires careful schema design. Entity-Location pairing currently incomplete (see Known Issues).  
**Revisit trigger:** Never on the principle. Pairing implementation to be decided next session.

---

### packages/sync isolated from day one

**Decision:** Offline-first sync logic lives in its own isolated package, not inside the Back to One app.  
**Date:** April 2026  
**Rationale:** On-set offline with bad signal is the hardest technical problem in this suite. Isolation enables safe iteration.  
**Tradeoffs:** More packages to maintain.  
**Revisit trigger:** Never. Isolation is the point.

---

### Schema changes require a dedicated PR

**Decision:** No schema changes in feature branches. Schema gets its own PR every time.  
**Date:** April 2026  
**Rationale:** Schema touches all three apps simultaneously. An incidental schema change in a feature branch is a hidden breaking change.  
**Tradeoffs:** Slower iteration on schema.  
**Revisit trigger:** Never.

---

### Writing is a shared surface — not owned by one app

**Decision:** A scene written in any app saves to the shared Document schema. It appears in all other apps automatically.  
**Date:** April 2026  
**Rationale:** No handoffs. No exports. One record. This is the core technical expression of ONE.  
**Tradeoffs:** Requires careful schema design upfront.  
**Revisit trigger:** Never.

---

### Shot numbers are permanent identifiers

**Decision:** Shot numbers (e.g. 12A) are permanent identifiers. They do not change when shots are reordered.  
**Date:** April 2026  
**Rationale:** Shot numbers are referenced across call sheets, reports, and crew communication. Reordering should never silently rename a shot.  
**Tradeoffs:** Requires separate Story Order and Shoot Order fields.  
**Revisit trigger:** Never. Story Order is canonical. Shoot Order is a production overlay.

---

### HTML reference files before every Claude Code session

**Decision:** Every new page or significant UI change is designed as an HTML artifact, reviewed and approved, then dropped into `apps/back-to-one/reference/` before any Claude Code session begins.  
**Date:** April 2026  
**Rationale:** Prevents Claude Code from making design assumptions. The reference file is the spec. This is the two-chat workflow: planning/design chat → reference file → Claude Code session.  
**Tradeoffs:** Adds a step before building. Worth it every time.  
**Revisit trigger:** Never.

---

### Seed data — 6 projects, locked

**Decision:** Six specific demo projects are locked in `back-to-one-seed-v1.html`. They do not change.  
**Date:** April 2026  
**Projects:** Simple Skin Promo, Full Send, In Vino Veritas, Flexibility Course A, Natural Order, The Weave.  
**Rationale:** Each project exercises a different module/workflow state. A subtle thematic thread runs through all six. Seed data is not modified casually — any changes require intentional revision of the reference file.  
**Revisit trigger:** A module requires a workflow state not covered by existing six projects.

---

### Marketing site — Framer (not Webflow)

**Decision:** Back to One marketing site built in Framer.  
**Date:** April 2026  
**Rationale:** Design-forward, closest to Figma workflow. Built-in CMS, fast deployment, excellent animations. Better design control than Webflow for this visual direction.  
**Tradeoffs:** Less flexible CMS than Webflow for complex content structures.  
**Revisit trigger:** Framer becomes limiting for content complexity.

---

### Electron — after PWA confirmed responsive

**Decision:** Desktop Electron wrapper added after PWA is confirmed responsive and functional at full width in a browser.  
**Date:** April 2026  
**Rationale:** One codebase, two build targets. Don't add complexity before it's needed.  
**Tradeoffs:** No native OS integration until Electron is added.  
**Revisit trigger:** Users clearly expect to launch from dock like Premiere or Final Cut.

---

### Prisma is the canonical migration system (not Supabase Studio)

**Decision:** All schema changes happen via `prisma migrate dev` → commit → `prisma migrate deploy`. No direct SQL edits in Supabase Studio. No ad-hoc SQL files in `apps/back-to-one/supabase/migrations/` going forward.  
**Date:** April 19, 2026  
**Rationale:** Parallel migration systems caused months of drift between `schema.prisma` and the live database. Fields existed in the DB that the schema file didn't know about. Single source of truth is required.  
**Tradeoffs:** Lose the convenience of quick Supabase Studio column edits. Gain type-safety and repeatable migrations.  
**Revisit trigger:** Never. The cost of drift already materialized.

---

### `schema.prisma` must match database state — reconcile when drift detected

**Decision:** When drift is detected between `schema.prisma` and the live database (via `prisma migrate diff` or similar), reconcile immediately via `prisma db pull`. Never ship migrations on top of unacknowledged drift.  
**Date:** April 19, 2026  
**Rationale:** Applying a migration on top of drift compounds the problem and makes future debugging worse. Reconcile first, migrate second.  
**Tradeoffs:** Reconciliation is real work — a dedicated PR, not a quick fix.  
**Revisit trigger:** Never.

---

### Prisma baseline — `0_init` represents pre-Prisma database state

**Decision:** The live Supabase database has been baselined as Prisma migration `0_init`, representing all schema existing as of April 19, 2026. Future migrations diff against this baseline.  
**Date:** April 19, 2026  
**Rationale:** Prisma requires a baseline to manage a database that wasn't created via Prisma. `0_init` contains the full schema as it existed when Prisma was adopted as canonical.  
**Tradeoffs:** `0_init` is a one-time migration that should never be run against an empty DB — it's marked applied but would be incorrect to actually execute. New environments need special handling.  
**Revisit trigger:** Never.

---

### Characters stay as polymorphic Entity rows — no dedicated Character model

**Decision:** Characters continue to be stored as `Entity(type='character')` rows. No dedicated `Character` model in Back to One.  
**Date:** April 19, 2026  
**Rationale:** Entity already provides stable IDs for character references (script tagging, threads, cast assignments). Extracting to a dedicated table adds migration work with no functional benefit in Back to One's phase. When One Lore is built, it can add a `CharacterProfile` table that *links* to Entity for richer world-building data — keeping Entity as canonical identity.  
**Tradeoffs:** Character-specific fields (archetype, arc, voice) can't live cleanly on Entity long-term. Punts that problem to One Lore.  
**Revisit trigger:** One Lore active development, or Back to One develops character-specific UI that needs rich fields.

---

### Threads are polymorphic — one table, `entity_type` + `entity_id`

**Decision:** All threads live in a single `Thread` table with `attachedToType` + `attachedToId` columns. Not separate tables per entity type.  
**Date:** April 2026 (schema); April 19, 2026 (14-type union locked)  
**Rationale:** Standard polymorphic pattern (Linear, Notion, GitHub use it). One thread model means one inbox, one read-state model, one query surface.  
**Tradeoffs:** No DB-level FK integrity on `attachedToId` — enforcement lives in application code. Requires batched loaders in `thread-context.ts` (one query per type, never per thread) to avoid N+1.  
**Revisit trigger:** Never.

---

### Threadable entity types — canonical 14

**Decision:** Threads can be attached to exactly these 14 entity types:
`shot`, `scene`, `location`, `character`, `cast`, `crew`, `prop`, `wardrobe`, `hmu`, `moodboardRef`, `actionItem`, `milestone`, `deliverable`, `workflowStage`.  
**Date:** April 19, 2026  
**Rationale:** Each type covers a real attachment surface in Back to One's UI or a future-reserved surface (scene, crew). Chat messages use their own reply pattern, not threads. Art was split into prop/wardrobe/hmu to reflect actual production departments.  
**Tradeoffs:** Adding new types in the future requires updating the union + chip colors + batched loaders.  
**Revisit trigger:** A new major surface needs threading (e.g. a new module added to Back to One).

---

### Canonical department list — 13 entries

**Decision:** The canonical list of crew departments is defined exactly once in `apps/back-to-one/src/lib/utils/phase.ts` as the `DEPARTMENTS` export. All consumers import from this single source.  
**Date:** April 19, 2026  
**List (in display order):** Production, Direction, Camera, G&E, Lighting, Sound, Art, Wardrobe, HMU, Casting, Post, Client, Other.  
**Rationale:** Three diverging lists (phase.ts, CrewPanel, CreateTaskSheet) with different spellings and different entries caused silent breakage — department values set from one source didn't group under another source's headers.  
**Tradeoffs:** Changing departments requires touching one file but affects every consumer. That's the point.  
**Revisit trigger:** Production experience reveals a missing or redundant department. All changes go through `phase.ts` and follow the "schema changes require a dedicated PR" pattern.

---

### Rafi Torres and Cleo Strand as cross-project post crew

**Decision:** Rafi Torres (editor) and Cleo Strand (GFX artist) are declared at global scope in the seed and assigned to multiple projects (currently P1 and P5).  
**Date:** April 20, 2026  
**Rationale:** Post editors and GFX artists realistically work across multiple productions at the same studio. Seed accuracy requires the option to assign them across projects.  
**Tradeoffs:** When new projects need post crew, the hoisting pattern must be preserved — additional declarations go in the same global section, not inside project blocks.  
**Revisit trigger:** Never.

---

### Session pooler for DATABASE_URL and DIRECT_URL

**Decision:** Both DATABASE_URL and DIRECT_URL point at Supabase's session pooler (port 5432) with username format `postgres.<projectref>`. Transaction pooler (port 6543) on the same host is NOT used — it rejects the `postgres.<projectref>` username format for this project.  
**Date:** April 20, 2026  
**Rationale:** Session pooler works reliably with IPv4 and the full Supavisor auth flow. The quirk is project-specific — this project's dedicated pooler and shared pooler don't work interchangeably.  
**Tradeoffs:** Slightly less connection efficiency than transaction pooling — negligible for local dev.  
**Revisit trigger:** Supabase changes pooler configuration or the app moves to a production-scale deployment where connection pooling performance matters.

---

### After any schema change, regenerate Prisma client before seeding

**Decision:** `pnpm --filter @origin-one/db prisma generate` is required after any schema.prisma edit, before running db:seed.  
**Date:** April 20, 2026  
**Rationale:** Skipping this wipes the DB mid-seed because deleteMany runs before the new field reference fails. Losing state in exchange for a bug isn't acceptable.  
**Tradeoffs:** One extra command in the workflow.  
**Revisit trigger:** Never. Build habit.

---

### Location ↔ Entity 1:many FK with LocationStatus enum

**Decision:** Locations link to Entity via nullable FK. One Entity can have multiple Location candidates. LocationStatus enum: unscouted/scouting/in_talks/confirmed/passed.  
**Date:** April 20, 2026  
**Rationale:** Parity with the Character pattern — Entity is canonical identity, Location extends with production data. Same record across One Lore, One Arc, Back to One. The status enum honors the existing production vocabulary (scouting, in_talks, booked→confirmed) and adds the missing front (unscouted) and back (passed) states.  
**Tradeoffs:** "scouting" and "candidate" are collapsed into one stage. "Visited" and "shortlisted" are distinct in real production but currently share a state.  
**Revisit trigger:** Producer needs to distinguish visited locations from shortlisted candidates in the UI.

---

### Location.approved preserved alongside status enum

**Decision:** The `approved` Boolean on Location stays. Not folded into or replaced by the status enum.  
**Date:** April 20, 2026  
**Rationale:** Approved (aesthetic sign-off, often by EP or director) and confirmed (contractually booked) are conceptually distinct in real production. A location can be approved aesthetically before being booked, or booked under pressure without aesthetic approval. Removing without evidence of redundancy would be a guess.  
**Tradeoffs:** Two fields where one might suffice.  
**Revisit trigger:** Production usage shows the two fields tracking 1:1 in practice — collapse if so.

---

### meId centralized in useMeId() hook

**Decision:** The current-user id resolves through a single `useMeId()` hook in `apps/back-to-one/src/lib/hooks/useOriginOne.ts`. Every consumer — detail sheets, thread mutations, the threads page — calls this hook. The placeholder body reads the first `ProjectMember` row (matching prior inline `allCrew[0]?.userId ?? null` usage); Auth replaces only this function's body.  
**Date:** April 20, 2026  
**Rationale:** Auth is deferred until after Phase 1A. Centralizing the placeholder means the Auth implementation touches exactly one file instead of every consumer of the current fallback. Query keys that include meId (threads, allThreads) also pick up the real user id automatically on cutover, since the hook return flows through `useQuery` key factories.  
**Tradeoffs:** One extra indirection while the placeholder is in place. The first-row fallback is still non-deterministic across environments.  
**Revisit trigger:** Auth ships. At that moment, `useMeId()`'s body becomes the auth-session lookup and nothing else changes.


---

### Entity-vs-production-record threading rule

**Decision:** When a conceptual entity (Entity row) has a corresponding production-specific record (Talent for cast, Location for physical place), each has its own thread stream. Threads do not aggregate across the pair.  
**Date:** April 20, 2026  
**Rationale:** Entity holds the creative idea (the character as written, the location as scripted). The production record holds the execution (the actor hired, the place booked). Different audiences, different lifetimes. A creative thread about a role stays relevant if the actor is recast. A logistics thread about an actor becomes irrelevant if they drop out. Conflating them fragments conversation across the wrong axes.  
**Applies to:**
- Entity(type='character') ↔ Talent (cast)
- Entity(type='location') ↔ Location (physical place)
- Future pattern: any Entity–production-record pair

**Tradeoffs:** User opening one surface doesn't see the other surface's thread activity. Solved via cross-surface bridges like the Characters dropdown on Casting (creative context reachable from logistics page) — NOT via thread aggregation.  
**Revisit trigger:** Production workflow reveals a real pain from the separation that a cross-surface bridge can't solve.
