# Hub — Production / Creative Toggle

**Date:** 2026-05-03
**Scope:** `apps/back-to-one` — Project Hub (`/projects/[projectId]`)
**Goal:** Replace the single stacked Hub screen with a clean toggle between two intentional surfaces — Production and Creative — so each feels like a place, not a section.
**Constraint:** Fit into the cinema-glass design language already on `main` (PR #121). No new design tokens, no copy changes, no new sheets. Visual-only restructure plus one new class pair in `globals.css`.

---

## Why

Today's Hub is one long stack of five sections (Timeline+Budget peers, Action Items, Creative, Inventory, Workflow). Every visit lands in the same view, mixing real-world execution with narrative work. Users have to scroll past one mode to reach the other; neither surface gets to set its own tone.

Splitting the Hub into two toggleable surfaces lets each one be opinionated about what belongs there, what comes first, and what gets cut.

## North star

- **Production** = real-world execution: schedule, money, people, gear, pipeline.
- **Creative** = narrative + look: One Arc (script/shotlist/storyboard), tone, locations, casting, art.
- Toggle is **always present** in the topbar, never scrolls away.
- Project accent leads everywhere — both surfaces stay faithful to the project's color.

---

## Surface contents (locked)

### Production surface (top to bottom)
1. **Timeline** (full width) — `GanttChart` with milestone ticks; below it, the milestone-detail row with `‹` / `›` arrow navigation between milestones. Same component already on main; only the layout changes from peer-of-Budget to full-width.
2. **My Action Items** — `ActionItemsPreview` with the existing 3-row preview + assignee pill.
3. **Crew** — 3-tile preview row (existing pattern), tap to open `CrewPanel`.
4. **Inventory** — featured department chips strip + "View all" tile, links to `/inventory`.
5. **Workflow** — 5-node icon chain (`wf-row` / `wf-node` / `wf-conn`).
6. **Budget** — full-width row card (was a peer of Timeline; moves to bottom). Producer-only via the existing `useViewerRole(projectId) === 'producer'` gate.

### Creative surface (top to bottom)
1. **One Arc triple toggle** — segmented `Script` / `Shotlist` / `Storyboard` pill at the very top. Selecting a segment swaps the preview panel below; tapping the panel itself (or the in-panel "Open in One Arc · X →" pill) deep-links to `/projects/[projectId]/scenemaker?mode=script|shotlist|storyboard`. Order is `Script ▸ Shotlist ▸ Storyboard` to read as the natural creative pipeline. Replaces today's `SwipeableSceneMaker` swipe carousel — same data, more legible header.

   **Panel height is locked** at a single value (target: 220px) regardless of which segment is active, so the surfaces below (Tone, Loc/Cast/Art) never shift when the user navigates between the three. Each panel handles its own internal overflow inside the locked box:
   - **Script**: top-anchored prose with a soft fade-out mask at the bottom for overflow.
   - **Shotlist**: vertical scroll inside the box (~4 rows visible at the locked height).
   - **Storyboard**: horizontal scroll, frames vertically centered inside the box.

   The "Open in One Arc · X →" footer pill is pinned to the bottom edge of the locked box across all three panels.
2. **Tone** — full-width tone/moodboard preview panel, links to `/moodboard`.
3. **Locations · Casting · Art** — 3-up `SwipePanel` row exactly as today (panel shapes are sacred per memory).

The mode toggle's FAB branches change with mode:

- **Production FAB** (3 branches): Action (`CreateTaskSheet`) / Milestone (`CreateMilestoneSheet`) / Crew (existing `InviteCrewSheet` from `apps/back-to-one/src/components/crew/InviteCrewSheet.tsx`).
- **Creative FAB** (3 branches): Scene / Shot / Tone — each routes directly to the page where the creation lives:
  - **Scene** → `/projects/[projectId]/scenemaker?mode=script`
  - **Shot** → `/projects/[projectId]/scenemaker?mode=shotlist`
  - **Tone** → `/projects/[projectId]/moodboard`

  Replaces the current `CreateCreativeSheet` picker (1 tap instead of 2 — the picker today does exactly the same routing, it's just a middle step). The picker becomes redundant once the branches are explicit.

---

## Architecture

### Component split

`HubContent.tsx` becomes a thin shell that:
- Reads project + accent + viewer role.
- Sets the existing `--tile-rgb` / `--accent-rgb` / `--accent-glow-rgb` CSS vars on the `.screen` root (no change to today's pattern).
- Renders the existing `.hub-topbar` chrome (project switcher, client name, type+status pill, crew avatars).
- Mounts the new `<HubModeToggle />` *inside* the `.hub-topbar`, below the existing chrome.
- Renders a single sliding stage with two surfaces side-by-side.
- Delegates ActionBar registration to whichever surface is active.

New components in `apps/back-to-one/src/components/hub/`:

| File | Responsibility |
|---|---|
| `HubProductionSurface.tsx` | Timeline / Action Items / Crew / Inventory / Workflow / Budget. Owns its `useFabAction` registration. |
| `HubCreativeSurface.tsx` | One Arc triple toggle + active panel / Tone / Loc-Cast-Art. Owns its `useFabAction` registration. |
| `HubModeToggle.tsx` | Segmented binary toggle bound to `useHubMode`. |
| `HubArcToggle.tsx` | Segmented triple toggle (Script / Shotlist / Storyboard). Local state inside `HubCreativeSurface`. |

New hook in `apps/back-to-one/src/lib/hooks/`:

| File | Responsibility |
|---|---|
| `useHubMode.ts` | `(projectId: string) → { mode: 'production' \| 'creative', setMode }`. Reads/writes `localStorage` key `hub-mode:${projectId}`. Defaults to `production` on first load. |

The arc selection inside `HubCreativeSurface` does *not* persist (intentional — it's a navigation aid, not a mode). Defaults to `'script'`.

### Data and queries

No new queries, no schema changes. Every existing hook (`useActionItems`, `useCrew`, `useScenesWithShots`, `useMoodboard`, `useLocations`, `useArtItems`, `useCastRoles`, `useWorkflowNodes`, `useInventoryItems`, `useShootDays`, `useBudget`, `useThreadPreviews`, `useFabAction`) is reused as-is. The two surfaces consume what they need from the same data source — no duplicate fetches because React Query dedupes by key.

### Slide stage

```
┌─ .hub-stage ──────────────────────────┐
│  ┌─ .hub-surfaces (translate -50%) ─┐  │
│  │ ┌─ Prod ────┐ ┌─ Crea ────┐      │  │
│  │ │  width:50%│ │ width: 50%│      │  │
│  │ └───────────┘ └───────────┘      │  │
│  └────────────────────────────────-─┘  │
└─────────────────────────────────────-──┘
```

`.hub-surfaces` is a flex row of 200% width; `.hub-stage` clips. `mode === 'creative'` adds `transform: translateX(-50%)` with a 420ms cubic-bezier transition. Each surface scrolls independently (its own `overflow-y: auto`), and scroll positions are preserved across toggles by virtue of being separate scroll containers.

---

## Cinema-glass conformance

**The new components reuse existing classes wherever possible:**

| Element | Class |
|---|---|
| Topbar wrapper | `.hub-topbar` (existing — unchanged) |
| Section header | `.sheen-title` via existing `<ModuleHeader>` (unchanged) |
| Card surfaces (Timeline, Action Items, Tone, Loc/Cast/Art panels, etc.) | `.glass-tile` (existing) |
| Phase chips on the timeline | `.ai-meta-pill.pre / .prod / .post` (existing) |
| Skeleton placeholders during load | `.sk` / `.sk-line` / `.sk-pill` / `.sk-title` / `.sk-grid-3` (existing) |

**One new class pair added to `apps/back-to-one/src/styles/globals.css`** in the cinema-glass component layer:

```css
/* Hub-scoped segmented toggle. Used by HubModeToggle (binary) and
   HubArcToggle (ternary). Active button stretches to take more centered
   space; inactive buttons compress aside. Active treatment matches
   .scenemaker-toggle-btn.active — project accent fill, accent text. */
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
```

**Why a new class pair instead of reusing `.scenemaker-toggle`:**
- The Hub toggles need the flex-grow stretch behavior; scenemaker toggles do not (they're a 50/50 segmented control by design — see `globals.css:525-552`). Adding stretch to scenemaker would change every existing scenemaker toggle on main.
- `.hub-toggle` is a focused new primitive in the same shape as `.scenemaker-toggle`; both can later be unified into a shared `.glass-segmented-toggle` if a third surface needs the pattern.

**Stretch ratio:**
- Binary toggle (Production / Creative): active = `flex-grow: 1.6`, inactive = `1` → roughly 62% / 38%.
- Triple toggle (Script / Shotlist / Storyboard): same `1.6` / `1` ratio → roughly 44% / 28% / 28%.

## Color discipline (the accent question)

Origin One uses three color systems. After this change:

| Color | Where it shows up | Behavior on accent change |
|---|---|---|
| **Project accent** (per project, 18 options) | Topbar radial glow, `.glass-tile` background, `.sheen-title` gradient, `.hub-toggle-btn.active`, milestone branch FAB icon, scene gradients | Re-renders instantly — accent is set as `--accent-rgb` / `--tile-rgb` on the `.screen` root and cascades through every cinema-glass class. |
| **Phase colors** (pre `#e8a020` / prod `#6470f3` / post `#00b894`) | Gantt segments, `.ai-meta-pill.pre/.prod/.post` | Phase-semantic; never project-tinted. Unchanged. |
| **Mode (this feature)** | Surface content + slide direction + toggle position | The toggle's *active* state uses the project accent (matches cinema-glass), not orange/blue. Mode distinctness comes from layout + slide + stretch, not color. |

**Result:** when the user changes a project's accent, both surfaces re-tint together. The toggle re-tints. The Gantt phase segments stay phase-colored. The mode toggle never confuses "what mode am I in" with "what project am I on."

---

## ActionBar (FAB) per mode

`useFabAction(branches, deps)` is called inside each surface component, not in the shell. When `mode` changes:

1. Both surfaces stay mounted (so each preserves its own scroll position across toggles).
2. Each surface always calls `useFabAction`, but passes `branches: []` when not active. The active surface's non-empty branches win in the ActionBar context.
3. The `active` boolean is part of the dependency array so registration re-runs on every mode flip.

The two registrations:

```ts
// HubProductionSurface.tsx
useFabAction({
  branches: [
    { label: 'Action',    color: '#e8a020',     icon: <CheckCircle/>, action: () => setShowCreateTask(true) },
    { label: 'Milestone', color: projectColor,  icon: <MilestoneBar/>, action: () => setShowCreateMilestone(true) },
    { label: 'Crew',      color: '#00b894',     icon: <Person/>,       action: () => setInviteCrewOpen(true) },
  ],
}, [projectColor])

// HubCreativeSurface.tsx
useFabAction({
  branches: [
    { label: 'Scene', color: '#6470f3', icon: <Filmstrip/>,  action: () => router.push(`/projects/${projectId}/scenemaker?mode=script`)   },
    { label: 'Shot',  color: '#6470f3', icon: <ShotFrame/>,  action: () => router.push(`/projects/${projectId}/scenemaker?mode=shotlist`) },
    { label: 'Tone',  color: '#6470f3', icon: <ToneSwatch/>, action: () => router.push(`/projects/${projectId}/moodboard`) },
  ],
}, [projectId])
```

The Crew branch wires to the existing `InviteCrewSheet` (no new sheet). The Creative branches deep-link directly into the existing creation flows that today live behind `CreateCreativeSheet`'s picker.

---

## Loading and empty states

- `HubSkeleton` continues to render until `loadingProject` resolves; unchanged.
- Each surface internally guards against missing data with the existing empty states (e.g., milestone empty state in `GanttChart`'s parent).
- The toggle renders even on first paint (skeleton can show beneath it).

## Migration safety (the "smoothly to main" question)

**Two-PR rollout:**

1. **Reference HTML PR** (~1 file)
   - Adds `apps/back-to-one/reference/hub-production-creative-toggle.html` — a high-fidelity HTML mockup matching the v4 prototype (with the cinema-glass adjustment: toggle is project-accent, not mode-tinted).
   - Per project rule: "Reference file is the spec. Match it exactly."
   - Trivial to review; sets the visual contract.

2. **Implementation PR** (the work)
   - Adds the new components + hook + `.hub-toggle` class pair.
   - Refactors `HubContent.tsx` from one stack to shell + two surfaces. Net line count drops because layout is decomposed.
   - **Behind a `?hub=split` URL parameter** — old stacked Hub stays default; the new layout is opt-in via querystring. This lets the work merge to main, exercise on production data, and roll back trivially if anything is off.
   - All existing tests continue to pass; no test changes needed (HubContent has no unit tests today).
   - `pnpm -w build` succeeds across all three apps before merge (Origin One discipline).

**One-line follow-up PR** flips the default and removes the gate after a real-production validation pass.

**Wired-up correctness comes from:**
- Pure layout refactor — no schema, no queries, no new sheets.
- All accent threading already happens via CSS vars at the `.screen` root — both surfaces inherit identically.
- Memory rule "Hub panel shapes are sacred" — `SwipePanel` wrapper unchanged.
- Memory rule "Design refreshes are visual-only" — no copy or control changes.
- ActionBar branch swap is a single re-registration; no race because `useFabAction`'s dependency tracking handles it.
- `localStorage` key namespaced per project so multi-project workflows don't bleed.

---

## What we are explicitly *not* doing

- No new design tokens, no Tailwind config changes, no new fonts.
- No new sheets — `InviteCrewSheet`, `CreateTaskSheet`, `CreateMilestoneSheet` and the Scene/Shot/Tone flows already exist.
- No mode-specific orange/blue topbar tinting — the v4 prototype's mode-semantic toggle colors were dropped to fit cinema-glass.
- No swipe gesture between surfaces in v1 — the segmented control + toggle tap is enough. (Swipe is a clean v2 add via Framer Motion's `dragX`.)
- No `SwipeableSceneMaker` cleanup in this PR — its file stays but becomes unreferenced from the Hub. Removed in a tiny follow-up so this PR's diff stays focused.
- No `CreateCreativeSheet` cleanup in this PR — same reason; its picker is replaced by the explicit Creative FAB branches.
- No backwards-compat shim for old Hub URL deep-links — there were none; the route is unchanged.

---

## Verification before merge

- Type check passes across the monorepo (`pnpm -w build`).
- Walk through both modes on Vanta (full data) and Lumière (sparse data) in the browser.
- Rotate a project's accent mid-session via Settings — verify both surfaces re-tint instantly.
- Tap each FAB branch in each mode; verify the right sheet opens.
- Toggle 10 times rapidly; verify slide animation, glow, and FAB branches stay in sync.
- Tap Script/Shotlist/Storyboard segments; verify panels swap and "Open in One Arc → X" deep-links to the right `?mode=` value.
- Reload the page; verify last-used mode is restored per project.
- Open a child page (Script editor) and back-button; verify last-used mode is restored.
- Light mode + dark mode both render correctly (theme picker is light/dark only post-#118).
