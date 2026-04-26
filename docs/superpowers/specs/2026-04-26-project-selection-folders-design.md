# Project-selection folders — design

**Date:** 2026-04-26
**Status:** Spec — pending implementation plan
**Surface:** `apps/back-to-one/src/app/projects/page.tsx` (project-selection root)
**Ships in two PRs** per repo discipline: a *schema PR* (the two new tables + migration + `prisma generate` + all-three-apps compile check), then the *UI PR* (queries, hooks, components, page changes).

---

## Goal

Let a user organize their project list on the selection page into personal folders, with a smooth iOS-Home-Screen-style interaction model. Folders are per-user and never shared with the team — each user may have a different set of projects (per the membership model) and arranges their own home view.

The primary use case is grouping by client (e.g., a "Lumière" folder containing every project for that client). The system enables that pattern without enforcing it: folder names are freeform.

## Non-goals

- Shared / team-level folders. Pre-Auth: every viewer resolves to the same `useMeId()` placeholder, so de facto everyone sees the same folders during demo. Post-Auth, folders are per-user.
- Folder nesting. Folders contain projects, not other folders.
- Tagging / multi-folder membership. A project lives in *exactly one* place: top-level OR inside one folder.
- Producer / role gating on folder usage. Pre-Auth this is open to everyone; post-Auth still open to all roles.

---

## User experience

### Edit mode (wiggle) entry

Long-press anywhere on a project or folder card (matching the existing `useLongPress` 500ms threshold) → all cards begin wiggling. The current "Reorder" pill at the bottom of the grid goes away (long-press is the entry).

In wiggle mode:

- **Drag** any card → the existing direct-DOM drag system from `projects/page.tsx` (300ms hold-to-pick-up, then floating card follows finger).
- **Tap** a wiggling card → open the existing `ProjectActionSheet` for that card. For folders, a parallel `FolderActionSheet` opens with rename / color / delete.
- **Tap empty grid space** → exit wiggle (subtle haptic on exit).
- **Tap** any card *outside* wiggle mode (i.e. in normal navigation) → behaves exactly as today (route to `/projects/<id>`). Folders → see "Open folder".

### Open a folder (iOS-style zoom)

Tap a folder card outside wiggle:

1. Background grid + bar dim and blur (5px) — uses the existing dim-overlay pattern from chat / threads / resources sheets, extended to cover folder-open state via `RootFabContext`.
2. Folder card visually scales up from its grid position to fill ~84% of the viewport, centered. Easing matches the existing panel-detail slide (`[0.32, 0.72, 0, 1]`, ~280ms).
3. Inside the open folder: header with folder name + project count, then the same 2-column slate-card grid of contained projects (using the existing `SlateCard` component verbatim).
4. Tap a project inside → routes into the project (existing `/projects/<id>` flow).
5. Tap outside the open folder, or tap the bar's Back button (newly added in PR #37 — perfect fit), or swipe down → folder closes by reversing the zoom back to its grid position.

While open, the folder is the only foreground surface — fan / chat / threads / resources sheets remain mutually exclusive with it via the `RootFabContext` close-stack pattern.

### Folder card appearance (in the grid)

Folders sit in the same 2-column grid as project slate cards and share their aspect ratio (matching the existing project-card proportions, ~4:3) so they don't disrupt the grid rhythm.

Inside the folder card:

- A mini-grid of slate-shaped tiles, one per contained project. Each tile preserves the slate identity at small scale: rounded rect, the project's accent stripe at the top, the dark per-project body color.
- A label row at the bottom: folder name + project count (mono, dim).
- The folder's accent color outlines the card (1px @ 22% alpha).

**Mini-grid scaling rules:**

| Project count | Layout      | Notes                                                  |
|---------------|-------------|--------------------------------------------------------|
| 1             | 1×1         | Single large tile                                      |
| 2             | 1×2         | Side-by-side                                           |
| 3             | 2×2         | One empty placeholder tile (dashed)                    |
| 4             | 2×2         | Full                                                   |
| 5–9           | 3×3         | Tiles get smaller; remaining cells empty placeholders  |
| 10+           | 3×3         | First 8 tiles + last cell as `+N` overflow indicator   |

The folder still opens to show all contained projects regardless of overflow.

### Drag-and-drop interactions

All in wiggle mode. On `touchmove` while a card is being dragged:

- **Hover-snap activation** — when the dragged card's center is within ~30px of another card's center, that target enters the *active drop* state.
- **Magnetic ring feedback** — the active target gets a 2px violet outer ring + soft outer glow (`box-shadow: 0 0 0 2px ${ACCENT}b3, 0 0 30px ${ACCENT}80`) and scales to 1.04. Haptic light tick fires on activation. Same visual whether the target is a project (folder-creation cue) or an existing folder (add-to-folder cue).
- **Reorder preview** — when the dragged card moves past another card *not* near enough to activate hover-snap, the existing reorder logic from `projects/page.tsx` shifts cards around it (visual-only currently — this PR makes it persisted).

On `touchend` while a card is being dragged:

- **Released over an active target** that is a project → both projects are moved into a *new* folder named "Untitled" with a default brand-indigo accent. The folder takes the dragged card's previous grid slot.
- **Released over an active target** that is a folder → the dragged project becomes a member of that folder.
- **Released over no active target** → the dragged card settles into the slot the reorder preview was showing (persisted).

### Folder action sheet (in wiggle, tap a folder)

Opens a sheet matching the existing `ProjectActionSheet` style:

- **Rename** → inline text input on the folder name (no nested sheet)
- **Color** → 18 project-color swatches (reuses `PROJECT_COLORS` from `phase.ts`); folder accent is freeform, not tied to any project
- **Delete folder** → confirmation row in the sheet. On delete, the folder row is removed and **all its projects fall back to top-level** (placement rows have `folderId` set to NULL via `onDelete: SetNull`).

The folder accent color stays neutral/indigo by default, picked freely by the user.

### Empty folders

A folder created with two projects, then both removed, **stays** as an empty folder until manually deleted. Empty state inside the open folder: dashed placeholder tiles + a "No projects yet — drop one in from the home grid" hint. (No iOS-style auto-delete-when-empty.)

### Folder name on creation

Default `Untitled`. The user can rename via the action sheet whenever.

---

## Data model

Two new tables, both per-user. All schema changes land as a *dedicated schema PR* per the repo's discipline (`packages/db/prisma/schema.prisma` + a Prisma migration), separate from the UI PR.

### `UserProjectFolder`

One row per folder owned by a user.

| Field     | Type      | Notes                                                                |
|-----------|-----------|----------------------------------------------------------------------|
| `id`      | String    | `@id @default(dbgenerated("gen_random_uuid()"))`                     |
| `userId`  | String    | FK → `User.id`, `onDelete: Cascade`                                  |
| `name`    | String    | Default `'Untitled'`                                                 |
| `color`   | String?   | Hex from `PROJECT_COLORS` in `phase.ts`. Null → brand-indigo default |
| `sortOrder` | Int     | Per-user ordering of folders in the grid                             |
| `createdAt` | DateTime | `@default(now())`                                                  |
| `updatedAt` | DateTime | `@updatedAt`                                                       |

Indexes: `(userId, sortOrder)`.

### `UserProjectPlacement`

One row per (user, project) the user has *intentionally placed*. No row → project shows at top-level by `Project.createdAt` (default order, no manual reorder yet).

| Field       | Type      | Notes                                                            |
|-------------|-----------|------------------------------------------------------------------|
| `id`        | String    | `@id @default(dbgenerated("gen_random_uuid()"))`                 |
| `userId`    | String    | FK → `User.id`, `onDelete: Cascade`                              |
| `projectId` | String    | FK → `Project.id`, `onDelete: Cascade`                           |
| `folderId`  | String?   | FK → `UserProjectFolder.id`, `onDelete: SetNull` (folder delete drops projects to top-level) |
| `sortOrder` | Int       | Within its container (top-level if folderId NULL, else within folder) |
| `createdAt` | DateTime  | `@default(now())`                                                |
| `updatedAt` | DateTime  | `@updatedAt`                                                     |

Constraints: `@@unique([userId, projectId])` — a user can have at most one placement per project.
Indexes: `(userId, folderId, sortOrder)`.

### Read model

Top-level grid for a user is the union of:

1. Every project the user has access to (today: every project; post-Auth: scoped via `ProjectMember`).
2. Joined with `UserProjectPlacement` left-outer on `(userId, projectId)`.
3. Bucket: rows where `folderId IS NULL` OR no placement → top-level. Rows where `folderId` is set → inside that folder.
4. Top-level sort: by `placement.sortOrder` if present, else by `Project.createdAt` desc (existing default).
5. Folder grid is `UserProjectFolder` rows for the user, sorted by `sortOrder`, intermixed at top-level.

Where in the home grid does each item sit? Both folders and unplaced projects need a unified `sortOrder`. Simplest implementation: keep folders and placements in two tables but compute a unified sort by:

- Each `UserProjectFolder` has `sortOrder` (folder's slot index in the home grid).
- Each `UserProjectPlacement` with `folderId IS NULL` has `sortOrder` (top-level slot index).
- The home grid renders both lists merged on `sortOrder` ascending. (sortOrder is sparse Int — leave room for inserts.)

Implementation detail in the plan PR.

---

## Pre-Auth scope

`useMeId()` resolves to the first `ProjectMember` row's `userId` pre-Auth. Practically, this means:

- All demo viewers share the same pre-Auth identity → folders are effectively global pre-Auth.
- Post-Auth, the placeholder swap in `useMeId()` lights up real per-user folders with zero call-site changes.
- This is consistent with how chat, threads, and the cross-project resources sheet were shipped: schema + UI ready for Auth, gate becomes real on Auth day.

No extra producer-role gating on folder use. (Cross-project resources had a producer role gate; folders are everyone.)

---

## Implementation surfaces (high-level)

This is the architecture map for the implementation plan, not a step-by-step.

**`packages/db/prisma/schema.prisma`** — two new models, one migration. Dedicated schema PR.

**`apps/back-to-one/src/lib/db/queries.ts`** — new query functions:
- `getUserProjectFolders(meId)` — folders for the user
- `getUserProjectPlacements(meId)` — placements for the user
- `createUserProjectFolder({userId, name, color})` — create a folder (used at drag-onto-project moment)
- `updateUserProjectFolder({id, fields})` — rename / recolor / reorder
- `deleteUserProjectFolder(id)` — delete folder; cascade SetNull on placements
- `upsertUserProjectPlacement({userId, projectId, folderId, sortOrder})` — for drag-into-folder, drag-out-of-folder, top-level reorder
- `bulkReorderTopLevel(meId, [{type:'folder'|'project', id, sortOrder}, ...])` — single-trip reorder for the whole home grid

**`apps/back-to-one/src/lib/hooks/useOriginOne.ts`** — paired hooks + invalidation keys.

**New components in `apps/back-to-one/src/components/projects/`:**
- `FolderCard.tsx` — folder card render (mini-grid, scaling rules, slate-shaped tiles)
- `OpenFolderSheet.tsx` — iOS-style zoom open: a glass card layered over the projects grid with the contained slate cards inside
- `FolderActionSheet.tsx` — rename / color / delete (mirrors the existing `ProjectActionSheet`)

**Modifications to existing files:**
- `apps/back-to-one/src/app/projects/page.tsx`
  - Replace the "Reorder" pill with long-press → wiggle entry (existing 300ms hold logic on each card; remove the pill button)
  - Render the merged home grid (folders + top-level projects) sorted by unified `sortOrder`
  - Wire drag-onto-target detection + magnetic ring feedback
  - Mount `OpenFolderSheet` (closed by default, opens when user taps a folder outside wiggle)
- `apps/back-to-one/src/components/ui/ActionBarRoot.tsx`
  - Extend `RootFabContext` with `openFolderId: string | null` + open/close handlers, and include it in the bar's Back-button layered close stack (priority just above `panelDetail`)

---

## Animation / haptic spec

| Moment                                 | Animation                                                  | Haptic        |
|----------------------------------------|------------------------------------------------------------|---------------|
| Wiggle starts (500ms long-press)       | All cards rotate ±1.5° at 0.5s ease-in-out                 | medium        |
| Pick up a card                         | Scale 1.06, rotate +1.5°, shadow grows                     | medium        |
| Hover-snap activates on a target       | Target ring fades in over 180ms, scales 1→1.04             | light         |
| Hover-snap deactivates                 | Target ring fades out over 180ms                           | none          |
| Drop creates folder                    | Old project + new folder cross-fade in place over 240ms    | medium        |
| Drop adds to existing folder           | Dragged card scales to 0 and slides into folder center     | light         |
| Open folder                            | Card scales from grid position to centered glass over 280ms, dim layer fades in | light         |
| Close folder                           | Reverse the open animation                                 | light         |
| Tap empty grid in wiggle (exit)        | Cards return to 0° over 200ms                              | light         |
| Folder color change                    | Border color crossfades over 200ms                         | light         |

---

## Out of scope for this arc

Land if a real production surfaces the need:

- Folder nesting (folders inside folders)
- Sharing folders across users / teams
- Folder cover image / icon (today: just colored stripe + name)
- Multi-folder membership (a project in two folders simultaneously)
- Bulk-move (multi-select projects → drag set into folder)
- Folder color auto-derived from contained projects' palette

---

## Decisions log

| # | Decision                                          | Picked     |
|---|---------------------------------------------------|------------|
| 1 | Use case scope                                    | Per-user, freeform, by-client expected |
| 2 | Folder open paradigm                              | iOS-style zoom |
| 3 | Folder creation                                   | Drag-onto-project (auto-create with both inside) |
| 4 | Folder card appearance                            | Mini-grid of slate-shaped tiles |
| 5 | Mini-grid scaling                                 | 1→1×1, 2→1×2, 3→2×2 (one empty), 4→2×2, 5–9→3×3, 10+→3×3 + `+N` |
| 6 | Edit mode entry                                   | Long-press anywhere → wiggle (replaces "Reorder" pill) |
| 7 | Drag target feedback                              | Magnetic ring + 4% scale + light haptic |
| 8 | Persistence                                       | Postgres (UserProjectFolder + UserProjectPlacement) |
| 9 | Empty folder behavior                             | Stays until manually deleted |
| 10 | Rename UX                                        | Folder action sheet (same pattern as projects) |
| 11 | Default folder name                              | `Untitled` |
| 12 | Folder accent color                              | User-pickable from the 18 PROJECT_COLORS |
