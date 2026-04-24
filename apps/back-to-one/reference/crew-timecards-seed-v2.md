# Crew Timecards — Seed Data v2

**Generated:** April 23, 2026
**Supersedes:** `back-to-one-crew-timecards-seed-v1.md` — draft, never committed to repo, referenced fictional crew (Jordan R., Dev P., Mia T., Sam K., Alex L., Rosa N.) who do not exist in the live DB.

This file supersedes v1 entirely. v1 should be moved to an archive folder or deleted.

---

## Source of truth

All crew references in this file map to ProjectMember rows confirmed present in the live Supabase DB as of the Apr 23 audit. Claude Code will look up `projectMemberId` by `(name, projectId)` pairs when running the seed — **do not invent or hardcode UUIDs**. The audit output from Apr 23 is the reference for ID resolution.

---

## Eligibility rule

A ProjectMember is timecard-eligible if:

```
department NOT IN ('Client', 'Other')
```

This excludes:
- **Client department (2 rows):** Sarah Osei (P5), Lena Farrow (P1)
- **Other department (11 rows, all currently talent):** Aria Stone (P1); Dev Okafor, Marco Silva, Zoe Park (P2); Jin Ho, Marcus Trent, Paul Navarro (P3); Kaia Mori (P4); James North (P5); Leo Marsh, Vera Koss (P6)

**Eligible count:** 60 of 73 ProjectMembers.

### Flag for future maintainers

The `Other`-exclusion is a temporary heuristic. The current schema does not distinguish cast/subjects/talent from generic "other" crew — every row presently in `Other` happens to be talent, but the schema permits legitimate `Other` crew to exist. When the talent-as-ProjectMember cleanup ships (already tracked in `BUILD_STATUS.md` Known Issues — moves talent to a dedicated table), this rule simplifies to `department != 'Client'` and the seed logic must be revisited.

Principals are eligible: **directors and producers can log their own time**. The producer/director distinction is about *visibility and approval scope*, not *logging eligibility* — a director logs their own hours like any crew member, a producer logs their own AND approves others.

---

## Coverage summary

**35 entries across 6 projects.** Exercises every state in the state machine, the empty state, a reopened-with-reason case, and principals logging own time alongside crew.

| Project | Entries | States present | Purpose |
|---|---|---|---|
| Simple Skin Promo | 9 | `approved`, `submitted` | Mid-shoot mostly-logged |
| Full Send | 5 | `submitted`, `approved`, `draft` | Active run-and-gun shoot with late submissions |
| In Vino Veritas | 6 | `approved`, `reopened` | Wrapped shoot with one queried entry |
| Flexibility Course A | 5 | `approved`, `submitted`, `draft` | Multi-day series mid-production |
| Natural Order | **0** | *(empty)* | Empty-state UI render |
| The Weave | 10 | `approved` | Fully wrapped narrative, all locked |

---

## P1 — Simple Skin Promo

**Project ID:** `2c67eaba-4e9d-42c5-bad6-e91a5acf61ab`
**Shoot dates:** Apr 13–15, 2026 (Mon–Wed)
**State:** Mid-shoot, most entries approved, two pending approval

| Crew | Dept | Date | Hours | Description | Status | Approver |
|---|---|---|---|---|---|---|
| Priya Nair | Camera | Apr 13 | 12.0 | Camera prep, beauty lighting tests at Bel Air estate | approved | Kelly Pratt |
| Theo Hartmann | Camera | Apr 13 | 12.0 | B-cam coverage, hero product macro inserts | approved | Kelly Pratt |
| Carlos Vega | Camera | Apr 14 | 12.5 | A-cam talent coverage, product reveals | submitted | — |
| Tanya Mills | Lighting | Apr 13 | 13.0 | Key + fill beauty setup, diffusion pass | approved | Kelly Pratt |
| Derek Huang | G&E | Apr 14 | 12.0 | Grip rigging, dolly setup for beauty moves | approved | Tyler Heckerman |
| Nina Osei | Art | Apr 13 | 12.0 | Hero product styling, set dressing | approved | Kelly Pratt |
| Fiona Drake | HMU | Apr 14 | 10.5 | Talent makeup, beauty continuity | submitted | — |
| Andre Kim | Sound | Apr 14 | 11.0 | VO booth capture, room tone | approved | Kelly Pratt |
| Mia Chen | Production | Apr 13 | 13.5 | Crew coordination, talent wrangling, call sheets | approved | Tyler Heckerman |

---

## P2 — Full Send

**Project ID:** `1db2136c-b596-484f-817a-83027275c9aa`
**Shoot dates:** Apr 14–16, 2026 (Tue–Thu, multi-location)
**State:** Active shoot, mixed states — run-and-gun submissions are late, drafts happen

Note: Full Send has only 5 timecard-eligible members (3 athletes are excluded as talent in `Other`). All 5 are represented.

| Crew | Dept | Date | Hours | Description | Status | Approver |
|---|---|---|---|---|---|---|
| Dani Reeves | Camera | Apr 14 | 11.0 | Mountain biking coverage, handheld + gimbal | submitted | — |
| Dani Reeves | Camera | Apr 15 | 12.5 | Skate park session, slow-mo and standard | submitted | — |
| Tyler Green | Production | Apr 14 | 13.0 | Location lockdown, athlete coordination | approved | Kelly Pratt |
| Kelly Pratt | Production | Apr 15 | 13.5 | Multi-location producing, own-time logged | submitted | — |
| Clyde Bessey | Direction | Apr 16 | 10.0 | Surf coverage directing at dawn | draft | — |

Demonstrates: producers and directors logging own time (Kelly P submitted, Clyde still in draft).

---

## P3 — In Vino Veritas

**Project ID:** `97c5c9e1-adb9-4152-af41-8912d5e75f13`
**Shoot dates:** Apr 6–10, 2026 (full week in Napa)
**State:** Wrapped, almost all approved, one entry reopened awaiting correction

| Crew | Dept | Date | Hours | Description | Status | Approver | Reopen reason |
|---|---|---|---|---|---|---|---|
| Owen Blakely | Camera | Apr 6 | 10.0 | Vineyard establishing shots, golden hour | approved | Kelly Pratt | — |
| Owen Blakely | Camera | Apr 8 | 12.0 | Harvest multi-cam coverage | approved | Kelly Pratt | — |
| Tom Vega | Sound | Apr 7 | 10.5 | Winemaker interview audio, lavs + boom | approved | Kelly Pratt | — |
| Ryan Cole | Production | Apr 8 | 12.0 | Harvest day coordination — hours need locations split | **reopened** | *reopened by Tyler Heckerman* | "Please split vineyard field hours from cellar hours — need locations broken out for the line-item audit." |
| Tyler Heckerman | Production | Apr 6 | 11.0 | Vineyard owner coordination, location prep | approved | Kelly Pratt | — |
| Clyde Bessey | Direction | Apr 10 | 9.0 | Pickups and drone directing, wrap | approved | Tyler Heckerman | — |

**This is the one reopened case in the seed.** Demonstrates the full cycle: Ryan Cole submitted → Tyler Heckerman approved → Tyler Heckerman later reopened with a specific reason. Ryan Cole's entry is now back to editable for him, and `reopenReason` on the record explains what needs fixing.

---

## P4 — Flexibility Course A

**Project ID:** `9af79016-8a00-4a6b-9338-c4ef2518f8ed`
**Shoot dates:** Apr 11 + Apr 16, 2026 (Episodes 1 and 2 of a six-part series)
**State:** Mid-series, Ep 1 approved, Ep 2 in approval limbo

| Crew | Dept | Date | Hours | Description | Status | Approver |
|---|---|---|---|---|---|---|
| Alex Drum | Camera | Apr 11 | 9.0 | Episode 1 yoga sequences, locked-off + handheld | approved | Kelly Pratt |
| Hana Liu | Sound | Apr 11 | 8.5 | Instructor lavs, ambient room tone | approved | Kelly Pratt |
| Tyler Moss | Production | Apr 11 | 9.0 | Episode 1 coordination, talent support | approved | Tyler Heckerman |
| Alex Drum | Camera | Apr 16 | 9.5 | Episode 2 meditation segments, soft lighting | submitted | — |
| Clyde Bessey | Direction | Apr 16 | 8.0 | Episode 2 directing, early cut review | draft | — |

---

## P5 — Natural Order

**Project ID:** `7e718564-0a23-4c40-9c63-5813f12846d3`

**No entries.** Natural Order is a post-only project — there is no production phase that generates timecards.

This project exists in the seed deliberately empty, to exercise the empty-state UI path.

**Expected UI render:** "No timecards logged for this project yet." (or equivalent empty-state copy from the design system).

---

## P6 — The Weave

**Project ID:** `40085c75-a246-42b6-8008-92858855bafb`
**Shoot dates:** Apr 1–4, 2026 (four-day narrative shoot)
**State:** Fully wrapped, all entries approved and locked

| Crew | Dept | Date | Hours | Description | Status | Approver |
|---|---|---|---|---|---|---|
| Maya Lin | Camera | Apr 1 | 12.0 | Day 1 exterior ravine sequences, magic hour | approved | Kelly Pratt |
| Caleb Stone | Camera | Apr 2 | 13.5 | Day 2 Lohm/Aleph dialogue coverage, A-cam | approved | Kelly Pratt |
| Chris Tan | Sound | Apr 2 | 13.0 | Dialogue capture, multi-track, boom + lavs | approved | Kelly Pratt |
| Omar Rashid | Sound | Apr 3 | 13.5 | Scene 12 audio, dusk wind challenges | approved | Kelly Pratt |
| Dario Reyes | Lighting | Apr 3 | 14.0 | Magic hour rigging, sunset extension pass | approved | Kelly Pratt |
| Petra Walsh | Art | Apr 3 | 13.0 | Scene 12 prep, ravine practical effects | approved | Kelly Pratt |
| Sofia Avila | Production | Apr 2 | 13.5 | Day 2 producing, schedule adjustments | approved | Kelly Pratt |
| Rina Cole | Production | Apr 1 | 13.0 | Day 1 coordination, call sheets, crafty | approved | Tyler Heckerman |
| Kelly Pratt | Production | Apr 1 | 13.5 | Day 1 producing, own-time | approved | Tyler Heckerman |
| Clyde Bessey | Direction | Apr 4 | 11.0 | Day 4 pickups directing, wrap | approved | Tyler Heckerman |

---

## Implementation notes for Claude Code

1. **ID resolution:** for every entry, look up `projectMemberId` via:
   ```
   SELECT id FROM "ProjectMember"
   WHERE "projectId" = <projectId> AND name = <crewName>;
   ```
   The audit output from Apr 23 contains the full list. Fail fast if any lookup returns zero rows — the seed is written against confirmed DB state.

2. **Entry field requirements (matches schema v2):**
   - `id` — `gen_random_uuid()` at DB level, per established Postgres-default pattern
   - `projectId` — from table header
   - `crewMemberId` — looked up per step 1
   - `date` — `@db.Date`, no time component
   - `hours` — `Decimal(4,2)`, e.g., `12.50`
   - `description` — from table, `@db.Text`
   - `status` — one of `draft | submitted | approved | reopened`
   - `submittedAt` — `null` for `draft`; otherwise set to a plausible timestamp after the `date` (e.g., same-day evening)
   - `approvedAt` + `approvedBy` — set only for `approved` and `reopened` entries
   - `approver` FK → ProjectMember row for the approver name (Kelly Pratt or Tyler Heckerman in this seed, resolved per project)
   - `reopenedAt` + `reopenedBy` + `reopenReason` — set only for the one `reopened` entry (Ryan Cole on P3)
   - `createdAt` + `updatedAt` — defaulted by schema

3. **Approver ID resolution:** approvers are named (Kelly Pratt, Tyler Heckerman). Each is a ProjectMember row on each project they approve on — the approver's ID must be *that project's* ProjectMember ID for them, not a global identity. Resolve `(approverName, projectId) → projectMemberId`.

4. **No new ProjectMember rows required.** Every crew name in this seed already exists in the live DB on the indicated project. If the seed script reports any missing name/project pair, stop and flag — do not auto-create.

5. **Reopened entry semantics:** Ryan Cole's Apr 8 entry on P3 has `status = reopened`, which means:
   - `submittedAt` — set (he submitted originally)
   - `approvedAt` + `approvedBy` (Tyler Heckerman) — set (was approved)
   - `reopenedAt` + `reopenedBy` (Tyler Heckerman) + `reopenReason` — set (was then reopened)
   - He has not re-submitted yet, so nothing else changes
   
   All three lifecycle traces are present on this one record, which is the fullest stress-test of the state machine.

6. **Save to:** `apps/back-to-one/reference/crew-timecards-seed-v2.md` (this file), commit alongside v1 being moved to an archive folder. Do not silently delete v1 — preserve it as a record of what changed and why (producer-chair discipline per `DECISIONS.md`).
