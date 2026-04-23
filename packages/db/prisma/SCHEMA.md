# Origin One — Schema Reference

Single consolidated view of the shared data model. Claude Code reads this to
avoid reconstructing the architecture every session.

This file is a **curated reference**, not the source of truth. The source of
truth is `packages/db/prisma/schema.prisma`. When the two disagree, Prisma
wins — and this file gets a PR to reconcile.

Last updated: April 22, 2026

---

## The One Rule

Schema changes require a dedicated PR. Never a feature branch. Never
incidental. A schema change touches all three apps simultaneously, and all
three must compile before merge.

See DECISIONS.md → "Schema changes require a dedicated PR."

---

## Core Entities

| Entity | Purpose | Apps |
|---|---|---|
| `Project` | Master container for everything | All |
| `Scene` | Atomic unit — connects script → shotlist → schedule | One Arc, B21 |
| `Shot` | Child of Scene. Permanent shot number (e.g. 12A). | One Arc, B21 |
| `Entity` | Polymorphic — characters, locations, props, wardrobe, HMU, etc. | All |
| `Document` | Versioned creative documents (scripts, boards, lore) | All |
| `User` | Identity and profile | All |
| `Team` | Org / project membership | All |
| `ProjectMember` | Person on a specific project (crew, cast, talent, client) | B21 |
| `Location` | Physical filming location. 1:many → `Entity(type='location')`. | B21 |
| `Thread` | Polymorphic discussion thread. See Threads section. | B21 |
| `ThreadMessage` | Message in a thread | B21 |
| `ThreadRead` | Per-user read state | B21 |
| `WorkflowNode` / `WorkflowEdge` | Pipeline / workflow graph | B21 |
| `Deliverable` | Output deliverable (cut, edit, asset) | B21 |
| `MoodboardTab` / `MoodboardRef` | Visual reference collections | B21 |
| `Milestone` | Project milestone | B21 |
| `ActionItem` | Task / todo | B21 |

---

## The Polymorphic Patterns

Two core patterns. Understand these before touching anything else.

### Entity — canonical identity

`Entity` is one table with a `type` discriminator. The same record flows
from One Arc into Back to One — no handoff, no export.

| `Entity.type` | Appears in Back to One as |
|---|---|
| `character` | Casting page |
| `location` | Locations pre-pro section (via `Location` FK) |
| `prop` | Art page → Props |
| `wardrobe` | Art page → Wardrobe |
| `hmu` | Art page → HMU |
| `moodboardRef` | Moodboard refs |

**Why this matters:** One Arc never exports to Back to One. A prop tagged in
One Arc's script breakdown is the same `Entity` row that appears in the Art
page. No sync. No drift. Same record.

**When you add a new `Entity.type`:** it's a schema PR. Update this file,
update the threadable types table (if threadable), update the seed, update
the routing in the relevant Back to One page.

### Thread — polymorphic attachment

All threads live in one `Thread` table. Attachment is via:

```
Thread.attachedToType: ThreadableType (enum, 14 values)
Thread.attachedToId:   UUID (points at the attached record)
```

No DB-level FK on `attachedToId` — enforcement is application-level. The
cost: batched loaders in `thread-context.ts` (one query per type, never
per-thread) to avoid N+1. The benefit: one inbox, one read-state model, one
query surface across every threadable surface.

Chat messages are **not** threads. Chat uses its own reply pattern.

---

## Threadable Types (locked — 14)

| Type | Attached to | Notes |
|---|---|---|
| `shot` | `Shot` | Has UI |
| `scene` | `Scene` | No detail sheet yet — future-reserved |
| `location` | `Location` | Has UI |
| `character` | `Entity(type='character')` | Has UI |
| `cast` | `ProjectMember` (cast role) | Has UI |
| `crew` | `ProjectMember` (crew role) | Future-reserved — no detail sheet yet |
| `prop` | `Entity(type='prop')` | Has UI |
| `wardrobe` | `Entity(type='wardrobe')` | Has UI |
| `hmu` | `Entity(type='hmu')` | Has UI |
| `moodboardRef` | `MoodboardRef` | Has UI |
| `actionItem` | `ActionItem` | Has UI |
| `milestone` | `Milestone` | Has UI |
| `deliverable` | `Deliverable` | Has UI |
| `workflowStage` | `WorkflowNode` | Has UI |

Adding a new threadable type is a coordinated change:
1. Add enum value to `ThreadableType`
2. Add chip color to `thread-tokens.ts`
3. Add batched loader in `thread-context.ts`
4. Update this table
5. Dedicated PR — never incidental to a feature branch

---

## Canonical Department List (13)

Defined exactly once in `apps/back-to-one/src/lib/utils/phase.ts` as the
`DEPARTMENTS` export. Every consumer imports from there.

Order is display order:

1. Production
2. Direction
3. Camera
4. G&E
5. Lighting
6. Sound
7. Art
8. Wardrobe
9. HMU
10. Casting
11. Post
12. Client
13. Other

Three diverging lists caused silent breakage in April — `Other` department
set from one source didn't group under another source's headers. Never
again. One source. `phase.ts`.

---

## Scenes & Shots

- **Shot numbers are permanent.** `12A` stays `12A` regardless of reordering.
  Referenced on call sheets, reports, crew comms — reordering must not
  silently rename a shot.
- **Story Order is canonical.** `Scene.orderInStory`, `Shot.orderInStory`.
- **Shoot Order is a production overlay.** A separate field. The strip board
  reads Shoot Order; the script reads Story Order.
- **Scene has no detail sheet yet.** Deferred until a real production run
  surfaces the gap. Scene is still a valid threadable type.

---

## Locations

A location is two records:

- `Entity(type='location')` — canonical identity, threads attach here, One
  Arc references here.
- `Location` — physical filming-location detail (address, scout photos,
  status, aesthetic approval).

`Location.entityId` is a 1:many FK → `Entity`. One entity can resolve to
multiple filming locations (a "warehouse" entity shot at three real places).

**LocationStatus enum:** `unscouted` / `scouting` / `in_talks` / `confirmed` / `passed`.

**`approved` is a separate boolean.** Aesthetic sign-off and booking status
are distinct concerns. Don't collapse them.

**Scene ↔ Location is derived, not stored.** Query: Scene → Entity → Location.
Scene-binding UX not yet designed.

**Known cleanup:** 5 unpaired `Entity(type='location')` rows on P2 + P4.
Dedicated PR before external beta.

---

## Crew & Cast

`ProjectMember` is the join table between `User` and `Project`.

- **Role types:** crew, cast, talent, client.
- **Department:** required for crew. Must be a value from the canonical
  13-department list.
- **Cross-project scope:** Some people (post editors, GFX artists) are
  declared at global scope in the seed and assigned to multiple projects
  (e.g. Rafi Torres, Cleo Strand on P1 + P5).
- **Talent mis-tagged as crew:** Aria Stone, Marco Silva, Zoe Park, etc. are
  currently `ProjectMember(role='crew', department='Other')`. Should move to
  a dedicated `Talent` table. Small follow-up PR.

---

## Workflow, Deliverables, Moodboards

Seeded April 20. Not yet deep-dived here — structure exists, wire diagrams
lives in `workflow-page.html` reference and the seed. When either of these
gets its own dedicated page (Deliverables UI is queued), expand this section.

Totals as of Apr 20: 39 WorkflowNodes, 33 WorkflowEdges, 20 Deliverables,
6 MoodboardTabs, 30 MoodboardRefs, 26 Threads, 50 ThreadMessages.

---

## Slack Integration (V3) — reserved fields

These fields are in the schema **from day one** even though Slack ships in
V3. Including them later is a schema-PR-for-all-three-apps problem we'd
rather avoid.

On any table that may originate in an external system:

```
integration_source:   "native" | "slack" | ...  (default "native")
external_id:          string?  (e.g. Slack message ts)
external_thread_id:   string?  (e.g. Slack thread_ts)
```

`SlackWorkspace.accessToken` **will not ship as plaintext**. Supabase Vault
or env-encrypted columns required before V3 ships.

---

## Documents

One shared `Document` schema across all three apps. A scene written in One
Lore at 2am is the same row that opens in One Arc and Back to One the next
morning. No export. No send.

Versioning + collaborative edit history lives on this table. Expand this
section when One Arc / One Lore active development begins.

---

## Prisma Baseline

The live DB was baselined as Prisma migration `0_init` on April 19, 2026,
representing all schema as of that date. `0_init` is marked applied but
should **never be run against an empty database** — new environments need
special handling (`prisma migrate deploy` from the full history, not
`migrate dev`).

---

## How to Update This File

This file drifts the moment a schema PR merges without updating it. The
discipline:

1. Schema PR changes `schema.prisma`.
2. Same PR updates this file.
3. If the change affects a threadable type, the 14-type table updates.
4. If the change affects entity routing, the polymorphic table updates.
5. If the change affects departments, `phase.ts` updates and this file
   reflects it.

No exceptions. This file is the onboarding surface for every future
collaborator and every Claude Code session.
