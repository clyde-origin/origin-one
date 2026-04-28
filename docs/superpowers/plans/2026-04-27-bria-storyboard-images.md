# Bria Storyboard Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one pencil-sketch storyboard frame per seeded `Shot` via Bria.ai (~89 images, ~$3.56), using a shared `bria.ts` client and pure prompt-shaper that the future in-app "regenerate storyboard" feature will reuse unchanged.

**Architecture:** Extend the existing `seed-images` pipeline (manifest → fetch CLI → files/ → uploader → Supabase) with a new `'storyboard'` surface whose entries are *derived* from `Shot` rows at fetch time (no manifest growth). New Bria HTTP client follows the existing `pexels.ts` / `openai-images.ts` pattern as a thin pure module. Plumbs the existing-but-unused `Project.aspectRatio` field through 7 hardcoded `'16/9'` UI render sites as a prerequisite, since per-project aspect ratios are part of the value.

**Tech Stack:** TypeScript, Vitest, tsx, Prisma, Supabase Storage, Bria.ai REST API (`api_token` header), `sharp` for 2.39:1 cropping, `p-limit` for bounded concurrency.

**Spec:** `docs/superpowers/specs/2026-04-27-bria-storyboard-images-design.md`

---

## File Structure

**New files (in `packages/db/src/`):**
- `seed-data/scenes.ts` — extracted scene metadata (project key → scene rows)
- `seed-data/shots.ts` — extracted shot metadata (scene number → shot rows)
- `seed-images/clients/bria.ts` — Bria HTTP client (pure, no Prisma/Supabase)
- `seed-images/clients/bria.test.ts`
- `seed-images/storyboard-prompt.ts` — pure prompt assembly
- `seed-images/storyboard-prompt.test.ts`
- `seed-images/bria-aspect.ts` — `Project.aspectRatio` → Bria request + crop hint
- `seed-images/bria-aspect.test.ts`
- `seed-images/shot-entries.ts` — derives `StoryboardEntry[]` from seed-data

**New files (in `apps/back-to-one/src/`):**
- `lib/aspect-ratio.ts` — `aspectRatioToCss('2.39:1') → '2.39 / 1'`
- `lib/aspect-ratio.test.ts`

**Modified files:**
- `packages/db/.env.example` — add `BRIA_API_TOKEN` *(already done in design phase)*
- `packages/db/package.json` — add `sharp` and `p-limit` deps
- `packages/db/prisma/seed.ts` — backfill `Project.aspectRatio`; import shots/scenes from seed-data; upload storyboards
- `packages/db/src/seed-images/tone-primers.ts` — add `aspectRatio` per project
- `packages/db/src/seed-images/paths.ts` — add `'storyboard'` Surface and Bucket
- `packages/db/src/seed-images/paths.test.ts` — extend for `'storyboard'`
- `packages/db/src/seed-images/filter.ts` — accept `'storyboard'` surface and surface-only filters
- `packages/db/src/seed-images/filter.test.ts` — extend for new filter shapes
- `packages/db/scripts/fetch-seed-images.ts` — wire storyboard surface, `--smoke`, `--confirm-spend`, concurrency
- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/page.tsx` — 5 hardcoded `'16/9'` sites
- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/ShotDetailSheet.tsx` — 1 site
- `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/PdfExport.tsx` — 1 site

---

## Task 1: Refactor — extract `seed-data/scenes.ts` and `seed-data/shots.ts`

**Why this first:** the storyboard fetch CLI needs to read scene/shot data without a DB connection. Pure code-reorganization step — no behavior change. Verified by diffing `db:seed` output before/after.

**Files:**
- Create: `packages/db/src/seed-data/scenes.ts`
- Create: `packages/db/src/seed-data/shots.ts`
- Modify: `packages/db/prisma/seed.ts` (replace inlined arrays with imports)

- [ ] **Step 1: Snapshot current seed output**

```bash
cd /Users/pawn/Code/origin-one
pnpm --filter @origin-one/db db:reset
pnpm --filter @origin-one/db db:seed > /tmp/seed-before.log 2>&1
```

Expected: completes without error. Save the row counts that print at the end (e.g., "P1: Simple Skin Promo — 3 scenes, 14 shots, 24 crew").

- [ ] **Step 2: Create `packages/db/src/seed-data/scenes.ts`**

```ts
// Scene metadata for all six seeded projects, in the same shape as the
// arguments to prisma.scene.create. Imported by prisma/seed.ts (which
// supplies the projectId at insert time) and by seed-images/shot-entries.ts
// (which uses sceneNumber + description to build storyboard prompts).

import type { ProjectKey } from '../seed-images/paths'

export type SceneSeedRow = {
  sceneNumber: string
  title: string
  sortOrder: number
  description: string
}

export const SCENES: Record<Exclude<ProjectKey, 'crew'>, SceneSeedRow[]> = {
  p1: [
    { sceneNumber: '01', title: 'The Ritual', sortOrder: 1, description: 'Bathroom. Marble surfaces, soft window light. The beginning of the day and the product.' },
    { sceneNumber: '02', title: 'The Light',  sortOrder: 2, description: 'Estate garden. Dappled shade, old stone. The exterior world as an extension of the interior one.' },
    { sceneNumber: '03', title: 'The Mirror', sortOrder: 3, description: 'Main salon. A full-length mirror. The final image of the film and the thesis of the campaign.' },
  ],
  // p2..p6: copy the exact arguments from the existing prisma.scene.create
  // calls in prisma/seed.ts (projectIds: p2.id..p6.id). Preserve sceneNumber,
  // title, sortOrder, and description verbatim.
  p2: [], // FILL IN from seed.ts current p2 scene.create calls
  p3: [],
  p4: [],
  p5: [],
  p6: [],
}
```

**Important:** the placeholder `[]` arrays for p2–p6 are not acceptable in the final commit. Walk through `prisma/seed.ts` and fill in every scene.

- [ ] **Step 3: Create `packages/db/src/seed-data/shots.ts`**

```ts
// Shot metadata keyed by projectKey + sceneNumber. Same shape as the rows
// passed to prisma.shot.createMany. Imported by prisma/seed.ts and by
// seed-images/shot-entries.ts (which uses size + description to build prompts).

import type { ProjectKey } from '../seed-images/paths'

export type ShotSize =
  | 'extreme_close_up' | 'close_up' | 'medium_close_up'
  | 'medium' | 'wide' | 'full' | 'insert'

export type ShotStatus = 'planned' | 'in_progress' | 'completed'

export type ShotSeedRow = {
  shotNumber: string
  size?: ShotSize
  status: ShotStatus
  sortOrder: number
  description: string
}

// Outer key: projectKey. Inner key: sceneNumber.
export const SHOTS: Record<Exclude<ProjectKey, 'crew'>, Record<string, ShotSeedRow[]>> = {
  p1: {
    '01': [
      { shotNumber: '01A', size: 'extreme_close_up', status: 'planned', sortOrder: 1, description: 'Fingers drawing a single drop from the bottle. The product in motion for the first time.' },
      { shotNumber: '01B', size: 'medium',           status: 'planned', sortOrder: 2, description: 'Aria at the mirror, unhurried. The quality of her attention. This is her morning.' },
      { shotNumber: '01C', size: 'close_up',         status: 'planned', sortOrder: 3, description: 'Light catching the cheekbone. The skin as landscape.' },
      { shotNumber: '01D', size: 'extreme_close_up', status: 'planned', sortOrder: 4, description: 'Eyes closing, then opening. Not a transformation. Recognition.' },
      { shotNumber: '01E', size: 'wide',             status: 'planned', sortOrder: 5, description: 'Full bathroom frame. The quality of the morning light. The room as a complete world.' },
    ],
    // '02' and '03' for p1, then all sceneNumbers for p2..p6:
    // copy verbatim from each prisma.shot.createMany call in seed.ts.
  },
  p2: {},
  p3: {},
  p4: {},
  p5: {},
  p6: {},
}
```

**Important:** placeholder `{}` arrays for p2–p6 must be filled in. Reference the existing `prisma.shot.createMany` calls in `seed.ts` and copy every shot row exactly.

- [ ] **Step 4: Modify `prisma/seed.ts` — replace inlined scene+shot data with imports**

At the top of `seed.ts`, near the other imports, add:

```ts
import { SCENES } from '../src/seed-data/scenes'
import { SHOTS } from '../src/seed-data/shots'
```

Then for each project, replace blocks like:

```ts
const p1s1 = await prisma.scene.create({ data: {
  projectId: p1.id, sceneNumber: '01', title: 'The Ritual', sortOrder: 1,
  description: 'Bathroom. ...',
}})
await prisma.shot.createMany({ data: [
  { sceneId: p1s1.id, shotNumber: '01A', ... },
  ...
]})
```

with a small helper-driven loop:

```ts
async function seedProjectScenes(projectKey: 'p1'|'p2'|'p3'|'p4'|'p5'|'p6', projectId: string) {
  const result: Record<string, { id: string }> = {}
  for (const scene of SCENES[projectKey]) {
    const created = await prisma.scene.create({ data: {
      projectId,
      sceneNumber: scene.sceneNumber,
      title: scene.title,
      sortOrder: scene.sortOrder,
      description: scene.description,
    }})
    result[scene.sceneNumber] = created
    const shotRows = SHOTS[projectKey][scene.sceneNumber] ?? []
    if (shotRows.length > 0) {
      await prisma.shot.createMany({ data: shotRows.map(s => ({
        sceneId: created.id,
        shotNumber: s.shotNumber,
        size: s.size,
        status: s.status,
        sortOrder: s.sortOrder,
        description: s.description,
      }))})
    }
  }
  return result
}
```

Keep variable names like `p1s1`, `p1s2` working by reading from the returned record (e.g., `const p1s1 = scenes['01']`) — they're referenced later for `mustFind` lookups.

- [ ] **Step 5: Type-check the package**

```bash
pnpm --filter @origin-one/db type-check
```

Expected: no errors. If `SCENES`/`SHOTS` types are off, fix before proceeding — easier to catch type errors here than in the seed run.

- [ ] **Step 6: Re-run seed and diff**

```bash
pnpm --filter @origin-one/db db:reset
pnpm --filter @origin-one/db db:seed > /tmp/seed-after.log 2>&1
diff /tmp/seed-before.log /tmp/seed-after.log
```

Expected: empty diff (or only timestamp differences). Row counts must match exactly.

- [ ] **Step 7: Verify branch, then commit**

```bash
git status -sb   # confirm we're on the intended branch
git add packages/db/src/seed-data/ packages/db/prisma/seed.ts
git commit -m "refactor(db): extract scene/shot seed data to seed-data/

Pure code reorganization — no behavior change. Verified by diffing
db:seed output before/after. Sets up the storyboard fetcher to read
shot metadata without a database connection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `aspectRatio` to `tone-primers.ts` and backfill in `seed.ts`

**Files:**
- Modify: `packages/db/src/seed-images/tone-primers.ts`
- Modify: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Modify `tone-primers.ts` — extend the per-project shape**

Replace the existing `TONE_PRIMERS: Record<…, string>` with:

```ts
import type { ProjectKey } from './paths'

export type ProjectMeta = {
  primer: string
  aspectRatio: string  // '16:9', '2.39:1', etc. Read by both the seed
                       // (Project.aspectRatio backfill) and the storyboard
                       // fetcher (briaAspect mapping).
}

export const PROJECT_META: Record<Exclude<ProjectKey, 'crew'>, ProjectMeta> = {
  p1: { aspectRatio: '16:9', primer: `Project: Lumière Skincare commercial — "Simple Skin Promo".
Atmosphere: unhurried morning luxury. Soft window light through frosted glass.
Calacatta marble, brushed brass, amber glass, glycerin-clean droplets.
Skin as topography, not as catalog. Restraint over excess. Editorial beauty
photography, magazine reference, never advertorial. Color: cream, ivory, brass,
deep amber. Lens: medium, shallow. Mood: attention as luxury.` },

  p2: { aspectRatio: '16:9', primer: `Project: Vanta camera commercial — "Full Send".
Atmosphere: kinetic, sweat-real, sport-magazine. Pre-dawn or golden hour, never
noon. Salt, dust, chalk, friction, lived-in gear. Athletes captured in
commitment moments — drop-in, send, exhale. Hard light, motion blur acceptable.
Color: salt-faded blacks, ocean greys, dust orange, sky cobalt. Lens: telephoto
for action, wide for environment. Mood: presence under pressure.` },

  p3: { aspectRatio: '16:9', primer: `Project: Napa Collective documentary — "In Vino Veritas".
Atmosphere: terroir documentary, slow earth time. Golden hour vineyards,
weathered hands, oak barrels in low light. Material: dust, vine, cork, stone,
oxidized iron. Honest portraiture — winemakers in their element, no styling.
Color: oxblood, burgundy, ochre, dried-leaf brown. Lens: 35mm or 50mm,
naturalistic. Mood: patient making, generational craft.` },

  p4: { aspectRatio: '16:9', primer: `Project: Kaia Mori educational series — "Flexibility Course A".
Atmosphere: studio cyclorama, controlled warm light. Yoga and movement —
clean lines, calm bodies, no distraction. Material: matte studio floor,
wool blocks, cotton straps, bare skin. Direct-to-camera energy: warm, specific,
unhurried. Color: dove grey, sand, terracotta, deep moss. Lens: medium,
even exposure, soft shadows. Mood: instructional intimacy.` },

  p5: { aspectRatio: '16:9', primer: `Project: Meridian Climate branded film — "Natural Order".
Atmosphere: stock-driven climate visuals — ocean, weather, satellite, data
overlay. Scale and consequence, not panic. Material: water surface, cloud
formations, ice, machined metal sensors. Color: deep blue, glacial white,
storm grey, copper instrument. Lens: wide environmental, occasional macro for
detail. Mood: scale rendered legible.` },

  p6: { aspectRatio: '2.39:1', primer: `Project: B Story narrative film — "The Weave".
Atmosphere: cinematic narrative, three intercut storylines (desert, urban, coastal).
Mojave flats at apogee — silence, scale, isolation. Material varies by storyline:
sun-bleached wood, cracked asphalt, kelp wet stone. Performances over plot beats.
Color: dust orange, bone white, neon teal (urban), kelp green (coastal). Lens:
anamorphic feel, 2.39:1 framing in mind. Mood: parallel lives, single weather.` },
}

export function tonePrimer(projectKey: ProjectKey): string {
  if (projectKey === 'crew') {
    return `Editorial environmental portrait, natural light, neutral background, professional crew aesthetic. Real-feeling, never glossy or stocky.`
  }
  return PROJECT_META[projectKey].primer
}

export function projectAspectRatio(projectKey: Exclude<ProjectKey, 'crew'>): string {
  return PROJECT_META[projectKey].aspectRatio
}
```

- [ ] **Step 2: Modify `prisma/seed.ts` — backfill `Project.aspectRatio`**

For each `prisma.project.create` call (lines 520, 818, 1087, 1357, 1624, 1844 in current seed.ts), add `aspectRatio` to the `data` object. Import the helper at the top of `seed.ts`:

```ts
import { projectAspectRatio } from '../src/seed-images/tone-primers'
```

Then on each create call:

```ts
// p1 (line 520):
const p1 = await prisma.project.create({
  data: { teamId: team.id, name: 'Simple Skin Promo', status: 'pre_production', client: 'Lumière Skincare', type: 'commercial', color: '#D4A847', aspectRatio: projectAspectRatio('p1') },
})
// repeat for p2..p6, passing the matching projectKey
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter @origin-one/db db:reset
pnpm --filter @origin-one/db db:seed
pnpm --filter @origin-one/db prisma studio
```

In Prisma Studio: open `Project` table. Confirm `aspectRatio` is `'16:9'` for P1–P5 and `'2.39:1'` for P6. (Or run `psql` if Studio is fussy.)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed-images/tone-primers.ts packages/db/prisma/seed.ts
git commit -m "feat(db): backfill Project.aspectRatio on seeded projects

P1-P5 ship at 16:9; P6 (The Weave) ships at 2.39:1 to match its
anamorphic primer. Adds projectAspectRatio() helper colocated with
tone-primers since both are per-project seed-side metadata.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add `aspectRatioToCss` helper in back-to-one

**Files:**
- Create: `apps/back-to-one/src/lib/aspect-ratio.ts`
- Test: `apps/back-to-one/src/lib/aspect-ratio.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/back-to-one/src/lib/aspect-ratio.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aspectRatioToCss } from './aspect-ratio'

describe('aspectRatioToCss', () => {
  it('returns 16 / 9 default for null', () => {
    expect(aspectRatioToCss(null)).toBe('16 / 9')
  })

  it('returns 16 / 9 default for undefined', () => {
    expect(aspectRatioToCss(undefined)).toBe('16 / 9')
  })

  it('returns 16 / 9 default for empty string', () => {
    expect(aspectRatioToCss('')).toBe('16 / 9')
  })

  it('converts simple ratios', () => {
    expect(aspectRatioToCss('16:9')).toBe('16 / 9')
    expect(aspectRatioToCss('9:16')).toBe('9 / 16')
    expect(aspectRatioToCss('1:1')).toBe('1 / 1')
    expect(aspectRatioToCss('4:5')).toBe('4 / 5')
    expect(aspectRatioToCss('3:2')).toBe('3 / 2')
  })

  it('converts decimal ratios', () => {
    expect(aspectRatioToCss('2.39:1')).toBe('2.39 / 1')
    expect(aspectRatioToCss('1.85:1')).toBe('1.85 / 1')
  })

  it('returns 16 / 9 default for malformed input', () => {
    expect(aspectRatioToCss('garbage')).toBe('16 / 9')
    expect(aspectRatioToCss('1:')).toBe('16 / 9')
    expect(aspectRatioToCss(':1')).toBe('16 / 9')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run apps/back-to-one/src/lib/aspect-ratio.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/back-to-one/src/lib/aspect-ratio.ts`**

```ts
// Convert a Project.aspectRatio string ('16:9', '2.39:1', etc.) to the
// CSS aspect-ratio property value ('16 / 9', '2.39 / 1', ...). Centralizes
// the conversion + null/malformed handling so render sites don't reimplement.

export function aspectRatioToCss(ratio: string | null | undefined): string {
  if (!ratio) return '16 / 9'
  const parts = ratio.split(':')
  if (parts.length !== 2) return '16 / 9'
  const [w, h] = parts
  if (!w || !h) return '16 / 9'
  const wn = Number(w), hn = Number(h)
  if (!Number.isFinite(wn) || !Number.isFinite(hn) || wn <= 0 || hn <= 0) return '16 / 9'
  return `${w} / ${h}`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run apps/back-to-one/src/lib/aspect-ratio.test.ts
```

Expected: PASS — all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/aspect-ratio.ts apps/back-to-one/src/lib/aspect-ratio.test.ts
git commit -m "feat(back-to-one): add aspectRatioToCss helper

Pure utility for converting Project.aspectRatio strings to CSS
aspect-ratio values. Sets up plumbing the existing-but-unused
Project.aspectRatio field through scenemaker render sites.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Plumb `Project.aspectRatio` through scenemaker UI

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/scenemaker/page.tsx` (5 sites)
- Modify: `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/ShotDetailSheet.tsx` (1 site)
- Modify: `apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/PdfExport.tsx` (1 site)

- [ ] **Step 1: Audit each render site to know what `project` object is in scope**

```bash
grep -n "aspectRatio: '16/9'" apps/back-to-one/src/app/projects/[projectId]/scenemaker/page.tsx apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/ShotDetailSheet.tsx apps/back-to-one/src/app/projects/[projectId]/scenemaker/components/PdfExport.tsx
```

For each match, read 30 lines of surrounding context and identify the variable name holding the project (likely `project`, `currentProject`, or passed as a prop). Note any sites where the project isn't available — those need to thread `project.aspectRatio` down through props.

- [ ] **Step 2: Modify each site in `scenemaker/page.tsx`**

For each of the 5 hardcoded sites (lines 826, 865, 907, 934, 1092 — line numbers may have drifted; re-grep):

Before:
```tsx
<div ... style={{ aspectRatio: '16/9', ... }}>
```

After:
```tsx
<div ... style={{ aspectRatio: aspectRatioToCss(project?.aspectRatio), ... }}>
```

Add this import at the top of the file:
```ts
import { aspectRatioToCss } from '@/lib/aspect-ratio'
```

(Match the existing import alias style — if the file uses relative imports like `'../../../lib/...'`, follow that.)

- [ ] **Step 3: Modify `ShotDetailSheet.tsx` line 101**

Same pattern. Add the import. Replace:
```tsx
aspectRatio: '16/9',
```
with:
```tsx
aspectRatio: aspectRatioToCss(project?.aspectRatio),
```

If `project` isn't in scope here, accept it as a prop on the sheet and pass it from the call site.

- [ ] **Step 4: Modify `PdfExport.tsx` line 195**

Same pattern. Add the import. Replace as in Step 3.

- [ ] **Step 5: Type-check the app**

```bash
pnpm --filter back-to-one type-check
```

Expected: no errors. If `project.aspectRatio` is missing from a type, fix the type to include `aspectRatio: string | null` (it's already in the schema, so the Prisma generated type includes it — issue would be in a hand-written `Project`-shaped local type; widen it).

- [ ] **Step 6: Manual verify in dev**

```bash
pnpm --filter back-to-one dev
```

In a browser:
1. Open a P1 project's scenemaker. All shot tiles should still render at 16:9 (no visual change).
2. Open a P6 project's scenemaker (after `db:seed` in Task 2). Shot tiles should render at 2.39:1 (wider, shorter).
3. Open the shot detail sheet on a P6 shot. Same — 2.39:1.
4. Trigger a PDF export on P6. Shot images in the PDF should be 2.39:1.

- [ ] **Step 7: Commit**

```bash
git add apps/back-to-one/src/app/projects/[projectId]/scenemaker/
git commit -m "feat(back-to-one): plumb Project.aspectRatio through scenemaker

Replaces 7 hardcoded 16/9 render sites with aspectRatioToCss(project.aspectRatio).
The picker on the projects page now actually affects what users see — P6's
2.39:1 boards render anamorphic instead of being letterboxed inside a 16:9 box.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Add `'storyboard'` to `paths.ts` Surface and Bucket

**Files:**
- Modify: `packages/db/src/seed-images/paths.ts`
- Modify: `packages/db/src/seed-images/paths.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/db/src/seed-images/paths.test.ts`:

```ts
describe('bucketForSurface — storyboard', () => {
  it('routes storyboard to storyboard bucket', () => {
    expect(bucketForSurface('storyboard')).toBe('storyboard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/db/src/seed-images/paths.test.ts
```

Expected: TS error or FAIL — `'storyboard'` is not a valid `Surface`.

- [ ] **Step 3: Modify `paths.ts`**

Add `'storyboard'` to the `Surface` and `Bucket` types and update `bucketForSurface`:

```ts
export type Surface =
  | 'location'
  | 'narrativeLocation'
  | 'moodboard'
  | 'prop'
  | 'wardrobe'
  | 'hmu'
  | 'cast'
  | 'avatar'
  | 'storyboard'

export type Bucket = 'entity-attachments' | 'moodboard' | 'avatars' | 'storyboard'

export function bucketForSurface(surface: Surface): Bucket {
  switch (surface) {
    case 'location':
    case 'narrativeLocation':
    case 'prop':
    case 'wardrobe':
    case 'hmu':
    case 'cast':
      return 'entity-attachments'
    case 'moodboard':
      return 'moodboard'
    case 'avatar':
      return 'avatars'
    case 'storyboard':
      return 'storyboard'
  }
  const _exhaustive: never = surface
  throw new Error(`Unknown surface: ${_exhaustive as string}`)
}
```

(Leave `imageSizeForSurface` alone — storyboard fetch path computes its size from `Project.aspectRatio` separately, not from this helper. Storyboard never goes through OpenAI.)

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/db/src/seed-images/paths.test.ts
```

Expected: PASS, including the new storyboard case.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-images/paths.ts packages/db/src/seed-images/paths.test.ts
git commit -m "feat(db): add 'storyboard' Surface and Bucket

Routes storyboard surface to the existing 'storyboard' Supabase
bucket (currently permissive RLS, see CLAUDE.md storage discipline).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Build `bria-aspect.ts`

**Files:**
- Create: `packages/db/src/seed-images/bria-aspect.ts`
- Test: `packages/db/src/seed-images/bria-aspect.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/seed-images/bria-aspect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { briaAspect } from './bria-aspect'

describe('briaAspect', () => {
  it('passes through Bria-native ratios with no crop', () => {
    expect(briaAspect('16:9')).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('9:16')).toEqual({ request: '9:16', cropTo: null })
    expect(briaAspect('1:1')).toEqual({ request: '1:1', cropTo: null })
    expect(briaAspect('4:5')).toEqual({ request: '4:5', cropTo: null })
    expect(briaAspect('3:2')).toEqual({ request: '3:2', cropTo: null })
  })

  it('requests 16:9 and crops for 2.39:1', () => {
    expect(briaAspect('2.39:1')).toEqual({ request: '16:9', cropTo: '2.39:1' })
  })

  it('requests 16:9 and crops for 1.85:1', () => {
    expect(briaAspect('1.85:1')).toEqual({ request: '16:9', cropTo: '1.85:1' })
  })

  it('defaults to 16:9 with no crop for null/undefined/empty', () => {
    expect(briaAspect(null)).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect(undefined)).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('')).toEqual({ request: '16:9', cropTo: null })
  })

  it('defaults to 16:9 for unrecognized ratios', () => {
    expect(briaAspect('garbage')).toEqual({ request: '16:9', cropTo: null })
    expect(briaAspect('5:7')).toEqual({ request: '16:9', cropTo: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/db/src/seed-images/bria-aspect.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/db/src/seed-images/bria-aspect.ts`**

```ts
// Maps a Project.aspectRatio string to a Bria API request and an optional
// post-crop hint. Bria natively supports a fixed set of ratios; for ratios
// outside that set (e.g. 2.39:1, 1.85:1) we request the closest supported
// one and crop locally with sharp.

export type BriaRequestRatio = '1:1' | '16:9' | '9:16' | '4:5' | '3:2'

export type BriaAspectResult = {
  request: BriaRequestRatio   // value to send as aspect_ratio in the Bria request
  cropTo: string | null        // null = use as-is; otherwise center-crop locally to this ratio
}

const NATIVE: ReadonlySet<string> = new Set<BriaRequestRatio>([
  '1:1', '16:9', '9:16', '4:5', '3:2',
])

const CROP_FROM_16_9: ReadonlySet<string> = new Set([
  '2.39:1', '1.85:1',
])

export function briaAspect(ratio: string | null | undefined): BriaAspectResult {
  if (!ratio) return { request: '16:9', cropTo: null }
  if (NATIVE.has(ratio)) return { request: ratio as BriaRequestRatio, cropTo: null }
  if (CROP_FROM_16_9.has(ratio)) return { request: '16:9', cropTo: ratio }
  return { request: '16:9', cropTo: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/db/src/seed-images/bria-aspect.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-images/bria-aspect.ts packages/db/src/seed-images/bria-aspect.test.ts
git commit -m "feat(db): add briaAspect ratio mapper

Maps Project.aspectRatio to a Bria-native request value plus an
optional crop hint. 2.39:1 and 1.85:1 generate at 16:9 and crop locally.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Build `bria.ts` HTTP client

**Files:**
- Create: `packages/db/src/seed-images/clients/bria.ts`
- Test: `packages/db/src/seed-images/clients/bria.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/seed-images/clients/bria.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateStoryboard } from './bria'

describe('bria.generateStoryboard', () => {
  const ORIGINAL_TOKEN = process.env.BRIA_API_TOKEN

  beforeEach(() => {
    process.env.BRIA_API_TOKEN = 'test-token'
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env.BRIA_API_TOKEN = ORIGINAL_TOKEN
  })

  it('throws if BRIA_API_TOKEN is unset', async () => {
    delete process.env.BRIA_API_TOKEN
    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/BRIA_API_TOKEN/)
  })

  it('posts to the v2 endpoint with api_token header', async () => {
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // JPEG magic
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ image_url: 'https://cdn.bria/result.jpg', structured_prompt: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      })
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'a pencil sketch', aspectRatio: '16:9' })

    expect(out.bytes).toBeInstanceOf(Buffer)
    expect(out.bytes.length).toBe(4)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [genUrl, genInit] = fetchMock.mock.calls[0]
    expect(genUrl).toBe('https://engine.prod.bria-api.com/v2/image/generate')
    expect(genInit.method).toBe('POST')
    expect(genInit.headers['api_token']).toBe('test-token')
    expect(genInit.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(genInit.body)
    expect(body).toEqual({ prompt: 'a pencil sketch', aspect_ratio: '16:9' })

    const [imgUrl] = fetchMock.mock.calls[1]
    expect(imgUrl).toBe('https://cdn.bria/result.jpg')
  })

  it('throws on non-ok generate response without retrying for 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false, status: 400, statusText: 'Bad Request',
      text: async () => '{"error":"prompt too long"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries up to 3 times on 5xx, then fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 503, statusText: 'Service Unavailable',
      text: async () => 'down',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(generateStoryboard({ prompt: 'p', aspectRatio: '16:9' }))
      .rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  }, 15_000)

  it('retries on network error (TypeError), then succeeds', async () => {
    const fakeBytes = new Uint8Array([0xff])
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ image_url: 'https://cdn.bria/x.jpg', structured_prompt: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => fakeBytes.buffer,
      })
    vi.stubGlobal('fetch', fetchMock)

    const out = await generateStoryboard({ prompt: 'p', aspectRatio: '16:9' })
    expect(out.bytes.length).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 fail + 1 generate ok + 1 image fetch
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/db/src/seed-images/clients/bria.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/db/src/seed-images/clients/bria.ts`**

```ts
// Bria.ai text-to-image client. Pure: no Prisma, no Supabase, no filesystem.
// Importable from both the seed-side fetch CLI and (in a future arc) an
// in-app server route.
//
// Quirks vs OpenAI:
//   - Auth header is literal `api_token: <value>`, not Authorization Bearer.
//   - Response is { image_url }, not base64. Caller's hop is generate → fetch URL.
//
// Docs: https://docs.bria.ai/

import type { BriaRequestRatio } from '../bria-aspect'

const BRIA_GENERATE_URL = 'https://engine.prod.bria-api.com/v2/image/generate'

export type GenerateStoryboardArgs = {
  prompt: string
  aspectRatio: BriaRequestRatio
}

export type GenerateStoryboardResult = {
  bytes: Buffer
}

const MAX_ATTEMPTS = 3
const BACKOFF_MS = 2_000

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms))
}

export async function generateStoryboard(args: GenerateStoryboardArgs): Promise<GenerateStoryboardResult> {
  const token = process.env.BRIA_API_TOKEN
  if (!token) {
    throw new Error('BRIA_API_TOKEN not set. Add it to packages/db/.env.')
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const genRes = await fetch(BRIA_GENERATE_URL, {
        method: 'POST',
        headers: {
          'api_token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: args.prompt,
          aspect_ratio: args.aspectRatio,
        }),
      })
      if (!genRes.ok) {
        const text = await genRes.text().catch(() => '')
        const err = new Error(`Bria generate failed: ${genRes.status} ${genRes.statusText} ${text.slice(0, 200)}`)
        if (!isTransientStatus(genRes.status)) throw err
        lastError = err
      } else {
        const data = await genRes.json() as { image_url?: string }
        if (!data.image_url) {
          throw new Error(`Bria response missing image_url: ${JSON.stringify(data).slice(0, 200)}`)
        }
        const imgRes = await fetch(data.image_url)
        if (!imgRes.ok) {
          const err = new Error(`Bria image fetch failed: ${imgRes.status} ${imgRes.statusText}`)
          if (!isTransientStatus(imgRes.status)) throw err
          lastError = err
        } else {
          const ab = await imgRes.arrayBuffer()
          return { bytes: Buffer.from(ab) }
        }
      }
    } catch (err) {
      // Network / DNS / fetch-level errors arrive as TypeError. Treat as transient.
      if (err instanceof TypeError) {
        lastError = err
      } else {
        throw err
      }
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS * attempt)
    }
  }
  throw lastError ?? new Error('Bria generate failed after retries')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run packages/db/src/seed-images/clients/bria.test.ts
```

Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-images/clients/bria.ts packages/db/src/seed-images/clients/bria.test.ts
git commit -m "feat(db): add Bria.ai HTTP client for storyboard generation

Pure module — no Prisma, no Supabase, no filesystem. Designed to be
imported by both the seed CLI and a future in-app server route.

- Auth: literal api_token header (not Bearer)
- Response: image_url, fetched in a second hop
- Retry: 3 attempts on 5xx/429/network with 2s × attempt back-off
- Hard-fail on 4xx so bad prompts surface immediately

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Build `storyboard-prompt.ts`

**Files:**
- Create: `packages/db/src/seed-images/storyboard-prompt.ts`
- Test: `packages/db/src/seed-images/storyboard-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/db/src/seed-images/storyboard-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildStoryboardPrompt, humanizeShotSize } from './storyboard-prompt'
import type { ShotSize } from '../seed-data/shots'

const baseShot = {
  shotNumber: '01A',
  size: 'extreme_close_up' as ShotSize,
  status: 'planned' as const,
  sortOrder: 1,
  description: 'Fingers drawing a single drop from the bottle.',
}

const baseScene = {
  sceneNumber: '01',
  title: 'The Ritual',
  sortOrder: 1,
  description: 'Bathroom. Marble surfaces, soft window light.',
}

const tonePrimer = 'Project: Lumière Skincare. Soft window light, marble, amber glass.'

describe('humanizeShotSize', () => {
  it('maps each enum value to a natural-language phrase', () => {
    expect(humanizeShotSize('extreme_close_up')).toBe('extreme close-up')
    expect(humanizeShotSize('close_up')).toBe('close-up')
    expect(humanizeShotSize('medium_close_up')).toBe('medium close-up')
    expect(humanizeShotSize('medium')).toBe('medium shot')
    expect(humanizeShotSize('wide')).toBe('wide shot')
    expect(humanizeShotSize('full')).toBe('full shot')
    expect(humanizeShotSize('insert')).toBe('insert shot')
  })

  it('returns null for undefined size', () => {
    expect(humanizeShotSize(undefined)).toBeNull()
  })
})

describe('buildStoryboardPrompt', () => {
  it('contains tone primer, scene description, framing, action, and style suffix', () => {
    const prompt = buildStoryboardPrompt({
      shot: baseShot,
      scene: baseScene,
      tonePrimer,
    })
    expect(prompt).toContain(tonePrimer)
    expect(prompt).toContain(baseScene.description)
    expect(prompt).toContain('extreme close-up')
    expect(prompt).toContain(baseShot.description)
    expect(prompt).toContain('pencil storyboard sketch')
  })

  it('omits the framing line when shot.size is undefined', () => {
    const prompt = buildStoryboardPrompt({
      shot: { ...baseShot, size: undefined },
      scene: baseScene,
      tonePrimer,
    })
    expect(prompt).not.toContain('Shot framing:')
    expect(prompt).toContain(baseShot.description)
  })

  it('puts sections in the expected order', () => {
    const prompt = buildStoryboardPrompt({
      shot: baseShot,
      scene: baseScene,
      tonePrimer,
    })
    const primerIdx = prompt.indexOf(tonePrimer)
    const sceneIdx = prompt.indexOf('Scene context:')
    const framingIdx = prompt.indexOf('Shot framing:')
    const actionIdx = prompt.indexOf('Action:')
    const styleIdx = prompt.indexOf('Style:')
    expect(primerIdx).toBeLessThan(sceneIdx)
    expect(sceneIdx).toBeLessThan(framingIdx)
    expect(framingIdx).toBeLessThan(actionIdx)
    expect(actionIdx).toBeLessThan(styleIdx)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/db/src/seed-images/storyboard-prompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/db/src/seed-images/storyboard-prompt.ts`**

```ts
// Pure prompt assembly for storyboard generation. No Prisma, no Supabase,
// no filesystem. The future in-app route imports this module unchanged.
//
// Recipe (from spec §3): tone primer + scene context + shot framing +
// shot description + style suffix.

import type { SceneSeedRow } from '../seed-data/scenes'
import type { ShotSeedRow, ShotSize } from '../seed-data/shots'

const STYLE_SUFFIX =
  'pencil storyboard sketch, loose ink lines, monochrome graphite, ' +
  'hand-drawn, single panel, no text or numbers in the frame.'

export function humanizeShotSize(size: ShotSize | undefined): string | null {
  if (!size) return null
  switch (size) {
    case 'extreme_close_up': return 'extreme close-up'
    case 'close_up':         return 'close-up'
    case 'medium_close_up':  return 'medium close-up'
    case 'medium':           return 'medium shot'
    case 'wide':             return 'wide shot'
    case 'full':             return 'full shot'
    case 'insert':           return 'insert shot'
  }
  const _exhaustive: never = size
  throw new Error(`Unknown shot size: ${_exhaustive as string}`)
}

export type BuildStoryboardPromptArgs = {
  shot: ShotSeedRow
  scene: SceneSeedRow
  tonePrimer: string
}

export function buildStoryboardPrompt(args: BuildStoryboardPromptArgs): string {
  const { shot, scene, tonePrimer } = args
  const framing = humanizeShotSize(shot.size)

  const lines: string[] = []
  lines.push(tonePrimer)
  lines.push('')
  lines.push(`Scene context: ${scene.description}`)
  lines.push('')
  if (framing) {
    lines.push(`Shot framing: ${framing}.`)
    lines.push('')
  }
  lines.push(`Action: ${shot.description}`)
  lines.push('')
  lines.push(`Style: ${STYLE_SUFFIX}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run packages/db/src/seed-images/storyboard-prompt.test.ts
```

Expected: PASS — all tests including section ordering.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-images/storyboard-prompt.ts packages/db/src/seed-images/storyboard-prompt.test.ts
git commit -m "feat(db): add storyboard-prompt assembly

Pure function shared between the seed CLI (today) and the future
in-app regenerate route. Recipe from spec §3: tone primer, scene
context, shot framing, action, style suffix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Build `shot-entries.ts` deriver

**Files:**
- Create: `packages/db/src/seed-images/shot-entries.ts`

(No dedicated unit test — this is a thin loop over `SCENES` × `SHOTS` that's covered end-to-end by Task 12's smoke run. A unit test would just re-encode the loop.)

- [ ] **Step 1: Create `packages/db/src/seed-images/shot-entries.ts`**

```ts
// Derives storyboard entries from the seed-data tables. Each entry
// contains everything the fetch CLI needs to build a prompt and write
// the output file — without touching the database.

import { SCENES, type SceneSeedRow } from '../seed-data/scenes'
import { SHOTS, type ShotSeedRow } from '../seed-data/shots'
import { PROJECT_META } from './tone-primers'
import type { ProjectKey } from './paths'

export type StoryboardEntry = {
  projectKey: Exclude<ProjectKey, 'crew'>
  scene: SceneSeedRow
  shot: ShotSeedRow
  tonePrimer: string
  aspectRatio: string  // raw Project.aspectRatio (e.g. '16:9', '2.39:1')
  // localFilePath = `storyboard/<projectKey>/<sceneNumber>-<shotNumber>.jpg`
  // (relative to seed-images/files/)
  localRelativePath: string
}

export function listStoryboardEntries(): StoryboardEntry[] {
  const out: StoryboardEntry[] = []
  for (const projectKey of Object.keys(SCENES) as Array<Exclude<ProjectKey, 'crew'>>) {
    const meta = PROJECT_META[projectKey]
    for (const scene of SCENES[projectKey]) {
      const shotRows = SHOTS[projectKey][scene.sceneNumber] ?? []
      for (const shot of shotRows) {
        out.push({
          projectKey,
          scene,
          shot,
          tonePrimer: meta.primer,
          aspectRatio: meta.aspectRatio,
          localRelativePath: `storyboard/${projectKey}/${scene.sceneNumber}-${shot.shotNumber}.jpg`,
        })
      }
    }
  }
  return out
}
```

- [ ] **Step 2: Sanity-check the count**

Add a temporary throwaway script (or use `tsx -e`):

```bash
cd packages/db
pnpm exec tsx -e "import { listStoryboardEntries } from './src/seed-images/shot-entries'; console.log('count:', listStoryboardEntries().length)"
```

Expected: `count: 89` (or whatever number matches your seed shot total — should match Task 0's snapshot).

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed-images/shot-entries.ts
git commit -m "feat(db): derive storyboard entries from seed-data

listStoryboardEntries() iterates SCENES × SHOTS and produces one entry
per shot with everything the fetch CLI needs. No database connection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Extend `filter.ts` to accept `'storyboard'` and surface-only filters

The existing `parseOnly` requires `<projectKey>.<surface>.<slug>` form. For storyboards we want both project-scoped (`p1.storyboard`, `p1.storyboard.01A`) and cross-project (`storyboard`) shapes. Extend the parser to accept either a projectKey OR a surface as the first segment.

**Files:**
- Modify: `packages/db/src/seed-images/filter.ts`
- Modify: `packages/db/src/seed-images/filter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/db/src/seed-images/filter.test.ts`:

```ts
describe('parseOnly — storyboard surface', () => {
  it('parses storyboard.<projectKey>.<shotNumber>', () => {
    expect(parseOnly('p1.storyboard.01A')).toEqual({
      projectKey: 'p1', surface: 'storyboard', slug: '01A',
    })
  })

  it('parses surface-only filter "storyboard"', () => {
    expect(parseOnly('storyboard')).toEqual({ surface: 'storyboard' })
  })

  it('rejects surface-only filter for non-storyboard surfaces', () => {
    // Other surfaces are project-scoped today; only storyboard is
    // cross-project (one entry per shot, ~89 total).
    expect(() => parseOnly('cast')).toThrow(/projectKey/)
  })
})

describe('matchesOnly — storyboard surface', () => {
  it('matches by surface alone when filter has no projectKey', () => {
    const e1: ImageEntry = { projectKey: 'p1', surface: 'storyboard', slug: '01A', source: 'ai', matchByName: '' }
    const e2: ImageEntry = { projectKey: 'p2', surface: 'storyboard', slug: '01A', source: 'ai', matchByName: '' }
    const e3: ImageEntry = { projectKey: 'p1', surface: 'cast', slug: 'x', source: 'ai', matchByName: '' }
    expect(matchesOnly(e1, { surface: 'storyboard' })).toBe(true)
    expect(matchesOnly(e2, { surface: 'storyboard' })).toBe(true)
    expect(matchesOnly(e3, { surface: 'storyboard' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run packages/db/src/seed-images/filter.test.ts
```

Expected: FAIL — `OnlyFilter` requires `projectKey`; surface-only form not supported.

- [ ] **Step 3: Modify `filter.ts`**

Replace the file with:

```ts
import type { ImageEntry, ProjectKey, Surface } from './paths'

const VALID_PROJECT_KEYS: ReadonlySet<ProjectKey> = new Set(
  ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'crew'],
)
const VALID_SURFACES: ReadonlySet<Surface> = new Set(
  ['location', 'narrativeLocation', 'moodboard', 'prop', 'wardrobe', 'hmu', 'cast', 'avatar', 'storyboard'],
)

// Surface-only filters are allowed for surfaces that span multiple projects
// in a single run. Today only 'storyboard' qualifies (one entry per shot,
// fanned across all six demo projects).
const SURFACE_ONLY_ALLOWED: ReadonlySet<Surface> = new Set(['storyboard'])

export type OnlyFilter = {
  projectKey?: ProjectKey
  surface?: Surface
  slug?: string
}

export function parseOnly(raw: string | undefined): OnlyFilter | null {
  if (!raw) return null
  const parts = raw.split('.')
  const [first, second, third] = parts

  // Surface-only form: 'storyboard'
  if (VALID_SURFACES.has(first as Surface) && SURFACE_ONLY_ALLOWED.has(first as Surface) && parts.length === 1) {
    return { surface: first as Surface }
  }

  // Project-scoped form: 'p1' | 'p1.cast' | 'p1.cast.slug' | 'p1.storyboard.01A'
  if (!VALID_PROJECT_KEYS.has(first as ProjectKey)) {
    throw new Error(`Invalid projectKey "${first}" in --only filter. Expected one of: ${[...VALID_PROJECT_KEYS].join(', ')}`)
  }
  if (second !== undefined && !VALID_SURFACES.has(second as Surface)) {
    throw new Error(`Invalid surface "${second}" in --only filter. Expected one of: ${[...VALID_SURFACES].join(', ')}`)
  }
  return {
    projectKey: first as ProjectKey,
    surface: second as Surface | undefined,
    slug: third,
  }
}

export function matchesOnly(entry: ImageEntry, filter: OnlyFilter | null): boolean {
  if (!filter) return true
  if (filter.projectKey && entry.projectKey !== filter.projectKey) return false
  if (filter.surface && entry.surface !== filter.surface) return false
  if (filter.slug && entry.slug !== filter.slug) return false
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run packages/db/src/seed-images/filter.test.ts
```

Expected: PASS — all old + new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-images/filter.ts packages/db/src/seed-images/filter.test.ts
git commit -m "feat(db): allow 'storyboard' surface in parseOnly + surface-only filter

Adds 'storyboard' to the valid surface set and allows '--only=storyboard'
(surface-only) for cross-project bulk runs. Project-scoped forms still
work: --only=p1.storyboard, --only=p1.storyboard.01A.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Wire storyboard surface into `fetch-seed-images.ts`

**Files:**
- Modify: `packages/db/package.json` (add `sharp`, `p-limit`)
- Modify: `packages/db/scripts/fetch-seed-images.ts`

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/pawn/Code/origin-one
pnpm --filter @origin-one/db add sharp p-limit
```

Expected: both added to `packages/db/package.json` `dependencies`. (`sharp` ships with prebuilt binaries; on macOS arm64 this should just work.)

Sanity:
```bash
pnpm exec tsx -e "import sharp from 'sharp'; console.log(sharp.versions)"
```
Expected: prints version info.

- [ ] **Step 2: Modify `fetch-seed-images.ts` — add storyboard fetch path**

Open `packages/db/scripts/fetch-seed-images.ts` and make these additions/changes. Working from the existing structure:

Add imports near the top:

```ts
import sharp from 'sharp'
import pLimit from 'p-limit'
import { generateStoryboard } from '../src/seed-images/clients/bria'
import { briaAspect } from '../src/seed-images/bria-aspect'
import { buildStoryboardPrompt } from '../src/seed-images/storyboard-prompt'
import { listStoryboardEntries, type StoryboardEntry } from '../src/seed-images/shot-entries'
```

Add a Bria cost constant near the existing `AI_COST_USD_PER_IMAGE`:

```ts
const BRIA_COST_USD_PER_IMAGE = Number(process.env.BRIA_PRICE_PER_IMAGE_USD ?? '0.04')
const STORYBOARD_CONCURRENCY = 3
```

Extend `Flags`:

```ts
type Flags = {
  only?: string
  force: boolean
  dryRun: boolean
  smoke: boolean
  confirmSpend: boolean
  concurrency?: number
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { force: false, dryRun: false, smoke: false, confirmSpend: false }
  for (const a of argv) {
    if (a.startsWith('--only=')) flags.only = a.slice('--only='.length)
    else if (a === '--force') flags.force = true
    else if (a === '--dry-run') flags.dryRun = true
    else if (a === '--smoke') flags.smoke = true
    else if (a === '--confirm-spend') flags.confirmSpend = true
    else if (a.startsWith('--concurrency=')) flags.concurrency = Number(a.slice('--concurrency='.length))
    else if (a === '--help' || a === '-h') {
      console.log('Usage: db:fetch-images [--only=<filter>] [--force] [--dry-run] [--smoke] [--confirm-spend] [--concurrency=N]')
      process.exit(0)
    }
  }
  return flags
}
```

Extend `RunStats`:

```ts
type RunStats = {
  generated: number
  fetched: number
  storyboards: number
  skipped: number
  blocked: number
  failed: number
  estimatedSpendUsd: number
}
```

Add the storyboard fetch function:

```ts
async function fetchStoryboardEntry(entry: StoryboardEntry, flags: Flags, stats: RunStats): Promise<void> {
  const outPath = path.join(FILES_ROOT, entry.localRelativePath)
  await ensureDir(path.dirname(outPath))

  if (await fileExists(outPath) && !flags.force) {
    stats.skipped++
    return
  }

  if (flags.dryRun) {
    console.log(`  would generate: ${entry.localRelativePath}`)
    return
  }

  const prompt = buildStoryboardPrompt({
    shot: entry.shot,
    scene: entry.scene,
    tonePrimer: entry.tonePrimer,
  })
  const aspect = briaAspect(entry.aspectRatio)

  try {
    const start = Date.now()
    const { bytes: rawBytes } = await generateStoryboard({
      prompt,
      aspectRatio: aspect.request,
    })

    let finalBytes = rawBytes
    if (aspect.cropTo) {
      finalBytes = await cropToRatio(rawBytes, aspect.cropTo)
    }

    await writeAtomic(outPath, finalBytes)
    stats.storyboards++
    stats.estimatedSpendUsd += BRIA_COST_USD_PER_IMAGE
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  ✓ storyboard: ${entry.localRelativePath} (${elapsed}s)`)
  } catch (err) {
    stats.failed++
    console.error(`  ✗ storyboard: ${entry.localRelativePath} — ${(err as Error).message}`)
  }
}

async function cropToRatio(bytes: Buffer, ratio: string): Promise<Buffer> {
  // Center-crop to the target ratio. Bria delivers 16:9 source; we crop the
  // top/bottom for wider ratios like 2.39:1 and 1.85:1.
  const [w, h] = ratio.split(':').map(Number)
  const targetRatio = w / h
  const img = sharp(bytes)
  const meta = await img.metadata()
  if (!meta.width || !meta.height) throw new Error('cropToRatio: source has no dimensions')

  const sourceRatio = meta.width / meta.height
  if (Math.abs(sourceRatio - targetRatio) < 0.001) {
    return bytes
  }
  if (sourceRatio < targetRatio) {
    // Crop sides (target is wider than source — unusual for our case but handled).
    const newWidth = Math.round(meta.height * targetRatio)
    const left = Math.round((meta.width - newWidth) / 2)
    return img.extract({ left, top: 0, width: newWidth, height: meta.height }).jpeg().toBuffer()
  }
  // Source wider than target — crop top/bottom.
  const newHeight = Math.round(meta.width / targetRatio)
  const top = Math.round((meta.height - newHeight) / 2)
  return img.extract({ left: 0, top, width: meta.width, height: newHeight }).jpeg().toBuffer()
}
```

Add a `--smoke` short-circuit at the top of `main()`:

```ts
async function smokeRun(): Promise<void> {
  console.log('smoke: one Bria call with a fixed pencil-sketch prompt...')
  const { bytes } = await generateStoryboard({
    prompt: 'A simple pencil sketch of a cup of coffee on a wooden table, loose ink lines, monochrome graphite, hand-drawn.',
    aspectRatio: '16:9',
  })
  console.log(`  ✓ ok — ${bytes.length} bytes received`)
  console.log(`  Estimated cost: $${BRIA_COST_USD_PER_IMAGE.toFixed(2)}`)
}
```

Extend `main()` — at the start, after `parseArgs`, handle `--smoke`:

```ts
async function main() {
  const flags = parseArgs(process.argv.slice(2))

  if (flags.smoke) {
    await smokeRun()
    return
  }

  const filter = parseOnly(flags.only)
  const stats: RunStats = { generated: 0, fetched: 0, storyboards: 0, skipped: 0, blocked: 0, failed: 0, estimatedSpendUsd: 0 }
  await ensureDir(FILES_ROOT)

  // Existing-surface entries
  const manifestEntries = MANIFEST.filter((e) => matchesOnly(e, filter))

  // Storyboard entries (added when filter is null/storyboard-scoped)
  const wantsStoryboards =
    !filter ||
    filter.surface === 'storyboard' ||
    (filter.projectKey && (filter.surface === 'storyboard' || filter.surface === undefined))

  const storyboardEntries = wantsStoryboards
    ? listStoryboardEntries().filter(e =>
        (!filter?.projectKey || e.projectKey === filter.projectKey) &&
        (!filter?.slug || e.shot.shotNumber === filter.slug)
      )
    : []

  // Spend gate for bulk storyboard runs
  const isBulkStoryboardRun = storyboardEntries.length > 1 && !flags.dryRun
  if (isBulkStoryboardRun && !flags.confirmSpend) {
    const estUsd = (storyboardEntries.length * BRIA_COST_USD_PER_IMAGE).toFixed(2)
    console.error(`Refusing to run: ${storyboardEntries.length} storyboard generations would cost ~$${estUsd}.`)
    console.error(`Re-run with --confirm-spend to proceed, or scope with --only=p1.storyboard.<shotNumber> for single shots.`)
    process.exit(2)
  }

  console.log(
    `fetch-seed-images: ${manifestEntries.length} manifest + ${storyboardEntries.length} storyboards` +
    `${filter ? ` (filter: ${flags.only})` : ''}` +
    `${flags.force ? ' [force]' : ''}${flags.dryRun ? ' [dry-run]' : ''}`
  )

  // Manifest entries — sequential as before
  for (const entry of manifestEntries) {
    await fetchEntry(entry, flags, stats)
  }

  // Storyboard entries — bounded concurrency
  const limit = pLimit(flags.concurrency ?? STORYBOARD_CONCURRENCY)
  await Promise.all(
    storyboardEntries.map(e => limit(() => fetchStoryboardEntry(e, flags, stats)))
  )

  if (!flags.dryRun) {
    await writeCredits()
  }

  console.log('')
  console.log('  Summary:')
  console.log(`    generated (ai):    ${stats.generated}`)
  console.log(`    fetched (stock):   ${stats.fetched}`)
  console.log(`    storyboards:       ${stats.storyboards}`)
  console.log(`    skipped (cached):  ${stats.skipped}`)
  console.log(`    blocked:           ${stats.blocked}`)
  console.log(`    failed:            ${stats.failed}`)
  console.log(`    estimated spend:   $${stats.estimatedSpendUsd.toFixed(2)}`)

  process.exit(stats.failed > 0 ? 1 : 0)
}
```

- [ ] **Step 3: Smoke verify the wiring**

```bash
pnpm --filter @origin-one/db db:fetch-images --only=storyboard --dry-run
```

Expected: prints `89 storyboards (filter: storyboard) [dry-run]` (or whatever your shot count is) followed by 89 `would generate: storyboard/...` lines. No API calls.

```bash
pnpm --filter @origin-one/db db:fetch-images --only=p1.storyboard.01A --dry-run
```

Expected: prints `0 manifest + 1 storyboards`, one `would generate: storyboard/p1/01-01A.jpg` line.

- [ ] **Step 4: Commit (no API spend yet)**

```bash
git add packages/db/package.json packages/db/scripts/fetch-seed-images.ts
git commit -m "feat(db): wire storyboard surface into fetch CLI

- Adds sharp + p-limit dependencies
- New --smoke flag (one Bria call, ~\$0.04, verifies token + endpoint)
- New --confirm-spend gate (prevents accidental bulk re-runs)
- New --concurrency=N flag (default 3 for storyboards)
- 2.39:1 / 1.85:1 ratios generate at 16:9 + center-crop with sharp
- Storyboard entries derived from listStoryboardEntries() — no manifest growth

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Smoke + P1 visual gate (operator step, real money)

This is the first task that spends real money. ~$0.04 for the smoke, then ~$0.56 for a P1-only run (14 shots). Stop and look at output before fanning out to all 89.

- [ ] **Step 1: Confirm `BRIA_API_TOKEN` is set**

```bash
grep -c "^BRIA_API_TOKEN=." packages/db/.env
```

Expected: `1`. (Must equal 1 — empty value is `BRIA_API_TOKEN=` with no character after `=`, which the grep won't match.)

- [ ] **Step 2: Smoke run**

```bash
pnpm --filter @origin-one/db db:fetch-images --smoke
```

Expected: `✓ ok — <N> bytes received` and `Estimated cost: $0.04`.

If FAIL with 401/403: token wrong. Re-paste from platform.bria.ai.
If FAIL with 5xx after retries: Bria service issue. Wait, retry.
If FAIL with TypeError: network. Check connectivity.

- [ ] **Step 3: P1 visual gate (14 shots, ~$0.56)**

```bash
pnpm --filter @origin-one/db db:fetch-images --only=p1.storyboard --concurrency=1 --confirm-spend
```

Expected output ends with `storyboards: 14`.

Open the 14 generated files:

```bash
open packages/db/seed-images/files/storyboard/p1/
```

Eyeball each one. Acceptance criteria:
- Reads as a pencil sketch (not photoreal, not painterly).
- Recognizable composition matching the shot description (e.g., 01A "fingers drawing a single drop" should show a hand and a bottle).
- Scene-level coherence (all 5 shots from scene 01 share marble/bathroom feel).
- 16:9 framing.

If frames look bad: iterate the `STYLE_SUFFIX` constant in `storyboard-prompt.ts`, then `--force --only=p1.storyboard --concurrency=1 --confirm-spend` to regenerate. Don't fan out until P1 looks acceptable.

- [ ] **Step 4: Decide go / no-go**

If P1 looks good: proceed to Task 13.
If P1 looks bad after a few prompt iterations: STOP and discuss with the team — Bria may not be the right model for pencil-sketch storyboards. Don't burn $5 on bad output.

- [ ] **Step 5: Don't commit the P1 files yet**

P1 files might be re-generated in Task 13's full run anyway. Commit all storyboard files together at the end of Task 13.

---

## Task 13: Full storyboard fetch run

- [ ] **Step 1: Run the full fetch**

```bash
pnpm --filter @origin-one/db db:fetch-images --only=storyboard --confirm-spend
```

Expected:
- ~89 storyboards generated (P1's 14 will be skipped if not `--force`).
- Concurrency 3 (default).
- Total time ~2-5 minutes (depends on Bria latency).
- `failed: 0` ideally; some shots may need retry.

If any failures, re-run: failed shots have no file on disk and will be retried.

```bash
pnpm --filter @origin-one/db db:fetch-images --only=storyboard --confirm-spend
```

(Skips successes, retries the failures.)

- [ ] **Step 2: Spot-check a few projects visually**

```bash
open packages/db/seed-images/files/storyboard/p2/
open packages/db/seed-images/files/storyboard/p6/
```

P6 frames should be 2.39:1 (visibly wider, shorter than the 16:9 ones). If they're not: investigate the `cropToRatio` path.

- [ ] **Step 3: Commit the generated files**

```bash
git add packages/db/seed-images/files/storyboard/
git commit -m "seed-images: storyboard frames for all seeded shots (~89 images)

Generated by Bria via db:fetch-images --only=storyboard. Pencil-sketch
style. P1-P5 at 16:9, P6 at 2.39:1 (cropped from 16:9 source).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Upload storyboards in `prisma/seed.ts` and set `Shot.imageUrl`

**Files:**
- Modify: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Add storyboard upload step to seed.ts**

Find the section in `seed.ts` where other surface uploads happen (search for `uploadSeedImage` calls, especially the moodboard / EntityAttachment uploads). Add a new section after all `Shot` rows are created and after other image uploads:

```ts
import { listStoryboardEntries } from '../src/seed-images/shot-entries'
import { uploadSeedImage, FILES_ROOT } from '../src/seed-images/uploader'
import { bucketForSurface } from '../src/seed-images/paths'
import { existsSync } from 'node:fs'
import * as path from 'node:path'

// ...somewhere after shots are created, late in seed.ts, before the final logs:

console.log('Uploading storyboard images...')
let storyboardUploads = 0
let storyboardSkipped = 0
const storyboardEntries = listStoryboardEntries()
for (const entry of storyboardEntries) {
  const localPath = path.join(FILES_ROOT, entry.localRelativePath)
  if (!existsSync(localPath)) {
    console.warn(
      `  skip: ${entry.localRelativePath} not on disk. ` +
      `Run \`pnpm db:fetch-images --only=${entry.projectKey}.storyboard.${entry.shot.shotNumber} --confirm-spend\``,
    )
    storyboardSkipped++
    continue
  }

  // Find the Shot row this entry corresponds to.
  const sceneRow = await prisma.scene.findFirst({
    where: {
      sceneNumber: entry.scene.sceneNumber,
      project: { name: PROJECT_NAME_BY_KEY[entry.projectKey] },
    },
  })
  if (!sceneRow) {
    console.warn(`  skip: scene ${entry.projectKey}/${entry.scene.sceneNumber} not found in DB`)
    storyboardSkipped++
    continue
  }
  const shotRow = await prisma.shot.findFirst({
    where: { sceneId: sceneRow.id, shotNumber: entry.shot.shotNumber },
  })
  if (!shotRow) {
    console.warn(`  skip: shot ${entry.projectKey}/${entry.scene.sceneNumber}/${entry.shot.shotNumber} not found in DB`)
    storyboardSkipped++
    continue
  }

  const filename = `${entry.scene.sceneNumber}-${entry.shot.shotNumber}.jpg`
  const storagePath = `${shotRow.id}/${filename}`
  await uploadSeedImage({
    localRelativePath: entry.localRelativePath,
    bucket: bucketForSurface('storyboard'),
    storagePath,
  })

  // Compose the public URL the same way other surfaces do (see commit 5c664f4).
  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/storyboard/${storagePath}`
  await prisma.shot.update({
    where: { id: shotRow.id },
    data: { imageUrl: publicUrl },
  })
  storyboardUploads++
}
console.log(`  Storyboards uploaded: ${storyboardUploads}, skipped: ${storyboardSkipped}`)
```

Add the project-name lookup table near the top of `seed.ts` (or use whatever existing project name → projectKey mapping you find — there may already be one):

```ts
const PROJECT_NAME_BY_KEY: Record<Exclude<import('../src/seed-images/paths').ProjectKey, 'crew'>, string> = {
  p1: 'Simple Skin Promo',
  p2: 'Full Send',
  p3: 'In Vino Veritas',
  p4: 'Flexibility Course A',
  p5: 'Natural Order',
  p6: 'The Weave',
}
```

(If the project names don't match these exact strings, fix to match `seed.ts`'s actual `name:` values.)

- [ ] **Step 2: Run seed end-to-end**

```bash
pnpm --filter @origin-one/db db:reset
pnpm --filter @origin-one/db db:seed
```

Expected:
- Existing seed flow runs.
- New "Uploading storyboard images..." section runs.
- "Storyboards uploaded: 89, skipped: 0" (or close to it).

If `skipped > 0`: a shot in seed-data doesn't have a corresponding row in DB, or the file wasn't generated. Investigate.

- [ ] **Step 3: Verify in Prisma Studio (or psql)**

```bash
pnpm --filter @origin-one/db prisma studio
```

Open `Shot` table. Sort by any field. Confirm most rows have a non-null `imageUrl` matching the pattern `https://<ref>.supabase.co/storage/v1/object/public/storyboard/<shotId>/<sceneNumber>-<shotNumber>.jpg`.

- [ ] **Step 4: Verify in browser**

```bash
pnpm --filter back-to-one dev
```

Open a project's scenemaker. Each shot tile should now display the generated storyboard frame instead of the placeholder. P6 tiles should be 2.39:1.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(db): upload storyboards and set Shot.imageUrl in seed

After all shot rows are created, iterate listStoryboardEntries() and
upload each on-disk storyboard frame to the storyboard bucket. Skip
gracefully if the file is missing — partial seed is fine.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Final end-to-end check + housekeeping

- [ ] **Step 1: Run the whole vitest suite**

```bash
pnpm vitest run
```

Expected: all tests pass — including the new bria, bria-aspect, storyboard-prompt, aspect-ratio, paths, filter tests.

- [ ] **Step 2: Type-check the whole monorepo**

```bash
pnpm -w type-check
```

Expected: no errors.

- [ ] **Step 3: Build all apps**

```bash
pnpm -w build
```

Expected: success — per CLAUDE.md "Apps compile check across all three before merging any schema PR" (this isn't a schema PR but the same rigor applies for cross-app safety).

- [ ] **Step 4: Final visual check in browser**

```bash
pnpm --filter back-to-one dev
```

For each of the 6 projects:
- Open scenemaker.
- All shot tiles render with their storyboard image.
- Shot detail sheet shows the image at the correct aspect ratio.
- PDF export includes the image at the correct aspect ratio.
- P6 (The Weave) renders 2.39:1 throughout.

- [ ] **Step 5: Update CLAUDE.md if needed**

If the team has been told "no per-shot storyboards in seed" anywhere in `BUILD_STATUS.md` or other docs, update those notes to reflect that storyboards are now seeded.

- [ ] **Step 6: Final summary commit (if any small fixes from Step 4 needed)**

If everything passed cleanly with no follow-up edits, no commit needed. Otherwise:

```bash
git add <whatever changed>
git commit -m "fix(...): <one-liner from final check>"
```

---

## Out of plan (tracked for follow-up)

These were explicitly deferred per the spec — file as separate work, not in this arc:

1. **In-app `/api/shots/[id]/generate-storyboard` route.** The pure-function modules (`bria.ts`, `storyboard-prompt.ts`) are ready for it.
2. **`Shot.storyboardPromptOverride` field.** YAGNI until we see real bad frames in production usage.
3. **`storyboard` bucket RLS tightening.** Deferred to the #24 RLS pass with the other permissive buckets at Auth day.
4. **Character/entity NER in prompt assembly (Recipe D).** Bumps quality but adds real engineering — observe coherence quality first.
