# Origin One — Decision Log

Every significant architectural or strategic decision lives here.
Before relitigating any call, read this file first.

Last updated: April 26, 2026

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

> **Superseded by [Shot numbers — mutable in pre-production, locked at production start](#shot-numbers--mutable-in-pre-production-locked-at-production-start) (April 26, 2026).** The "permanent identifiers" rule still describes the post-lockoff regime; the new entry adds the pre-production phase where reorder renumbers shots.

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

### ActionBar lives in apps/back-to-one, not packages/ui

**Decision:** ActionBar and FabActionContext are placed in `apps/back-to-one/src/`, not `packages/ui/`.
**Date:** April 25, 2026
**Rationale:** `packages/ui` is currently a pure-TS utility lib with zero React components. Lifting ActionBar there would require pulling React, `next/navigation`, and `framer-motion` into the package, coupling one-arc and one-lore to Next.js prematurely. ActionBar's routes and registered actions are Back-to-One-specific. Every other UI component already lives in `apps/back-to-one/src/components/ui/` — this matches established convention.
**Tradeoffs:** If a peer ActionBar becomes useful in one-arc or one-lore later, abstraction has to be extracted then.
**Revisit trigger:** A second app needs a structurally similar persistent nav bar.

---

### ActionBar uses project-accent glow over flat glass

**Decision:** ActionBar buttons render with strong glass background + project-accent glow + drop shadow. Glow color tracks the active project's accent.
**Date:** April 25, 2026
**Rationale:** 2a's flat glass tokens (rgba(8,8,14,0.6)) washed out against bright surfaces (moodboard, light detail sheets). Strong glass + accent glow lifts buttons off any background AND reintroduces project context to the persistent nav, which was lost when + went glass.
**Tradeoffs:** ActionBar is no longer brand-neutral — every project tints the bar. Acceptable: project context is always desirable when inside a project.
**Revisit trigger:** Project switcher ships and reintroduces project identity elsewhere in the persistent nav.

---

### Chat / threads / resources are toggle-to-close

**Decision:** Tapping chat / threads / resources when already on that route closes it (router.back() with Hub fallback). Active route shows accent fill + intensified glow.
**Date:** April 25, 2026
**Rationale:** Treats these surfaces as panels that flip in and out, not destinations users navigate away from. Matches the mental model established by drag-down sheets elsewhere in the app.
**Tradeoffs:** Users who *want* to navigate to chat from chat (e.g. to refresh) get a back-navigation instead. Acceptable — not a real workflow.
**Revisit trigger:** Resources becomes a slide-up panel instead of a route. Toggle behavior would need to swap from route-detect to panel-state.

---

### Projects-root gets its own ActionBar (root variant)

**Decision:** Projects-root mounts an `ActionBarRoot` variant in a new `apps/back-to-one/src/app/projects/layout.tsx`, gated to `/projects` and `/projects/threads` only (project-scoped routes keep the project-scoped `ActionBar`). Slot map: back hidden, chat at reduced opacity (no-op until Auth), + opens the 5-arc fan with labels, threads routes to `/projects/threads`, resources at reduced opacity (no-op until V2). Crew replaces Threads in the fan. Threads becomes its own route at `/projects/threads`. The bar uses brand indigo glow throughout — no project context exists at root.
**Date:** April 26, 2026
**Rationale:** Investigation confirmed company-level Threads already aggregates correctly via `useAllThreads` — promoting it from a fan-arc panel to a discoverable bar button is honest discoverability work. Crew at company level is one client-side dedupe away from working; introducing it as a panel keeps it iterable. Visual symmetry with the project-scoped bar (same anchor, same five slot count) makes navigation between root and project surfaces feel like one continuous bar.
**Tradeoffs:** Two of five slots (chat, resources) are visual-only for now — chat lights up with Auth, resources with V2 schema work (nullable projectId on Resource + Folder + Storage discipline). Reduced opacity signals the disabled affordance; tap is a no-op with a developer console hint. The asymmetry is honest: routes diverge slightly from project-scoped, ever (no chat or resources at root in the literal "tap → destination" sense until those destinations exist).
**Revisit trigger:** Auth lands → company chat unlocked → ActionBarRoot's chat slot becomes a real route. Resources V2 (nullable `Resource.projectId`) → resources slot becomes a real route. Crew design locks → promote from panel to `/projects/crew` route.

---

### Threadable entity types — expanded to canonical 15

**Decision:** Threads can be attached to fifteen entity types. Adds `inventoryItem` as the 15th, alongside the original 14.  
**Date:** April 25, 2026  
**Rationale:** Inventory items span the production lifecycle and attract the same kind of cross-team conversation that other threadable surfaces do (e.g. "is this prop arriving Tuesday?", "who has the camera package on day 3?"). Threading on Inventory was deferred when InventoryItem schema landed (PR #20) and expanded here once the page was real (PR #24).  
**Tradeoffs:** The 14-type lock from April 19 is now superseded. Future additions follow the same discipline: dedicated PR, rationale, BRAND_TOKENS chip color, thread-tokens entry, batched loader case.

The `thread-context.ts` file now contains six explicit-enumeration sites for each threadable type (chip type, gradient, label, batched query, map slot, build-context case). At 15 types this is manageable; at 20+ it becomes a registry-pattern refactor candidate. Defer until a real new threadable type surfaces the cost.

**Revisit trigger:** Same as the 14-type lock — a new major surface needs threading.

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

---

### Local branches whose work has landed on main are deleted immediately

**Decision:** Local branches whose work has landed on main via any commit path are deleted immediately, not preserved.  
**Date:** April 26, 2026  
**Rationale:** Squash-merge produces different commit hashes, so `git branch --no-merged` cannot detect superseded branches. Persisting them creates a ghost backlog. The PR record is the historical artifact, not the local branch. Verified by branch audit on Apr 26 — five branches discovered to be fully superseded by main via different commit paths.  
**Tradeoffs:** Loss of branch-level metadata for re-applied work. PR descriptions must carry that context instead.  
**Revisit trigger:** Never.

---

### Shot numbers — mutable in pre-production, locked at production start

**Decision:** Shot numbers (e.g. 12A) are MUTABLE during pre-production planning — drag-reorder in Story Order mode renumbers shots according to their `sortOrder`. Once production begins, shot numbers freeze and become permanent identifiers. After lockoff, drag-reorder operates on Shoot Order only and does not touch shot numbers.  
**Date:** April 26, 2026  
**Rationale:** The original "shot numbers are permanent identifiers" decision protects against silent renaming during active production — call sheets reference Shot 12A and that reference cannot drift. But during pre-production, the writer / director / AD are still figuring out the story; renumbering is desired and expected. Permanent shot numbers in early drafts would create confusing 12A-between-1-and-2 states that are worse than the renumbering problem.  

**The lock mechanism (manual / phase-based / version-based) is intentionally deferred** to a separate future PR. Current behavior: numbers track `sortOrder` always. Production-lock is a future feature.  

**Tradeoffs:** A user who reorders shots in pre-production sees their shot numbers update. Until the lock mechanism ships, there is no protection against late-pre-production renumbering. Mitigation is producer discipline — don't reorder shots in story-order mode after the call sheet goes out.  
**Revisit trigger:** Lock mechanism design conversation (separate PR).

---

### EntityAttachment storage — v1 unsigned public URLs, RLS deferred

**Decision:** The `entity-attachments` storage bucket ships with permissive RLS (public SELECT, anon INSERT/UPDATE/DELETE) — the same posture as the existing `moodboard` bucket — NOT the `auth.role() = 'authenticated'` pattern that CLAUDE.md "Storage" lists as the default for new buckets. Public URLs are unsigned, never expire, and rely on random per-file IDs in the storage path for unguessability.  
**Date:** April 26, 2026  
**Rationale:** EntityAttachment is foundational for six+ surfaces (locations, props, wardrobe, hmu, moodboard refs, future cast reference photos). Auth-checked RLS would render the entire pattern unusable until Auth (#23) ships, which means the gallery component and helper code sit dormant on main for weeks of internal-only Phase 1A work — exactly the kind of dead-code-on-main the discipline was meant to avoid. The threat model is bounded: internal users only, no external clients, no PII in scout photos. Random filenames mean leaked URLs are unguessable but link-leaks are permanent until the bucket policy tightens.  
**Tradeoffs:** Anyone with a leaked URL can view forever. The CLAUDE.md "auth-check from day one" rule now has an explicit exception, which weakens the rule unless every future bucket either follows it or earns its own DECISIONS entry. The next bucket (`avatars` for Crew Profile v2) MUST justify its policy choice the same way — no silent precedent.  
**Revisit trigger:** Auth (#23) ships. Tightened in the same RLS pass that locks down `moodboard` and `storyboard`. Also: external client beta — the "v1 sharing model" must be revisited before any non-employee user touches the system.

---

### Narrative → Production cardinality rule (1:1 vs 1:N)

**Decision:** The narrative→production pattern chooses cardinality per entity type using a single test:

> **Does the production process for this type involve evaluating multiple candidates per script element?**
>
> - **Yes → 1:N.** The narrative entity is the parent; multiple production rows can FK back to it. Apply when production scouting / casting / sourcing organically produces several options for a single scripted thing, and the choice between them is part of the workflow.
> - **No → 1:1.** Enforced via `@unique` on the nullable production-side `entityId`. Apply when narrative entities map cleanly to a single tracked physical record and any "alternates" are noise rather than first-class workflow state.

**Date:** April 26, 2026

**Application by type (current + planned):**

| Type | Cardinality | Reasoning |
|---|---|---|
| Character → Cast (Talent) | 1:1 | One actor portrays one character. Recasting replaces, doesn't add. |
| **Location → Location** | **1:N** | Scouting produces multiple candidates per scripted location; choosing between them is the workflow. (P1 Bel Air Estate → 3 Location candidates is the seed example.) |
| **Prop → PropSourced** | **1:1** | Production sources one prop per scripted prop. Pickup-options (multiple vendors / candidates per scripted item) deferred to a child `PropSourceOption` table only if a real production surfaces the need. |
| Wardrobe → WardrobeSourced (#15) | TBD per test | Open question: do directors typically evaluate multiple wardrobe options per scripted item, or is sourcing 1:1? Apply the test when #15 is designed. |
| HMU (TBD) | TBD per test | HMU looks tend toward 1:1 (one final per character look) but apply the test on real production data. |
| Future entity types | TBD per test | Always answer the test before choosing. |

**Tradeoffs:**
- 1:1-with-`@unique` is harder to reverse than 1:N — going from 1:1 to 1:N means dropping the unique constraint and possibly migrating data. Going from 1:N to 1:1 means picking a "winner" row and deduplicating. Choose the cardinality that matches the workflow.
- The 1:1 test gates premature optionality. If a future PR proposes a child-options table for what's currently 1:1, the proposer must show that real productions are creating multiple rows in app code or via dashboard edits — not just speculate.

**Revisit trigger:** A type's actual production data shows the chosen cardinality was wrong (1:1 with persistent need for multiple rows, or 1:N where the "options" pattern is never used). Promote/demote with a dedicated migration.

---

### PropSourced schema — production-side prop tracking with PropStatus enum

**Decision:** Production-side prop data lives in a dedicated `PropSourced` table — 1:1 FK to `Entity(type='prop')` (enforced via `@unique` on `entityId`, per the Narrative→Production cardinality rule above), with a typed `PropStatus` enum (`needed | sourced | ready`) and a separate `isHero Boolean` for the hero/featured-prop category. Existing `Entity.metadata.status` values lift into `PropSourced.status` via migration `20260426210000_add_prop_sourced`; the `metadata.status` read path drops in the next PR (#14). `metadata.imageUrl` and `metadata.tags` remain on Entity unless explicitly lifted.  
**Date:** April 26, 2026  
**Rationale:**
- **Own table, not Entity.metadata:** Production-side data has its own lifecycle (status changes, hero flagging, future sourcing detail) distinct from script-side identity. Typed columns on a typed table beat untyped JSON for a field that drives UI state.
- **3-state enum (needed / sourced / ready):** Matches the documented spec in `apps/back-to-one/reference/locations-art-casting.html`. Existing TS code used `confirmed` (== `ready`) plus a `hero` value that was type-only — never seeded, never read, never compared. Reference HTML is the spec; the migration renames `confirmed → ready` and splits `hero` out as a Boolean.
- **`isHero` as Boolean, not enum value:** Hero is a category (this prop is featured / hero), not a workflow stage. Mixing it into the status enum forces awkward two-axis decisions (a hero prop can be needed OR sourced OR ready — three states × two categories = 6 combos). Boolean is cleaner and orthogonal.
- **1:1 cardinality (per the rule above):** Production sources one prop per scripted prop — the test answers "no" for props. Pickup-options pattern (`PropSourceOption` child table) deferred per BUILD_STATUS Apr 24 lock; added later only if a real production surfaces the need.
- **`@unique` on nullable `entityId`:** Allows `PropSourced` rows without a parent Entity (production-only props that weren't scripted), mirroring the Location-Silver-Lake case. Postgres' `UNIQUE` treats `NULL` as distinct, so multiple unpaired rows are allowed; once paired, the 1:1 constraint is enforced. **Smoke-tested:** see Flag-2 verification in PR #53 conversation — duplicates rejected, multiple nulls accepted.
- **`projectId` with cascade + index:** Matches every other table's pattern (deleting a Project deletes all PropSourced rows). Required for the same RLS-day storyboarding as `EntityAttachment`.

**Tradeoffs:**
- Removing or renaming a `PropStatus` enum value later requires a Postgres migration (enum values append cleanly; remove/rename is harder). The 3-value choice is conservative; expansion later is deliberate work.
- `confirmed → ready` rename means anyone with a `confirmed` value in their head needs to internalize the new vocabulary. Mitigated by the rename happening in lift-and-break migration before any UI consumes it.
- Dual-write transition: between #13 merge and #14 merge, both `Entity.metadata.status` and `PropSourced.status` are populated. Slight redundancy. Cleared up in #14 when the read path swaps.

**Revisit trigger:**
- A real production surfaces an `on_set` or `wrapped` lifecycle stage that needs to be tracked separately from `ready` — extend the enum (append-only is cheap).
- Multiple production candidates per scripted prop become a real pattern — add the `PropSourceOption` child table.
- Hero/featured props acquire enough metadata (tags, render priority, etc.) to deserve their own table — promote `isHero` from Boolean to FK.

---

### WardrobeSourced schema — production-side wardrobe tracking with WardrobeStatus enum

**Decision:** Production-side wardrobe data lives in a dedicated `WardrobeSourced` table — 1:1 FK to `Entity(type='wardrobe')` (enforced via `@unique` on `entityId`, per the Narrative→Production cardinality rule), with a typed `WardrobeStatus` enum (`needed | sourced | fitted | ready`) and **no** `isHero` Boolean. Existing `Entity.metadata.status` values lift into `WardrobeSourced.status` via migration `20260427000000_add_wardrobe_sourced`; the `metadata.status` read path drops in the next PR (#16). `metadata.imageUrl` and `metadata.tags` remain on Entity unless explicitly lifted.  
**Date:** April 27, 2026  
**Rationale:**
- **Cardinality 1:1:** Apply the rule from the entry above — wardrobe sourcing produces one physical wardrobe item per scripted item; the answer to "does production evaluate multiple candidates per script element" is no. Same answer as Prop, distinct from Location.
- **4-state enum (`needed | sourced | fitted | ready`):** Distinct from `PropStatus` per BUILD_STATUS Apr 24 lock — wardrobe has a `fitted` beat that props don't. Real production wardrobe goes through fitting with talent, alterations, and final approval before it's ready for shoot day. Prop's `ready` means "prepped"; wardrobe's `fitted` means "talent has tried it on, alterations underway/done"; wardrobe's `ready` means "alterations done, locked in."
- **No `isHero`:** Hero is a prop concept (the hero camera, the hero device) — the analogous wardrobe pattern would be "principal wardrobe" but the workflow doesn't branch on it the same way. Add later only if a real production surfaces the need (parallel to the prop `PropSourceOption` deferral).
- **`@unique` on nullable `entityId`:** Same shape as PropSourced, smoke-tested in PR #53. Multiple production-only WardrobeSourced rows allowed (production-added wardrobe not in script); 1:1 enforced once paired.
- **`projectId` cascade:** matches every other production-side table.

**Tradeoffs:**
- Two parallel enums (`PropStatus` and `WardrobeStatus`) with overlapping but distinct values means the Art page UI branches on type for status display. Acceptable cost for honest workflow modeling.
- HMU is the third art type but stays on `Entity.metadata.status` for now — no `HmuSourced` table or typed enum yet. Defers schema work until a real production surfaces the need (smaller surface than props/wardrobe; the polymorphic Entity.metadata pattern still serves it).

**Revisit trigger:**
- A real production surfaces an `on_set` or `wrapped` lifecycle stage — extend the enum.
- Multiple production candidates per scripted wardrobe item become a real pattern — add `WardrobeSourceOption` child table.
- HMU complexity grows enough to warrant its own typed table — add `HmuSourced` with the same shape (apply the cardinality test first; HMU likely 1:1 too).
- Wardrobe acquires a "principal" / "hero" concept worth tracking — add `WardrobeSourced.isPrincipal Boolean`.

---

### Crew profile fields — global vs project-scoped split

**Decision:** Crew Profile v2 fields are split between `User` (global) and `ProjectMember` (project-scoped):
- **`User.phone`** — global. The person's contact number; follows them across every project they're a member of.
- **`User.avatarUrl`** — global. Already existed; same reasoning.
- **`ProjectMember.notes`** — project-scoped. Production-relevant context that varies by role.
- **`ProjectMember.skills String[]`** — project-scoped. Relevant skills for this role on this project; Postgres native array.

**Date:** April 27, 2026  
**Rationale:**
- **Phone is identity, not role.** A person has one phone number across every project. Storing it on `ProjectMember` would either duplicate it across rows for the same person or require a "primary ProjectMember" tiebreaker — both bad.
- **Notes are context, not identity.** The same person can be DP on Project A (notes: "owns RED package") and Director on Project B (notes: "needs script breakdown by week 2"). Production-side context is per-role, not per-person.
- **Skills are role-relevant.** Camera operation matters to a DP credit, not to a director credit on a different project. The `String[]` shape makes them queryable (e.g. "find all crew with `Steadicam` skills on this project"); switching to a JSON column or a separate `Skill` table would lose Postgres' native array operators for marginal flexibility.

**Tradeoffs:**
- Editing a person's notes/skills means editing the right `ProjectMember` row, not the `User` — UI must surface this clearly to avoid "I edited it on Project A but it didn't change on Project B."
- Empty-array default for `skills` (Postgres `'{}'` / Prisma `@default([])`) means existing seeded `ProjectMember` rows get `[]` not `NULL` — fewer null-vs-empty branches in app code. Matches the Inventory `ImportSource` precedent of "make defaults explicit at migration time."
- Future migration to per-team profile fields (e.g. payroll tax info that's global per User but only relevant inside one Team) follows the same test: scope to the smallest container that the field naturally belongs to.

**Revisit trigger:**
- A real production needs a field that's currently project-scoped to behave globally (or vice-versa) — apply the test ("does this travel with the person, the role, or the team?") and migrate.
- Skills become structured (skill levels, certifications, expiry dates) — promote to a dedicated `Skill` table linked to `User` or `ProjectMember`.

---

### Avatars storage — v1 unsigned public URLs, RLS deferred

**Decision:** The `avatars` storage bucket ships with permissive RLS (public SELECT, anon INSERT/UPDATE/DELETE) — same posture as `entity-attachments` and the existing `moodboard`/`storyboard` buckets — NOT the `auth.role() = 'authenticated'` pattern that CLAUDE.md "Storage" lists as the default for new buckets. Public URLs are unsigned, never expire, and rely on random per-file IDs in the storage path (`{userId}/{cuid}.{ext}`) for unguessability.  
**Date:** April 27, 2026  
**Rationale:**
- **Pre-Auth usability matches the EntityAttachment precedent.** Auth-checked RLS would make the avatar upload UI in #22 dormant code on main until Auth (#23) ships — the same dead-code-on-main risk that drove the EntityAttachment exception.
- **Threat model is bounded for v1:** internal users only, no external clients, avatars are inherently meant to be visible (they appear in chat, threads, crew rows, casting bridge, etc.). Avatars are weaker-privacy than scout photos in `entity-attachments`.
- **Random per-file IDs** make leaked URLs unguessable. Combined with the `uploadAvatar` helper's best-effort cleanup of the old object on replace, an avatar URL that's been retired is gone for new viewers (modulo browser cache).
- **Tightening with `entity-attachments` on Auth day** keeps the cleanup batched into one RLS pass (#24) rather than per-bucket scattered work.

**Tradeoffs:**
- Anyone with a leaked avatar URL can view forever pre-Auth. For internal-only users this is acceptable; pre-external-beta this gets revisited.
- Two storage buckets now ship with permissive RLS by exception (`entity-attachments`, `avatars`). The third (Crew Profile v2 phone numbers — but those aren't in storage, they're in the `User` table). Future buckets must each justify their RLS choice with a DECISIONS entry — the exceptions are deliberate, not standard.

**Revisit trigger:**
- Auth (#23) ships. Tightened in the same RLS pass that locks down `entity-attachments`, `moodboard`, `storyboard` (#24).
- External client beta — avatar URLs leaving the internal Trust boundary force a hard tightening pass before that ships.

### Receipts storage — pre-Auth permissive, signed-URL-only access

**Decision:** The `receipts` storage bucket's `storage.objects` policies ship permissive (anon SELECT/INSERT/UPDATE/DELETE) — same posture as `moodboard`/`storyboard`/`entity-attachments`/`avatars`. The bucket itself stays `public=false`, so files are NEVER reachable via raw public URLs — only via short-lived signed URLs created by the JS client. Originally PR 4 set `auth.role() = 'authenticated'` on every policy; PR 14 (#72) browser smoke surfaced that the localStorage-only viewer-shim does NOT establish a Supabase auth session pre-Auth, so every browser upload was denied.

**Date:** April 27, 2026  
**Rationale:**
- **Pre-Auth usability matches the EntityAttachment / Avatars precedent.** Auth-checked RLS would make PR 14's receipt-capture UI dormant code on main until Auth (#23) ships — same dead-code-on-main risk that drove the prior exceptions.
- **Bucket stays `public=false`.** Unlike moodboard/storyboard/entity-attachments/avatars (all public buckets), receipts are sensitive financial documents. Forcing access through `createSignedUrl` (1-hour expiry, generated server-side via the browser anon client) means leaked filesystem paths alone don't expose receipts — you need an active Supabase client + the path. Weaker than auth-only RLS, stronger than public URLs.
- **Random per-file IDs** in the storage path (`{projectId}/{lineId}/{timestamp}-{random}.{ext}`) make targeted enumeration of other projects' receipts infeasible without the path.
- **5MB + MIME allowlist** (PNG/JPEG/WebP/HEIC/PDF) stays enforced server-side on the bucket — that's a separate config, unaffected by RLS.

**Tradeoffs:**
- Anyone with the anon key + a receipt path can fetch a signed URL pre-Auth. For the closed-set v1 dogfood (Tyler + Kelly), this is acceptable; pre-external-beta this gets the same hard tightening as avatars.
- Five storage buckets now ship permissive by exception — three public (moodboard, storyboard, entity-attachments, avatars) and one private-bucket-with-permissive-RLS (receipts). The pattern is "RLS is dead-code pre-Auth" — Auth day's #24 RLS pass restores the discipline across all five.

**Revisit trigger:**
- Auth (#23) ships. Tightened in the same RLS pass that locks down `entity-attachments`, `moodboard`, `storyboard`, `avatars` (#24). Receipts get the strictest tightening of the five — `auth.role() = 'authenticated'` AND a project-membership check via `storage.objects.metadata` so a producer can only read receipts on their projects.
- External client beta — receipts hitting an external Trust boundary forces a hard tightening pass before that ships.

### Producer-only swap sites — pre-Auth viewer-shim consolidation

**Decision:** Three sites read `readStoredViewerRole()` (localStorage shim) to gate producer-only UI pre-Auth. Cataloged here so Auth day swaps them in a single pass to a Supabase session check.

**Date:** April 27, 2026 (PR 15 added the third site).  
**Sites:**
1. **Budget page** — `apps/back-to-one/src/app/projects/[projectId]/budget/page.tsx`. Non-producer hits `/budget` → `router.replace` back to project root. Established in PR 8.
2. **Hub Budget block** — `apps/back-to-one/src/components/hub/HubContent.tsx`. Producer-only block at the top-row 2-col grid (peer of Timeline). Established in PR 8; placement moved to top in PR 14.
3. **Timeline Days tab** — `apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx`. Days pill in the right-slot toggle is producer-only; renders the lifted /schedule UI. Established in PR 15. Replaces the standalone /schedule page.

**Rationale:**
- Day counts (`prepDays`/`shootDays`/`postDays`) drive budget formula globals. Crew should not be able to mutate these — they fan out through every line item with `qty = shootDays * 2` etc.
- Same shim across all three sites keeps the Auth-day refactor surface trivial: one `useEffect(() => setRole(readStoredViewerRole()), [])` to swap per file.

**Tradeoffs:**
- localStorage is trivially bypassable (`localStorage.setItem('origin_one_user_role', 'producer')`). Pre-Auth dogfood (Tyler + Kelly) only — no external producers.
- Three sites need to be touched on Auth day, not one — but the swap is mechanical and the search/replace is `readStoredViewerRole` → `useSupabaseSession().user.role`.

**Revisit trigger:**
- Auth (#23) ships. Replace `readStoredViewerRole()` with the Supabase session role-claim across all three sites in a single PR. Add a `useViewerRole()` hook in `@origin-one/auth` so future producer-only sites have one entry point.
