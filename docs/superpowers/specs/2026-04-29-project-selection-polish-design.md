# Project Selection Polish — Design

Date: 2026-04-29
Status: Approved (awaiting plan)

## Problem

The project selection page has three rough edges that surface every time a
producer opens it:

1. **Wiggle mode is half-built.** Long-press on the home grid enters wiggle
   and lets you drag projects into folders or onto Archive — but tap a
   folder open and the projects inside go static. No reorder, no archive,
   no way out. Users either close the folder, archive from outside, or
   give up.
2. **Visual mismatch.** The home grid renders projects as `SlateCard` (top
   stripe, slate body, specific aspect ratio + padding). The open folder
   sheet renders a separate local `ProjectTile` that's *almost* the same
   but visibly different (slightly different fonts, no slate stripes).
   Two cards purporting to be the same thing.
3. **No way to name the production company.** The page H1 reads
   `myTeam?.name ?? 'Projects'` but there's no UI anywhere to edit
   `Team.name`. New teams created via `/bt1-new-team` get whatever name
   was typed at creation time — and after that, it's frozen unless
   someone runs SQL.

## Goal

Three changes, one PR, one surface (`apps/back-to-one/src/app/projects/`):

1. Wiggle works **inside** an open folder: reorder, archive, and "move
   back out" gestures, with the Archive icon visible the whole time.
2. Project tiles look identical inside and outside folders by extracting
   `SlateCard` into a shared component.
3. The Team name is editable via a small pencil that appears next to the
   H1 in wiggle mode, opening a rename sheet.

## Non-goals

- No schema changes. `Team.name` exists; `UserProjectPlacement.folderId`
  is already the in-folder pointer; archive mutations exist for both
  projects and folders.
- No nested folders. The existing rule (no folder inside a folder) holds.
- No team-level settings beyond name (no color, no logo, no billing) —
  YAGNI; expand only when a real production needs it.
- No drag-to-Archive of an entire folder *from inside that folder*. The
  drag affordance applies to projects only. Archiving a folder still
  happens via the existing `FolderActionSheet`.

## Surface — what changes

### 1. Wiggle inside the open folder

`OpenFolderSheet` becomes wiggle-aware. The home grid still owns
`editMode` state in `apps/back-to-one/src/app/projects/page.tsx`. Wiggle
turns on at the home grid via the existing long-press; tapping a folder
opens the sheet **with wiggle still active** — the sheet receives
`editMode` as a prop and decorates its tiles accordingly.

**New props on `OpenFolderSheet`:**
- `editMode: boolean`
- `onProjectReorder(projectId, fromIndex, toIndex)` — same signature the
  home grid already uses for placement order writes.
- `onProjectArchive(projectId)` — defers to the parent's existing
  `archiveMutation`.
- `onProjectMoveOut(projectId)` — clears the project's `folderId` (sets
  `UserProjectPlacement.folderId = NULL`).

**Drag mechanics** — reuse the parent's `handleTouchStart` /
`handleTouchMove` infrastructure (lines 291–399 in `page.tsx`), now
extended to accept slot elements rendered inside the open folder sheet.
Slots in the open folder carry the same `data-project-id` attribute the
home grid already uses, so the slot-finding code (line 339) just sees
more tiles when a folder is open.

**Drop targets active during a folder-internal drag:**

| Target | DOM marker | Action |
| --- | --- | --- |
| Another project tile in the folder | `data-project-id` | Reorder within folder |
| **Archive icon (rendered inside the sheet)** | `data-archive-target` | Archive the project |
| **"Move out" pill** | `data-move-out-target` | Clear `folderId` → project returns to home grid |

**Archive icon placement.** The existing Archive icon (`page.tsx`
lines 877–918) lives inside the home grid as a 2-col-span row, which
means it scrolls with the grid and gets occluded by the open folder
sheet's backdrop. Rather than lifting it to a fixed-position global
element (more visual surgery than the polish warrants), we render a
**second Archive icon inside `OpenFolderSheet`** — same component, same
`data-archive-target` attribute, same `onClick` handler. The home-grid
Archive icon stays put and serves the home grid; the in-sheet Archive
icon serves folder-internal interactions. Two DOM nodes with the same
`data-archive-target` attribute is fine — the drag-detection code
(`page.tsx:339`) already works against multiple rects and the home-grid
one's bounds sit outside the sheet's visible area when scrolled, so
it's never the closest target during a folder-internal drag.

To avoid duplicating the Archive icon's JSX in two places, extract it
to `apps/back-to-one/src/components/projects/ArchiveIcon.tsx`. Both
`page.tsx` and `OpenFolderSheet` import it. Props:
`{ isDropTarget: boolean; onClick: () => void }`.

**"Move out" pill placement.** Renders only when `editMode &&
draggingProjectId` inside the open folder sheet, sitting in the same
bottom-row layout as the in-sheet Archive icon (side-by-side). Labeled
"← Move out", glass pill matching the design language. On hover,
highlights with the folder's accent color.

**Folders are not draggable from inside a folder.** Drag-kind detection
(`dragKindRef`, line 234) already short-circuits this: `OpenFolderSheet`
won't render `data-folder-id` on any of its tiles in the project view.

### 2. Archive ↔ Folder navigation swap

While a folder is open in any mode (wiggle on or off), tapping the
**in-sheet Archive icon** swaps the sheet's contents to the Archive
variant rather than closing-then-reopening:

- From a project folder, tap Archive → sheet stays mounted, contents
  re-render as the Archive variant (`kicker="Archive"`, archived
  projects + archived folders).
- From the Archive variant, tap an archived folder → sheet swaps to
  that folder's Archive sub-view (already supported via existing
  `folders` prop on the Archive variant).
- Back button on the open folder sheet always closes the sheet entirely
  (returns to home grid). Same as today.

Implementation: lift the open-folder selection state in `page.tsx` from
"project folder open" / "archive open" to a single
`openFolder: { kind: 'project' | 'archive'; folderId?: string } | null`
discriminated union. The bar's Archive icon's `onClick` becomes
`setOpenFolder({ kind: 'archive' })` instead of `closeFolder() +
setShowArchive(true)`.

### 3. SlateCard unification

Extract `SlateCard` from `page.tsx` (currently defined inline at
line 101) into `apps/back-to-one/src/components/projects/SlateCard.tsx`
as a default export plus props type. The home grid imports it; the
open folder sheet imports it; the local `ProjectTile` in
`OpenFolderSheet.tsx` is deleted.

Props the extracted `SlateCard` needs (matching today's inline usage):

```ts
type SlateCardProps = {
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
```

`OpenFolderSheet`'s `onProjectLongPress` and `onProjectClick` callbacks
map to `onLongPress` and `onClick` directly. `dimmed` is always `false`
inside the open folder. `wiggleDelay` is computed from the tile's index
in the folder list, same formula as the home grid (`i * 0.08`).

`FolderTile` (used today by the Archive variant to render archived
folders inline) stays — folders aren't projects, and that variant is
unaffected.

### 4. Team rename

In wiggle mode, the H1 title in `page.tsx` line 689 gets a small pencil
glyph (16px, low-opacity outline icon) immediately to the right of the
team name. Tapping the pencil opens a new `TeamNameSheet` component:

- File: `apps/back-to-one/src/components/projects/TeamNameSheet.tsx`
- Props: `{ open: boolean; currentName: string; onClose: () => void; onSave: (name: string) => Promise<void> }`
- Layout: the same glass sheet pattern used by `NewFolderSheet` —
  20px border-radius, accent line, single-line text input pre-filled
  with `currentName`, two buttons (Cancel / Save). Save is disabled when
  the input is empty/whitespace-only or matches `currentName`.
- On Save: call `useUpdateTeamName({ teamId, name }).mutateAsync()`,
  then close.

Pencil visibility: gated entirely by `editMode`. When wiggle exits, the
pencil disappears. The H1 itself remains a non-interactive heading in
both modes — only the pencil is tappable.

### 5. Mutations / queries (new and reused)

**New hooks** in `apps/back-to-one/src/lib/hooks/useOriginOne.ts`:

- `useMoveProjectToRoot()` — `mutateAsync(projectId)` updates the
  authenticated viewer's `UserProjectPlacement` row to set
  `folderId = NULL`. If no placement row exists, inserts one with
  `folderId = NULL` and `position` at the end of the home-grid list.
  Invalidates `['userProjectPlacements', authId]`.
- `useUpdateTeamName()` — `mutateAsync({ teamId, name })` updates
  `Team.name` for the team the viewer is producer/director on (RLS
  enforces). Invalidates `['myTeam', authId]`.

**Reused, no change:**
- `useArchiveProject` — fired from drag-onto-Archive inside a folder.
- The existing placement-position write the home grid uses for
  drag-reorder — extended to apply to in-folder reorders by passing the
  folder's project list instead of the root list.

### 6. Empty / edge-case behavior

- **Folder empty after move-out.** Sheet stays open showing its empty
  state; user closes manually if they want to.
- **Drag a project to "Move out" then immediately re-open the folder.**
  The mutation has settled by the time the sheet re-mounts; no stale
  data shown.
- **Team rename to empty.** Save disabled.
- **Team rename while not a producer/director.** RLS rejects; `onSave`
  surfaces a toast via the same error path other mutations use. (The
  pencil shouldn't show for non-producers in the first place — gated by
  `useViewerRole(undefined).role === 'producer'`.)
- **No team yet (auth not bound).** `myTeam` is null → pencil hidden,
  H1 shows the "Projects" fallback.
- **Concurrent drag and tap.** Existing drag-start hysteresis covers
  this; no change.
- **Reorder inside folder while another viewer reorders the same
  folder.** Last-write-wins on `position`, matching today's home-grid
  behavior. No CRDT, no merge.

## File layout

```
apps/back-to-one/src/
  app/projects/page.tsx                            ← MODIFY
    - extract SlateCard out (move to new file below)
    - extract Archive icon out (move to new file below)
    - lift openFolder state to discriminated union
    - pass editMode/onProjectReorder/onProjectArchive/onProjectMoveOut
      to OpenFolderSheet
    - render pencil glyph next to H1 when editMode
    - mount TeamNameSheet
  components/projects/
    SlateCard.tsx                                  ← CREATE
    ArchiveIcon.tsx                                ← CREATE (shared by home grid + open folder sheet)
    OpenFolderSheet.tsx                            ← MODIFY
      - delete local ProjectTile
      - import & render SlateCard
      - import & render ArchiveIcon (with its own onClick that swaps
        sheet contents to Archive variant)
      - render Move-out pill when editMode && dragging
      - accept editMode/onProjectReorder/etc. props
    TeamNameSheet.tsx                              ← CREATE
  lib/hooks/useOriginOne.ts                        ← MODIFY
    - add useMoveProjectToRoot
    - add useUpdateTeamName
  lib/db/queries.ts                                ← MODIFY
    - add moveProjectToRoot helper
    - add updateTeamName helper
```

## Risks / open questions

- **`SlateCard` extraction is mechanical but big** — the inline version
  is ~90 lines and references `editMode`, drag props, and a keyframes
  block (line 196). The keyframes need to live globally; either move
  them to `globals.css` or keep them in `page.tsx` (referenced by class
  name from the extracted component). Plan picks one.
- **Move-out pill placement.** The open folder sheet has fixed top/bottom
  insets. The pill must not overlap the FAB (`useFabAction`) or the
  Archive icon; both also live near the bottom of the screen. The plan
  needs to verify visually before declaring done.
- **Archive↔Folder swap and the close animation.** The existing close
  animation scales-into the source tile via `transformOriginPx`. When
  swapping rather than closing, we don't want that animation to fire —
  the transition needs to be a content cross-fade only. The plan
  identifies the specific Framer Motion change.
- **`Team.name` RLS coverage.** The UI gates the rename pencil on
  producer role, but the plan must verify the underlying SQL/RLS policy
  rejects non-producer attempts as a backstop. If no policy exists on
  `public."Team"` updates today, the plan adds one (or scopes that as
  out-of-band work for the Auth-day RLS pass). Spec acceptance assumes
  a backstop is in place.

## Acceptance

A producer can:

1. Long-press the home grid, enter wiggle, tap a folder. Projects inside
   the folder wiggle. Drag one tile onto another to reorder. Drag a
   tile onto the Archive icon — it disappears and shows up in Archive.
   Drag a tile onto "Move out" — it leaves the folder and reappears on
   the home grid. Tap the Archive icon — the sheet swaps to Archive
   without closing. Tap an archived folder — the sheet swaps to that
   folder's archive sub-view. Tap Back — the sheet closes, the home
   grid is still wiggling.
2. Tap any project at any point — it routes to that project's page.
3. In wiggle mode, tap the pencil next to the page title — a sheet
   opens, type a new team name, hit Save. The H1 reflects the new name
   immediately. Cancel — no change.
4. The project tile inside a folder is visually identical to the same
   tile on the home grid (top stripe, accent color, name + client
   typography, aspect ratio).
