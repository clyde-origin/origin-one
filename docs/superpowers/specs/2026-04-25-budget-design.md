# Budget Module — Design Spec

**Status:** Brainstorm complete; design locked; ready for implementation plan.
**Date:** 2026-04-25
**Author:** Clyde (with Claude — brainstorming session)
**Implementation timing:** Brainstorm-now, build-later (slot pre-Auth at the producer's discretion).
**Branch:** `design/budget-explorations` (off `origin/main`).
**Mockup:** `apps/back-to-one/reference/explorations/budget-page.html` (this branch).
**Final reference path on UI PR:** `apps/back-to-one/reference/budget-page.html`.

---

## 1. Overview

A film-industry-grade production budget module embedded in Back to One: nested AICP-aligned accounts → line items with formula-capable qty, per-line fringe %, per-version amounts (Estimate / Working / Committed). Actuals computed from approved timecards (labor) + Expense rows with receipt photos (non-labor). Multiple side-by-side versions for what-if comparison. PDF (topsheet + detail) and CSV export. Cloneable across projects.

**Heavily inspired by saturation.io's budget table** with concessions for BT1's mobile-first PWA reality and dark cinematic visual system.

### The Four Questions (project-mandated test)

1. **Reduces friction?** Yes — one place to plan and track; no Excel re-entry; phone-driven receipt capture.
2. **Protects vision?** Yes — producer can see the cost of a creative call before greenlighting.
3. **Brings team closer to a unified workflow?** Yes — directly couples Crew (timecards), Locations, Schedule (ShootDays), and Inventory.
4. **Proven on a real production before broad ship?** Spec now, build pre-Auth when a real project pulls on it.

### Nav placement

- New top-level project nav slot: `/projects/[projectId]/budget`. Same level as Workflow / Art / Casting / Locations / Crew / Schedule.
- Hub gets a small Budget topsheet card (working version's grand total, % spent bar, variance flag) — single source of truth lives on the dedicated page.

### Integration map

| Existing system | How budget interacts |
|---|---|
| `CrewTimecard` | Reads approved timecards. Each timecard carries new optional `lineItemId`. Hours × `timecard.rate` (with new `rateUnit`) → `Expense` row of source `timecard`, summed into line actuals. |
| `ProjectMember` | Reads for default `lineItemId` per crew (Q2 hybrid). Producer-role gating uses the existing role infra (PRs #15, #16). |
| `Project` | Reads name, type, color, currency for budget header. |
| `Milestone` | Read-only reference for milestone-anchored line entries. NOT the canonical phase source. |
| **`ShootDay` (new)** | Reads `count(by type)` → `prepDays`/`shootDays`/`postDays` global variables. |
| `Thread` | TypeScript-only: adds `'budgetLine'` to `ThreadAttachmentType` union (16th, after `'inventoryItem'`). No schema change — `Thread.attachedToType` is a `String` field. Per-line discussion. |
| `Storage / receipts bucket (new)` | Writes receipt photos. Auth-check RLS from day one (storage discipline). |
| `Workflow` (deliverables) | Read-only cross-link — line items can reference deliverables, not the inverse. |

### What budget does NOT do (explicit non-goals)

- No bill pay, no banking, no expense cards (saturation 2.0 territory; deferred indefinitely).
- No payroll output (Wrapbook integration is its own future PR; budget exports CSV instead).
- No multi-currency. One currency per budget, defaults to USD.
- No tax computation. Rates entered as-is.
- No automatic line-item suggestion / AI categorization.
- No editing of locked-version columns once locked (audit-protected).
- No drag-reorder of accounts in v1 (sort by `sortOrder`, manual edit in account settings sheet).
- No keyboard shortcuts in v1 (phone-first; desktop parity is a follow-up).

---

## 2. Decisions log (Q1–Q11)

Each decision was presented with 3–5 options, tradeoffs, and a recommendation. The choice is recorded here for traceability.

| # | Question | Choice | Why |
|---|---|---|---|
| Q1 | MVP shape | **C + D + Export** | Budget table + auto-actuals from timecards + schedule globals + side-by-side versions + PDF/CSV export. (Receipt capture later promoted to v1 via Q8.) |
| Q2 | Timecard → budget mapping | **C — Hybrid** | Crew has a default `lineItemId` (pre-fills); approver can override per-timecard. Rate lives on the line for planning, snapshot on Expense at creation. |
| Q3 | Schedule globals source | **C — `ShootDay` model** | Real schedule entity (date + phase type). Sets up future stripboard / call sheets. Budget reads `count(by type)` → globals. |
| Q4 | Versions storage | **B — Parallel** | `BudgetLineAmount` related table per (line, version). Both editable; comparison side-by-side. Term: **versions** (not "scenarios"). |
| Q5 | Account starter structure | **D — Default template + clone-from-prior** | Single shipped AICP-aligned default skeleton + ability to clone a prior project's budget. Both in v1. |
| Q6 | Fringes | **A — Single combined %** per labor line | Project's seed data is heavily non-union commercials; named-fringe model (B) becomes a clean future migration. |
| Q7 | Exports + CSV shape | **D + (i)** | Topsheet PDF + Detail PDF + generic CSV. Generic well-named CSV columns. `@react-pdf/renderer` server-side. |
| Q8 | Non-labor actuals | **C — Expense + receipts** | New `Expense` model + new `receipts` Supabase bucket with auth-check RLS. Mobile-first capture. |
| Q9 | Variables / formulas | **B — Formula qty + variables table** | Qty is a string evaluated by a small restricted parser (numbers, +−×÷, parens, identifiers). User-defined variables in `BudgetVariable`. |
| Q10 | Polish features | **All four (a, b, c, d)** | Markups (a) + tags (b) + variance flags (c) + threadable lines (d, 16th `ThreadAttachmentType`). |
| Q11 | Sequencing | **C — Brainstorm-now, build-later** | Spec is the deliverable today. Implementation can land pre-Auth at producer's discretion. |

### Discoveries during the session (not part of original Q&A)

- **`CrewTimecard.rate Decimal? @db.Decimal(8, 2)` exists** (PRs #11, #12). The previous schema reference said rate was deferred to a future Wrapbook PR; that decision was overridden. Rate UI shipped in PR #12.
- **Rate-unit math is deliberately deferred to land with budget** — known-issue documented in BUILD_STATUS.md (commit `16db604`, PR #19). Quote: "Proper fix is `rateUnit` enum (`'day' | 'hour'`) plus unit-aware math, landing alongside budget functionality where rate-unit will have a proper consumer." **The `rateUnit` schema migration is part of this feature's scope.**
- **Multi-role `ProjectMember`** shipped (PR #16). Producer role exists (PR #15: role-gated routing). Clyde Bessey is seeded as Producer on all 6 projects (PR #17). Budget can be producer-gated even pre-Auth via the existing role infrastructure.
- **Seed data has realistic rates and now-relative dates** (PR #18). Good for end-to-end verification of expense math.

---

## 3. Data model

Schema lands in **dedicated PRs** per project rules (no schema riding on feature branches; all-three-apps compile must pass; `prisma generate` runs before any seed update).

### 3.1 New models

```prisma
// One per project; created lazily when a producer first opens Budget.
model Budget {
  id                   String   @id @default(uuid())
  projectId            String   @unique
  currency             String   @default("USD")  // ISO 4217. Single-currency v1.
  // The version whose rates drive actuals when no per-line override exists.
  // Defaults order: committed > working > estimate.
  rateSourceVersionId  String?
  // Budget-level threshold for variance flagging (default 10%).
  varianceThreshold    Decimal  @default(0.10) @db.Decimal(5,4)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  versions  BudgetVersion[]
  accounts  BudgetAccount[]
  lines     BudgetLine[]
  variables BudgetVariable[]
  markups   BudgetMarkup[]
  expenses  Expense[]

  @@index([projectId])
}

// Estimate / Working / Committed (extensible — name + kind, not enum-locked).
model BudgetVersion {
  id        String              @id @default(uuid())
  budgetId  String
  name      String              // "Estimate", "Working", "Committed", "Final Cost", ...
  kind      BudgetVersionKind   // estimate | working | committed | other
  sortOrder Int
  state     BudgetVersionState  @default(draft)  // draft | locked
  lockedAt  DateTime?
  lockedBy  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  budget    Budget               @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  amounts   BudgetLineAmount[]
  variables BudgetVariable[]
  markups   BudgetMarkup[]

  // No @@unique on (budgetId, kind) — uniqueness for estimate/working/committed
  // is enforced in app code (creation check). "other" kind allowed multiple times.
  @@index([budgetId])
  @@index([budgetId, kind])
}

enum BudgetVersionKind { estimate working committed other }
enum BudgetVersionState { draft locked }

// Tree of accounts. Self-referential. Shared across all versions.
model BudgetAccount {
  id        String   @id @default(uuid())
  budgetId  String
  parentId  String?
  code      String   // "A", "A.10", "A.10.05" — AICP-style hierarchical codes
  name      String   // "Pre-Production Wages"
  sortOrder Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  budget   Budget          @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  parent   BudgetAccount?  @relation("Tree", fields: [parentId], references: [id], onDelete: Cascade)
  children BudgetAccount[] @relation("Tree")
  lines    BudgetLine[]
  markups  BudgetMarkup[]

  @@unique([budgetId, code])
  @@index([budgetId])
  @@index([parentId])
}

// Canonical line. Shared across versions. Amounts live in BudgetLineAmount.
model BudgetLine {
  id          String       @id @default(uuid())
  budgetId    String
  accountId   String
  description String
  unit        BudgetUnit   // DAY | WEEK | HOUR | FLAT | UNIT
  fringeRate  Decimal      @default(0) @db.Decimal(5,4)  // 0.0000–1.0000
  tags        String[]     @default([])  // "dept:art", "location:vineyard", "shootDay:3"
  // Optional rate override for actuals. When null, falls back to
  // rateSourceVersionId's BudgetLineAmount.rate.
  actualsRate Decimal?     @db.Decimal(12,2)
  sortOrder   Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  budget    Budget              @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  account   BudgetAccount       @relation(fields: [accountId], references: [id], onDelete: Restrict)
  amounts   BudgetLineAmount[]
  expenses  Expense[]
  members   ProjectMember[]     @relation("DefaultLineItem")  // crew whose default line is this
  timecards CrewTimecard[]      @relation("TimecardLine")     // timecards mapped to this line

  @@index([budgetId])
  @@index([accountId])
  @@index([tags], type: Gin)
}

enum BudgetUnit { DAY WEEK HOUR FLAT UNIT }

// Per-version qty/rate. Qty is a string (formula-capable).
model BudgetLineAmount {
  id        String   @id @default(uuid())
  lineId    String
  versionId String
  qty       String   @default("0")   // "12" | "shootDays" | "shootDays * 2 + 1"
  rate      Decimal  @default(0) @db.Decimal(12,2)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  line    BudgetLine    @relation(fields: [lineId], references: [id], onDelete: Cascade)
  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([lineId, versionId])
  @@index([versionId])
}

// User-defined variables. Schedule globals (prepDays/shootDays/postDays) are
// derived from ShootDay counts (NOT stored). Reserved names listed below.
model BudgetVariable {
  id        String   @id @default(uuid())
  budgetId  String
  versionId String?  // null = applies to all versions; non-null = override for this version
  name      String   // identifier — alphanumeric + underscore
  value     String   // formula or number, evaluated same as line qty
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  budget  Budget         @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  version BudgetVersion? @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([budgetId, versionId, name])
  @@index([budgetId])
}

// Markups: % applied to a target subtotal. Per-version (estimate may differ).
model BudgetMarkup {
  id         String        @id @default(uuid())
  budgetId   String
  versionId  String?       // null = applies to all versions
  name       String        // "Contingency", "Agency Fee"
  percent    Decimal       @db.Decimal(5,4)   // 0.10 = 10%
  appliesTo  MarkupTarget  // grandTotal | accountSubtotal
  accountId  String?       // required when appliesTo=accountSubtotal
  sortOrder  Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  budget  Budget         @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  version BudgetVersion? @relation(fields: [versionId], references: [id], onDelete: Cascade)
  account BudgetAccount? @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([budgetId])
}

enum MarkupTarget { grandTotal accountSubtotal }

// Single source of actuals — labor (from timecards) and non-labor (manual + receipts).
model Expense {
  id         String         @id @default(uuid())
  budgetId   String
  lineId     String
  source     ExpenseSource  // timecard | manual
  amount     Decimal        @db.Decimal(12,2)  // computed = units * unitRate, OR manual entry
  date       DateTime       @db.Date
  // Snapshot fields — immutable once recorded; past actuals don't shift if rates change.
  units      Decimal?       @db.Decimal(8,2)   // hours, days
  unitRate   Decimal?       @db.Decimal(12,2)
  unit       BudgetUnit?
  // Manual-only fields
  vendor     String?
  notes      String?
  receiptUrl String?        // receipts bucket; auth-check RLS
  // Timecard-only field — uniqueness ensures one expense per approved timecard.
  timecardId String?        @unique
  // Audit
  createdBy  String         // ProjectMember.id (or User.id post-Auth)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  budget   Budget         @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  line     BudgetLine     @relation(fields: [lineId], references: [id], onDelete: Restrict)
  timecard CrewTimecard?  @relation(fields: [timecardId], references: [id], onDelete: SetNull)

  @@index([budgetId])
  @@index([lineId])
  @@index([date])
  @@index([source])
}

enum ExpenseSource { timecard manual }

// Schedule spine. Read by ShootDay-derived globals; future stripboard / call sheets ride on this.
model ShootDay {
  id         String        @id @default(uuid())
  projectId  String
  date       DateTime      @db.Date
  type       ShootDayType  // pre | prod | post
  notes      String?
  locationId String?       // optional — links to Location for downstream stripboard
  sortOrder  Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  project  Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  location Location? @relation(fields: [locationId], references: [id], onDelete: SetNull)

  @@unique([projectId, date])  // one row per project per date
  @@index([projectId])
  @@index([projectId, type])
}

enum ShootDayType { pre prod post }
```

### 3.2 Modifications to existing models

```prisma
// CrewTimecard:
//   - Add lineItemId for budget mapping (Q2 hybrid).
//   - Add rateUnit for unit-aware math (resolves the deferred known-issue from PR #19).
model CrewTimecard {
  // ... existing fields unchanged ...
  rateUnit   RateUnit?     // 'day' | 'hour' — null only on legacy rows pending backfill
  lineItemId String?
  line       BudgetLine?   @relation("TimecardLine", fields: [lineItemId], references: [id], onDelete: SetNull)
  expense    Expense?      // back-relation (one expense per approved timecard, via Expense.timecardId @unique)

  @@index([lineItemId])
}

enum RateUnit { day hour }

// ProjectMember: add defaultLineItemId for the "default labor line" pre-fill (Q2 hybrid).
model ProjectMember {
  // ... existing fields unchanged ...
  defaultLineItemId String?
  defaultLine       BudgetLine? @relation("DefaultLineItem", fields: [defaultLineItemId], references: [id], onDelete: SetNull)
}

// Project: budget back-relation.
model Project {
  // ... existing fields unchanged ...
  budget    Budget?
  shootDays ShootDay[]
}

// Thread: NO schema change. Thread.attachedToType is `String` (already polymorphic).
// Add 'budgetLine' to the TypeScript union ThreadAttachmentType in
// apps/back-to-one/src/types/index.ts (becomes 16th type after 'inventoryItem'),
// plus matching chip/gradient/label helpers in apps/back-to-one/src/lib/thread-context.ts.
```

### 3.3 Storage

New bucket: **`receipts`**. Auth-check RLS from day one (`auth.role() = 'authenticated'`), per the storage discipline pattern. Bucket setup migrated into a Prisma migration alongside the schema PR (NOT a separate SQL script). Upload helper `uploadExpenseReceipt` in `queries.ts`, mirroring storyboard/moodboard helpers.

### 3.4 Key design choices to flag

- **Lines and accounts are shared across versions.** Adding a line in any version creates a new `BudgetLine`; absent `BudgetLineAmount` rows for other versions imply qty=0/rate=0 (no row = nothing planned).
- **Actuals are NOT versioned.** One set of `Expense` rows shared across all versions. Topsheet shows actuals once, compared against any selected version.
- **Rate sourcing for timecard→expense conversion:** `timecard.rate` (with `timecard.rateUnit`) is the primary truth at expense-creation. If null, fall back to `BudgetLine.actualsRate`, then to `rateSourceVersion`'s `BudgetLineAmount.rate`. Snapshot all of {units, unitRate, unit} onto `Expense`. Past actuals immutable.
- **Versions extensible past three.** `BudgetVersionKind=other` allows "Final Cost," "Plan B," etc., zero migration.
- **Markups versioned but flexible.** `versionId=null` → all versions; non-null → that version only.
- **Tags use Postgres GIN index** for fast contains-any queries.
- **`ShootDay` has unique `(projectId, date)`** — one row per date; `type` is the variable.
- **Threading via existing polymorphic Thread** — no FK on `BudgetLine`; `Thread.attachableType='budget_line'` + `attachableId=lineId`.

### 3.5 Type layer (Zod)

The `packages/schema` package wraps each Prisma model with a Zod schema, using a **dual-export pattern**: the same name lives at both value and type position. This is the canonical source for both TypeScript types and runtime validation across the monorepo. Prisma-generated types are NOT exported across package boundaries — apps import from `@origin-one/schema`, not from the Prisma client.

**Template:** `packages/schema/src/shoot-day.ts` (shipped in PR #33). Apply the same shape to all budget types.

```typescript
import { z } from "zod";

export const ShootDayType = z.enum(["pre", "prod", "post"]);
export type ShootDayType = z.infer<typeof ShootDayType>;

export const ShootDay = z.object({ /* … fields … */ });
export type ShootDay = z.infer<typeof ShootDay>;
```

**Field-pattern cheat sheet for budget types:**

| Prisma type | Zod treatment | Notes |
|---|---|---|
| `String @id @default(uuid())` | `z.string().uuid()` | |
| `String?` (nullable) | `.nullable()` on the inner schema | NOT `.optional()` — Prisma emits `null`, not `undefined` |
| `String[]` (array) | `z.array(z.string()).default([])` | E.g. `BudgetLine.tags` |
| `DateTime` or `@db.Date` | `z.coerce.date()` | Handles both ISO-string (JSON serialize) and Date (direct query) |
| `Decimal @db.Decimal(p,s)` | `z.coerce.number()` | All budget money is USD ≤ 2 decimals, precision well within JS Number range. Revisit with a Decimal library only if ever crossing 8+ digits or doing repeated arithmetic on the same value |
| `enum X { ... }` | `z.enum([...])` mirroring the values exactly | |
| `Int` | `z.number().int()` | E.g. `sortOrder` |
| `Json` | `z.unknown()` then per-callsite refinement | Budget types have none |

**Files this layer adds (per PR sequence):**

- **PR 3:** New `packages/schema/src/rate-unit.ts` (`z.enum(['day', 'hour'])`). Modify `crew-timecard.ts` to add `rateUnit` field.
- **PR 4:** Eight new files under `packages/schema/src/` — one per budget model (`budget.ts`, `budget-version.ts`, `budget-account.ts`, `budget-line.ts`, `budget-line-amount.ts`, `budget-variable.ts`, `budget-markup.ts`, `expense.ts`). Modifications to `crew-timecard.ts` (`lineItemId`), `project-member.ts` (`defaultLineItemId`), `project.ts` (`budget` back-relation). All re-exported from `packages/schema/src/index.ts`.

**Don't:** Don't import Prisma-generated types directly in app code. Always go through `@origin-one/schema`.

---

## 4. Expression evaluator (formula qty + variables)

Line item `qty` is a string. Variables (`BudgetVariable.value`) are also strings. Both are evaluated by the same small restricted parser at read time and on save (for validation).

### 4.1 Grammar

```
expr        := term (('+' | '-') term)*
term        := factor (('*' | '/') factor)*
factor      := number | identifier | '(' expr ')' | '-' factor
number      := /[0-9]+(\.[0-9]+)?/
identifier  := /[a-zA-Z_][a-zA-Z0-9_]*/
```

No functions. No string ops. No I/O. No `eval`. No `Function` constructor. Hand-written recursive-descent parser, ~100–150 lines including tests.

### 4.2 Identifier resolution

Lookup order for an identifier:
1. **Reserved schedule globals** — `prepDays`, `shootDays`, `postDays` → `count(ShootDay where projectId=X AND type=Y)`.
2. **Version-scoped variables** — `BudgetVariable where budgetId=X AND versionId=activeVersionId AND name=ident`.
3. **Budget-level variables** — `BudgetVariable where budgetId=X AND versionId IS NULL AND name=ident`.

Unknown identifier → evaluation error; line shows error state in UI; save still allowed (so producer can fix incrementally) but `qty_resolved` falls back to 0 in exports.

### 4.3 Cycles

Variables can reference other variables. Detect cycles with a depth limit (e.g., max 8 levels) — any cycle yields `error: cycle in <name>`.

### 4.4 Reserved names

`prepDays`, `shootDays`, `postDays`. Cannot be defined as user variables. Validation enforces this at create time.

### 4.5 Numeric semantics

All values are decimals; division by zero → error (not Infinity / NaN). Resolved values rounded to 4 decimal places before display.

### 4.6 Computation pipeline

For each line in a given version:

```
qty       = evaluate(amount.qty, variables, scheduleGlobals)
rate      = amount.rate
fringeAmt = qty * rate * line.fringeRate
total     = qty * rate + fringeAmt

// Actuals (NOT versioned)
actuals = sum(expense.amount where expense.lineId = line.id)
varPct  = (actuals - total) / total           // negative = under, positive = over
flag    = abs(varPct) > budget.varianceThreshold
```

Subtotals roll up the account tree. Markups apply to grand total or named-account subtotals depending on `appliesTo`.

---

## 5. Integration: timecards, expenses, schedule

### 5.1 Approved-timecard → Expense flow

**Trigger:** `CrewTimecard.status` transitions `submitted → approved`.

**Action (transactional with the approval write):**

```
let line = timecard.lineItemId ? lookup(BudgetLine) : crewMember.defaultLineItemId ? lookup : null
if (!line) skip — surface a producer warning ("timecard not mapped to a budget line")

let units, unit
if (timecard.rateUnit == 'hour') {
  units = timecard.hours
  unit  = HOUR
} else if (timecard.rateUnit == 'day') {
  units = 1                              // one timecard date = one day
  unit  = DAY
} else {
  // legacy null — error / skip, surface for backfill
}

let unitRate = timecard.rate
            ?? line.actualsRate
            ?? rateSourceVersion.amountFor(line).rate
            ?? 0

let amount = units * unitRate

upsert Expense {
  budgetId, lineId: line.id, source: 'timecard',
  amount, date: timecard.date, units, unitRate, unit,
  timecardId: timecard.id, createdBy: timecard.approvedBy
}
```

**On reopen** (`approved → reopened`): delete the corresponding Expense (where `timecardId=this`).
**On re-approve:** upsert recreates a fresh Expense with current values.

Idempotent because `Expense.timecardId` is `@unique`.

### 5.2 Manual expense flow

User on detail sheet → "Add expense / receipt" → opens entry form:
- Amount, date, vendor (optional), notes (optional), receipt photo (optional).
- Photo capture uses PWA camera intent → upload to `receipts` bucket → store URL on Expense.

```
insert Expense {
  budgetId, lineId, source: 'manual',
  amount, date, vendor, notes, receiptUrl,
  units: null, unitRate: null, unit: null,
  createdBy: currentMember
}
```

### 5.3 ShootDay → variables

`prepDays`, `shootDays`, `postDays` are **derived** at evaluation time, not stored:
- `prepDays  = count(ShootDay where projectId=X AND type=pre)`
- `shootDays = count(ShootDay where projectId=X AND type=prod)`
- `postDays  = count(ShootDay where projectId=X AND type=post)`

Mutation of `ShootDay` (add/edit/delete) invalidates the budget's React Query cache via `invalidateQueries(['budget', projectId])`. All formula-qty lines recompute.

### 5.4 ShootDay management UI (out of scope for v1 budget)

This spec assumes a minimal Schedule page exists or is built alongside the budget feature. **The Schedule page itself is OUT OF SCOPE** — only the `ShootDay` schema is part of this feature. Either:
- (Path A) ShootDays are seeded for v1 testing and managed via an admin form deferred to a follow-up PR.
- (Path B) A minimal Schedule UI ships alongside this feature (date picker, list of dates with type tags). **Recommend Path B** — without it, the variables strip is theoretical.

Decision deferred to implementation plan. If chosen, Path B adds one PR (Schedule UI) before the budget UI PR.

---

## 6. UI/UX

The mockup file (`apps/back-to-one/reference/explorations/budget-page.html` on this branch) is the canonical visual reference. On UI PR it gets promoted to `apps/back-to-one/reference/budget-page.html`.

### 6.1 Layout structure

**Mobile (PWA target):**
- One full-screen sheet, 20px radius. Sheet header with grabber.
- Vertical scroll: project header → version pills → variables strip → account list (each account a card).
- Line tap → replace-in-place navigation into line detail sheet (no nested modal — per project rule).
- Topsheet drawer pulls up from bottom; gesture or tap on the handle reveals.
- FAB bottom-right (safe-area aware — picks up Phase 1A FAB safe-area work).

**Desktop / wide (≥1024px):**
- Sheet max-width ~480–520px on the left.
- Topsheet appears as a side panel rather than a bottom drawer.
- Line detail opens in a side pane (not a modal) to the right of the budget list.

### 6.2 Component inventory

| Component | Role | Pattern source |
|---|---|---|
| `<BudgetSheet>` | Top-level page; owns version + variables state. | Mirrors `CrewPanel` from timecards (same layer-state pattern: `'list' \| 'detail' \| 'topsheet'`). |
| `<VersionPills>` | Three-pill switcher; locked variants show ⌃ glyph. | New, uses BRAND_TOKENS chip rules. |
| `<VariablesStrip>` | Phase-tinted chips for `prepDays/shootDays/postDays`, neutral for user-defined, "+ var" affordance. | BRAND_TOKENS chip pattern. |
| `<AccountCard>` | Collapsible card per top-level account; nested children indent. | New. |
| `<LineRow>` | Two-row grid (description + total / meta-strip). Hover @0.03 alpha. | Mirrors timecards crew-row. |
| `<LineDetailSheet>` | Tabs (Edit / Expenses · N / Threads), per-version cell grid, expense list, inline thread teaser. | Mirrors `threads-full.html` + timecards week-view tab idiom. |
| `<TopsheetDrawer>` | Pull-up bottom drawer (mobile) / right-side panel (desktop). Cream PDF preview + export buttons. | New. |
| `<HubBudgetCard>` | Small read-only summary on Hub: working total, % spent bar, variance flag. | Existing hub card pattern. |
| `<TemplatePicker>` | Sheet shown when a budget is first created — "Start from template" or "Clone from another project". | New, uses sheet pattern. |

### 6.3 State machine (mirrors timecards)

```
budget layer state: 'list' | 'detail' | 'topsheet'
detail tab state:   'edit' | 'expenses' | 'threads'
version state:      activeVersionId
                    comparisonVersionId? (Hub card / topsheet)
```

Mutations: React Query with `invalidateQueries` (no optimistic updates — codebase convention). Viewer shim: `useMemo` resolves producer at top of `BudgetSheet`; single-spot swap on Auth day (matches timecards pattern).

### 6.4 Interactions

- **Inline edits in detail sheet, NOT list.** List is read-optimized; edits happen in detail. Deliberate simplification vs. saturation; phone cells too small.
- **Account expand/collapse** persists per-user, per-budget in `localStorage`. Default: top-level collapsed except most-recently-edited.
- **Variable inspect.** Tap formula chip in line meta-strip → tooltip: `shootDays = 12 (12 prod ShootDays)`. Long-press on phone.
- **Variance threshold** is `Budget.varianceThreshold` (default 0.10). Surfaced in budget settings sheet.
- **Topsheet drag** — bottom drawer accepts swipe-up (Framer Motion drag pattern used elsewhere).

### 6.5 Mobile-first specifics

- **Receipt capture:** tap "+ Add expense / receipt" → device camera (PWA gesture) → upload to `receipts` bucket → create `Expense{source:manual, receiptUrl, ...}`. Background upload OK; UI shows pending state.
- **Offline:** writes hit `packages/sync` queue when sync ships. Reads gracefully fall back to last-cached state.
- **Tap targets ≥44px.**

### 6.6 Empty states

- **No budget yet** — placeholder card, single CTA: "Start budget" → opens `<TemplatePicker>`.
- **Account empty** — "+ Add line" inline button inside expanded account body.
- **No expenses on a line** — "No expenses yet" with camera affordance.
- **No threads on a line** — collapsed "+ Start thread" affordance; uses existing thread-creation flow.

### 6.7 Print / export views

The PDF topsheet view (Frame C in mockup) is also the in-app preview before export. Same React component renders to:
- (a) on-screen preview in `<TopsheetDrawer>`
- (b) `@react-pdf/renderer` server-side for PDF
- (c) headless render for PNG share (deferred, nice-to-have)

Detail PDF is a multi-page version of the same component with line items expanded under each account.

CSV export is a Vercel Function streaming flat rows (see Section 8).

### 6.8 Tokens to add to BRAND_TOKENS.md

- `obj-budgetLine: #34d399` (emerald) — 15th attachable thread chip color. (Open to alternate proposals.)
- `phase-pre-tint`, `phase-prod-tint`, `phase-post-tint` — give the existing phase hex values formal token names so variables strip and ShootDay UI reference one source.

---

## 7. Templates and cloning

### 7.1 Default AICP template

Single shipped template: `default-aicp-commercial`. Loaded as a JSON fixture in `apps/back-to-one/lib/budget-templates/default-aicp.ts`.

Skeleton structure (top-level accounts only — sub-accounts and line items added by producer):

```
A. Pre-Production Wages
B. Shooting Crew Labor
C. Production Wrap Wages
D. Locations & Travel
E. Props · Wardrobe · HMU
F. Studio Rental & Expenses
G. Set Construction
H. Equipment (Camera · Lighting · Grip)
I. Production Film & Lab
J. Talent & Talent Expenses
K. Editorial · Post · Music
L. Insurance · Misc
M. Director / Creative Fees
N. Producer / Production Manager
```

(Letter-coded per AICP convention; final list refined in implementation plan.)

### 7.2 Clone from prior project

Sheet flow: "Clone from another project" → list of projects with budgets → confirmation → creates a deep copy:
- New `Budget`, new `BudgetVersion(s)`, new `BudgetAccount` tree (with new IDs, parent pointers re-linked).
- New `BudgetLine`s (new IDs).
- New `BudgetLineAmount`s for each (line × version) pair.
- New `BudgetVariable`s.
- New `BudgetMarkup`s.
- **NOT cloned:** `Expense`s (actuals are real-world, not template data).
- `Project.id` of source recorded on `Budget.clonedFromProjectId` (new optional field for traceability).

Implementation: a single transaction in a query helper; uses Prisma's nested writes.

### 7.3 Template chooser flow

```
First time opening Budget on a project:
  → <TemplatePicker> sheet
  → Three options:
    (a) Start from default AICP template
    (b) Clone from another project (list)
    (c) Start blank
  → User picks → Budget created → navigates to the budget page
```

---

## 8. Exports

### 8.1 Topsheet PDF

Audience: clients, agencies. One page. `@react-pdf/renderer`. Same component shape as Frame C in mockup. Server-side via Vercel Function. Layout: project header + account-level table (Estimate / Working / Committed / Actuals / Δ) + markup rows + grand total. Cream paper (`#f4f1ea`), brand-black ink (`#1a1a26`), Geist Sans + Geist Mono.

### 8.2 Detail PDF

Audience: internal review, signoff. Multi-page. Same component, line items expanded under each account. Includes line-level columns: description, qty (resolved), rate, fringe %, version totals, actuals, variance.

### 8.3 CSV (generic, well-named columns)

Audience: accountants, Wrapbook, QuickBooks, Excel users. Format: UTF-8, comma-delimited, header row.

```
budget_id, version_kind, version_name,
account_code, account_name, account_path,
line_id, description, unit, qty_formula, qty_resolved,
rate, fringe_rate,
estimate_total, working_total, committed_total, actual_total,
variance_pct, tags, created_at, updated_at
```

One row per line × version is **NOT** the shape — instead one row per line, with version totals as parallel columns. Account totals + markups + grand total are appended as summary rows at the end (with `line_id=NULL`, `description='ACCOUNT TOTAL: ...'` etc.) for accountant convenience.

### 8.4 Export trigger

Three buttons in `<TopsheetDrawer>`: **PDF · TOPSHEET** (primary), **PDF · DETAIL**, **CSV**. Each hits a Vercel Function endpoint that streams the file with `Content-Disposition: attachment`. PDFs use a 5-second timeout; CSV is instant.

### 8.5 What's deferred

- AICP-format-specific CSV (column names matching AICP standard exactly — multiple tools each implement slightly different).
- JSON export.
- Saturation-format export (for migration the other way).
- PNG share (deferred; v1.1 nice-to-have).

---

## 9. Polish features

All four ride along with v1.

### 9.1 Markups

`BudgetMarkup` model (Section 3). Two targets: `grandTotal` and `accountSubtotal`. Common patterns:
- "Contingency" 10% on Below-the-Line subtotal (one specific account's subtotal — `appliesTo=accountSubtotal, accountId=BTLAccountId`).
- "Agency Fee" 5% on Grand Total (`appliesTo=grandTotal`).

UI: markups managed in budget settings sheet. Displayed in topsheet preview as italic rows under their target.

### 9.2 Tags

`BudgetLine.tags: String[]` with Postgres GIN index. Tag conventions:
- `dept:art`, `dept:camera` (department tagging — unifies with the upcoming Department enum)
- `location:vineyard`, `location:barrel-room`
- `shootDay:3`, `shootDay:1-12`

Filter view: top-of-list tag chip strip → tap a tag → list filters to lines with that tag. Multi-select supported (AND semantics).

### 9.3 Variance flags

UI chip pattern (`variance over` / `variance warn` / `variance under`). Computed per line per version in the UI layer (no schema field). Threshold from `Budget.varianceThreshold`. Hub card surfaces an aggregate "N lines over budget" summary.

### 9.4 Threadable line items

Adds `'budgetLine'` to the `ThreadAttachmentType` TypeScript union (16th type, after `'inventoryItem'` from PR #25). No schema migration — `Thread.attachedToType` is already a free-form `String` field. Existing Threads infrastructure handles everything else: thread chip on `<LineRow>` (violet read, amber unread, matching `BRAND_TOKENS` thread system); `chipForType`, `gradientForType`, `labelForType` helpers in `apps/back-to-one/src/lib/thread-context.ts` get a `budgetLine` branch.

---

## 10. PR sequencing

Per project rules: schema PRs are dedicated (no schema riding on feature branches); each feature is a complete arc; main stays green.

**Suggested sequence** (each is a separate PR). Note: `origin/main` has moved beyond this branch's base — current `main` is at `e3defd0` (PR #25 → 15 ThreadAttachmentTypes; PR #24 → Inventory UI shipped). Rebase before starting.

| PR | Type | Scope |
|---|---|---|
| 1 | Schema | `ShootDay` model + enum (`ShootDayType`). Smallest possible schema PR. Validates the new index/uniqueness pattern. |
| 2 | UI | Minimal Schedule page (date picker, list of dates with type tags). Validates that ShootDay-derived globals will have data. **(Optional Path B — see §5.4.)** |
| 3 | Schema | `RateUnit` enum + `CrewTimecard.rateUnit` field. Resolves PR #19's deferred known-issue. Includes data backfill (default existing rows to `'day'` based on inspection). Updates timecard math in `EntryCard` and `ProducerOverview`. **This is the math fix BUILD_STATUS flagged.** |
| 4 | Schema | All budget core models (`Budget`, `BudgetVersion`, `BudgetAccount`, `BudgetLine`, `BudgetLineAmount`, `BudgetVariable`, `BudgetMarkup`, `Expense`). Plus `CrewTimecard.lineItemId`, `ProjectMember.defaultLineItemId`, `Thread.attachableType` += `budget_line`, `Project.budget` back-relation. Plus `receipts` Supabase bucket migration with auth-check RLS. |
| 5 | Seed | Add `ShootDay` rows for the 6 seed projects. Add a sample budget for In Vino Veritas (full AICP skeleton + ~30 line items, ~20 expenses, all three versions populated, real markup/tag/thread data). |
| 6 | Library | Expression evaluator (`packages/budget-eval` or co-located in `apps/back-to-one/lib`). ~150 lines + tests. No app integration yet — pure utility. |
| 7 | Library | AICP default template fixture + clone helper (`apps/back-to-one/lib/budget-templates/`). |
| 8 | UI | Budget page (read-only list view, version pills, variables strip, account cards, line rows, FAB). Wires expense computation but NOT inline editing yet. |
| 9 | UI | Line detail sheet (edit tab, expenses tab, threads tab, per-version cells). |
| 10 | UI | Topsheet drawer + Hub topsheet card. |
| 11 | UI | Template picker (first-time flow + clone-from-prior). |
| 12 | UI | Variance flags + variable inspect tooltips + tag filter. |
| 13 | Backend | Export endpoints — CSV stream, Topsheet PDF, Detail PDF (`@react-pdf/renderer`). Wire to topsheet drawer buttons. |
| 14 | UI | Receipt capture (camera intent, upload, preview). |

**Reference HTML promotion:** during PR 8, `apps/back-to-one/reference/explorations/budget-page.html` is moved to `apps/back-to-one/reference/budget-page.html` and updated to match the final UI state.

**BUILD_STATUS update:** Add Budget feature to the BUILD_STATUS sequence after Inventory (per Q11). Once a real production triggers Path A in Q11.

---

## 11. Risks and open questions

### 11.1 Risks

| Risk | Mitigation |
|---|---|
| Expression evaluator becomes a security hole | Hand-written parser, no `eval`/`Function`, no string ops, no I/O. Fuzz with malformed inputs in tests. Depth-limit cycle detection. |
| Receipt photos balloon storage | Bucket setup includes a 5MB per-file size limit at upload helper. Auth-check RLS prevents unauthorized listing. Consider thumbnail generation in v1.1. |
| Producers fudge actuals via manual expenses | Audit trail (Expense.createdBy + createdAt). Post-Auth: only producer role can edit/delete expenses. Receipts attached strongly recommended in UX copy. |
| Rate-unit backfill of existing timecards is wrong | PR 3 includes a data audit — every existing timecard reviewed before defaulting. Spot-check seed data shapes. |
| `ShootDay` doubles as canonical schedule but isn't fully featured | Documented as a minimal foundation; stripboard / call sheet features build on it later. v1 schedule UI (Path B) is purposely thin — date + phase type + optional location only. |
| Cloning a budget produces orphaned references if deletions happen during clone | Clone runs in a single Prisma transaction; concurrent edits on source rare given producer-gated UI. |

### 11.2 Open questions for the implementation plan

1. **Schedule UI path** (§5.4) — Path A (defer Schedule UI; admin-form ShootDay management) or Path B (build a minimal Schedule UI alongside)? Recommend B; PR 2 in the sequence.
2. **Budget settings sheet contents** — variance threshold, markup management, version management, currency? List finalized in plan.
3. **Account template letter codes** — confirm the exact AICP-aligned skeleton (Section 7.1) with a producer (Clyde) before fixturing.
4. **Cloning UI affordance** — sheet vs. full page? Probably sheet.
5. **Where does "Lock version" live?** — in version pill long-press menu, or settings sheet? Probably long-press menu on the pill.
6. **Markup ordering on topsheet** — contingency before agency fee, or producer-configured order? `sortOrder` field exists; decide UX default.
7. **CSV summary rows format** — appended at end as flat `line_id=NULL` rows, or a separate file? Implementation plan to pick.
8. **Budget visibility pre-Auth** — viewer shim (everyone can see) or producer-gated using existing role infra (PR #15)? Recommend producer-gated since producer role exists. Confirm with Clyde.

---

## 12. Out of scope (definitive)

These are explicitly NOT being built and should not be added to the plan without a separate brainstorm:

- Bill pay / banking / expense cards / production banking (saturation 2.0 territory).
- Wrapbook integration (separate future feature; CSV export is the seam).
- Multi-currency / FX conversion.
- Tax computation (rates entered as-is).
- AI categorization / line item suggestion.
- AICP-format-specific CSV column names.
- Drag-reorder of accounts / lines (v1.1).
- Keyboard shortcuts (v1.1+).
- Inline cell editing in list view (deliberate simplification — phone-first).
- Locked-version editing (audit-protected).
- Named fringe profiles (Q6 chose single-percent; named-fringe is a clean future migration).
- PNG share export.

---

## 13. References

- **Mockup:** `apps/back-to-one/reference/explorations/budget-page.html` (this branch)
- **Inspiration:** [saturation.io budget table](https://saturation.io/budgeting) — nested accounts, phases, fringes, globals, tags
- **Project rules:** `CLAUDE.md` (root + `apps/back-to-one/`)
- **Schema discipline:** `CLAUDE.md` "Schema discipline" section
- **Storage discipline:** `CLAUDE.md` "Storage discipline" section
- **Brand tokens:** `BRAND_TOKENS.md`
- **Build status / known issues:** `BUILD_STATUS.md`
- **Decisions log:** `DECISIONS.md`
- **Existing UI references:**
  - `apps/back-to-one/reference/timecards-ui-reference.html` — closest UX precedent (tabular crew/hours data)
  - `apps/back-to-one/reference/threads-full.html` — sheet detail pattern
  - `apps/back-to-one/reference/timeline-states.html` — gallery layout pattern (matched by mockup)
- **Relevant prior PRs (origin/main):**
  - PR #11 — `feat(schema): add nullable rate field to CrewTimecard`
  - PR #12 — `feat(timecards): rate input, display, and totals`
  - PR #15 — `feat(timecards): role-gated routing and self-view affordances`
  - PR #16 — `feat(schema): allow multi-role ProjectMember per project`
  - PR #17 — `feat(seed): add Clyde Bessey as Producer on all 6 projects`
  - PR #18 — `seed: richer CrewTimecard data with rates and now-relative dates`
  - PR #19 — `docs: document deferred rate-unit work as known issue` ← **resolved by PR 3 in sequence**
  - PR #24 — `feat(back-to-one): Inventory UI` (Inventory now shipped — InventoryItem step in BUILD_STATUS sequence is done)
  - PR #25 — `feat(threading): expand ThreadAttachmentType to 15 types` (`'budgetLine'` becomes the 16th, TypeScript-only)

---

## 14. Acceptance — what "done" looks like for v1

- A producer can: create a budget, populate it from the AICP template (or clone), add accounts/lines, set qty as formulas, manage versions (Estimate / Working / Committed), see actuals roll up from approved timecards, capture manual expenses with receipts, view a topsheet, export PDF (topsheet + detail) and CSV.
- All of the above works on a phone.
- All four polish features (markups, tags, variance flags, threadable lines) are functional.
- The reference HTML at `apps/back-to-one/reference/budget-page.html` matches the production UI.
- `prisma generate` is clean across all three apps; main is green at every PR boundary.
- Seed data demonstrates the full feature on at least the In Vino Veritas project.
- The rate-unit known-issue (PR #19) is resolved.

---

*End of spec.*
