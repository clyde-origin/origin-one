# Project Selection Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three small UX fixes on the project selection page — wiggle works inside open folders (reorder, archive, move-out), project tiles look identical inside and outside folders, and the Team name is editable via a wiggle-mode pencil.

**Architecture:** Extract `SlateCard` and the Archive icon button into shared components so both the home grid and the open folder sheet render identical tiles. `OpenFolderSheet` becomes wiggle-aware via new props that route drag-end events back to `page.tsx` for the existing mutation infrastructure. A new `useMoveProjectToRoot` mutation clears `UserProjectPlacement.folderId`. A new `TeamNameSheet` + `useUpdateTeamName` mutation handle the rename flow. `Team.name` already has an RLS UPDATE policy gating to TeamMembers (`packages/db/prisma/migrations/20260428005845_rls_helpers_and_policies/migration.sql:105`), so no schema work.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind, Framer Motion, Supabase JS client, React Query.

**Spec:** `docs/superpowers/specs/2026-04-29-project-selection-polish-design.md`

**Verification model:** No unit tests exist for these UI components; verification is `pnpm --filter @back-to-one build` (typecheck) plus manual smoke testing on `pnpm --filter @back-to-one dev`. Each task ends with a `pnpm --filter @back-to-one build` step that must succeed before commit.

---

## File Structure

```
apps/back-to-one/src/
  app/projects/page.tsx                            ← MODIFY (across multiple tasks)
  components/projects/
    SlateCard.tsx                                  ← CREATE in Task 1
    ArchiveIcon.tsx                                ← CREATE in Task 2
    OpenFolderSheet.tsx                            ← MODIFY in Tasks 3, 5, 7
    TeamNameSheet.tsx                              ← CREATE in Task 9
  lib/hooks/useOriginOne.ts                        ← MODIFY in Tasks 4, 8
  lib/db/queries.ts                                ← MODIFY in Tasks 4, 8
docs/superpowers/specs/2026-04-29-project-selection-polish-design.md  ← already committed
docs/superpowers/plans/2026-04-29-project-selection-polish.md         ← this file
```

The branch is `feat/project-selection-polish`. The worktree is
`/Users/pawn/Code/origin-one/.worktrees/project-selection-polish`. All
commands run from there unless noted.

---

## Task 1: Extract `SlateCard` to its own file

Mechanical refactor — pure visual no-op. Move the inline `SlateCard`
function (currently at `apps/back-to-one/src/app/projects/page.tsx`
lines 99–204) into a dedicated component file. Move `WiggleStyle`,
`SlateLines`, `hexToRgba`, and `slateBodyBg` along with it since
`SlateCard` is the only consumer.

**Files:**
- Create: `apps/back-to-one/src/components/projects/SlateCard.tsx`
- Modify: `apps/back-to-one/src/app/projects/page.tsx` (delete inline SlateCard + helpers + WiggleStyle, add import)

- [ ] **Step 1: Create the new file**

Create `apps/back-to-one/src/components/projects/SlateCard.tsx` with:

```tsx
'use client'

import { useCrew } from '@/lib/hooks/useOriginOne'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { CrewAvatar } from '@/components/ui'
import { statusHex, STATUS_LABELS_SHORT } from '@/lib/utils/phase'
import type { Project } from '@/types'

export function hexToRgba(hex: string | null | undefined, a: number) {
  const h = hex || '#444444'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function slateBodyBg(color: string | null | undefined): string {
  const c = color || '#444444'
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  const dr = Math.round(r * 0.07)
  const dg = Math.round(g * 0.07)
  const db = Math.round(b * 0.07)
  const c1 = `rgb(${dr + 4},${dg + 4},${db + 4})`
  const c2 = `rgb(${Math.round(dr * 0.7) + 2},${Math.round(dg * 0.7) + 2},${Math.round(db * 0.7) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

function SlateLines({ color }: { color: string }) {
  const opacities = [0.28, 0, 0.15, 0, 0.07, 0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 18, overflow: 'hidden' }}>
      {opacities.map((o, i) => (
        <div key={i} style={{ flex: 1, background: o > 0 ? hexToRgba(color, o) : 'transparent' }} />
      ))}
    </div>
  )
}

export function WiggleStyle() {
  return (
    <style>{`
      @keyframes wiggle {
        0%   { transform: rotate(0deg); }
        25%  { transform: rotate(-1.5deg); }
        75%  { transform: rotate(1.5deg); }
        100% { transform: rotate(0deg); }
      }
    `}</style>
  )
}

export type SlateCardProps = {
  project: Project
  color: string
  dimmed: boolean
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

export function SlateCard({
  project, color, dimmed, editMode, isGhost, isDragging, wiggleDelay,
  onLongPress, onClick,
}: SlateCardProps) {
  const phaseColor = statusHex(project.status)
  const { data: crew } = useCrew(project.id)
  const allCrew = crew ?? []
  const longPressHandlers = useLongPress(onLongPress, 500)

  if (isGhost) {
    return (
      <div style={{ borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)', opacity: 0.18, overflow: 'hidden' }}>
        <div style={{ height: 18 }} />
        <div style={{ height: 90 }} />
      </div>
    )
  }

  const wiggleStyle = editMode && !isDragging ? {
    animation: 'wiggle 0.5s ease-in-out infinite',
    animationDelay: `${wiggleDelay ?? 0}s`,
  } : {}

  const dragStyle = isDragging ? {
    transform: 'scale(1.06) rotate(1.5deg)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.12)',
    zIndex: 50, opacity: 0.95,
  } : {}

  return (
    <div
      onClick={onClick}
      {...longPressHandlers}
      data-project-id={project.id}
      style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        border: `1px solid rgba(255,255,255,${editMode ? '0.1' : '0.06'})`,
        background: 'rgba(10,10,18,0.6)',
        transition: isDragging ? 'none' : 'transform 0.12s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : 'none',
        ...wiggleStyle,
        ...dragStyle,
      }}
      className={editMode || isDragging ? '' : 'active:scale-[0.96] active:brightness-[0.85]'}
    >
      <SlateLines color={color} />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '9px 10px 11px', position: 'relative', overflow: 'hidden',
        background: slateBodyBg(color),
        minHeight: 90,
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div className="font-mono uppercase" style={{ fontSize: '0.42rem', letterSpacing: '0.08em', color: hexToRgba(color, 0.55) }}>{project.type}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, background: hexToRgba(phaseColor, 0.12), border: `1px solid ${hexToRgba(phaseColor, 0.2)}`, flexShrink: 0 }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 3px ${phaseColor}` }} />
              <span className="font-mono uppercase" style={{ fontSize: '0.34rem', letterSpacing: '0.04em', color: phaseColor }}>{STATUS_LABELS_SHORT[project.status] ?? project.status}</span>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#dddde8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{project.name}</div>
          {project.client && <div className="font-mono" style={{ fontSize: '0.38rem', color: '#62627a', letterSpacing: '0.06em', marginTop: 3 }}>{project.client}</div>}
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 7 }}>
          {!editMode && allCrew.length > 0 && (
            <div style={{ display: 'flex' }}>
              {allCrew.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -3, position: 'relative', zIndex: 5 - i }}>
                  <CrewAvatar name={c.User?.name ?? 'Unknown'} size={20} avatarUrl={c.User?.avatarUrl} />
                </div>
              ))}
              {allCrew.length > 5 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.32rem', fontWeight: 600, border: '1px solid rgba(0,0,0,0.5)', marginLeft: -3, fontFamily: 'var(--font-geist-mono)', background: hexToRgba(color, 0.12), color: '#62627a' }}>+{allCrew.length - 5}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `page.tsx` imports**

In `apps/back-to-one/src/app/projects/page.tsx`, add to the existing block of imports:

```tsx
import { SlateCard, WiggleStyle, hexToRgba } from '@/components/projects/SlateCard'
```

- [ ] **Step 3: Delete the moved code from `page.tsx`**

Delete the following ranges from `page.tsx`:
- Lines 33–52: `hexToRgba` and `slateBodyBg` helpers (now in `SlateCard.tsx`).
- Lines 56–65: `SlateLines` (now in `SlateCard.tsx`).
- Lines 99–204: `SlateCard` and `WiggleStyle` (now in `SlateCard.tsx`).

Keep all other inline functions (`SpaceBg`, etc.) — they're not moving.

- [ ] **Step 4: Verify build**

Run from the worktree root:

```bash
pnpm install
pnpm --filter @back-to-one build
```

Expected: build succeeds. Any TypeScript error or unresolved import means a leftover reference to a deleted helper — fix in `page.tsx` before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/components/projects/SlateCard.tsx apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
refactor(projects): extract SlateCard, WiggleStyle, hexToRgba to shared file

Pure refactor in service of the project-selection-polish feature: we need
SlateCard rendered identically inside OpenFolderSheet, which means it
can't live as a private function inside page.tsx. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extract Archive icon to `ArchiveIcon.tsx`

The Archive button JSX (currently `page.tsx` lines 877–915) gets used in
two places after this PR: the home grid and the open folder sheet.
Extract it to a shared component now so both sites import the same code.

**Files:**
- Create: `apps/back-to-one/src/components/projects/ArchiveIcon.tsx`
- Modify: `apps/back-to-one/src/app/projects/page.tsx` (replace inline JSX with import + usage)

- [ ] **Step 1: Create the new file**

Create `apps/back-to-one/src/components/projects/ArchiveIcon.tsx` with:

```tsx
'use client'

export const ARCHIVE_FOLDER_ID = '__archive__'

type ArchiveIconProps = {
  count: number            // archived projects count to show in label
  isDropTarget: boolean    // true while a drag is hovering
  onClick: () => void
}

export function ArchiveIcon({ count, isDropTarget, onClick }: ArchiveIconProps) {
  return (
    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', padding: '6px 2px 2px' }}>
      <button
        data-archive-target={ARCHIVE_FOLDER_ID}
        onClick={onClick}
        className="active:opacity-80 transition-all"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 14px',
          borderRadius: 14,
          border: isDropTarget
            ? '1.5px solid rgba(232,86,74,0.7)'
            : '1px dashed rgba(98,98,122,0.3)',
          background: isDropTarget
            ? 'rgba(232,86,74,0.12)'
            : 'rgba(98,98,122,0.04)',
          boxShadow: isDropTarget
            ? '0 0 30px rgba(232,86,74,0.45), inset 0 0 18px rgba(232,86,74,0.15)'
            : 'none',
          transform: isDropTarget ? 'scale(1.06)' : 'scale(1)',
          transition: 'all 0.18s ease',
          cursor: 'pointer',
          color: isDropTarget ? '#e8564a' : '#62627a',
        }}
      >
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 4.5C2 3.4 2.9 2.5 4 2.5H8.5L10.5 4.5H18C19.1 4.5 20 5.4 20 6.5V14.5C20 15.6 19.1 16.5 18 16.5H4C2.9 16.5 2 15.6 2 14.5V4.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.1em' }}>
          Archive{count > 0 ? ` · ${count}` : ''}
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Replace the inline JSX in `page.tsx`**

In `apps/back-to-one/src/app/projects/page.tsx`:

a) Add to the imports block:

```tsx
import { ArchiveIcon, ARCHIVE_FOLDER_ID } from '@/components/projects/ArchiveIcon'
```

b) Delete the local `const ARCHIVE_FOLDER_ID = '__archive__'` declaration
(currently line 429) since it's now imported.

c) Replace lines 873–915 (the entire `{/* Archive icon — sits below ... */}`
block including its outer `<div>`) with:

```tsx
              <ArchiveIcon
                count={allArchivedProjects.length}
                isDropTarget={dragTargetId === ARCHIVE_FOLDER_ID}
                onClick={() => { haptic('light'); openFolder(ARCHIVE_FOLDER_ID) }}
              />
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/components/projects/ArchiveIcon.tsx apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
refactor(projects): extract ArchiveIcon to shared component

Pulls the home-grid Archive button (and the ARCHIVE_FOLDER_ID sentinel)
into its own file so OpenFolderSheet can render the same component
without JSX duplication. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Use `SlateCard` in `OpenFolderSheet` (visual unification)

Replace `OpenFolderSheet`'s local `ProjectTile` with `SlateCard` so
project tiles look identical inside and outside folders. Pass
`editMode={false}` initially — wiggle inside folders is wired up in
Task 5.

**Files:**
- Modify: `apps/back-to-one/src/components/projects/OpenFolderSheet.tsx`

- [ ] **Step 1: Add the import**

In `apps/back-to-one/src/components/projects/OpenFolderSheet.tsx`,
right after the existing imports at the top, add:

```tsx
import { SlateCard, hexToRgba } from '@/components/projects/SlateCard'
```

Then **delete** the local `hexToRgba` function (currently lines 134–139)
since it's now imported. The `FolderTile` below uses it; ensure it
still resolves via the new import.

- [ ] **Step 2: Delete the local `ProjectTile`**

Delete lines 50–86 (the entire `ProjectTile` function definition).
`FolderTile` immediately below stays.

- [ ] **Step 3: Wire `SlateCard` into the grid**

In `OpenFolderSheet`'s JSX (the grid that renders `projects.map(...)`,
currently around line 232), replace:

```tsx
                {projects.map(p => (
                  <ProjectTile
                    key={p.id}
                    project={p}
                    onClick={() => handleClick(p)}
                    onLongPress={onProjectLongPress ? () => onProjectLongPress(p) : undefined}
                  />
                ))}
```

with:

```tsx
                {projects.map((p, i) => (
                  <SlateCard
                    key={p.id}
                    project={p}
                    color={p.color || '#6470f3'}
                    dimmed={false}
                    editMode={false}
                    isGhost={false}
                    isDragging={false}
                    wiggleDelay={i * 0.08}
                    onClick={() => handleClick(p)}
                    onLongPress={onProjectLongPress ? () => onProjectLongPress(p) : (() => {})}
                  />
                ))}
```

Note: `SlateCard.onLongPress` is required; pass a no-op when the parent
doesn't provide one.

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds. If `Project` type doesn't have a `color`
field at the call-site type, double-check the `import type { Project }`
line in `OpenFolderSheet.tsx` — should match the import already in
`SlateCard.tsx` (`@/types`).

- [ ] **Step 5: Manual smoke test (optional but recommended)**

```bash
pnpm --filter @back-to-one dev
```

Visit `http://localhost:3000/projects`, tap a folder open. The project
tiles inside should now visually match the home-grid tiles (same top
stripe, slate background, name + client typography). Stop the dev
server when satisfied.

- [ ] **Step 6: Commit**

```bash
git add apps/back-to-one/src/components/projects/OpenFolderSheet.tsx
git commit -m "$(cat <<'EOF'
refactor(projects): use SlateCard inside OpenFolderSheet

Replaces the local ProjectTile with the shared SlateCard so project
tiles look identical inside and outside folders. Wiggle is intentionally
off here for now — it's wired up in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `useMoveProjectToRoot` mutation

The "drag a project out of its folder" interaction needs a mutation that
clears `UserProjectPlacement.folderId` for the (viewer, project) pair.
Wraps the existing `upsertUserProjectPlacement` helper.

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1: Add the queries.ts helper**

In `apps/back-to-one/src/lib/db/queries.ts`, immediately after the
existing `upsertUserProjectPlacement` function (which ends near
line 3239), add:

```ts
/**
 * Move a project out of its folder back to the home grid root for a
 * specific viewer. Clears UserProjectPlacement.folderId; assigns a
 * sortOrder that places the project at the bottom of the root-grid
 * order. Wraps upsertUserProjectPlacement.
 */
export async function moveProjectToRoot(input: {
  userId: string
  projectId: string
}) {
  // We need a sortOrder that's >= every existing root-grid sortOrder.
  // Read the current max from the viewer's placements where folderId IS NULL.
  const db = createClient()
  const { data: rows, error: readErr } = await db
    .from('UserProjectPlacement')
    .select('sortOrder')
    .eq('userId', input.userId)
    .is('folderId', null)
    .order('sortOrder', { ascending: false })
    .limit(1)
  if (readErr) { console.error('moveProjectToRoot read failed:', readErr); throw readErr }
  const maxSortOrder = rows && rows.length > 0 ? rows[0].sortOrder : 0
  return upsertUserProjectPlacement({
    userId: input.userId,
    projectId: input.projectId,
    folderId: null,
    sortOrder: maxSortOrder + 1024,
  })
}
```

- [ ] **Step 2: Add the hook**

In `apps/back-to-one/src/lib/hooks/useOriginOne.ts`, immediately after
the existing `useUpsertUserProjectPlacement` function (around line 1386),
add:

```ts
export function useMoveProjectToRoot() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (projectId: string) => db.moveProjectToRoot({ userId: meId!, projectId }),
    onSuccess:  () => invalidateFolders(qc),
  })
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "$(cat <<'EOF'
feat(projects): add useMoveProjectToRoot mutation

Wraps upsertUserProjectPlacement to clear folderId and pin the project
at the end of the root-grid order. Used by the upcoming "drag out of
folder" interaction in OpenFolderSheet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire wiggle + drag scaffolding into `OpenFolderSheet`

`OpenFolderSheet` now accepts the wiggle/drag plumbing from `page.tsx`.
This task adds the props and renders the in-sheet `ArchiveIcon` plus a
"Move out" pill. It does **not** wire up the parent's drag-end handler
yet — that's Task 6.

**Files:**
- Modify: `apps/back-to-one/src/components/projects/OpenFolderSheet.tsx`
- Modify: `apps/back-to-one/src/app/projects/page.tsx` (pass new props)

- [ ] **Step 1: Add new props to the `OpenFolderSheetProps` type**

In `OpenFolderSheet.tsx`, extend the `OpenFolderSheetProps` interface
(currently around line 21):

```ts
interface OpenFolderSheetProps {
  open: boolean
  folder: FolderRef | null
  projects: Project[]
  onClose: () => void
  kicker?: string
  emptyMessage?: string
  onProjectClick?: (project: Project) => void
  onProjectLongPress?: (project: Project) => void
  folders?: FolderWithCount[]
  onFolderClick?: (folder: FolderRef) => void
  onFolderLongPress?: (folder: FolderRef) => void
  originPoint?: { x: number; y: number } | null

  // NEW — wiggle / drag wiring
  editMode?: boolean
  draggingProjectId?: string | null      // viewport-active drag's project id (for ghost styling)
  dragTargetId?: string | null           // current drag target id (for archive/move-out highlights)
  archivedCount?: number                 // number of archived projects (for ArchiveIcon label)
  onProjectTouchStart?: (e: React.TouchEvent, projectId: string) => void
  onArchiveTap?: () => void              // tap on in-sheet ArchiveIcon → swap to Archive variant
}
```

- [ ] **Step 2: Import `ArchiveIcon` and `ARCHIVE_FOLDER_ID` in `OpenFolderSheet.tsx`**

Add to the imports near the top:

```tsx
import { ArchiveIcon, ARCHIVE_FOLDER_ID } from '@/components/projects/ArchiveIcon'
```

- [ ] **Step 3: Wrap each project tile in a touch-start container**

The current grid renders `<SlateCard ... />` directly inside the grid
(from Task 3). Wrap each in a `motion.div` matching the home-grid
pattern so the parent's `onProjectTouchStart` can fire. Replace the
project mapping block from Task 3:

```tsx
                {projects.map((p, i) => {
                  const isDragging = draggingProjectId === p.id
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      onTouchStart={onProjectTouchStart ? (e => onProjectTouchStart(e, p.id)) : undefined}
                      style={{
                        position: 'relative',
                        touchAction: editMode ? 'none' : 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      <SlateCard
                        project={p}
                        color={p.color || '#6470f3'}
                        dimmed={!!draggingProjectId && !isDragging}
                        editMode={editMode ?? false}
                        isGhost={isDragging}
                        isDragging={false}
                        wiggleDelay={i * 0.08}
                        onClick={() => handleClick(p)}
                        onLongPress={onProjectLongPress ? () => onProjectLongPress(p) : (() => {})}
                      />
                    </motion.div>
                  )
                })}
```

- [ ] **Step 4: Render `ArchiveIcon` + "Move out" pill at the bottom of the grid**

Inside the same scrollable grid container, immediately after the
`{projects.map(...)}` block, add:

```tsx
                {editMode && folder?.id !== ARCHIVE_FOLDER_ID && (
                  <>
                    {/* Move-out pill — only visible while dragging a project. */}
                    {draggingProjectId && (
                      <div
                        data-move-out-target="__move_out__"
                        style={{
                          gridColumn: 'span 2',
                          display: 'flex',
                          justifyContent: 'center',
                          padding: '6px 2px 2px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 16px',
                            borderRadius: 20,
                            border: dragTargetId === '__move_out__'
                              ? `1.5px solid ${hexToRgba(accent, 0.7)}`
                              : `1px dashed ${hexToRgba(accent, 0.4)}`,
                            background: dragTargetId === '__move_out__'
                              ? hexToRgba(accent, 0.18)
                              : hexToRgba(accent, 0.04),
                            transform: dragTargetId === '__move_out__' ? 'scale(1.06)' : 'scale(1)',
                            transition: 'all 0.18s ease',
                            color: dragTargetId === '__move_out__' ? '#dddde8' : hexToRgba(accent, 0.7),
                          }}
                        >
                          <span style={{ fontSize: 13 }}>←</span>
                          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.1em' }}>
                            Move out
                          </span>
                        </div>
                      </div>
                    )}

                    {/* In-sheet Archive icon — drop target during drag, tap to
                        swap sheet contents to the Archive variant. */}
                    <ArchiveIcon
                      count={archivedCount ?? 0}
                      isDropTarget={dragTargetId === ARCHIVE_FOLDER_ID}
                      onClick={onArchiveTap ?? (() => {})}
                    />
                  </>
                )}
```

The conditional `folder?.id !== ARCHIVE_FOLDER_ID` ensures we don't
render an ArchiveIcon recursively when the user is already viewing the
Archive variant.

- [ ] **Step 5: Pass the new props through from `page.tsx`**

In `apps/back-to-one/src/app/projects/page.tsx`, find the
`<OpenFolderSheet ... />` JSX (around line 1090) and add these props:

```tsx
        editMode={editMode}
        draggingProjectId={dragProjectId && dragKindRef.current === 'project' ? dragProjectId : null}
        dragTargetId={dragTargetId}
        archivedCount={allArchivedProjects.length}
        onProjectTouchStart={(e, id) => handleTouchStart(e, id, 'project')}
        onArchiveTap={() => { haptic('light'); openFolder(ARCHIVE_FOLDER_ID) }}
```

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/back-to-one/src/components/projects/OpenFolderSheet.tsx apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
feat(projects): scaffold wiggle + drag inside OpenFolderSheet

Adds editMode, drag, archive, and move-out props to OpenFolderSheet.
Renders the shared ArchiveIcon and a "Move out" pill at the bottom of
the open folder grid when wiggle is on. Drag-end handler not yet wired
to the new targets — next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire drag-end handlers for in-folder source

`page.tsx`'s `handleTouchEnd` currently assumes the drag started on the
home grid. When a drag starts inside an open folder, the routing rules
are different (no folder-creation, reorder is folder-internal, move-out
is a new path). This task adds source-context awareness.

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Import the new mutation hook**

In `apps/back-to-one/src/app/projects/page.tsx`, add to the existing
import block from `@/lib/hooks/useOriginOne`:

```tsx
import {
  // ... existing imports ...
  useMoveProjectToRoot,
} from '@/lib/hooks/useOriginOne'
```

- [ ] **Step 2: Instantiate the mutation**

Right after the existing mutation declarations (around line 410, near
`placementMutation`), add:

```tsx
const moveProjectToRootMutation = useMoveProjectToRoot()
```

- [ ] **Step 3: Add a source-context ref**

In the drag-state ref block (around line 232–240), add:

```tsx
// Folder id at drag start; null = drag started on the home grid.
// Drives the drop-target routing in handleTouchEnd.
const dragSourceFolderIdRef = useRef<string | null>(null)
```

- [ ] **Step 4: Capture the source context in `handleTouchStart`**

Update `handleTouchStart` (currently lines 291–302) to also capture
the source folder id when wiggle is on inside an open folder:

```tsx
  const handleTouchStart = useCallback((e: React.TouchEvent, id: string, kind: 'project' | 'folder' = 'project') => {
    if (!editMode) return
    const touch = e.touches[0]
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const elX = touch.clientX - el.left
    const elY = touch.clientY - el.top
    pendingDragRef.current = { projectId: id, x: touch.clientX, y: touch.clientY, elX, elY, w: el.width }
    dragKindRef.current = kind
    // If a folder is open, the drag started inside that folder. Capture
    // the source folder id so handleTouchEnd can route correctly. If no
    // folder is open, source is the home grid (null).
    dragSourceFolderIdRef.current = openFolderId && openFolderId !== ARCHIVE_FOLDER_ID
      ? openFolderId
      : null
  }, [editMode, openFolderId])
```

- [ ] **Step 5: Extend the drag-target detection to include `data-move-out-target`**

In `handleTouchMove` (around line 364–393), update the `cardSelector`
construction:

```tsx
    const draggingFolder = dragKindRef.current === 'folder'
    const cardSelector = draggingFolder
      ? '[data-archive-target]'
      : '[data-project-id], [data-folder-id], [data-archive-target], [data-move-out-target]'
```

And inside the loop, ensure the move-out target's id resolves correctly
by adding it to the destructure:

```tsx
      const id = el.dataset.projectId ?? el.dataset.folderId ?? el.dataset.archiveTarget ?? el.dataset.moveOutTarget
```

The move-out target uses a generous radius like the Archive icon — adjust
the `radius` calculation:

```tsx
      const isArchive = id === ARCHIVE_FOLDER_ID
      const isMoveOut = id === '__move_out__'
      const radius = isArchive || isMoveOut ? 60 : 30
```

- [ ] **Step 6: Branch in `handleTouchEnd` on source folder context**

Update `handleTouchEnd` (currently lines 532–606). Replace the entire
function body with a version that branches on source context:

```tsx
  const handleTouchEnd = useCallback(() => {
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
    pendingDragRef.current = null

    const draggedId = dragProjectIdRef.current
    const targetId = dragTargetIdRef.current
    const targetIdx = dragTargetIdxRef.current
    const kind = dragKindRef.current
    const sourceFolderId = dragSourceFolderIdRef.current

    if (draggedId && meId) {
      const targetIsArchive = targetId === ARCHIVE_FOLDER_ID
      const targetIsMoveOut = targetId === '__move_out__'
      const targetIsFolder = targetId && allFolders.some(f => f.id === targetId)
      const targetIsProject = targetId && allProjects.some(p => p.id === targetId)

      if (sourceFolderId) {
        // ── Drag started INSIDE an open folder ──
        if (targetIsArchive) {
          haptic('medium')
          archiveMutation.mutate(draggedId)
        } else if (targetIsMoveOut) {
          haptic('medium')
          moveProjectToRootMutation.mutate(draggedId)
        } else if (kind === 'project' && targetId && targetIsProject) {
          // Folder-internal reorder — only valid if target is also in the same folder.
          const folderProjs = folderProjects.get(sourceFolderId) ?? []
          const targetInSameFolder = folderProjs.some(p => p.id === targetId)
          if (targetInSameFolder) {
            haptic('light')
            // Find target's position; insert dragged before/after based on
            // dragTargetIdx convention (already set by handleTouchMove).
            const filtered = folderProjs.filter(p => p.id !== draggedId)
            const beforeIdx = Math.max(0, targetIdx - 1)
            const afterIdx = Math.min(filtered.length - 1, targetIdx)
            // Use placement sortOrders if available, else fall back to indices.
            const beforePlacement = allPlacements.find(p => p.projectId === filtered[beforeIdx]?.id && p.folderId === sourceFolderId)
            const afterPlacement  = allPlacements.find(p => p.projectId === filtered[afterIdx]?.id && p.folderId === sourceFolderId)
            const beforeSO = beforePlacement?.sortOrder ?? 0
            const afterSO  = afterPlacement?.sortOrder ?? beforeSO + 1024
            const newSO = Math.floor((beforeSO + afterSO) / 2)
            placementMutation.mutate({
              userId: meId,
              projectId: draggedId,
              folderId: sourceFolderId,
              sortOrder: newSO,
            })
          }
        }
        // No top-level reorder, no folder-creation, no folder→folder. Drops
        // on anything else inside the sheet are no-ops (snap back).
      } else {
        // ── Drag started on the home grid — existing behavior ──
        if (targetIsArchive) {
          haptic('medium')
          if (kind === 'project') {
            archiveMutation.mutate(draggedId)
          } else {
            archiveFolderMutation.mutate(draggedId)
          }
        } else if (kind === 'project' && targetId && targetIsFolder) {
          haptic('light')
          const folderProjList = folderProjects.get(targetId) ?? []
          placementMutation.mutate({
            userId: meId,
            projectId: draggedId,
            folderId: targetId,
            sortOrder: folderProjList.length,
          })
        } else if (kind === 'project' && targetId && targetIsProject) {
          haptic('medium')
          const draggedItem = homeItems.find(i => i.kind === 'project' && i.id === draggedId)
          createFolderMutation.mutate(
            { userId: meId, name: 'Untitled', color: null, sortOrder: draggedItem?.sortOrder ?? 0 },
            {
              onSuccess: (folder) => {
                placementMutation.mutate({ userId: meId, projectId: draggedId, folderId: folder.id, sortOrder: 0 })
                placementMutation.mutate({ userId: meId, projectId: targetId,  folderId: folder.id, sortOrder: 1 })
              },
            }
          )
        } else if (targetIdx >= 0) {
          const reordered = homeItems.filter(i => i.id !== draggedId)
          const beforeSO = targetIdx > 0 ? reordered[targetIdx - 1]?.sortOrder ?? 0 : 0
          const afterSO  = reordered[targetIdx]?.sortOrder ?? beforeSO + 1024
          const newSO = Math.floor((beforeSO + afterSO) / 2)
          if (kind === 'project') {
            placementMutation.mutate({ userId: meId, projectId: draggedId, folderId: null, sortOrder: newSO })
          } else {
            updateFolderMutation.mutate({ id: draggedId, fields: { sortOrder: newSO } })
          }
        }
      }
    }

    // Reset
    dragProjectIdRef.current = null
    dragTargetIdRef.current = null
    dragTargetIdxRef.current = -1
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    dragSourceFolderIdRef.current = null
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDragTargetIdState(null)
  }, [meId, allProjects, allFolders, allPlacements, folderProjects, homeItems, placementMutation, createFolderMutation, archiveMutation, archiveFolderMutation, updateFolderMutation, moveProjectToRootMutation])
```

- [ ] **Step 7: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds. The dependency array is long; if TypeScript
flags an unused variable, audit the closure.

- [ ] **Step 8: Manual smoke test**

```bash
pnpm --filter @back-to-one dev
```

Test sequence in the browser:
1. Long-press home grid → wiggle on.
2. Tap a folder open. Tiles inside should wiggle.
3. Drag a project tile onto another tile inside the same folder → reorders.
4. Drag a project tile onto the in-sheet Archive icon → archives.
5. Drag a project tile onto the "Move out" pill → returns to home grid.
6. Tap the in-sheet Archive icon (no drag) → sheet swaps to Archive
   contents (this works automatically because `onArchiveTap` calls
   `openFolder(ARCHIVE_FOLDER_ID)`, which updates `openFolderId` and
   re-renders the sheet with the Archive variant).
7. Tap an archived folder card inside Archive → sheet swaps again to
   show that folder's contents.
8. Tap Back → sheet closes, home grid still wiggling.

If any step misbehaves, fix before commit. Common pitfalls:
- Move-out pill not registering as a target → check that `data-move-out-target` is
  on the right element (the wrapper div, not the inner styled div).
- Reorder placing item at wrong position → verify the
  beforeSO/afterSO calculation uses placement rows for the same folder.

- [ ] **Step 9: Commit**

```bash
git add apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
feat(projects): in-folder reorder, archive, and move-out

Drag-end now branches on whether the drag started inside an open folder
or on the home grid. Inside-folder drags route to:
- archive icon → archive the project
- "Move out" pill → clear folderId, return to home grid
- another tile in same folder → reorder placement sortOrder

Top-level reorder, folder-creation-from-project-onto-project, and
folder-into-folder remain home-grid-only (no nesting).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Polish the Archive↔Folder swap animation

When the user taps the in-sheet Archive icon, the sheet should swap
contents without re-running the open animation. Currently `openFolder()`
sets `openFolderOrigin` to a new value every call — when the sheet is
already open, that resets the transform-origin and (depending on
Framer Motion's reconciliation) can cause a visible flicker.

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Skip origin recompute when the sheet is already open**

In `apps/back-to-one/src/app/projects/page.tsx`, update the `openFolder`
callback (currently lines 444–456):

```tsx
  const openFolder = useCallback((id: string) => {
    // If the sheet is already open, this is a swap (e.g. tap Archive
    // while another folder is open). Don't recompute the origin —
    // we want the close-back-into-source-tile gesture to still target
    // the original tile. Just swap the openFolderId.
    if (openFolderId) {
      setOpenFolderId(id)
      return
    }
    const selector = id === '__archive__'
      ? '[data-archive-target]'
      : `[data-folder-id="${id}"]`
    const el = document.querySelector(selector) as HTMLElement | null
    if (el) {
      const r = el.getBoundingClientRect()
      setOpenFolderOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    } else {
      setOpenFolderOrigin(null)
    }
    setOpenFolderId(id)
  }, [openFolderId, setOpenFolderId])
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Run dev server, repeat steps 6 and 7 from Task 6 Step 8. The swap from
a regular folder into Archive should be a clean content cross-fade — no
flicker, no re-zoom from a new origin. Tapping Back from the Archive
view (which was reached via swap) closes back into… the original folder
card you opened first. (This is acceptable — the user's mental model is
"I opened that folder, then went to Archive; closing means going home.")

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
fix(projects): preserve open-folder origin when swapping to Archive

When the sheet is already open and the user taps Archive (or an
archived folder) to swap contents, don't recompute originPoint. The
close animation should still scale-back into the originally-tapped
tile, and the swap itself should be a simple content cross-fade.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add `useUpdateTeamName` mutation

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1: Add the queries.ts helper**

In `apps/back-to-one/src/lib/db/queries.ts`, add (anywhere near the
other Team helpers; if none exist, place near `getMyTeam`):

```ts
/**
 * Update the team's name. RLS enforces the viewer must be a TeamMember
 * (policy `team_update` in migration 20260428005845_rls_helpers_and_policies).
 */
export async function updateTeamName(teamId: string, name: string) {
  const db = createClient()
  const { error } = await db
    .from('Team')
    .update({ name, updatedAt: new Date().toISOString() })
    .eq('id', teamId)
  if (error) { console.error('updateTeamName failed:', error); throw error }
}
```

- [ ] **Step 2: Add the hook**

In `apps/back-to-one/src/lib/hooks/useOriginOne.ts`, near `useMyTeam`
(around line 478) or with the other folder mutations — pick whichever
matches the file's existing organization. Add:

```ts
export function useUpdateTeamName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      db.updateTeamName(teamId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myTeam'] }),
  })
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "$(cat <<'EOF'
feat(projects): add useUpdateTeamName mutation

Wraps an UPDATE on Team.name. RLS (team_update policy) enforces the
viewer is a TeamMember. UI gates the rename pencil to producer-only
visibility as a separate layer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Build the `TeamNameSheet` component

A glass sheet that prompts for a new team name. Modeled on
`NewFolderSheet.tsx` (which is small and well-scoped — read it first).

**Files:**
- Create: `apps/back-to-one/src/components/projects/TeamNameSheet.tsx`

- [ ] **Step 1: Read the reference component**

Read `apps/back-to-one/src/components/projects/NewFolderSheet.tsx`
(85 lines). The new sheet uses the same styling, focus management, and
backdrop pattern.

- [ ] **Step 2: Create the file**

Create `apps/back-to-one/src/components/projects/TeamNameSheet.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from '@/lib/utils/haptics'

interface TeamNameSheetProps {
  open: boolean
  currentName: string
  onClose: () => void
  onSave: (name: string) => Promise<void> | void
}

export function TeamNameSheet({ open, currentName, onClose, onSave }: TeamNameSheetProps) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(currentName)
      // Defer focus a tick so the slide-in animation doesn't fight the keyboard.
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, currentName])

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed !== currentName.trim()

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    haptic('medium')
    try {
      await onSave(trimmed)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="team-name-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 30,
            background: 'rgba(4,4,10,0.78)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <motion.div
            key="team-name-sheet"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '20px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(10,10,18,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 -32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(196,90,220,0.6)' }}>
              Team Name
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              maxLength={80}
              placeholder="Production company"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#dddde8',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dddde8', fontSize: 13,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  background: canSave && !saving ? '#c45adc' : 'rgba(196,90,220,0.3)',
                  border: '1px solid rgba(196,90,220,0.6)',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  cursor: canSave && !saving ? 'pointer' : 'default',
                  opacity: canSave && !saving ? 1 : 0.6,
                }}
              >{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/components/projects/TeamNameSheet.tsx
git commit -m "$(cat <<'EOF'
feat(projects): add TeamNameSheet component

Glass bottom sheet for renaming the production company. Modeled on
NewFolderSheet — same backdrop, same border-radius, same focus pattern.
Save disabled when the input is empty or unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Wire the rename pencil + sheet into `page.tsx`

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Import the new sheet and hook**

In `apps/back-to-one/src/app/projects/page.tsx`, add to the imports:

```tsx
import { TeamNameSheet } from '@/components/projects/TeamNameSheet'
import {
  // ...existing...
  useUpdateTeamName,
} from '@/lib/hooks/useOriginOne'
```

- [ ] **Step 2: Instantiate state + mutation**

Near the other state hooks (around line 412 with `creatingFolder`), add:

```tsx
const [renamingTeam, setRenamingTeam] = useState(false)
const updateTeamNameMutation = useUpdateTeamName()
```

- [ ] **Step 3: Render the pencil next to the H1**

Find the H1 in the header (currently line 689):

```tsx
<h1 className="font-sans" style={{ fontWeight: 800, fontSize: '1.6rem', color: '#dddde8', letterSpacing: '-0.03em', lineHeight: 1 }}>{myTeam?.name ?? 'Projects'}</h1>
```

Replace with a wrapper that includes the pencil:

```tsx
<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
  <h1 className="font-sans" style={{ fontWeight: 800, fontSize: '1.6rem', color: '#dddde8', letterSpacing: '-0.03em', lineHeight: 1 }}>
    {myTeam?.name ?? 'Projects'}
  </h1>
  {editMode && myTeam && (
    <button
      onClick={() => { haptic('light'); setRenamingTeam(true) }}
      className="active:opacity-60 transition-opacity"
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'rgba(196,90,220,0.12)',
        border: '1px solid rgba(196,90,220,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
      aria-label="Rename team"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M11.5 1.5l3 3-9 9-3.5.5.5-3.5 9-9z" stroke="#c45adc" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )}
</div>
```

- [ ] **Step 4: Mount the sheet**

Near the bottom of the JSX, alongside the other sheets (e.g. just below
`<NewFolderSheet ... />` at the end of the file, before the closing
`</div>` of the page wrapper), add:

```tsx
<TeamNameSheet
  open={renamingTeam}
  currentName={myTeam?.name ?? ''}
  onClose={() => setRenamingTeam(false)}
  onSave={async (name) => {
    if (!myTeam) return
    await updateTeamNameMutation.mutateAsync({ teamId: myTeam.id, name })
  }}
/>
```

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @back-to-one build
```

Expected: build succeeds.

- [ ] **Step 6: Manual smoke test**

```bash
pnpm --filter @back-to-one dev
```

In the browser:
1. Long-press home grid → wiggle on. The pencil should appear next to
   the team name.
2. Tap pencil → sheet slides up with the team name pre-filled.
3. Type a new name, tap Save. Sheet closes; H1 reflects the new name
   immediately (React Query invalidates `['myTeam']`).
4. Toggle wiggle off (tap Done). Pencil disappears.
5. Toggle wiggle on, tap pencil, hit Cancel. Nothing changes.
6. Tap pencil with the existing name unchanged → Save is disabled.

If the sheet appears below the keyboard or focus is lost, check the
80ms `setTimeout` in `TeamNameSheet`'s focus useEffect.

- [ ] **Step 7: Commit**

```bash
git add apps/back-to-one/src/app/projects/page.tsx
git commit -m "$(cat <<'EOF'
feat(projects): wiggle-mode pencil to rename the production company

Pencil glyph appears next to the page H1 only when wiggle is active.
Tap opens TeamNameSheet for inline rename. Mutation invalidates the
myTeam query so the H1 reflects the new name immediately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Full-page smoke test

End-to-end manual verification of every spec acceptance criterion.

**Files:** None (test only).

- [ ] **Step 1: Start dev server**

```bash
pnpm --filter @back-to-one dev
```

- [ ] **Step 2: Walk the spec's acceptance list**

In a browser at `http://localhost:3000/projects`:

1. **Wiggle inside folder works.** Long-press the grid. Tap a folder.
   Tiles wiggle. Drag one onto another → reorders.
2. **Drag onto Archive from inside folder.** While wiggling inside a
   folder, drag a tile onto the Archive icon at the bottom of the
   sheet. Tile disappears; close the folder, tap Archive at the home
   grid → archived tile is there.
3. **Drag onto Move-out from inside folder.** While wiggling inside a
   folder, drag a tile onto "← Move out" pill. Tile disappears from
   folder; close the folder → tile is back on the home grid at the end.
4. **Tap-to-Archive swap.** While a regular folder is open, tap the
   in-sheet Archive icon. Sheet contents swap to Archive without
   close+reopen.
5. **Archive folder drill-in.** From the Archive view, tap an archived
   folder card → swap to that folder's archived contents.
6. **Back closes sheet.** From any sheet state, tap Back (or backdrop)
   → sheet closes, home grid still wiggling.
7. **Tap project routes.** With wiggle off, tap any project (home or
   inside a folder) → routes to that project's page.
8. **Pencil rename.** Wiggle on → pencil appears. Tap → sheet opens.
   Save new name → H1 updates immediately. Toggle wiggle off → pencil
   gone.
9. **Visual parity.** Open a folder, compare a project tile inside
   against one on the home grid. They should be visually identical
   (top stripe, slate body, name, client, phase pill).

- [ ] **Step 3: Note any regressions**

If any acceptance criterion fails, fix in the relevant earlier task
and re-run from there. Do not proceed until every step passes.

- [ ] **Step 4: Stop the dev server**

`Ctrl+C` in the terminal.

- [ ] **Step 5: No commit**

---

## Task 12: Final handoff

**Files:** None.

- [ ] **Step 1: Confirm clean tree on the feature branch**

```bash
git status -sb
git log --oneline main..HEAD
```

Expected: working tree clean (or only untracked files unrelated to this
feature). The log should show ~10 commits — one per implementation
task plus the spec/plan commits already on the branch.

- [ ] **Step 2: Final build**

```bash
pnpm --filter @back-to-one build
```

Expected: success.

- [ ] **Step 3: Print user-facing summary**

Tell Clyde:

```
Project selection polish landed on feat/project-selection-polish.

What changed:
  - Wiggle inside any open folder (reorder, drag-to-archive, drag-to-
    move-out via the new "← Move out" pill).
  - Archive icon visible inside the open folder sheet — drop target
    during drag, tap to swap sheet contents to Archive.
  - Project tiles inside folders are now identical to the home grid
    (extracted SlateCard).
  - Pencil glyph next to the page title in wiggle mode opens
    TeamNameSheet to rename the production company.

Schema: untouched. RLS: existing team_update policy gates the rename.

Branch is ahead of main by ~10 commits. Push and open a PR when ready.
```

---

## Self-review notes

**Spec coverage check** (vs `2026-04-29-project-selection-polish-design.md`):

- Section 1 — Wiggle inside open folder → Tasks 5 + 6.
- Section 2 — Archive↔Folder navigation swap → Tasks 5 (in-sheet ArchiveIcon
  rendering) + 7 (origin preservation on swap).
- Section 3 — SlateCard unification → Tasks 1 + 3.
- Section 4 — Team rename → Tasks 8 + 9 + 10.
- Section 5 — Mutations / queries → Tasks 4 (`useMoveProjectToRoot`) +
  8 (`useUpdateTeamName`).
- Section 6 — Edge cases → covered in the manual smoke test (Task 11).
- Risks — `Team.name` RLS coverage flagged in spec; verified in Task 8
  Step 1 (cites the existing `team_update` policy from migration
  `20260428005845_rls_helpers_and_policies`).
- File layout — matches spec's stated layout exactly.

**No placeholders** — every step has concrete code or a concrete
command. No "TBD," "etc.," or "similar to."

**Type consistency**:
- `SlateCardProps` (Task 1) — used in Task 3 (`OpenFolderSheet` rendering)
  and Task 5 (wrapped in `motion.div`). Same prop names throughout.
- `useMoveProjectToRoot` (Task 4) — `mutationFn: (projectId: string)` —
  consumed in Task 6 as `moveProjectToRootMutation.mutate(draggedId)`.
  Match.
- `useUpdateTeamName` (Task 8) — `{ teamId, name }` — consumed in Task 10
  as `updateTeamNameMutation.mutateAsync({ teamId: myTeam.id, name })`.
  Match.
- `ARCHIVE_FOLDER_ID` (Task 2) — exported from `ArchiveIcon.tsx`,
  imported in `page.tsx` (Task 2) and `OpenFolderSheet.tsx` (Task 5).
  Same string sentinel `'__archive__'`.
