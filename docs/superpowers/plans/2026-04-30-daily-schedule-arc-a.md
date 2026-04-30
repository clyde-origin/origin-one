# Daily Schedule (Arc A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-shoot-day strip board editor matching the GB01 reference. Multi-track time blocks (Main / Secondary / Tertiary) with talent + location FKs and free-text descriptions.

**Architecture:**
- One new model: `ScheduleBlock`. Hand-authored SQL migration + `prisma migrate deploy` (origin-one's standard, per `origin_one_db_migration_patterns` memory).
- Editor lives at `/projects/[id]/timeline/[shootDayId]` — deep route on existing Timeline page. Phone view = card-stack per time block; desktop = grid table matching GB01.
- Add Block via `useFabAction` (existing ActionBar pattern).
- React Query hooks follow the existing `invalidateQueries` pattern in `useOriginOne.ts`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Prisma, React Query, vitest. Reference HTML in `apps/back-to-one/reference/schedule-page.html` shows the existing simple shoot-day list (this is the next layer down).

**Spec:** `docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md`

---

## File Structure

**Created:**
- `packages/db/prisma/migrations/20260430010000_add_schedule_block/migration.sql`
- `apps/back-to-one/src/app/projects/[projectId]/timeline/[shootDayId]/page.tsx` — schedule editor
- `apps/back-to-one/src/components/schedule/ScheduleGrid.tsx` — desktop grid render
- `apps/back-to-one/src/components/schedule/ScheduleCardStack.tsx` — phone card-stack render
- `apps/back-to-one/src/components/schedule/AddScheduleBlockSheet.tsx` — add/edit block sheet
- `apps/back-to-one/src/components/schedule/BlockEditForm.tsx` — shared form (used by add + edit)
- `apps/back-to-one/src/lib/schedule/derive-call-times.ts` — pure: takes blocks → talent → call-time-by-talent map
- `apps/back-to-one/src/lib/schedule/derive-call-times.test.ts`
- `apps/back-to-one/src/lib/schedule/format-time.ts` — `'09:30'` → `'9:30am'`, `'14:30'` → `'2:30pm'`
- `apps/back-to-one/src/lib/schedule/format-time.test.ts`

**Modified:**
- `packages/db/prisma/schema.prisma` — add `ScheduleBlock` + enums; add reverse relation on `Project`, `ShootDay`, `Location`.
- `apps/back-to-one/src/types/index.ts` — add `ScheduleBlock`, `ScheduleBlockTrack`, `ScheduleBlockKind`.
- `apps/back-to-one/src/lib/db/queries.ts` — add CRUD queries.
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — add `useScheduleBlocks`, `useCreateScheduleBlock`, `useUpdateScheduleBlock`, `useDeleteScheduleBlock`.
- `packages/db/prisma/seed.ts` — add a few schedule blocks for one shoot day in seed project (Gibbon-equivalent).

---

## Task 1 — Schema migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260430010000_add_schedule_block/migration.sql`

- [ ] **Step 1:** Add to `schema.prisma` after `ShootDay`:

```prisma
enum ScheduleBlockTrack {
  main
  secondary
  tertiary
}

enum ScheduleBlockKind {
  work
  load_in
  talent_call
  lunch
  wrap
  tail_lights
  meal_break
  custom
}

model ScheduleBlock {
  id            String              @id @default(dbgenerated("gen_random_uuid()"))
  projectId     String
  shootDayId    String
  track         ScheduleBlockTrack  @default(main)
  kind          ScheduleBlockKind   @default(work)

  startTime     String              @db.VarChar(5)   // 'HH:MM' 24h
  endTime       String?             @db.VarChar(5)
  description   String              @db.Text
  customLabel   String?

  locationId    String?
  talentIds     String[]            @default([])
  crewMemberIds String[]            @default([])
  sceneIds      String[]            @default([])

  sortOrder     Int                 @default(0)

  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shootDay  ShootDay  @relation(fields: [shootDayId], references: [id], onDelete: Cascade)
  location  Location? @relation(fields: [locationId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([shootDayId, startTime])
  @@index([shootDayId, track, sortOrder])
}
```

Add reverse relations on `Project`, `ShootDay`, `Location`:

```prisma
model Project {
  // existing fields...
  scheduleBlocks ScheduleBlock[]
}

model ShootDay {
  // existing fields...
  scheduleBlocks ScheduleBlock[]
}

model Location {
  // existing fields...
  scheduleBlocks ScheduleBlock[]
}
```

- [ ] **Step 2:** Create migration file `packages/db/prisma/migrations/20260430010000_add_schedule_block/migration.sql` with hand-authored SQL:

```sql
-- ScheduleBlockTrack enum
CREATE TYPE "ScheduleBlockTrack" AS ENUM ('main', 'secondary', 'tertiary');

-- ScheduleBlockKind enum
CREATE TYPE "ScheduleBlockKind" AS ENUM (
  'work', 'load_in', 'talent_call', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'custom'
);

CREATE TABLE "ScheduleBlock" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId"     TEXT NOT NULL,
  "shootDayId"    UUID NOT NULL,
  "track"         "ScheduleBlockTrack" NOT NULL DEFAULT 'main',
  "kind"          "ScheduleBlockKind" NOT NULL DEFAULT 'work',
  "startTime"     VARCHAR(5) NOT NULL,
  "endTime"       VARCHAR(5),
  "description"   TEXT NOT NULL,
  "customLabel"   TEXT,
  "locationId"    TEXT,
  "talentIds"     TEXT[] NOT NULL DEFAULT '{}',
  "crewMemberIds" TEXT[] NOT NULL DEFAULT '{}',
  "sceneIds"      TEXT[] NOT NULL DEFAULT '{}',
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_shootDayId_fkey"
  FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleBlock"
  ADD CONSTRAINT "ScheduleBlock_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ScheduleBlock_projectId_idx" ON "ScheduleBlock"("projectId");
CREATE INDEX "ScheduleBlock_shootDayId_startTime_idx" ON "ScheduleBlock"("shootDayId", "startTime");
CREATE INDEX "ScheduleBlock_shootDayId_track_sortOrder_idx" ON "ScheduleBlock"("shootDayId", "track", "sortOrder");
```

- [ ] **Step 3:** Regenerate Prisma client:

```bash
pnpm --filter @origin-one/db db:generate
```

Expected: `Generated Prisma Client (v5.22.0)`.

- [ ] **Step 4:** Run baseline build:

```bash
pnpm -w build
```

Expected: all 6 tasks succeed.

- [ ] **Step 5:** Commit:

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(schedule): ScheduleBlock schema + migration"
```

---

## Task 2 — Pure helper: `formatTime`

**Files:**
- Create: `apps/back-to-one/src/lib/schedule/format-time.ts`
- Test: `apps/back-to-one/src/lib/schedule/format-time.test.ts`

- [ ] **Step 1:** Write failing tests in `format-time.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatTime, parseTime, addMinutesToTime, compareTime } from './format-time'

describe('formatTime', () => {
  it('formats morning times', () => {
    expect(formatTime('09:30')).toBe('9:30am')
    expect(formatTime('07:15')).toBe('7:15am')
  })
  it('formats noon and midnight', () => {
    expect(formatTime('12:00')).toBe('12:00pm')
    expect(formatTime('00:00')).toBe('12:00am')
  })
  it('formats afternoon times', () => {
    expect(formatTime('13:30')).toBe('1:30pm')
    expect(formatTime('19:45')).toBe('7:45pm')
  })
  it('returns empty for invalid', () => {
    expect(formatTime('')).toBe('')
    expect(formatTime('25:00')).toBe('25:00')
  })
})

describe('parseTime', () => {
  it('parses HH:MM to {h, m}', () => {
    expect(parseTime('09:30')).toEqual({ h: 9, m: 30 })
    expect(parseTime('00:00')).toEqual({ h: 0, m: 0 })
  })
  it('returns null for invalid', () => {
    expect(parseTime('bad')).toBeNull()
    expect(parseTime('25:00')).toBeNull()
  })
})

describe('addMinutesToTime', () => {
  it('subtracts minutes', () => {
    expect(addMinutesToTime('09:30', -15)).toBe('09:15')
    expect(addMinutesToTime('00:10', -15)).toBe('23:55')
  })
  it('adds minutes across hour', () => {
    expect(addMinutesToTime('09:50', 15)).toBe('10:05')
  })
})

describe('compareTime', () => {
  it('compares HH:MM strings', () => {
    expect(compareTime('09:30', '10:00')).toBeLessThan(0)
    expect(compareTime('10:00', '09:30')).toBeGreaterThan(0)
    expect(compareTime('09:30', '09:30')).toBe(0)
  })
})
```

- [ ] **Step 2:** Run test, expect FAIL.

```bash
pnpm vitest run apps/back-to-one/src/lib/schedule/format-time.test.ts
```

- [ ] **Step 3:** Implement `format-time.ts`:

```ts
export function parseTime(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

export function formatTime(t: string): string {
  const parsed = parseTime(t)
  if (!parsed) return t
  const { h, m } = parsed
  const period = h >= 12 ? 'pm' : 'am'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:${String(m).padStart(2, '0')}${period}`
}

export function addMinutesToTime(t: string, deltaMin: number): string {
  const parsed = parseTime(t)
  if (!parsed) return t
  let totalMin = (parsed.h * 60 + parsed.m + deltaMin) % (24 * 60)
  if (totalMin < 0) totalMin += 24 * 60
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function compareTime(a: string, b: string): number {
  const pa = parseTime(a), pb = parseTime(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return (pa.h * 60 + pa.m) - (pb.h * 60 + pb.m)
}
```

- [ ] **Step 4:** Run test, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add apps/back-to-one/src/lib/schedule/format-time.ts apps/back-to-one/src/lib/schedule/format-time.test.ts
git commit -m "feat(schedule): formatTime/parseTime/addMinutesToTime/compareTime helpers"
```

---

## Task 3 — Pure helper: `deriveCallTimes`

**Files:**
- Create: `apps/back-to-one/src/lib/schedule/derive-call-times.ts`
- Test: `apps/back-to-one/src/lib/schedule/derive-call-times.test.ts`

Maps each talent → their earliest schedule block's startTime minus 15 min. Used by Arc B + C.

- [ ] **Step 1:** Write failing tests in `derive-call-times.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveCallTimes } from './derive-call-times'

const blocks = [
  { id: 'b1', startTime: '09:30', talentIds: ['t1'], kind: 'work' as const },
  { id: 'b2', startTime: '11:00', talentIds: ['t1', 't2'], kind: 'work' as const },
  { id: 'b3', startTime: '08:00', talentIds: ['t3'], kind: 'work' as const },
]

describe('deriveCallTimes', () => {
  it('returns earliest block startTime - 15 min per talent', () => {
    const result = deriveCallTimes(blocks, ['t1', 't2', 't3'])
    expect(result.t1).toBe('09:15')
    expect(result.t2).toBe('10:45')
    expect(result.t3).toBe('07:45')
  })
  it('omits talents with no blocks', () => {
    const result = deriveCallTimes(blocks, ['t1', 'tX'])
    expect(result.t1).toBe('09:15')
    expect(result.tX).toBeUndefined()
  })
  it('respects talent_call kind blocks (no -15 offset for those)', () => {
    const tcBlocks = [
      { id: 'b1', startTime: '08:00', talentIds: ['t1'], kind: 'talent_call' as const },
      { id: 'b2', startTime: '09:30', talentIds: ['t1'], kind: 'work' as const },
    ]
    const result = deriveCallTimes(tcBlocks, ['t1'])
    expect(result.t1).toBe('08:00')
  })
})
```

- [ ] **Step 2:** Run test, expect FAIL.

- [ ] **Step 3:** Implement:

```ts
import { addMinutesToTime, compareTime } from './format-time'

export type DeriveBlock = {
  id: string
  startTime: string
  talentIds: string[]
  kind: 'work' | 'talent_call' | 'load_in' | 'lunch' | 'wrap' | 'tail_lights' | 'meal_break' | 'custom'
}

export function deriveCallTimes(blocks: DeriveBlock[], talentIds: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const tid of talentIds) {
    const myBlocks = blocks.filter(b => b.talentIds.includes(tid))
    if (myBlocks.length === 0) continue
    myBlocks.sort((a, b) => compareTime(a.startTime, b.startTime))
    const earliest = myBlocks[0]
    if (earliest.kind === 'talent_call') {
      result[tid] = earliest.startTime
    } else {
      result[tid] = addMinutesToTime(earliest.startTime, -15)
    }
  }
  return result
}
```

- [ ] **Step 4:** Run test, expect PASS.

- [ ] **Step 5:** Commit:

```bash
git add apps/back-to-one/src/lib/schedule/derive-call-times.ts apps/back-to-one/src/lib/schedule/derive-call-times.test.ts
git commit -m "feat(schedule): deriveCallTimes helper"
```

---

## Task 4 — Types

**Files:**
- Modify: `apps/back-to-one/src/types/index.ts`

- [ ] **Step 1:** Add to `types/index.ts`:

```ts
export type ScheduleBlockTrack = 'main' | 'secondary' | 'tertiary'
export type ScheduleBlockKind =
  | 'work'
  | 'load_in'
  | 'talent_call'
  | 'lunch'
  | 'wrap'
  | 'tail_lights'
  | 'meal_break'
  | 'custom'

export interface ScheduleBlock {
  id: string
  projectId: string
  shootDayId: string
  track: ScheduleBlockTrack
  kind: ScheduleBlockKind
  startTime: string
  endTime: string | null
  description: string
  customLabel: string | null
  locationId: string | null
  talentIds: string[]
  crewMemberIds: string[]
  sceneIds: string[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2:** Run typecheck:

```bash
pnpm --filter @origin-one/back-to-one type-check
```

Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/types/index.ts
git commit -m "feat(schedule): ScheduleBlock types"
```

---

## Task 5 — DB queries

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`

Append at the end of the file (look for the existing ShootDay section as the placement reference — use the same patterns).

- [ ] **Step 1:** Add to `queries.ts`:

```ts
import type { ScheduleBlock, ScheduleBlockTrack, ScheduleBlockKind } from '@/types'

// ─── Schedule Blocks ─────────────────────────────────────────────────────

export async function fetchScheduleBlocks(shootDayId: string): Promise<ScheduleBlock[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ScheduleBlock')
    .select('*')
    .eq('shootDayId', shootDayId)
    .order('startTime', { ascending: true })
    .order('sortOrder', { ascending: true })
  if (error) throw error
  return (data ?? []) as ScheduleBlock[]
}

export async function createScheduleBlock(input: {
  projectId: string
  shootDayId: string
  track: ScheduleBlockTrack
  kind: ScheduleBlockKind
  startTime: string
  endTime?: string | null
  description: string
  customLabel?: string | null
  locationId?: string | null
  talentIds?: string[]
  crewMemberIds?: string[]
  sceneIds?: string[]
}): Promise<ScheduleBlock> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ScheduleBlock')
    .insert({
      projectId: input.projectId,
      shootDayId: input.shootDayId,
      track: input.track,
      kind: input.kind,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      description: input.description,
      customLabel: input.customLabel ?? null,
      locationId: input.locationId ?? null,
      talentIds: input.talentIds ?? [],
      crewMemberIds: input.crewMemberIds ?? [],
      sceneIds: input.sceneIds ?? [],
      sortOrder: 0,
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

export async function updateScheduleBlock(
  id: string,
  patch: Partial<Omit<ScheduleBlock, 'id' | 'projectId' | 'shootDayId' | 'createdAt' | 'updatedAt'>>,
): Promise<ScheduleBlock> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('ScheduleBlock')
    .update({ ...patch, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ScheduleBlock
}

export async function deleteScheduleBlock(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('ScheduleBlock').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2:** Run typecheck:

```bash
pnpm --filter @origin-one/back-to-one type-check
```

Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/lib/db/queries.ts
git commit -m "feat(schedule): ScheduleBlock CRUD queries"
```

---

## Task 6 — React Query hooks

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

Find the existing `useShootDays`, `useCreateShootDay` block (around line 798 per `grep useShootDays`). Append after it.

- [ ] **Step 1:** Add hooks:

```ts
// ─── Schedule Blocks ─────────────────────────────────────────────────────

export function useScheduleBlocks(shootDayId: string | null) {
  return useQuery({
    queryKey: ['scheduleBlocks', shootDayId],
    queryFn: () => fetchScheduleBlocks(shootDayId!),
    enabled: !!shootDayId,
    staleTime: 30_000,
  })
}

export function useCreateScheduleBlock(shootDayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createScheduleBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduleBlocks', shootDayId] }),
  })
}

export function useUpdateScheduleBlock(shootDayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateScheduleBlock>[1] }) =>
      updateScheduleBlock(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduleBlocks', shootDayId] }),
  })
}

export function useDeleteScheduleBlock(shootDayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteScheduleBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduleBlocks', shootDayId] }),
  })
}
```

Make sure the imports at the top of the file include `createScheduleBlock`, `updateScheduleBlock`, `deleteScheduleBlock`, `fetchScheduleBlocks` from `@/lib/db/queries`.

- [ ] **Step 2:** Run typecheck. Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "feat(schedule): useScheduleBlocks/Create/Update/Delete hooks"
```

---

## Task 7 — Block edit form

**Files:**
- Create: `apps/back-to-one/src/components/schedule/BlockEditForm.tsx`

A controlled form used by both the Add sheet and the Edit sheet.

- [ ] **Step 1:** Implement (full code, no stubs):

```tsx
'use client'

import { useState } from 'react'
import type { ScheduleBlock, ScheduleBlockTrack, ScheduleBlockKind } from '@/types'
import { useTalent, useLocations, useCrew } from '@/lib/hooks/useOriginOne'

const TRACK_LABEL: Record<ScheduleBlockTrack, string> = {
  main: 'Main',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
}

const KIND_LABEL: Record<ScheduleBlockKind, string> = {
  work: 'Work',
  load_in: 'Load In',
  talent_call: 'Talent Call',
  lunch: 'Lunch',
  wrap: 'Wrap Out',
  tail_lights: 'Tail Lights',
  meal_break: 'Meal Break',
  custom: 'Custom',
}

const FULL_WIDTH_KINDS: ScheduleBlockKind[] = ['load_in', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'talent_call', 'custom']

export type BlockEditValues = {
  track: ScheduleBlockTrack
  kind: ScheduleBlockKind
  startTime: string
  endTime: string
  description: string
  customLabel: string
  locationId: string | null
  talentIds: string[]
  crewMemberIds: string[]
}

export function BlockEditForm({
  projectId,
  initial,
  onChange,
}: {
  projectId: string
  initial: BlockEditValues
  onChange: (values: BlockEditValues) => void
}) {
  const { data: talent = [] } = useTalent(projectId)
  const { data: locations = [] } = useLocations(projectId)
  const { data: crew = [] } = useCrew(projectId)
  const [values, setValues] = useState<BlockEditValues>(initial)

  function update<K extends keyof BlockEditValues>(key: K, val: BlockEditValues[K]) {
    const next = { ...values, [key]: val }
    setValues(next)
    onChange(next)
  }

  function toggle(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]
  }

  const isFullWidth = FULL_WIDTH_KINDS.includes(values.kind)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Kind */}
      <div>
        <label className="text-xs uppercase tracking-wide text-white/50">Type</label>
        <select
          value={values.kind}
          onChange={e => update('kind', e.target.value as ScheduleBlockKind)}
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
        >
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      {/* Track (only for `work` kind) */}
      {!isFullWidth && (
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">Track</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(['main', 'secondary', 'tertiary'] as ScheduleBlockTrack[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => update('track', t)}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  values.track === t ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/70'
                }`}
              >
                {TRACK_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">Start</label>
          <input
            type="time"
            value={values.startTime}
            onChange={e => update('startTime', e.target.value)}
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">End</label>
          <input
            type="time"
            value={values.endTime}
            onChange={e => update('endTime', e.target.value)}
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs uppercase tracking-wide text-white/50">Description</label>
        <input
          type="text"
          value={values.description}
          onChange={e => update('description', e.target.value)}
          placeholder="Shoot Office — 2m Coverage"
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
        />
      </div>

      {/* Custom label (only for kind=custom) */}
      {values.kind === 'custom' && (
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">Custom Label</label>
          <input
            type="text"
            value={values.customLabel}
            onChange={e => update('customLabel', e.target.value)}
            placeholder="e.g. SAFETY MEETING"
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
        </div>
      )}

      {/* Location (work kind only) */}
      {!isFullWidth && (
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">Location</label>
          <select
            value={values.locationId ?? ''}
            onChange={e => update('locationId', e.target.value || null)}
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="">— None —</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Talent multi-select */}
      {!isFullWidth && (
        <div>
          <label className="text-xs uppercase tracking-wide text-white/50">Talent</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {talent.length === 0 && <p className="text-xs text-white/40">No talent on this project yet.</p>}
            {talent.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => update('talentIds', toggle(values.talentIds, t.id))}
                className={`px-3 py-1 rounded-full text-xs border ${
                  values.talentIds.includes(t.id)
                    ? 'bg-white/20 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Run typecheck. Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/components/schedule/BlockEditForm.tsx
git commit -m "feat(schedule): BlockEditForm component"
```

---

## Task 8 — Add/edit sheet

**Files:**
- Create: `apps/back-to-one/src/components/schedule/AddScheduleBlockSheet.tsx`

- [ ] **Step 1:** Implement:

```tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { BlockEditForm, type BlockEditValues } from './BlockEditForm'
import type { ScheduleBlock } from '@/types'
import { useCreateScheduleBlock, useUpdateScheduleBlock, useDeleteScheduleBlock } from '@/lib/hooks/useOriginOne'

const EMPTY: BlockEditValues = {
  track: 'main',
  kind: 'work',
  startTime: '08:00',
  endTime: '08:30',
  description: '',
  customLabel: '',
  locationId: null,
  talentIds: [],
  crewMemberIds: [],
}

function blockToValues(b: ScheduleBlock): BlockEditValues {
  return {
    track: b.track,
    kind: b.kind,
    startTime: b.startTime,
    endTime: b.endTime ?? '',
    description: b.description,
    customLabel: b.customLabel ?? '',
    locationId: b.locationId,
    talentIds: b.talentIds,
    crewMemberIds: b.crewMemberIds,
  }
}

export function AddScheduleBlockSheet({
  open,
  onClose,
  projectId,
  shootDayId,
  editingBlock,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  shootDayId: string
  editingBlock: ScheduleBlock | null
}) {
  const [values, setValues] = useState<BlockEditValues>(EMPTY)
  const createMut = useCreateScheduleBlock(shootDayId)
  const updateMut = useUpdateScheduleBlock(shootDayId)
  const deleteMut = useDeleteScheduleBlock(shootDayId)

  // sync initial values when editingBlock changes
  const initial = editingBlock ? blockToValues(editingBlock) : EMPTY

  async function save() {
    const payload = {
      track: values.track,
      kind: values.kind,
      startTime: values.startTime,
      endTime: values.endTime || null,
      description: values.description,
      customLabel: values.customLabel || null,
      locationId: values.locationId,
      talentIds: values.talentIds,
      crewMemberIds: values.crewMemberIds,
    }
    if (editingBlock) {
      await updateMut.mutateAsync({ id: editingBlock.id, patch: payload })
    } else {
      await createMut.mutateAsync({ projectId, shootDayId, ...payload })
    }
    onClose()
  }

  async function remove() {
    if (!editingBlock) return
    if (!confirm('Delete this block?')) return
    await deleteMut.mutateAsync(editingBlock.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title={editingBlock ? 'Edit Block' : 'Add Block'} onClose={onClose} />
      <SheetBody>
        <BlockEditForm projectId={projectId} initial={initial} onChange={setValues} />
        <div className="p-4 flex gap-2">
          <button
            onClick={save}
            disabled={createMut.isPending || updateMut.isPending}
            className="flex-1 bg-white text-black rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {editingBlock ? 'Save changes' : 'Add block'}
          </button>
          {editingBlock && (
            <button
              onClick={remove}
              className="px-4 bg-red-500/20 text-red-300 rounded-xl py-3 border border-red-500/30"
            >
              Delete
            </button>
          )}
        </div>
      </SheetBody>
    </Sheet>
  )
}
```

- [ ] **Step 2:** Run typecheck. Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/components/schedule/AddScheduleBlockSheet.tsx
git commit -m "feat(schedule): AddScheduleBlockSheet"
```

---

## Task 9 — ScheduleGrid (desktop) + ScheduleCardStack (phone)

**Files:**
- Create: `apps/back-to-one/src/components/schedule/ScheduleGrid.tsx`
- Create: `apps/back-to-one/src/components/schedule/ScheduleCardStack.tsx`

- [ ] **Step 1:** Implement `ScheduleGrid.tsx`:

```tsx
'use client'

import type { ScheduleBlock } from '@/types'
import { formatTime } from '@/lib/schedule/format-time'
import { useTalent, useLocations } from '@/lib/hooks/useOriginOne'

const FULL_WIDTH_KINDS = new Set(['load_in', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'talent_call', 'custom'])

const KIND_FULL_LABEL: Record<string, string> = {
  load_in: 'LOAD IN',
  lunch: 'LUNCH',
  wrap: 'WRAP OUT',
  tail_lights: 'TAIL LIGHTS',
  meal_break: 'MEAL BREAK',
  talent_call: 'TALENT CALL',
}

type GroupedRow = {
  startTime: string
  endTime: string | null
  fullWidthBlock: ScheduleBlock | null
  main: ScheduleBlock | null
  secondary: ScheduleBlock | null
  tertiary: ScheduleBlock | null
}

function groupBlocksByTime(blocks: ScheduleBlock[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>()
  for (const b of blocks) {
    const key = `${b.startTime}-${b.endTime ?? ''}`
    if (!map.has(key)) {
      map.set(key, { startTime: b.startTime, endTime: b.endTime, fullWidthBlock: null, main: null, secondary: null, tertiary: null })
    }
    const row = map.get(key)!
    if (FULL_WIDTH_KINDS.has(b.kind)) {
      row.fullWidthBlock = b
    } else if (b.track === 'main') {
      row.main = b
    } else if (b.track === 'secondary') {
      row.secondary = b
    } else if (b.track === 'tertiary') {
      row.tertiary = b
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function ScheduleGrid({
  blocks,
  onEditBlock,
  projectId,
}: {
  blocks: ScheduleBlock[]
  onEditBlock: (block: ScheduleBlock) => void
  projectId: string
}) {
  const { data: talent = [] } = useTalent(projectId)
  const { data: locations = [] } = useLocations(projectId)
  const talentName = (id: string) => talent.find(t => t.id === id)?.name ?? '—'
  const locationName = (id: string | null) => (id ? locations.find(l => l.id === id)?.name ?? '—' : '')

  const rows = groupBlocksByTime(blocks)

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-xs text-white" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="bg-white/5 text-white/50 font-mono uppercase tracking-wide">
            <th className="text-left p-3 w-32">Time</th>
            <th className="text-left p-3 w-20">Min</th>
            <th className="text-left p-3 w-32">Talent</th>
            <th className="text-left p-3 w-32">Location</th>
            <th className="text-left p-3">Main</th>
            <th className="text-left p-3">Secondary</th>
            <th className="text-left p-3">Tertiary</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-white/40">No schedule yet — add the first block.</td></tr>
          )}
          {rows.map((r, i) => {
            const minutes = r.endTime ? minutesBetween(r.startTime, r.endTime) : null
            if (r.fullWidthBlock) {
              const b = r.fullWidthBlock
              const label = b.kind === 'custom' ? (b.customLabel ?? 'CUSTOM') : KIND_FULL_LABEL[b.kind] ?? b.kind.toUpperCase()
              return (
                <tr key={i} className="border-t border-white/5 cursor-pointer hover:bg-white/5" onClick={() => onEditBlock(b)}>
                  <td className="p-3">{formatTime(r.startTime)}{r.endTime ? `–${formatTime(r.endTime)}` : ''}</td>
                  <td className="p-3 text-white/40">{minutes ?? ''}</td>
                  <td colSpan={5} className="p-3 text-center font-mono uppercase tracking-wide text-white/80">{label} {b.description ? `· ${b.description}` : ''}</td>
                </tr>
              )
            }
            // Compose the row from up to 3 track blocks; talent/location come from main if present
            const primary = r.main ?? r.secondary ?? r.tertiary
            const tIds = primary?.talentIds ?? []
            const locId = primary?.locationId ?? null
            return (
              <tr key={i} className="border-t border-white/5">
                <td className="p-3">{formatTime(r.startTime)}{r.endTime ? `–${formatTime(r.endTime)}` : ''}</td>
                <td className="p-3 text-white/40">{minutes ?? ''}</td>
                <td className="p-3 text-white/80">{tIds.map(talentName).join(', ') || '—'}</td>
                <td className="p-3 text-white/80">{locationName(locId)}</td>
                <td className="p-3 cursor-pointer hover:bg-white/5" onClick={() => r.main && onEditBlock(r.main)}>{r.main?.description ?? <span className="text-white/30">—</span>}</td>
                <td className="p-3 cursor-pointer hover:bg-white/5 text-white/70" onClick={() => r.secondary && onEditBlock(r.secondary)}>{r.secondary?.description ?? <span className="text-white/30">—</span>}</td>
                <td className="p-3 cursor-pointer hover:bg-white/5 text-white/70" onClick={() => r.tertiary && onEditBlock(r.tertiary)}>{r.tertiary?.description ?? <span className="text-white/30">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function minutesBetween(a: string, b: string): number {
  const [aH, aM] = a.split(':').map(Number)
  const [bH, bM] = b.split(':').map(Number)
  return (bH * 60 + bM) - (aH * 60 + aM)
}
```

- [ ] **Step 2:** Implement `ScheduleCardStack.tsx`:

```tsx
'use client'

import type { ScheduleBlock } from '@/types'
import { formatTime } from '@/lib/schedule/format-time'
import { useTalent, useLocations } from '@/lib/hooks/useOriginOne'

const FULL_WIDTH_KINDS = new Set(['load_in', 'lunch', 'wrap', 'tail_lights', 'meal_break', 'talent_call', 'custom'])

const TRACK_HEX: Record<string, string> = {
  main: '#6470f3',
  secondary: '#e8a020',
  tertiary: '#00b894',
}

export function ScheduleCardStack({
  blocks,
  onEditBlock,
  projectId,
}: {
  blocks: ScheduleBlock[]
  onEditBlock: (block: ScheduleBlock) => void
  projectId: string
}) {
  const { data: talent = [] } = useTalent(projectId)
  const { data: locations = [] } = useLocations(projectId)
  const talentName = (id: string) => talent.find(t => t.id === id)?.name ?? '—'
  const locationName = (id: string | null) => (id ? locations.find(l => l.id === id)?.name ?? '' : '')

  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 && (
        <div className="text-center text-white/40 py-12">No schedule yet — add the first block.</div>
      )}
      {sorted.map(b => {
        const isFull = FULL_WIDTH_KINDS.has(b.kind)
        const accent = isFull ? '#a0a0b8' : TRACK_HEX[b.track] ?? '#6470f3'
        return (
          <button
            key={b.id}
            onClick={() => onEditBlock(b)}
            className="text-left bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-3 active:bg-white/10"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-white/60">
                {formatTime(b.startTime)}{b.endTime ? `–${formatTime(b.endTime)}` : ''}
              </span>
              <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full" style={{ background: accent + '22', color: accent }}>
                {isFull ? (b.kind === 'custom' ? b.customLabel : b.kind.replace('_', ' ')) : b.track}
              </span>
            </div>
            <div className="mt-1 text-sm text-white">{b.description}</div>
            {!isFull && (b.locationId || b.talentIds.length > 0) && (
              <div className="mt-1 text-xs text-white/50">
                {b.locationId && <>📍 {locationName(b.locationId)}</>}
                {b.locationId && b.talentIds.length > 0 && ' · '}
                {b.talentIds.length > 0 && b.talentIds.map(talentName).join(', ')}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3:** Run typecheck. Expected: 0 errors.

- [ ] **Step 4:** Commit:

```bash
git add apps/back-to-one/src/components/schedule/
git commit -m "feat(schedule): ScheduleGrid + ScheduleCardStack"
```

---

## Task 10 — Schedule editor page

**Files:**
- Create: `apps/back-to-one/src/app/projects/[projectId]/timeline/[shootDayId]/page.tsx`

- [ ] **Step 1:** Implement:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { ScheduleCardStack } from '@/components/schedule/ScheduleCardStack'
import { AddScheduleBlockSheet } from '@/components/schedule/AddScheduleBlockSheet'
import { useScheduleBlocks, useShootDays, useProject } from '@/lib/hooks/useOriginOne'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import type { ScheduleBlock } from '@/types'

export default function ShootDaySchedulePage() {
  const params = useParams<{ projectId: string; shootDayId: string }>()
  const projectId = params.projectId
  const shootDayId = params.shootDayId
  const router = useRouter()

  const { data: project } = useProject(projectId)
  const { data: shootDays = [] } = useShootDays(projectId)
  const { data: blocks = [], isLoading } = useScheduleBlocks(shootDayId)
  const shootDay = shootDays.find(d => d.id === shootDayId) ?? null

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null)

  function openAdd() {
    setEditingBlock(null)
    setSheetOpen(true)
  }

  function openEdit(block: ScheduleBlock) {
    setEditingBlock(block)
    setSheetOpen(true)
  }

  // ActionBar — "+ Add Block"
  useFabAction({
    label: 'Add Block',
    onClick: openAdd,
    visible: !!shootDay,
  })

  if (isLoading || !shootDay || !project) return <LoadingState />

  const dateLabel = formatShootDate(shootDay.date)

  return (
    <div className="flex flex-col min-h-screen bg-[#04040a]">
      <PageHeader
        title="Schedule"
        subtitle={dateLabel}
        onBack={() => router.push(`/projects/${projectId}/timeline`)}
      />
      <div className="flex-1 px-4 pb-24">
        {/* Desktop: grid; phone: card stack — Tailwind responsive */}
        <div className="hidden md:block mt-4">
          <ScheduleGrid blocks={blocks} onEditBlock={openEdit} projectId={projectId} />
        </div>
        <div className="md:hidden mt-4">
          <ScheduleCardStack blocks={blocks} onEditBlock={openEdit} projectId={projectId} />
        </div>
      </div>
      <AddScheduleBlockSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        projectId={projectId}
        shootDayId={shootDayId}
        editingBlock={editingBlock}
      />
    </div>
  )
}

function formatShootDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${dow} ${mon} ${d}, ${y}`
}
```

- [ ] **Step 2:** Run typecheck. Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/app/projects/\[projectId\]/timeline/\[shootDayId\]/
git commit -m "feat(schedule): per-shoot-day editor page"
```

---

## Task 11 — Wire navigation from Timeline page

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx`

Find the existing shoot-day list rendering (look for the ShootDay row component or `.row` references). Add an `onClick` that routes to `/projects/[projectId]/timeline/[shootDayId]`.

- [ ] **Step 1:** Locate the shoot-day row click handler. Add (or modify) the click to:

```tsx
onClick={() => router.push(`/projects/${projectId}/timeline/${shootDay.id}`)}
```

- [ ] **Step 2:** Run typecheck. Expected: 0 errors.

- [ ] **Step 3:** Commit:

```bash
git add apps/back-to-one/src/app/projects/\[projectId\]/timeline/page.tsx
git commit -m "feat(schedule): wire ShootDay row → schedule editor route"
```

---

## Task 12 — Seed data

**Files:**
- Modify: `packages/db/prisma/seed.ts`

Add ~20 schedule blocks for one shoot day on the "In Vino Veritas" project (or whichever project has a `prod` ShootDay), matching a simplified GB01-shape day.

- [ ] **Step 1:** Find the existing ShootDay seed section in `seed.ts`. After ShootDay creation, locate one `prod` shoot day (or pick any project's first prod day) and add:

```ts
// Schedule blocks for one production day — illustrative GB01-shape day
const targetShootDay = createdShootDays.find(d => d.type === 'prod')
if (targetShootDay) {
  await prisma.scheduleBlock.createMany({
    data: [
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'load_in', track: 'main', startTime: '07:30', endTime: '08:30', description: 'ALL: Load In / Set Up' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'main', startTime: '08:30', endTime: '09:30', description: 'G&E: Light Office' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'secondary', startTime: '08:30', endTime: '09:30', description: 'Art: Garden' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'main', startTime: '09:30', endTime: '09:45', description: 'Shoot Office — 2m Coverage' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'main', startTime: '09:45', endTime: '10:00', description: 'Shoot Office — 1m Coverage' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'secondary', startTime: '09:45', endTime: '10:00', description: 'HMU / Wardrobe — Finish Kathleen (Garden)' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'work', track: 'tertiary', startTime: '09:45', endTime: '10:00', description: 'G&E: Light Garden' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'lunch', track: 'main', startTime: '13:30', endTime: '14:00', description: 'Lunch' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'wrap', track: 'main', startTime: '18:00', endTime: '19:30', description: 'Wrap Out' },
      { projectId: targetShootDay.projectId, shootDayId: targetShootDay.id, kind: 'tail_lights', track: 'main', startTime: '19:30', endTime: null, description: 'Tail Lights' },
    ],
  })
}
```

- [ ] **Step 2:** Run seed:

```bash
pnpm --filter @origin-one/db db:seed
```

Expected: seed completes; 10 schedule blocks inserted.

- [ ] **Step 3:** Commit:

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(schedule): seed ~10 schedule blocks for one prod day"
```

---

## Task 13 — Final verify

- [ ] **Step 1:** Run full build:

```bash
pnpm -w build
```

Expected: green.

- [ ] **Step 2:** Run all tests:

```bash
pnpm test
```

Expected: green.

- [ ] **Step 3:** Manual smoke (if dev DB available): start dev server, navigate to a project, click Timeline, click a prod shoot day, verify the schedule editor loads with seeded blocks; verify Add Block sheet opens via FAB; verify edit/delete works.

- [ ] **Step 4:** Tag the arc commit boundary — the last commit is the implicit boundary; no separate marker required since we'll cherry-pick by range later.

---

## Self-review

- ✅ Spec coverage: schema, types, queries, hooks, editor route, components, seed. Matches Arc A scope.
- ✅ No placeholders.
- ✅ Type consistency: `ScheduleBlock` shape matches across schema, queries, and components.
- ⚠️ `useFabAction` signature assumed to take `{ label, onClick, visible }` — verify against the actual signature in `lib/contexts/FabActionContext.tsx` and adjust call site in Task 10 if it differs.
- ⚠️ Sheet component import paths assumed — verify `@/components/ui/Sheet` exposes `Sheet`, `SheetHeader`, `SheetBody`.
