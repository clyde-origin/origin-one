# Back to One — Schema & Ontology Alignment

**Prepared for:** Chris Vienneau, Movielabs
**From:** Clyde Bessey, Origin Point / Origin One
**Last updated:** April 24, 2026

---

## Context

Origin Point has been building productions for the studios, networks, and brands referenced in our 2030 Vision adjacency (RED Digital Cinema in-house team, HPA standards work, Movielabs contributions) for years. **Back to One** is the production operating system we're building because the tooling we needed didn't exist — not because we theorized the need, but because we lived it on every production.

Origin One is the parent: three apps (One Lore · One Arc · Back to One) sharing one schema, one backend, one login. Back to One is shipping first — production OS. One Arc is script→shotlist→board. One Lore is world/character/mythology.

**Why this document exists:** As the schema has taken shape over the last several months, we kept arriving at conceptual decisions that turned out, on closer inspection, to match the Movielabs Ontology for Media Creation (OMC) v2.8. We want to share our schema, explain our alignment (and intentional divergences), and open a conversation about whether Back to One is a candidate implementer to reference, or a future interop target.

We are not proposing that Back to One *be* OMC. We are proposing that Back to One is **a product built on the Narrative/Production split that OMC articulates**, and that our schema reflects OMC's conceptual architecture without trying to be an interop ontology itself.

---

## The central alignment: Narrative/Production split

The OMC's foundational organizing move is the separation of **narrative elements** (from the script — Narrative Character, Narrative Location, Narrative Prop, Narrative Wardrobe, Narrative Scene) from **production elements** (the real-world things that depict or portray the narrative ones — the actor cast to play the character, the real location scouted to stand in for the narrative location, the physical prop built to depict the narrative prop).

The relationship between them in OMC terminology is **Portrayal** (for characters, where a Participant portrays a Narrative Character) and **Depiction** (for objects and places, where a production Asset depicts a narrative element).

### Back to One's expression of this split

From day one we modeled what we called "fictional → real." That's the same thing.

```
OMC                         Back to One
─────────────────────────   ───────────────────────────────────
Narrative Character     →   Entity(type='character')
 ↓ (Portrayal)               ↓
Production Character /  →   Cast (extends Entity via FK)
  Portrayal

Narrative Location      →   Entity(type='location')
 ↓ (Depiction)               ↓
Production Location     →   Location (extends Entity via FK)

Narrative Prop          →   Entity(type='prop')
 ↓ (Depiction)               ↓
Production Prop         →   PropSourced (upcoming)

Narrative Wardrobe      →   Entity(type='wardrobe')
 ↓ (Depiction)               ↓
Production Wardrobe     →   WardrobeSourced (upcoming)
```

`Entity` is the shared identity row. The production-side table (Cast, Location, PropSourced, WardrobeSourced) extends it with production-specific fields (scouted status, source vendor, physical location address, etc.) while the narrative identity remains a single row that all Scenes, Shots, Threads, and other references attach to.

The `LocationStatus` enum (`unscouted / scouting / in_talks / confirmed / passed`) is our expression of the production-side lifecycle for a Depiction pairing. Similar lifecycles are coming for Prop and Wardrobe.

---

## Schema overview — what exists today

### Core entities

- **Project** — master container. Every other table is project-scoped.
- **ProjectMember** — participant on a project, with role (director/producer/coordinator/writer/crew) and department (canonical 13-entry list).
- **User** — identity (separate from ProjectMember to support participation across projects).
- **Entity** — polymorphic narrative element. Fields: `type` (character, location, prop, wardrobe, etc.), `name`, and relationships to Scenes, Shots, Threads.
- **Scene** — Narrative Scene.
- **Shot** — Production Shot. Has permanent identifier (e.g. `12A`) independent of reorder.
- **Location** — Production Location. 1:1 FK to Entity(type='location').
- **Cast** — Production Character / Portrayal. 1:1 FK to Entity(type='character').

### Workflow and collaboration

- **WorkflowNode, WorkflowEdge** — pipeline stages per project, directed graph.
- **Thread, ThreadMessage, ThreadRead** — polymorphic discussion surface. A Thread attaches to any of 14 entity types (shot, scene, location, character, cast, crew, prop, wardrobe, hmu, moodboardRef, actionItem, milestone, deliverable, workflowStage). Conceptually similar to OMC's Context.
- **Deliverable, Milestone, ActionItem** — project tracking.
- **MoodboardTab, MoodboardRef** — creative references attached to projects.

### Production operations

- **CrewTimecard** — hourly tracking per ProjectMember per day. Status state machine (draft→submitted→approved, or reopened). Shipped April 23, 2026.
- **InventoryItem** (upcoming) — physical and consumable items (gear, expendables, build materials) scoped to a project.

---

## Where we diverge from OMC (and why)

1. **Vocabulary.** OMC uses abstract terms (Participant, Asset, Task, Context). We use production-practitioner terms (crew, shot, scene, prop, location). This is deliberate. OMC's abstraction serves interoperability between many tools. Back to One is a product used by on-set practitioners — our vocabulary matches how the work is actually talked about.

2. **Asset as a superset.** OMC treats physical props, digital media files, and participants all as subclasses of Asset. We keep these as distinct models. Collapsing them would lose the UI queries and constraints that make each concept useful to a user.

3. **Context as an explicit class.** OMC has `Context` as a first-class binding class. We've implemented the same conceptual pattern via polymorphic `Thread` (attachment to any entity type via `attachedToType` + `attachedToId`). Functionally similar, named differently for user-facing clarity.

4. **Camera Metadata not yet modeled.** OMC v2.x aligns Camera Metadata with SMPTE RIS OSVP. Back to One has `Shot` but not per-shot camera metadata yet. This is a deliberate defer — we'll model it when a real post workflow surfaces the need. Following the "proven on a real production before it ships" discipline.

5. **Production Set vs Production Location.** OMC distinguishes the built/dressed space from the real geographic place. We conflate into `Location` for now. Worth revisiting as productions with set-build-heavy workflows come through.

---

## Alignment by OMC concept

| OMC concept | BT1 model | Notes |
|---|---|---|
| Creative Work | `Project` | One project = one Creative Work |
| Narrative Scene | `Scene` | 1:1 |
| Narrative Character | `Entity(type='character')` | Canonical identity |
| Portrayal | `Cast` | FK-linked to Entity |
| Narrative Location | `Entity(type='location')` | Canonical identity |
| Production Location (Depiction) | `Location` | FK-linked to Entity |
| Narrative Prop | `Entity(type='prop')` | Canonical identity |
| Production Prop (Depiction) | `PropSourced` | Upcoming |
| Narrative Wardrobe | `Entity(type='wardrobe')` | Canonical identity |
| Production Wardrobe (Depiction) | `WardrobeSourced` | Upcoming |
| Participant | `ProjectMember` + `User` | Split for project-scoped membership |
| Task | `ActionItem` + `Deliverable` + `Milestone` | Three classes of task |
| Context | `Thread` (polymorphic) | Discussion and reference context |
| Shot | `Shot` | Permanent ID + story order + shoot order |
| Sequence | (implicit via Scene grouping) | Not yet first-class — may surface later |
| Version | (deferred) | OMC has strong versioning. We've deferred. |
| Asset: Camera Metadata | (deferred) | Will land with post workflow |
| Asset: Audio | (deferred) | Post pipeline not yet built |
| Asset: CG | (not in scope) | Out of scope for Back to One |

---

## What we'd like to discuss

1. **Does Back to One's narrative/production alignment make it a candidate for the 2030 Greenlight program or an OMC implementer case study?** The Yamdu case study referenced in Movielabs publications is our closest conceptual neighbor.

2. **Controlled vocabulary.** Our canonical 13-department list, our 14 threadable entity types, and our status enums — are there OMC-published controlled vocabularies we should be aligning to directly? We'd rather drift toward OMC than calcify custom terms that later need translation.

3. **RDF / JSON-LD export path.** If Back to One becomes a useful implementer reference, we'd want to publish our schema as OMC-aligned RDF. What's the right level of fidelity and the right sequence for that?

4. **Interop between Back to One and OMC-aware tools.** Script breakdown imports from Final Draft / Fountain / Celtx and exports to OMC-formatted data. Asset handoff to Frame.io, color platforms, delivery systems. What does the OMC community see as the highest-value import/export surfaces?

5. **Security architecture.** The CSAP (Common Security Architecture for Production) is referenced alongside OMC in the 2030 Vision. We haven't modeled against it yet. What's the right time to engage with CSAP for a tool at our stage?

---

## Appendix — Origin Point credentials

- RED Digital Cinema: in-house production team during formative years of 4K/6K/8K workflow standards
- HPA Tech Retreat and Movielabs work: contributing to industry-level discussions on production and post workflow infrastructure
- Production credits: Netflix, National Geographic, Adobe, HPA, Movielabs

Back to One is the infrastructure we always needed, built by the practitioners who felt the gap. Origin One is the broader mission: **what's in your mind should be what ends up in the world.** Remove friction, protect vision, keep the whole thing one connected thread from first spark to final frame.

---

*Document is a living artifact — schema evolves with every PR, and this doc should be updated in sync with BUILD_STATUS.md at each milestone.*
