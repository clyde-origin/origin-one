# Hub — Production / Creative Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on sub-agents in this environment:** Local sub-agents proved unreliable during the Cinema Glass arc (5 of 7 stalled silently). Prefer inline execution; if you need parallel implementation, dispatch via user-driven Claude Code shells (paste the per-task brief into a fresh shell) rather than the Agent tool.

**Spec:** `docs/superpowers/specs/2026-05-03-hub-production-creative-toggle-design.md`

**Goal:** Refactor the Project Hub from a single stacked screen into two toggleable surfaces — Production and Creative — gated behind `?hub=split` so the new layout is opt-in until validated.

**Architecture:** `HubContent.tsx` becomes a shell that mounts a `HubModeToggle` in the `.hub-topbar` and renders both surfaces side-by-side in a 200%-wide flex strip clipped by `.hub-stage`. `mode === 'creative'` translates the strip `-50%` with a 420ms cubic-bezier transition. Each surface owns its own `useFabAction` registration; the active surface's branches win in the ActionBar context. Mode persists per-project via `localStorage` key `hub-mode:${projectId}` through a new `useHubMode` hook. Pure visual restructure — no schema changes, no new queries, no new sheets.

**Tech Stack:** Next.js 14 (App Router, client components), React, React Query (already wired via existing hooks), Framer Motion (already in the codebase for animations), Tailwind + inline styles + plain CSS in `globals.css`. Uses existing cinema-glass classes (`.glass-tile`, `.sheen-title`, `.hub-topbar`, `.ai-meta-pill`, `.sk-*`); adds one new class pair (`.hub-toggle` / `.hub-toggle-btn`).

**Note on testing:** This codebase intentionally tests only pure utilities — JSX/jsdom for React components is deferred per `vitest.config.ts`. The new `useHubMode` hook is pure-ish (state + localStorage) and gets a unit test. The components get TypeScript + a documented manual smoke checklist per task. Final gate is `pnpm -w build` succeeding across all three apps + the spec's Verification section walked through in the browser.

---

## Pre-flight notes (read before starting)

1. **Branch & worktree.** This work lives on a NEW branch off current `main` (post-#154). The spec branch (`feat/hub-mode-toggle-spec`) carries this plan + the spec doc. Create a separate implementation branch off `main`:
   ```bash
   cd /Users/pawn/Code/origin-one
   git fetch origin
   git worktree add -b feat/hub-mode-toggle-impl .worktrees/hub-toggle-impl origin/main
   cd .worktrees/hub-toggle-impl
   ```
   All file paths in this plan are relative to `apps/back-to-one/`.

2. **Read first (no edits — pure orientation).**
   - The spec end-to-end: `docs/superpowers/specs/2026-05-03-hub-production-creative-toggle-design.md`
   - Current Hub: `apps/back-to-one/src/components/hub/HubContent.tsx` (~1086 lines — stacked layout, today's source of truth)
   - FAB context: `apps/back-to-one/src/lib/contexts/FabActionContext.tsx` — note `useFabAction(action, deps)` signature at line 123; deps array drives re-registration
   - Reference HTML pattern: `apps/back-to-one/reference/hub-full-preview-v2.html` (the design-locked Cinema Glass spec, ~16K lines, all 46 phones)
   - Existing scenemaker toggle CSS: `apps/back-to-one/src/styles/globals.css:525-552` — pattern reference for the new `.hub-toggle` class pair
   - Existing `SwipeableSceneMaker` in `HubContent.tsx:99-` — what the new triple toggle replaces
   - Existing `CreateCreativeSheet` in `apps/back-to-one/src/components/create/` — what the new Creative FAB branches replace (picker becomes redundant)

3. **Memory rules to honor.**
   - "Hub panel shapes are sacred" → don't modify `SwipePanel` wrapper for the Loc/Cast/Art row.
   - "Design refreshes are visual-only" → no copy / control / data-flow changes.
   - "Verify branch before commit" → run `git status -sb` before every commit (parallel sessions can switch branches externally on shared worktrees).

4. **Two-PR rollout (per spec).** This implementation work + the reference HTML mockup land together as one PR (the user's clarified two-PR plan: spec PR + impl PR). The spec branch carries the spec + this plan; this branch carries the reference HTML + implementation. The new layout is gated behind `?hub=split` so the old stacked Hub stays default until a follow-up flips the gate.

---

## File map

**Create:**
- `apps/back-to-one/reference/hub-production-creative-toggle.html` — high-fidelity Cinema Glass mockup matching the v4 prototype (toggle uses project accent, not mode-tinted)
- `apps/back-to-one/src/components/hub/HubProductionSurface.tsx` — Timeline / Action Items / Crew / Inventory / Workflow / Budget. Owns its `useFabAction` registration.
- `apps/back-to-one/src/components/hub/HubCreativeSurface.tsx` — One Arc triple toggle + active panel / Tone / Loc-Cast-Art. Owns its `useFabAction` registration.
- `apps/back-to-one/src/components/hub/HubModeToggle.tsx` — Binary segmented toggle bound to `useHubMode`.
- `apps/back-to-one/src/components/hub/HubArcToggle.tsx` — Triple segmented toggle (Script / Shotlist / Storyboard), local state inside `HubCreativeSurface`.
- `apps/back-to-one/src/lib/hooks/useHubMode.ts` — `(projectId) → { mode, setMode }`, persists to `localStorage` key `hub-mode:${projectId}`, defaults to `'production'`.
- `apps/back-to-one/src/lib/hooks/useHubMode.test.ts` — vitest unit test for the hook (pure-ish, deserves a test).

**Modify:**
- `apps/back-to-one/src/components/hub/HubContent.tsx` — refactor from stacked layout to thin shell + `<HubStage>` mounting both surfaces. Read `?hub=split` from URL; if absent, render the existing stacked layout unchanged (the gate). If present, render the new shell.
- `apps/back-to-one/src/styles/globals.css` — append the `.hub-toggle` / `.hub-toggle-btn` class pair + `.hub-stage` / `.hub-surfaces` slide-stage rules in a `/* ===== Hub split toggle ===== */` block at the END of the file.

---

## Task 0: Worktree + branch setup

**Files:** none (just git operations)

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/pawn/Code/origin-one
git fetch origin
git worktree add -b feat/hub-mode-toggle-impl .worktrees/hub-toggle-impl origin/main
cd .worktrees/hub-toggle-impl
```

- [ ] **Step 2: Verify**

Run: `git status -sb`
Expected: `## feat/hub-mode-toggle-impl`, no uncommitted files.

- [ ] **Step 3: Confirm base**

Run: `git log -1 --oneline`
Expected: tip is at or descendant of `6d31011 fix(wiring): post-Cinema-Glass affordance fixes (V2.2) (#154)`.

No commit yet for this task — it's branch setup only.

---

## Task 1: Reference HTML mockup

**Files:**
- Create: `apps/back-to-one/reference/hub-production-creative-toggle.html`

- [ ] **Step 1: Establish the file**

Mockup is a single self-contained HTML file matching the v4 prototype with the cinema-glass adjustment (toggle is project-accent, not mode-tinted). It lives next to `hub-full-preview-v2.html` and serves as the visual contract per the project rule "Reference file is the spec. Match it exactly unless there is a documented reason not to."

Create the file with this structure (fill in scene contents to match the spec's surface contents — Production = Timeline / Action Items / Crew / Inventory / Workflow / Budget; Creative = One Arc triple toggle + active panel / Tone / Loc-Cast-Art):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Hub — Production / Creative Toggle</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* Inline cinema-glass tokens — mirrors apps/back-to-one/src/styles/globals.css */
:root {
  --bg: #04040a;
  --fg: #dddde8;
  --fg-mono: #62627a;
  --border: rgba(255, 255, 255, 0.06);
  --accent-rgb: 196, 90, 220;            /* default project accent */
  --tile-rgb: 196, 90, 220;
  --accent-glow-rgb: 220, 130, 240;
  --phase-pre: #e8a020;
  --phase-prod: #6470f3;
  --phase-post: #00b894;
  --safe-top: 0px;
  --safe-bottom: 0px;
}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  background: var(--bg);
  font-family: 'Geist', sans-serif;
  color: var(--fg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 12px 64px;
  gap: 18px;
}
.phone {
  width: 358px;
  min-height: 760px;
  background: var(--bg);
  border-radius: 32px;
  border: 1px solid var(--border);
  overflow: hidden;
  position: relative;
}
/* ... (replicate cinema-glass classes used: .hub-topbar, .glass-tile, .sheen-title, .ai-meta-pill, .sk-line, etc. — copy from globals.css in current repo)

   New class pair to mock here exactly as it'll land in code: */
.hub-toggle {
  position: relative;
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  user-select: none;
}
.hub-toggle-btn {
  flex-grow: 1;
  flex-basis: 0;
  text-align: center;
  font-family: 'Geist Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-weight: 500;
  padding: 7px 8px;
  border-radius: 999px;
  background: transparent;
  border: none;
  color: var(--fg-mono);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  transition:
    flex-grow 380ms cubic-bezier(.4, 0, .2, 1),
    background 380ms ease,
    box-shadow 380ms ease,
    color 280ms ease;
}
.hub-toggle-btn.active {
  flex-grow: 1.6;
  background: rgba(var(--accent-rgb, 196, 90, 220), 0.18);
  color: rgb(var(--accent-rgb, 196, 90, 220));
  font-weight: 600;
  box-shadow: 0 0 12px -4px rgba(var(--accent-rgb, 196, 90, 220), 0.32);
}
</style>
</head>
<body>

<!-- TWO PHONES side-by-side: one in Production mode, one in Creative mode.
     Each phone shows the .hub-topbar (project name, type+status pill, crew avatars)
     followed by the .hub-toggle (binary), then the surface contents stacked. -->

<div class="phone">
  <!-- Production view — see spec section "Surface contents (locked)" -->
  <!-- topbar... toggle (Production active)... Timeline gantt... ActionItemsPreview...
       Crew 3-tile preview... Inventory chips strip... Workflow 5-node chain... Budget row -->
</div>

<div class="phone">
  <!-- Creative view -->
  <!-- topbar... toggle (Creative active)... HubArcToggle (Script active by default)...
       active One Arc panel (script preview)... Tone full-width... 3-up Loc/Cast/Art -->
</div>

</body>
</html>
```

**Reference for the scene contents:** lift section anatomy directly from `apps/back-to-one/reference/hub-full-preview-v2.html` Hub phone (#5). The new mockup differs only in (a) toggle row added, (b) Budget row moves to bottom of Production, (c) Creative view shows the One Arc triple toggle + Tone + Loc/Cast/Art instead of the stacked sequence.

- [ ] **Step 2: Verify the file opens cleanly**

Run: `open apps/back-to-one/reference/hub-production-creative-toggle.html`
Expected: macOS opens it in the default browser. Visual fidelity: project-accent toggle (violet by default), Production phone shows Timeline gantt at top with Budget at bottom, Creative phone shows the One Arc triple toggle with Script panel below. Both phones use cinema-glass tokens (dark bg, muted mono labels, accent glow).

- [ ] **Step 3: Stage**

```bash
git add apps/back-to-one/reference/hub-production-creative-toggle.html
```

(Do not commit yet — bundle the reference HTML with the implementation work in one PR per the user's two-PR plan. Plan ahead: all changes commit at the end of Task 9.)

---

## Task 2: `useHubMode` hook (with unit test)

**Files:**
- Create: `apps/back-to-one/src/lib/hooks/useHubMode.ts`
- Create: `apps/back-to-one/src/lib/hooks/useHubMode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/back-to-one/src/lib/hooks/useHubMode.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('useHubMode storage helpers', () => {
  const projectId = 'p-test-123'
  const KEY = `hub-mode:${projectId}`

  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('readHubMode returns null when no value stored', async () => {
    const { readHubMode } = await import('./useHubMode')
    expect(readHubMode(projectId)).toBeNull()
  })

  it('writeHubMode persists to localStorage under the project-namespaced key', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode(projectId, 'creative')
    expect(localStorage.getItem(KEY)).toBe('creative')
    expect(readHubMode(projectId)).toBe('creative')
  })

  it('writeHubMode rejects invalid values defensively', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode(projectId, 'creative')
    // @ts-expect-error testing runtime guard
    writeHubMode(projectId, 'bogus')
    expect(readHubMode(projectId)).toBe('creative')
  })

  it('different projectIds get independent values', async () => {
    const { writeHubMode, readHubMode } = await import('./useHubMode')
    writeHubMode('a', 'creative')
    writeHubMode('b', 'production')
    expect(readHubMode('a')).toBe('creative')
    expect(readHubMode('b')).toBe('production')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @origin-one/back-to-one test useHubMode --run`
Expected: FAIL — `Cannot find module './useHubMode'` (file doesn't exist yet).

- [ ] **Step 3: Implement the hook**

Create `apps/back-to-one/src/lib/hooks/useHubMode.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'

export type HubMode = 'production' | 'creative'
const VALID: ReadonlySet<HubMode> = new Set(['production', 'creative'])
const keyFor = (projectId: string) => `hub-mode:${projectId}`

/** Pure helper — read the persisted mode for a project (null if unset / invalid). */
export function readHubMode(projectId: string): HubMode | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(keyFor(projectId))
  return v && VALID.has(v as HubMode) ? (v as HubMode) : null
}

/** Pure helper — persist a mode for a project. Silently rejects invalid values. */
export function writeHubMode(projectId: string, mode: HubMode): void {
  if (typeof window === 'undefined') return
  if (!VALID.has(mode)) return
  window.localStorage.setItem(keyFor(projectId), mode)
}

/**
 * Hub mode state for a project, persisted per-project to localStorage.
 * Defaults to 'production' on first load. The setter writes through to
 * storage immediately so a hard reload restores the last-used mode.
 */
export function useHubMode(projectId: string): {
  mode: HubMode
  setMode: (next: HubMode) => void
} {
  const [mode, setModeState] = useState<HubMode>('production')

  // Hydrate from localStorage on mount + when projectId changes.
  useEffect(() => {
    const stored = readHubMode(projectId)
    if (stored) setModeState(stored)
    else setModeState('production')
  }, [projectId])

  const setMode = useCallback((next: HubMode) => {
    setModeState(next)
    writeHubMode(projectId, next)
  }, [projectId])

  return { mode, setMode }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @origin-one/back-to-one test useHubMode --run`
Expected: PASS — all four tests green.

- [ ] **Step 5: Stage**

```bash
git add apps/back-to-one/src/lib/hooks/useHubMode.ts apps/back-to-one/src/lib/hooks/useHubMode.test.ts
```

(No commit yet — bundle at Task 9.)

---

## Task 3: CSS — `.hub-toggle` / `.hub-toggle-btn` class pair + `.hub-stage` slide

**Files:**
- Modify: `apps/back-to-one/src/styles/globals.css` — append at the END of the file

- [ ] **Step 1: Append the new class block**

Append this block at the END of `apps/back-to-one/src/styles/globals.css`:

```css
/* ===== Hub split toggle (PR: feat/hub-mode-toggle-impl) =====
   Hub-scoped segmented toggle. Used by HubModeToggle (binary)
   and HubArcToggle (ternary). Active button stretches to take
   more centered space; inactive buttons compress aside. Active
   treatment matches .scenemaker-toggle-btn.active — project
   accent fill, accent text. */
.hub-toggle {
  position: relative;
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  user-select: none;
}
body.light-mode .hub-toggle, html.light-mode body .hub-toggle {
  background: rgba(60, 38, 14, 0.04);
}
.hub-toggle-btn {
  flex-grow: 1;
  flex-basis: 0;
  text-align: center;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-weight: 500;
  padding: 7px 8px;
  border-radius: 999px;
  background: transparent;
  border: none;
  color: var(--fg-mono);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  transition:
    flex-grow 380ms cubic-bezier(.4, 0, .2, 1),
    background 380ms ease,
    box-shadow 380ms ease,
    color 280ms ease;
}
.hub-toggle-btn.active {
  flex-grow: 1.6;
  background: rgba(var(--accent-rgb, 196, 90, 220), 0.18);
  color: rgb(var(--accent-rgb, 196, 90, 220));
  font-weight: 600;
  box-shadow: 0 0 12px -4px rgba(var(--accent-rgb, 196, 90, 220), 0.32);
}

/* Slide stage — clips the 200%-wide flex strip below.
   `.hub-surfaces` is `display: flex; width: 200%`; each child surface
   has `width: 50%` and its own `overflow-y: auto` so scroll positions
   are preserved across mode toggles. mode === 'creative' adds
   transform: translateX(-50%) on .hub-surfaces. */
.hub-stage {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.hub-surfaces {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 420ms cubic-bezier(.4, 0, .2, 1);
}
.hub-surfaces.creative {
  transform: translateX(-50%);
}
.hub-surface {
  width: 50%;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
/* ===== end Hub split toggle ===== */
```

- [ ] **Step 2: Visual sanity check (optional but cheap)**

Run: `open apps/back-to-one/reference/hub-production-creative-toggle.html`
Expected: the reference HTML's toggle visuals match what you'd get from the CSS above (active stretches to ~62% width, accent fill, glow shadow). If the reference and CSS disagree, the CSS is canonical — fix the reference HTML.

- [ ] **Step 3: Stage**

```bash
git add apps/back-to-one/src/styles/globals.css
```

(No commit yet — bundle at Task 9.)

---

## Task 4: `HubModeToggle` component

**Files:**
- Create: `apps/back-to-one/src/components/hub/HubModeToggle.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/back-to-one/src/components/hub/HubModeToggle.tsx`:

```tsx
'use client'

import type { HubMode } from '@/lib/hooks/useHubMode'

interface Props {
  mode: HubMode
  onChange: (next: HubMode) => void
}

const SEGMENTS: ReadonlyArray<{ value: HubMode; label: string }> = [
  { value: 'production', label: 'Production' },
  { value: 'creative',   label: 'Creative' },
]

/**
 * Binary segmented toggle between Production and Creative modes.
 * Renders inside the .hub-topbar. Stateless — parent owns the mode
 * via useHubMode().
 */
export function HubModeToggle({ mode, onChange }: Props) {
  return (
    <div className="hub-toggle" role="tablist" aria-label="Hub mode">
      {SEGMENTS.map(seg => (
        <button
          key={seg.value}
          type="button"
          role="tab"
          aria-selected={mode === seg.value}
          className={`hub-toggle-btn${mode === seg.value ? ' active' : ''}`}
          onClick={() => onChange(seg.value)}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `pnpm --filter @origin-one/back-to-one type-check`
Expected: clean (no errors introduced by this file).

- [ ] **Step 3: Manual smoke (deferred until Task 9 wires it up)**

Documented manual smoke (run after Task 9 lands HubContent shell):
- Toggle renders with two buttons, "Production" + "Creative".
- Active button stretches; inactive compresses.
- Click flips active state; transition is smooth (~380ms).
- aria-selected updates.

- [ ] **Step 4: Stage**

```bash
git add apps/back-to-one/src/components/hub/HubModeToggle.tsx
```

---

## Task 5: `HubArcToggle` component

**Files:**
- Create: `apps/back-to-one/src/components/hub/HubArcToggle.tsx`

- [ ] **Step 1: Implement the component**

Create `apps/back-to-one/src/components/hub/HubArcToggle.tsx`:

```tsx
'use client'

export type ArcMode = 'script' | 'shotlist' | 'storyboard'

interface Props {
  mode: ArcMode
  onChange: (next: ArcMode) => void
}

const SEGMENTS: ReadonlyArray<{ value: ArcMode; label: string }> = [
  { value: 'script',     label: 'Script' },
  { value: 'shotlist',   label: 'Shotlist' },
  { value: 'storyboard', label: 'Storyboard' },
]

/**
 * Triple segmented toggle for the One Arc preview within the Creative
 * surface. Local state — does NOT persist; each visit starts at 'script'.
 */
export function HubArcToggle({ mode, onChange }: Props) {
  return (
    <div className="hub-toggle" role="tablist" aria-label="One Arc mode">
      {SEGMENTS.map(seg => (
        <button
          key={seg.value}
          type="button"
          role="tab"
          aria-selected={mode === seg.value}
          className={`hub-toggle-btn${mode === seg.value ? ' active' : ''}`}
          onClick={() => onChange(seg.value)}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `pnpm --filter @origin-one/back-to-one type-check`
Expected: clean.

- [ ] **Step 3: Stage**

```bash
git add apps/back-to-one/src/components/hub/HubArcToggle.tsx
```

---

## Task 6: `HubProductionSurface` component

**Files:**
- Create: `apps/back-to-one/src/components/hub/HubProductionSurface.tsx`
- Reference (read-only): `apps/back-to-one/src/components/hub/HubContent.tsx` — copy the existing render branches for Timeline / ActionItemsPreview / Crew preview / Inventory chips / Workflow chain / Budget row

- [ ] **Step 1: Implement the surface**

The Production surface owns the render branches that today live inside `HubContent.tsx` for Timeline+Budget peers (line ~570), Action Items preview (~720), Crew strip (~510), Inventory dept chips (~945), Workflow chain (~1015), and Budget tile (~616). Lift each block VERBATIM (same JSX, same styles, same data sources via the hooks the parent passes in as props) — only restructuring is:

- **Timeline becomes full width** (was peer-of-Budget; spec section "Production surface" item 1).
- **Budget moves to the bottom** as a full-width row card; producer-only via the existing `useViewerRole(projectId) === 'producer'` gate (spec item 6).

Create `apps/back-to-one/src/components/hub/HubProductionSurface.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { useViewerRole } from '@/lib/auth/useViewerRole'
import type {
  ActionItem, Milestone, CrewMember, /* …add types as referenced from HubContent today */
} from '@/types'

interface Props {
  /** Whether this surface is the active one — gates FAB registration to win the context. */
  active: boolean
  projectId: string
  projectColor: string
  // Pass through the same data already fetched in HubContent so we don't refetch.
  // (HubContent already does the queries; just thread the slices both surfaces need.)
  // …signature mirrors what HubContent today reads from its hooks.
}

/**
 * Production surface — Timeline / Action Items / Crew / Inventory / Workflow / Budget.
 * Layout per spec section "Surface contents — Production".
 */
export function HubProductionSurface(props: Props) {
  const router = useRouter()
  const isProducer = useViewerRole(props.projectId) === 'producer'

  // Local sheet state lifted from HubContent for any sheets this surface owns
  // (e.g. CreateTaskSheet, CreateMilestoneSheet, InviteCrewSheet) — keep
  // exactly the same trigger pattern.

  // FAB registration — only the active surface's branches are non-empty,
  // so the active surface wins in the ActionBar context.
  useFabAction({
    branches: active ? [
      { label: 'Action',    color: '#e8a020',         icon: <CheckCircle/>,  action: () => setShowCreateTask(true) },
      { label: 'Milestone', color: props.projectColor, icon: <MilestoneBar/>, action: () => setShowCreateMilestone(true) },
      { label: 'Crew',      color: '#00b894',         icon: <Person/>,        action: () => setInviteCrewOpen(true) },
    ] : [],
  }, [active, props.projectColor])

  return (
    <div className="hub-surface" data-mode="production">
      {/* 1. Timeline — full width */}
      {/* 2. My Action Items */}
      {/* 3. Crew preview row */}
      {/* 4. Inventory featured chips strip */}
      {/* 5. Workflow 5-node chain */}
      {/* 6. Budget — full-width row, producer-only */}
    </div>
  )
}
```

**Implementation note:** the actual JSX for each block is in `HubContent.tsx` today (look up the line numbers above). Lift each block one at a time, preserving every existing className / style / data prop. The order of blocks changes from today (Timeline/Budget peers → Action Items → Creative → Inventory → Workflow) to the spec's order (Timeline full / Action Items / Crew / Inventory / Workflow / Budget). Crew preview is currently absent as a tile on the Hub — its 3-tile row taps to open the existing `CrewPanel`; if the wiring isn't there yet, copy the affordance from `apps/back-to-one/src/components/hub/CrewPanel.tsx` open trigger.

The `Props` interface should include exactly the data slices this surface uses (action items, milestones, shoot days, crew members, inventory items, workflow nodes, budget). Mirror what `HubContent` reads from `useActionItems`, `useShootDays`, `useCrew`, `useInventoryItems`, `useWorkflowNodes`, `useBudget` today — pass the results in as props from the parent shell so neither surface refetches.

- [ ] **Step 2: Type check**

Run: `pnpm --filter @origin-one/back-to-one type-check`
Expected: clean. If any block references a type or helper not exported, add the import.

- [ ] **Step 3: Manual smoke (deferred until Task 9)**

After the shell wires this surface in, verify each block renders identically to today's stacked Hub for Vanta (a project with full data).

- [ ] **Step 4: Stage**

```bash
git add apps/back-to-one/src/components/hub/HubProductionSurface.tsx
```

---

## Task 7: `HubCreativeSurface` component

**Files:**
- Create: `apps/back-to-one/src/components/hub/HubCreativeSurface.tsx`
- Reference (read-only): `apps/back-to-one/src/components/hub/HubContent.tsx` — copy the SwipePanel block for Loc/Cast/Art (~line 800+) and the Tone preview block

- [ ] **Step 1: Implement the surface**

Create `apps/back-to-one/src/components/hub/HubCreativeSurface.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFabAction } from '@/lib/contexts/FabActionContext'
import { HubArcToggle, type ArcMode } from './HubArcToggle'
// Reuse existing pieces; do NOT modify SwipePanel (memory rule: panel shapes are sacred).
import { SwipePanel } from './SwipePanel'

interface Props {
  active: boolean
  projectId: string
  // pass through scenes/shots/moodRefs/locations/cast/art slices from parent (no refetch)
}

/**
 * Creative surface — One Arc triple toggle + active panel / Tone /
 * Loc-Cast-Art SwipePanel row. Layout per spec section "Surface
 * contents — Creative".
 */
export function HubCreativeSurface(props: Props) {
  const router = useRouter()
  const [arcMode, setArcMode] = useState<ArcMode>('script')

  useFabAction({
    branches: props.active ? [
      { label: 'Scene', color: '#6470f3', icon: <Filmstrip/>,  action: () => router.push(`/projects/${props.projectId}/scenemaker?mode=script`)   },
      { label: 'Shot',  color: '#6470f3', icon: <ShotFrame/>,  action: () => router.push(`/projects/${props.projectId}/scenemaker?mode=shotlist`) },
      { label: 'Tone',  color: '#6470f3', icon: <ToneSwatch/>, action: () => router.push(`/projects/${props.projectId}/moodboard`)               },
    ] : [],
  }, [props.active, props.projectId])

  return (
    <div className="hub-surface" data-mode="creative">
      {/* 1. HubArcToggle (triple) at the top */}
      <HubArcToggle mode={arcMode} onChange={setArcMode} />

      {/* Active One Arc panel — height locked at 220px regardless of arcMode.
          Swap content based on arcMode:
          - 'script'     → top-anchored prose with bottom fade-out mask
          - 'shotlist'   → vertical scroll, ~4 rows visible
          - 'storyboard' → horizontal scroll, frames vertically centered
          Each panel includes a footer "Open in One Arc · X →" pinned to bottom edge.
       */}
      <div
        className="glass-tile"
        style={{
          height: 220, position: 'relative', overflow: 'hidden',
          padding: 0, marginTop: 8,
        }}
      >
        {/* render the panel matching arcMode (lift content from current SwipeableSceneMaker) */}
      </div>

      {/* 2. Tone full-width preview — links to /moodboard */}
      {/* 3. Loc/Cast/Art 3-up SwipePanel row — exactly as today */}
    </div>
  )
}
```

**Implementation notes:**
- The triple-toggle replaces today's `SwipeableSceneMaker` swipe carousel (`HubContent.tsx:99-` and consumer at `:800`). Same data, more legible header.
- The "Open in One Arc · X →" footer pill deep-links to `/projects/[projectId]/scenemaker?mode={script|shotlist|storyboard}`.
- The Locations/Casting/Art row uses the existing `<SwipePanel>` wrapper unchanged. Memory rule: panel shapes are sacred.

- [ ] **Step 2: Type check**

Run: `pnpm --filter @origin-one/back-to-one type-check`
Expected: clean.

- [ ] **Step 3: Stage**

```bash
git add apps/back-to-one/src/components/hub/HubCreativeSurface.tsx
```

---

## Task 8: `HubContent.tsx` shell refactor + `?hub=split` gate

**Files:**
- Modify: `apps/back-to-one/src/components/hub/HubContent.tsx`

- [ ] **Step 1: Add the URL-parameter gate at the top of the render**

`HubContent` today renders the stacked layout unconditionally. Wrap the new behavior in a `?hub=split` gate so the old layout stays default until validated.

Find the current `return (` at the top of the render in `HubContent.tsx`. Add this gate just above it:

```tsx
import { useSearchParams } from 'next/navigation'
import { useHubMode } from '@/lib/hooks/useHubMode'
import { HubModeToggle } from './HubModeToggle'
import { HubProductionSurface } from './HubProductionSurface'
import { HubCreativeSurface } from './HubCreativeSurface'

// …inside the component body, AFTER all data hooks but BEFORE the return:
const searchParams = useSearchParams()
const splitEnabled = searchParams?.get('hub') === 'split'
const { mode, setMode } = useHubMode(projectId)
```

- [ ] **Step 2: Render the shell when the gate is active**

Replace today's monolithic `return (...)` with a conditional:

```tsx
if (splitEnabled) {
  return (
    <div className="screen" /* …existing accent-cascading style… */>
      <div className="hub-topbar">
        {/* …existing topbar chrome (project switcher, client name, type+status pill, crew avatars)… */}
        <HubModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="hub-stage">
        <div className={`hub-surfaces${mode === 'creative' ? ' creative' : ''}`}>
          <HubProductionSurface active={mode === 'production'} projectId={projectId} projectColor={projectColor} /* + data slices */ />
          <HubCreativeSurface active={mode === 'creative'} projectId={projectId} /* + data slices */ />
        </div>
      </div>
      {/* sheets stay mounted at this level so both surfaces can trigger them */}
    </div>
  )
}
// otherwise fall through to today's stacked-layout return as-is — DO NOT modify
return (
  // …existing stacked layout, untouched…
)
```

The crucial point: the existing stacked render path remains in the file untouched. The gate flips at the top — `?hub=split` enters the new shell; absent, behavior is identical to before this PR.

- [ ] **Step 3: Move the FAB registration out of the shell**

`HubContent` today calls `useFabAction(...)` at line 360 with the Production-mode branches. In the gated branch, the surfaces own their own registration (per Task 6 + Task 7). In the un-gated stacked branch, leave the existing `useFabAction` call in place. Behavior matrix:

| Gate | FAB registration source |
|---|---|
| absent (default) | Existing `useFabAction` at line 360 — unchanged |
| `?hub=split` + mode=production | `HubProductionSurface`'s `useFabAction` |
| `?hub=split` + mode=creative | `HubCreativeSurface`'s `useFabAction` |

To avoid double-registration, the gated branch must skip the line-360 registration. Move it inside an `if (!splitEnabled) { useFabAction(...) }` — but React hooks can't be conditional. Solution: thread an `enabled: !splitEnabled` flag through the deps array and pass `branches: enabled ? [...] : []` instead. Pattern matches Task 6/7 (active surface wins by passing non-empty branches).

```tsx
useFabAction({
  branches: splitEnabled ? [] : [/* …existing 3 branches… */],
}, [splitEnabled, projectColor])
```

- [ ] **Step 4: Type check**

Run: `pnpm --filter @origin-one/back-to-one type-check`
Expected: clean.

- [ ] **Step 5: Manual smoke checklist**

Run: `pnpm --filter @origin-one/back-to-one dev` (or open the Vercel preview after pushing).

Walk these in the browser:

1. Visit `/projects/<vanta-id>` (no querystring) — old stacked Hub renders. Identical to today.
2. Visit `/projects/<vanta-id>?hub=split` — new shell renders. Topbar shows Production/Creative toggle. Production surface visible by default.
3. Tap "Creative" toggle — surfaces slide -50% with 420ms cubic-bezier transition. Creative surface visible. Active toggle button stretches with accent fill.
4. Tap "Production" — slides back. Active toggle re-stretches.
5. Tap each FAB branch in Production mode — verify CreateTaskSheet / CreateMilestoneSheet / InviteCrewSheet open.
6. Tap each FAB branch in Creative mode — verify Scene/Shot/Tone deep-link to `/scenemaker?mode=script`, `?mode=shotlist`, `/moodboard`.
7. Refresh the page on `?hub=split` — last-used mode is restored per project.
8. Visit `/projects/<lumière-id>?hub=split` — different project, fresh `'production'` default; switching its mode does NOT affect Vanta's stored mode.
9. In Creative surface, tap Script/Shotlist/Storyboard segments — active panel content swaps; surfaces below (Tone, Loc/Cast/Art) do not shift (panel height locked at 220px).
10. Tap "Open in One Arc · X →" footer pill in each panel — deep-links to `?mode=` matching the active segment.
11. Rotate Vanta's project accent via Settings — both surfaces re-tint instantly via existing `--accent-rgb` cascade.
12. Toggle 10 times rapidly — slide animation, glow, FAB branches stay in sync; no flicker.
13. Light + dark mode both render correctly.

- [ ] **Step 6: Stage**

```bash
git add apps/back-to-one/src/components/hub/HubContent.tsx
```

---

## Task 9: Build verification + single commit + push + open PR

**Files:** none (verification + git operations)

- [ ] **Step 1: Verify branch + staged files**

Run: `git status -sb`
Expected: branch is `feat/hub-mode-toggle-impl`. Staged files:
```
apps/back-to-one/reference/hub-production-creative-toggle.html (new)
apps/back-to-one/src/components/hub/HubProductionSurface.tsx (new)
apps/back-to-one/src/components/hub/HubCreativeSurface.tsx (new)
apps/back-to-one/src/components/hub/HubModeToggle.tsx (new)
apps/back-to-one/src/components/hub/HubArcToggle.tsx (new)
apps/back-to-one/src/lib/hooks/useHubMode.ts (new)
apps/back-to-one/src/lib/hooks/useHubMode.test.ts (new)
apps/back-to-one/src/components/hub/HubContent.tsx (modified)
apps/back-to-one/src/styles/globals.css (modified)
```

- [ ] **Step 2: Run the unit test**

Run: `pnpm --filter @origin-one/back-to-one test useHubMode --run`
Expected: PASS (4 tests).

- [ ] **Step 3: Type check the whole monorepo**

Run: `pnpm -w build`
Expected: green across all three apps. If `pnpm -w build` is too heavy, at minimum `pnpm --filter @origin-one/back-to-one type-check` must pass and the back-to-one Next build must succeed.

- [ ] **Step 4: Commit (one commit, descriptive)**

```bash
git -c commit.gpgsign=false commit -m "$(cat <<'EOF'
feat(hub): split Hub into Production / Creative toggle (gated, ?hub=split)

Refactors HubContent.tsx from one stacked screen into a thin shell that
mounts a binary HubModeToggle in the topbar and renders both surfaces
side-by-side in a 200%-wide flex strip clipped by .hub-stage. mode ===
'creative' translates the strip -50% with a 420ms cubic-bezier transition.

New components in apps/back-to-one/src/components/hub/:
- HubProductionSurface — Timeline / Action Items / Crew / Inventory /
  Workflow / Budget (Budget moves to bottom; Timeline becomes full width)
- HubCreativeSurface — One Arc triple toggle + active panel / Tone /
  Loc-Cast-Art (SwipePanel wrapper unchanged per "panel shapes are sacred")
- HubModeToggle — binary segmented toggle bound to useHubMode
- HubArcToggle — triple segmented toggle (Script/Shotlist/Storyboard),
  local state inside HubCreativeSurface (does not persist)

New hook:
- useHubMode(projectId) — { mode, setMode }, persists to localStorage
  key hub-mode:${projectId}, defaults to 'production'. Pure helpers
  readHubMode/writeHubMode covered by unit test (vitest).

CSS:
- .hub-toggle / .hub-toggle-btn class pair (active button stretches via
  flex-grow 1.6, accent fill matches .scenemaker-toggle-btn.active)
- .hub-stage / .hub-surfaces / .hub-surface slide-stage rules
Appended to globals.css end in a marked block; no overrides of existing
cinema-glass tokens or rules.

Reference HTML at apps/back-to-one/reference/hub-production-creative-toggle.html
matches the v4 prototype with cinema-glass adjustment (toggle uses project
accent, not mode-tinted).

Gated behind ?hub=split URL parameter — the old stacked Hub stays default
until a follow-up flips the gate. ActionBar registration uses the
active-surface-wins pattern (active surface passes its 3 branches; inactive
passes []), threading enabled flag through useFabAction's deps array.

No schema changes, no new queries, no new sheets. CreateCreativeSheet
picker becomes redundant for Creative FAB branches (1 tap instead of 2);
SwipeableSceneMaker becomes unreferenced from the Hub — both stay in the
file tree for a tiny follow-up cleanup PR.

Spec: docs/superpowers/specs/2026-05-03-hub-production-creative-toggle-design.md
Plan: docs/superpowers/plans/2026-05-03-hub-production-creative-toggle.md
EOF
)"
```

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feat/hub-mode-toggle-impl
```

- [ ] **Step 6: Open PR (draft)**

```bash
gh pr create --base main --draft --title "feat(hub): split Hub into Production / Creative toggle (gated, ?hub=split)" --body "$(cat <<'EOF'
## Summary

Refactors the Project Hub from one stacked screen into two toggleable surfaces — Production and Creative — with a sticky binary toggle in the topbar. Gated behind \`?hub=split\` so the old layout stays default; flip the gate in a one-line follow-up after validating on real production data.

**Spec:** \`docs/superpowers/specs/2026-05-03-hub-production-creative-toggle-design.md\`
**Plan:** \`docs/superpowers/plans/2026-05-03-hub-production-creative-toggle.md\`

## What's in this PR

| Path | Change |
|---|---|
| \`apps/back-to-one/reference/hub-production-creative-toggle.html\` | NEW — high-fidelity Cinema Glass mockup |
| \`apps/back-to-one/src/components/hub/HubProductionSurface.tsx\` | NEW — Timeline / Action Items / Crew / Inventory / Workflow / Budget |
| \`apps/back-to-one/src/components/hub/HubCreativeSurface.tsx\` | NEW — One Arc triple toggle + active panel / Tone / Loc-Cast-Art |
| \`apps/back-to-one/src/components/hub/HubModeToggle.tsx\` | NEW — binary segmented toggle |
| \`apps/back-to-one/src/components/hub/HubArcToggle.tsx\` | NEW — triple segmented toggle (Script/Shotlist/Storyboard) |
| \`apps/back-to-one/src/lib/hooks/useHubMode.ts\` | NEW — per-project mode persistence (localStorage) |
| \`apps/back-to-one/src/lib/hooks/useHubMode.test.ts\` | NEW — vitest unit test |
| \`apps/back-to-one/src/components/hub/HubContent.tsx\` | MODIFIED — added \`?hub=split\` gate; new shell branch; old stacked branch untouched |
| \`apps/back-to-one/src/styles/globals.css\` | MODIFIED — appended \`.hub-toggle\` / \`.hub-toggle-btn\` + slide-stage rules |

## Cinema-glass conformance

- No new design tokens; reuses \`.glass-tile\`, \`.sheen-title\`, \`.hub-topbar\`, \`.ai-meta-pill\`, \`.sk-*\` exactly as today
- Project accent threads through the existing \`--accent-rgb\` / \`--tile-rgb\` cascade — both surfaces re-tint together when the user changes a project's accent
- Toggle's active state uses the project accent (matches \`.scenemaker-toggle-btn.active\`), NOT mode-semantic orange/blue — deliberate choice per spec
- Phase chips stay phase-tinted; mode never confused with phase

## Out of scope

- \`SwipeableSceneMaker\` cleanup (becomes unreferenced from the Hub; tiny follow-up)
- \`CreateCreativeSheet\` cleanup (Creative FAB branches deep-link directly; picker becomes redundant)
- Swipe gesture between surfaces (segmented control + tap is enough for v1; clean v2 add)
- Mode-specific topbar tinting (dropped per cinema-glass conformance)

## Test plan

- [x] \`pnpm --filter @origin-one/back-to-one test useHubMode --run\` — green
- [x] \`pnpm -w build\` — green across all three apps
- [ ] Vercel preview build green
- [ ] Manual smoke (per spec Verification section + Task 8 Step 5 checklist)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Capture the PR URL**

Save the URL printed by \`gh pr create\` for reporting.

---

## Self-review checklist (run before handing off)

1. **Spec coverage:**
   - [ ] Production surface contents — covered by Task 6
   - [ ] Creative surface contents (incl. locked 220px panel height) — covered by Task 7
   - [ ] HubModeToggle binary — covered by Task 4
   - [ ] HubArcToggle triple (local state, no persist) — covered by Task 5
   - [ ] useHubMode hook (per-project localStorage) — covered by Task 2 + unit test
   - [ ] .hub-toggle / .hub-toggle-btn CSS — covered by Task 3
   - [ ] Slide stage (200% strip, 420ms cubic-bezier) — covered by Task 3
   - [ ] HubContent shell + \`?hub=split\` gate — covered by Task 8
   - [ ] FAB per-mode (active-surface-wins via empty/non-empty branches) — covered by Tasks 6, 7, 8
   - [ ] Reference HTML — covered by Task 1
   - [ ] No new sheets / queries / schema — verified by file map
   - [ ] Memory rules honored (panel shapes sacred, visual-only) — verified inline

2. **Type consistency:** \`HubMode\` exported from \`useHubMode.ts\` is used identically in \`HubModeToggle\`, \`HubContent\`. \`ArcMode\` exported from \`HubArcToggle.tsx\` is used in \`HubCreativeSurface\`. \`useFabAction\` signature matches the existing context export at \`FabActionContext.tsx:123\`.

3. **No placeholders:** every step has concrete code or commands; no "TBD" / "implement later" / "similar to Task N".

---

## Verification (the spec's checklist, repeated here for the implementer)

After Task 9 ships, walk these in the browser using the Vercel preview URL with `?hub=split`:

- Type check passes across the monorepo (`pnpm -w build`).
- Walk through both modes on Vanta (full data) and Lumière (sparse data) in the browser.
- Rotate a project's accent mid-session via Settings — verify both surfaces re-tint instantly.
- Tap each FAB branch in each mode; verify the right sheet opens or the right deep-link fires.
- Toggle 10 times rapidly; verify slide animation, glow, and FAB branches stay in sync.
- Tap Script/Shotlist/Storyboard segments; verify panels swap and "Open in One Arc → X" deep-links to the right `?mode=` value.
- Reload the page; verify last-used mode is restored per project.
- Open a child page (Script editor) and back-button; verify last-used mode is restored.
- Light mode + dark mode both render correctly.
