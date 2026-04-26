# Project-selection folders — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-26-project-selection-folders-design.md`

**Goal:** Personal per-user folders on the project-selection page with iOS-style zoom open, drag-onto-project to create, magnetic-ring drop feedback, and a slate-shaped mini-grid card appearance that scales by project count.

**Architecture:** Two Postgres tables (`UserProjectFolder` + `UserProjectPlacement`) lifted into `RootFabContext` for cross-bar awareness. Three new components on the projects-root page — `FolderCard`, `FolderActionSheet`, `OpenFolderSheet`. The existing `projects/page.tsx` long-press + direct-DOM drag system is reused for both reorder *and* drag-into-folder; the bottom "Reorder" pill is removed (long-press is the entry).

**Tech Stack:** Prisma + Postgres (live Supabase), TypeScript, Next.js 14 App Router, React Query, Framer Motion, Zod (`@origin-one/schema`).

**Ships in two PRs** per the repo's schema-PR-dedicated discipline:
- **PR A — schema** (Tasks 1–6): Prisma models, migration, Zod, workspace compile.
- **PR B — UI** (Tasks 7–19): queries, hooks, components, page refactor.

**Worktree:** `feat/project-folders` at `/Users/pawn/Code/origin-one-folders` (already created and contains the spec). PR A lands from this worktree. PR B starts a fresh worktree from updated `main` after PR A is merged.

---

## Pre-flight notes (read before starting)

1. **Auto-tested env:** there is no `pnpm test` in this repo. Verification per task is `pnpm --filter @origin-one/back-to-one type-check` plus manual browser checks against `pnpm --filter @origin-one/back-to-one dev`.
2. **Inline hex:** this codebase uses inline hex matching `BRAND_TOKENS.md` rather than Tailwind tokens (the token migration is deferred). Match the existing inline-hex style.
3. **Ports / dev server:** dev runs on port 3000 from the worktree.
4. **Schema discipline:** never run `prisma migrate dev` against the live DB without explicit user authorization for that specific migration. Use `--create-only` first, show the SQL, get approval, then apply.
5. **Bar back-button stack** (PR #37): `RootFabContext` already owns `fanOpen / threadsOpen / chatOpen / resourcesOpen / panelDetail`. PR B adds `openFolderId` and slots it into the same close stack.
6. **Pre-Auth identity:** `useMeId()` resolves to the first `ProjectMember` row's `userId`. All folder rows are keyed by that placeholder pre-Auth — every demo viewer effectively shares the same folders. Post-Auth, the swap in `useMeId()` lights up real per-user folders with zero call-site changes. Same pattern as chat/threads/resources sheets.
7. **Other parallel terminals:** other CLI sessions own `/Users/pawn/Code/origin-one`, `origin-one-budget`, `origin-one-design`, `origin-one-hub-variants`. Touch only this PR's worktree(s).

---

# PR A — Schema

Lands the two new tables only. No app code changes. App still compiles untouched on top of it.

---

## Task 1: Add Prisma models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Append the two models** to the bottom of `schema.prisma`

```prisma
// ─── Project-selection folders (per-user) ────────────────────────────────────
// See docs/superpowers/specs/2026-04-26-project-selection-folders-design.md.
// UserProjectFolder is the folder row. UserProjectPlacement is one row per
// (user, project) the user has explicitly placed: folderId NULL → top-level
// at the placement's sortOrder; folderId set → inside that folder. A project
// the user has never placed is rendered top-level by Project.createdAt.

model UserProjectFolder {
  id        String   @id @default(dbgenerated("gen_random_uuid()"))
  userId    String
  name      String   @default("Untitled")
  color     String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user       User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  placements UserProjectPlacement[]

  @@index([userId, sortOrder])
}

model UserProjectPlacement {
  id        String   @id @default(dbgenerated("gen_random_uuid()"))
  userId    String
  projectId String
  folderId  String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  folder  UserProjectFolder? @relation(fields: [folderId], references: [id], onDelete: SetNull)

  @@unique([userId, projectId])
  @@index([userId, folderId, sortOrder])
}
```

- [ ] **Step 2: Add the reverse relations** on the existing `User` and `Project` models in the same file.

In `model User { ... }`, add to the relations block:

```prisma
  projectFolders     UserProjectFolder[]
  projectPlacements  UserProjectPlacement[]
```

In `model Project { ... }`, add to the relations block:

```prisma
  placements UserProjectPlacement[]
```

---

## Task 2: Generate the migration with `--create-only` and review

**Files:**
- Auto-create: `packages/db/prisma/migrations/<timestamp>_user_project_folders/migration.sql`

- [ ] **Step 1: Generate migration without applying** (drift detection)

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/db exec \
  prisma migrate dev --create-only --name user_project_folders
```

Expected output: "Prisma Migrate created the following migration without applying it `<timestamp>_user_project_folders`".

- [ ] **Step 2: Inspect the generated SQL**

```bash
cat packages/db/prisma/migrations/*_user_project_folders/migration.sql
```

Expected: only `CREATE TABLE "UserProjectFolder"`, `CREATE TABLE "UserProjectPlacement"`, `CREATE UNIQUE INDEX`, `CREATE INDEX`, and the FKs. No unrelated `ALTER` / `DROP` statements (those would indicate drift).

If you see drift, **stop**: per `GOTCHAS.md` reconcile via `prisma db pull` first; do not layer on top of unacknowledged drift.

---

## Task 3: Apply the migration to the live DB

This is a destructive shared-state action. **Get explicit user authorization for this specific migration before running.** Show the SQL from Task 2 step 2 and ask for approval.

- [ ] **Step 1: Get user approval** (paste the migration SQL into the terminal output and ask "Apply this to live DB?")

- [ ] **Step 2: After approval, apply**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/db exec prisma migrate dev
```

Expected: "Your database is now in sync with your schema." Prisma client also regenerates.

- [ ] **Step 3: Verify regen happened**

```bash
ls -la node_modules/.pnpm/@prisma+client* 2>&1 | head -3
```

If the regenerate didn't happen automatically, run `pnpm --filter @origin-one/db exec prisma generate`.

---

## Task 4: Add Zod schemas to `@origin-one/schema`

**Files:**
- Create: `packages/schema/src/user-project-folder.ts`
- Create: `packages/schema/src/user-project-placement.ts`
- Modify: `packages/schema/src/index.ts`

- [ ] **Step 1: Create `user-project-folder.ts`**

```ts
import { z } from "zod";

export const UserProjectFolder = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProjectFolder = z.infer<typeof UserProjectFolder>;
```

- [ ] **Step 2: Create `user-project-placement.ts`**

```ts
import { z } from "zod";

export const UserProjectPlacement = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type UserProjectPlacement = z.infer<typeof UserProjectPlacement>;
```

- [ ] **Step 3: Re-export from `index.ts`**

Add to the bottom of `packages/schema/src/index.ts`:

```ts
export * from "./user-project-folder";
export * from "./user-project-placement";
```

---

## Task 5: Workspace-wide type-check

- [ ] **Step 1: Run turbo type-check**

```bash
cd /Users/pawn/Code/origin-one-folders && pnpm exec turbo run type-check
```

Expected: 9 successful tasks. If any fail, fix before continuing.

---

## Task 6: Commit, open PR A, merge

- [ ] **Step 1: Stage and commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add \
  packages/db/prisma/schema.prisma \
  packages/db/prisma/migrations/*_user_project_folders/ \
  packages/schema/src/user-project-folder.ts \
  packages/schema/src/user-project-placement.ts \
  packages/schema/src/index.ts \
  docs/superpowers/specs/2026-04-26-project-selection-folders-design.md \
  docs/superpowers/plans/2026-04-26-project-selection-folders.md

git -C /Users/pawn/Code/origin-one-folders commit -m "$(cat <<'EOF'
feat(schema): UserProjectFolder + UserProjectPlacement for project-selection folders

Two new per-user tables landing the data layer for personal folders on
the project-selection page (UI follow-up PR uses these tables to render
folders + drag-and-drop). Spec:
docs/superpowers/specs/2026-04-26-project-selection-folders-design.md.

UserProjectFolder
  one row per folder owned by a user; name + color + sortOrder + audit.

UserProjectPlacement
  one row per (user, project) the user has explicitly placed:
    folderId NULL → top-level at the placement's sortOrder
    folderId set  → inside that folder
  Unique (userId, projectId). On folder delete, folderId → NULL so
  contained projects fall back to top-level.

Workspace-wide type-check passes (9 tasks).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Push and open PR**

```bash
git -C /Users/pawn/Code/origin-one-folders push -u origin feat/project-folders
gh pr create -R clyde-origin/origin-one \
  --base main \
  --head feat/project-folders \
  --title "feat(schema): UserProjectFolder + UserProjectPlacement for project-selection folders" \
  --body "Schema foundation for the upcoming project-selection folders UI. Spec at docs/superpowers/specs/2026-04-26-project-selection-folders-design.md."
```

- [ ] **Step 3: After CI green, merge** (with user OK)

```bash
gh pr merge <PR-number> -R clyde-origin/origin-one --squash --delete-branch
```

- [ ] **Step 4: Wait for Vercel build success** before starting PR B (verifies the migration replays cleanly on preview/prod).

---

# PR B — UI

Lands all app code. Starts from a fresh worktree off updated `main` (because PR A's local branch is now merged into main).

---

## Task 7: New worktree for the UI PR

- [ ] **Step 1: Sync and remove the schema worktree's branch state**

The `feat/project-folders` branch was force-deleted as part of the squash-merge cleanup, so we just need a fresh worktree off updated main.

```bash
MAIN=/Users/pawn/Code/origin-one
git -C "$MAIN" fetch origin --prune
git -C /Users/pawn/Code/origin-one-folders worktree remove /Users/pawn/Code/origin-one-folders --force 2>/dev/null || true
git -C "$MAIN" branch -D feat/project-folders 2>/dev/null || true
git -C "$MAIN" worktree add /Users/pawn/Code/origin-one-folders -b feat/project-folders-ui origin/main
cp "$MAIN/apps/back-to-one/.env.local" /Users/pawn/Code/origin-one-folders/apps/back-to-one/.env.local
cp "$MAIN/packages/db/.env" /Users/pawn/Code/origin-one-folders/packages/db/.env
pnpm --dir /Users/pawn/Code/origin-one-folders install
```

- [ ] **Step 2: Verify Prisma client picked up the new models**

```bash
grep -E "userProjectFolder|userProjectPlacement" \
  /Users/pawn/Code/origin-one-folders/node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/index.d.ts \
  | head -5
```

Expected: matches found. If not, run `pnpm --filter @origin-one/db exec prisma generate` from inside the worktree.

---

## Task 8: Add query functions

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`

- [ ] **Step 1: Add a new section** to the bottom of `queries.ts` (just above the last `// ──` comment block):

```ts
// ── PROJECT-SELECTION FOLDERS (per-user) ──────────────────

export async function getUserProjectFolders(meId: string | null) {
  if (!meId) return []
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectFolder')
    .select('*')
    .eq('userId', meId)
    .order('sortOrder', { ascending: true })
  if (error) { console.error('getUserProjectFolders failed:', error); throw error }
  return data ?? []
}

export async function getUserProjectPlacements(meId: string | null) {
  if (!meId) return []
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectPlacement')
    .select('*')
    .eq('userId', meId)
  if (error) { console.error('getUserProjectPlacements failed:', error); throw error }
  return data ?? []
}

export async function createUserProjectFolder(input: {
  userId: string; name?: string; color?: string | null; sortOrder?: number
}) {
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectFolder')
    .insert({
      userId: input.userId,
      name: input.name ?? 'Untitled',
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) { console.error('createUserProjectFolder failed:', error); throw error }
  return data
}

export async function updateUserProjectFolder(
  id: string,
  fields: { name?: string; color?: string | null; sortOrder?: number }
) {
  const db = createClient()
  const { error } = await db.from('UserProjectFolder').update(fields).eq('id', id)
  if (error) { console.error('updateUserProjectFolder failed:', error); throw error }
}

export async function deleteUserProjectFolder(id: string) {
  const db = createClient()
  const { error } = await db.from('UserProjectFolder').delete().eq('id', id)
  if (error) { console.error('deleteUserProjectFolder failed:', error); throw error }
}

/**
 * Insert-or-update a placement for (userId, projectId). Upsert on the
 * unique (userId, projectId) constraint — every drag-into / drag-out /
 * top-level reorder writes through here.
 */
export async function upsertUserProjectPlacement(input: {
  userId: string; projectId: string; folderId?: string | null; sortOrder?: number
}) {
  const db = createClient()
  const { data, error } = await db
    .from('UserProjectPlacement')
    .upsert({
      userId: input.userId,
      projectId: input.projectId,
      folderId: input.folderId ?? null,
      sortOrder: input.sortOrder ?? 0,
    }, { onConflict: 'userId,projectId' })
    .select()
    .single()
  if (error) { console.error('upsertUserProjectPlacement failed:', error); throw error }
  return data
}

/** Bulk reorder for a single home-grid pass (all top-level items). */
export async function bulkReorderHomeGrid(
  meId: string,
  items: { type: 'folder' | 'project'; id: string; sortOrder: number }[]
) {
  const db = createClient()
  const folders = items.filter(i => i.type === 'folder')
  const projects = items.filter(i => i.type === 'project')

  if (folders.length > 0) {
    // Per-row update (Supabase doesn't have a single-call multi-row update for different values).
    await Promise.all(folders.map(f =>
      db.from('UserProjectFolder').update({ sortOrder: f.sortOrder }).eq('id', f.id).eq('userId', meId)
    ))
  }
  if (projects.length > 0) {
    await Promise.all(projects.map(p =>
      db.from('UserProjectPlacement').upsert({
        userId: meId,
        projectId: p.id,
        folderId: null,
        sortOrder: p.sortOrder,
      }, { onConflict: 'userId,projectId' })
    ))
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/lib/db/queries.ts
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): add user-project folder + placement queries"
```

---

## Task 9: Add React Query hooks + keys

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1: Add keys** to the `keys` const at the top of the file:

```ts
  userProjectFolders:    (meId: string | null) => ['userProjectFolders', meId ?? ''] as const,
  userProjectPlacements: (meId: string | null) => ['userProjectPlacements', meId ?? ''] as const,
```

- [ ] **Step 2: Add the hooks** at the end of the file (or in a sensibly-grouped location):

```ts
// ── PROJECT-SELECTION FOLDERS ─────────────────────────────

export function useUserProjectFolders() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.userProjectFolders(meId),
    queryFn:  () => db.getUserProjectFolders(meId),
    enabled:  !!meId,
  })
}

export function useUserProjectPlacements() {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.userProjectPlacements(meId),
    queryFn:  () => db.getUserProjectPlacements(meId),
    enabled:  !!meId,
  })
}

function invalidateFolders(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['userProjectFolders'] })
  qc.invalidateQueries({ queryKey: ['userProjectPlacements'] })
}

export function useCreateUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createUserProjectFolder,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useUpdateUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: { name?: string; color?: string | null; sortOrder?: number } }) =>
      db.updateUserProjectFolder(id, fields),
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useDeleteUserProjectFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteUserProjectFolder,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useUpsertUserProjectPlacement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.upsertUserProjectPlacement,
    onSuccess:  () => invalidateFolders(qc),
  })
}

export function useBulkReorderHomeGrid() {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: (items: { type: 'folder' | 'project'; id: string; sortOrder: number }[]) =>
      db.bulkReorderHomeGrid(meId!, items),
    onSuccess:  () => invalidateFolders(qc),
  })
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/lib/hooks/useOriginOne.ts
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): add user-project folder hooks"
```

---

## Task 10: Extend `RootFabContext` with `openFolderId`

**Files:**
- Modify: `apps/back-to-one/src/components/ui/ActionBarRoot.tsx`

- [ ] **Step 1: Add to the context value type** (within the `RootFabContextValue` interface, after `panelDetail`):

```ts
  openFolderId: string | null
  setOpenFolderId: (id: string | null) => void
  closeOpenFolder: () => void
```

- [ ] **Step 2: Add to the provider** state + handlers (mirroring the `panelDetail` pattern):

```ts
  const [openFolderId, setOpenFolderIdState] = useState<string | null>(null)
  const setOpenFolderId = useCallback((id: string | null) => setOpenFolderIdState(id), [])
  const closeOpenFolder = useCallback(() => setOpenFolderIdState(null), [])
```

Add to the provider's value object:

```ts
      openFolderId, setOpenFolderId, closeOpenFolder,
```

And to the inert defaults inside the no-context fallback in `useRootFab`:

```ts
      openFolderId: null, setOpenFolderId: () => {}, closeOpenFolder: () => {},
```

- [ ] **Step 3: Add to the body-lock `useEffect` dep** so the document body locks when a folder is open too. Find the `anyOpen` line and add `|| openFolderId`:

```ts
    const anyOpen = !!(fanOpen || threadsOpen || chatOpen || resourcesOpen || panelDetail || openFolderId)
```

And add `openFolderId` to the effect's dep array.

- [ ] **Step 4: Wire `openFolderId` into `hasOpenLayer` and `handleBack`** in the `ActionBarRoot` component:

```ts
  const hasOpenLayer = !!panelDetail || !!openFolderId || fanOpen || threadsOpen || chatOpen || resourcesOpen
```

In `handleBack`, after the `panelDetail` check, before the `fanOpen` check, add:

```ts
    if (openFolderId) { closeOpenFolder(); return }
```

Also call `closeOpenFolder()` from `handlePlus`, `handleThreads`, `handleChat`, `handleResources` alongside the existing close-others calls.

- [ ] **Step 5: Type-check**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/components/ui/ActionBarRoot.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): RootFabContext owns openFolderId for bar back-button stack"
```

---

## Task 11: Create `FolderActionSheet`

**Files:**
- Create: `apps/back-to-one/src/components/projects/FolderActionSheet.tsx`

- [ ] **Step 1: Create the file** mirroring the existing `ProjectActionSheet` structure (rename / color picker / delete). Read `ProjectActionSheet.tsx` once for pattern reference.

```tsx
'use client'

// Folder action sheet — mirror of ProjectActionSheet for projects, used
// when a folder card is tapped in wiggle/edit mode. Inline rename, color
// picker (18 PROJECT_COLORS), delete with confirmation. Matches the
// existing sheet visual language.

import { useEffect, useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { PROJECT_COLORS } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'

interface FolderActionSheetProps {
  folder: { id: string; name: string; color: string | null } | null
  onClose: () => void
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onDelete: () => void
}

export function FolderActionSheet({ folder, onClose, onRename, onColorChange, onDelete }: FolderActionSheetProps) {
  const [name, setName] = useState(folder?.name ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (folder) { setName(folder.name); setConfirmingDelete(false) }
  }, [folder?.id])

  if (!folder) return null

  const accent = folder.color ?? '#6470f3'

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed.length > 0 && trimmed !== folder!.name) onRename(trimmed)
  }

  return (
    <Sheet open={!!folder} onClose={onClose}>
      <SheetHeader title="Folder" onClose={onClose} />
      <SheetBody>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') { commitRename(); e.currentTarget.blur() } }}
              className="w-full bg-surface2 border border-border2 rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-sm text-muted tracking-widest uppercase block mb-2">Color</label>
            <div className="grid grid-cols-9 gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { haptic('light'); onColorChange(c) }}
                  className="aspect-square rounded-full transition-transform active:scale-95"
                  style={{
                    background: c,
                    border: c === folder.color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: c === folder.color ? `0 0 0 2px ${c}66` : 'none',
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {confirmingDelete ? (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted">
                Delete <b style={{ color: accent }}>{folder.name}</b>? Projects inside fall back to the home grid.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-3 rounded-lg bg-surface2 border border-border text-text"
                >Cancel</button>
                <button
                  onClick={() => { haptic('medium'); onDelete() }}
                  className="flex-1 py-3 rounded-lg text-white font-semibold"
                  style={{ background: '#e8564a' }}
                >Delete</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full py-3 rounded-lg border text-base font-medium active:opacity-80"
              style={{ background: 'rgba(232,86,74,0.08)', borderColor: 'rgba(232,86,74,0.3)', color: '#e8564a' }}
            >
              Delete folder
            </button>
          )}
        </div>
      </SheetBody>
    </Sheet>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/components/projects/FolderActionSheet.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): FolderActionSheet (rename / color / delete)"
```

---

## Task 12: Create `FolderCard`

**Files:**
- Create: `apps/back-to-one/src/components/projects/FolderCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

// Folder card in the project-selection grid. Mini-grid of slate-shaped
// tiles, scaling by project count per the spec. Folder accent outlines
// the card; tile body = project's getProjectColor(); tile stripe tint =
// matches the slate top-stripes on the real SlateCard.
//
// Aspect ratio matches the parent grid's auto-row (which is implicit on
// the project slate cards) — wrapping in aspect-ratio: 4/3 keeps folder
// cards visually consistent with project cards.

import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import { useLongPress } from '@/lib/hooks/useLongPress'
import type { Project } from '@/types'

interface FolderCardProps {
  folder: { id: string; name: string; color: string | null }
  projects: Project[]            // projects contained in this folder, in placement order
  editMode: boolean
  isGhost: boolean
  isDragging: boolean
  isDropTarget: boolean
  dimmed: boolean
  wiggleDelay?: number
  onLongPress: () => void
  onClick: () => void
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function bodyGradient(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const c1 = `rgb(${Math.round(r * 0.07) + 4},${Math.round(g * 0.07) + 4},${Math.round(b * 0.07) + 4})`
  const c2 = `rgb(${Math.round(r * 0.05) + 2},${Math.round(g * 0.05) + 2},${Math.round(b * 0.05) + 2})`
  return `linear-gradient(135deg,${c1},${c2})`
}

function tileLayout(count: number): { cols: number; rows: number; visible: number; overflow: boolean } {
  if (count <= 1) return { cols: 1, rows: 1, visible: 1, overflow: false }
  if (count === 2) return { cols: 2, rows: 1, visible: 2, overflow: false }
  if (count <= 4)  return { cols: 2, rows: 2, visible: count, overflow: false }
  if (count <= 9)  return { cols: 3, rows: 3, visible: count, overflow: false }
  return { cols: 3, rows: 3, visible: 8, overflow: true } // 10+ → 8 tiles + +N
}

export function FolderCard({
  folder, projects, editMode, isGhost, isDragging, isDropTarget, dimmed, wiggleDelay,
  onLongPress, onClick,
}: FolderCardProps) {
  const longPressHandlers = useLongPress(onLongPress, 500)
  const accent = folder.color ?? '#6470f3'
  const layout = tileLayout(projects.length)
  const overflowCount = layout.overflow ? projects.length - layout.visible : 0

  if (isGhost) {
    return (
      <div style={{
        borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)',
        opacity: 0.18, aspectRatio: '4 / 3',
      }} />
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

  const targetStyle = isDropTarget ? {
    transform: 'scale(1.04)',
    boxShadow: `0 0 0 2px ${hexToRgba(accent, 0.7)}, 0 0 30px ${hexToRgba(accent, 0.5)}, inset 0 0 18px ${hexToRgba(accent, 0.2)}`,
  } : {}

  return (
    <div
      data-folder-id={folder.id}
      onClick={editMode ? undefined : onClick}
      {...(editMode ? {} : longPressHandlers)}
      style={{
        position: 'relative',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(8,8,14,0.6)',
        border: `1px solid ${hexToRgba(accent, 0.22)}`,
        aspectRatio: '4 / 3',
        padding: 8,
        display: 'grid', gridTemplateRows: '1fr auto', gap: 5,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'blur(1px)' : 'none',
        transition: isDragging ? 'none' : 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.25s, filter 0.25s',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        ...wiggleStyle, ...dragStyle, ...targetStyle,
      }}
    >
      {/* Mini-grid of slate-shaped tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        gap: 3, minHeight: 0,
      }}>
        {Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
          if (i >= layout.visible) {
            // empty placeholder cell (3-project case has 1; bigger sizes have remainder)
            if (layout.overflow && i === layout.cols * layout.rows - 1) {
              return (
                <div key={i} style={{
                  background: 'rgba(8,8,14,0.85)', border: `0.5px solid ${hexToRgba(accent, 0.45)}`,
                  borderRadius: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700,
                  color: hexToRgba(accent, 0.95),
                }}>+{overflowCount}</div>
              )
            }
            return (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 3,
              }} />
            )
          }
          const project = projects[i]
          const projColor = project.color || getProjectColor(project.id)
          return (
            <div key={project.id} style={{
              background: bodyGradient(projColor),
              borderRadius: 3, border: '0.5px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{
                height: '20%', minHeight: 4,
                backgroundColor: projColor,
                backgroundImage:
                  `linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0.28)) 0 0 / 100% 1px no-repeat,
                   linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)) 0 1.5px / 100% 1px no-repeat`,
              }} />
              <div style={{ flex: 1 }} />
            </div>
          )
        })}
      </div>

      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }}>
        <span style={{
          fontWeight: 700, fontSize: 11, color: '#dddde8',
          letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{folder.name}</span>
        <span className="font-mono" style={{
          fontSize: 8, color: hexToRgba(accent, 0.7), letterSpacing: '0.08em', flexShrink: 0,
        }}>{projects.length}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/components/projects/FolderCard.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): FolderCard with scaling slate-shaped mini-grid"
```

---

## Task 13: Create `OpenFolderSheet`

**Files:**
- Create: `apps/back-to-one/src/components/projects/OpenFolderSheet.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

// iOS-style "open folder" — a glass card layered over the projects grid
// when the user taps a folder outside wiggle. Renders the folder's
// projects in the same 2-col SlateCard grid the home grid uses, but
// scoped to the folder. Closing handled by the bar's Back button via
// RootFabContext.closeOpenFolder() (already wired in PR #37 stack
// extension), tap on the dim backdrop, or escape (later).

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { getProjectColor } from '@/lib/utils/phase'
import { haptic } from '@/lib/utils/haptics'
import type { Project } from '@/types'

interface OpenFolderSheetProps {
  open: boolean
  folder: { id: string; name: string; color: string | null } | null
  projects: Project[]
  onClose: () => void
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function OpenFolderSheet({ open, folder, projects, onClose }: OpenFolderSheetProps) {
  const router = useRouter()
  const accent = folder?.color ?? '#6470f3'

  return (
    <AnimatePresence>
      {open && folder && (
        <motion.div
          key="open-folder"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'fixed',
            top: 156,
            bottom: 'calc(68px + 52px + 64px + env(safe-area-inset-bottom, 0px))',
            left: 14, right: 14,
            zIndex: 12,
            background: 'rgba(10,10,18,0.78)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${hexToRgba(accent, 0.3)}`,
            borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Accent line */}
          <div style={{
            height: 2, flexShrink: 0,
            background: `linear-gradient(90deg, transparent 5%, ${hexToRgba(accent, 0.45)} 40%, ${hexToRgba(accent, 0.45)} 60%, transparent 95%)`,
          }} />

          {/* Header */}
          <div style={{ padding: '14px 18px 12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="font-mono" style={{ fontSize: 9, color: hexToRgba(accent, 0.6), textTransform: 'uppercase', letterSpacing: '0.12em' }}>Folder</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dddde8', letterSpacing: '-0.02em', marginTop: 2 }}>{folder.name}</div>
            <div className="font-mono" style={{ fontSize: 10, color: '#62627a', marginTop: 4 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
            padding: '12px 14px 18px',
          }}>
            {projects.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 12, color: '#62627a' }}>
                No projects yet — drop one in from the home grid
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {projects.map(p => {
                  const color = p.color || getProjectColor(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => { haptic('light'); onClose(); router.push(`/projects/${p.id}`) }}
                      className="active:scale-[0.96] active:brightness-[0.85]"
                      style={{
                        aspectRatio: '4 / 3',
                        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(10,10,18,0.6)',
                        padding: 0, textAlign: 'left',
                      }}
                    >
                      <div style={{
                        height: 18,
                        backgroundColor: color,
                        backgroundImage:
                          `linear-gradient(rgba(255,255,255,0.28), rgba(255,255,255,0.28)) 0 1px / 100% 1px no-repeat,
                           linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)) 0 4px / 100% 1px no-repeat,
                           linear-gradient(rgba(255,255,255,0.07), rgba(255,255,255,0.07)) 0 7px / 100% 1px no-repeat`,
                      }} />
                      <div style={{ padding: '9px 10px 11px' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#dddde8', letterSpacing: '-0.02em' }}>{p.name}</div>
                        <div className="font-mono" style={{ fontSize: 9, color: '#62627a', letterSpacing: '0.06em', marginTop: 2 }}>
                          {p.client || ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/components/projects/OpenFolderSheet.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): OpenFolderSheet (iOS-style zoom open)"
```

---

## Task 14: Refactor `projects/page.tsx` — merged home grid render

This is the most invasive change. Split into Tasks 14–17 to keep each commit small and reversible.

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import { FolderCard } from '@/components/projects/FolderCard'
import { OpenFolderSheet } from '@/components/projects/OpenFolderSheet'
import { FolderActionSheet } from '@/components/projects/FolderActionSheet'
import {
  useUserProjectFolders, useUserProjectPlacements,
  useCreateUserProjectFolder, useUpdateUserProjectFolder, useDeleteUserProjectFolder,
  useUpsertUserProjectPlacement, useBulkReorderHomeGrid,
  useMeId,
} from '@/lib/hooks/useOriginOne'
```

- [ ] **Step 2: Read the new state inside `ProjectsPage`**, after the existing `useProjects()` etc.:

```ts
  const meId = useMeId()
  const { data: folders } = useUserProjectFolders()
  const { data: placements } = useUserProjectPlacements()
  const allFolders = folders ?? []
  const allPlacements = placements ?? []

  const createFolderMutation = useCreateUserProjectFolder()
  const updateFolderMutation = useUpdateUserProjectFolder()
  const deleteFolderMutation = useDeleteUserProjectFolder()
  const placementMutation = useUpsertUserProjectPlacement()

  const {
    openFolderId, setOpenFolderId, closeOpenFolder,
  } = useRootFab()

  const [actionFolder, setActionFolder] = useState<{ id: string; name: string; color: string | null } | null>(null)
```

- [ ] **Step 3: Compute the merged home-grid items**

Add a `useMemo` returning a unified array of items each with `{ kind: 'folder' | 'project', id, sortOrder, ... }`. Folders use their own sortOrder; projects use placement.sortOrder if a placement exists with `folderId === null`, else fall back to `Project.createdAt`.

```ts
  type HomeItem =
    | { kind: 'folder'; id: string; sortOrder: number; folder: typeof allFolders[number] }
    | { kind: 'project'; id: string; sortOrder: number; project: Project }

  const homeItems = useMemo<HomeItem[]>(() => {
    const placementById = new Map(allPlacements.map(p => [p.projectId, p]))
    const inFolder = new Set(
      allPlacements.filter(p => p.folderId !== null).map(p => p.projectId)
    )

    const folderItems: HomeItem[] = allFolders.map(f => ({
      kind: 'folder', id: f.id, sortOrder: f.sortOrder, folder: f,
    }))

    const projectItems: HomeItem[] = allProjects
      .filter(p => !inFolder.has(p.id))
      .map(p => {
        const pl = placementById.get(p.id)
        const so = pl && pl.folderId === null ? pl.sortOrder
                 : Number.MAX_SAFE_INTEGER - new Date(p.createdAt).getTime()
        return { kind: 'project', id: p.id, sortOrder: so, project: p }
      })

    return [...folderItems, ...projectItems].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [allProjects, allFolders, allPlacements])

  const folderProjects = useMemo(() => {
    // Map folderId → projects (in placement.sortOrder)
    const result = new Map<string, Project[]>()
    for (const f of allFolders) result.set(f.id, [])
    const byProjectId = new Map(allProjects.map(p => [p.id, p]))
    const sorted = [...allPlacements]
      .filter(p => p.folderId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const pl of sorted) {
      const project = byProjectId.get(pl.projectId)
      const list = result.get(pl.folderId!)
      if (project && list) list.push(project)
    }
    return result
  }, [allProjects, allFolders, allPlacements])
```

- [ ] **Step 4: Replace the existing `sortedProjects.map(...)` loop** that renders only project slates with a loop over `homeItems` rendering either `<FolderCard>` or `<SlateCard>` per item. Keep the existing drag wrappers around each card; pass `data-project-id` on `<SlateCard>` and `data-folder-id` on `<FolderCard>` (already done in the FolderCard component).

```tsx
{homeItems.map((it, i) => {
  if (it.kind === 'folder') {
    return (
      <div key={`folder-${it.id}`}>
        <FolderCard
          folder={it.folder}
          projects={folderProjects.get(it.id) ?? []}
          editMode={editMode}
          isGhost={false}
          isDragging={false}
          // Task 16 wires this to dragTargetIdState — false for now.
          isDropTarget={false}
          dimmed={(!!actionProject && actionProject.id !== it.id) || (!!dragProjectId)}
          wiggleDelay={i * 0.08}
          onLongPress={() => {
            haptic('light')
            if (editMode) return
            setEditMode(true)
          }}
          onClick={() => { haptic('light'); setOpenFolderId(it.id) }}
        />
      </div>
    )
  }
  // project slate render — same pattern as existing
  const p = it.project
  const isDragging = dragProjectId === p.id
  return (
    <div
      key={`project-${p.id}`}
      onTouchStart={e => handleTouchStart(e, p.id)}
      style={{ position: 'relative' }}
    >
      <SlateCard
        project={p} color={getColor(p.id)}
        dimmed={(!!actionProject && actionProject.id !== p.id) || (!!dragProjectId && !isDragging)}
        editMode={editMode} isGhost={isDragging} isDragging={false}
        wiggleDelay={i * 0.08}
        onLongPress={() => {
          haptic('light')
          if (editMode) return
          setActionProject({ id: p.id, name: p.name, client: p.client, type: p.type, aspectRatio: p.aspectRatio, projectColor: getColor(p.id) })
        }}
        onClick={() => router.push(`/projects/${p.id}`)}
      />
    </div>
  )
})}
```

- [ ] **Step 5: Type-check, manual smoke**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one dev
```

In a browser at http://localhost:3000/projects: existing project grid still renders. No folders show yet (none exist).

- [ ] **Step 6: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/app/projects/page.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): merged home-grid render (folders + projects sorted unified)"
```

---

## Task 15: `projects/page.tsx` — long-press → wiggle, replace "Reorder" pill

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: In each `SlateCard`/`FolderCard` `onLongPress`** handler in the home loop, replace the action-sheet open / no-op with `setEditMode(true)`. Project long-press already opens the action sheet — that flow moves into wiggle (Task 11 sheet wires the action sheet to be opened by tapping a wiggling card instead).

For projects, `onLongPress` becomes:

```tsx
onLongPress={() => {
  haptic('medium')
  if (!editMode) setEditMode(true)
}}
```

For folders, same.

- [ ] **Step 2: In wiggle mode, tap a wiggling card opens the action sheet.** Modify the `onClick` to branch on `editMode`:

For projects (the SlateCard `onClick` handler already short-circuits in editMode at the component level — extend it to OPEN the action sheet when in editMode):

In the SlateCard render block:

```tsx
onClick={() => {
  if (editMode) {
    setActionProject({ id: p.id, name: p.name, client: p.client, type: p.type, aspectRatio: p.aspectRatio, projectColor: getColor(p.id) })
    return
  }
  router.push(`/projects/${p.id}`)
}}
```

Also remove the `editMode ? undefined : onClick` short-circuit in `SlateCard` itself (`apps/back-to-one/src/app/projects/page.tsx:122`). Find:

```tsx
onClick={editMode ? undefined : onClick}
```

Replace with:

```tsx
onClick={onClick}
```

For folders, `onClick`:

```tsx
onClick={() => {
  haptic('light')
  if (editMode) {
    setActionFolder({ id: it.folder.id, name: it.folder.name, color: it.folder.color })
    return
  }
  setOpenFolderId(it.id)
}}
```

- [ ] **Step 3: Tap empty grid space exits wiggle.** Add an outer click handler on the grid container that detects taps with no card target:

```tsx
<div
  ref={gridRef}
  onClick={(e) => {
    // Only fire when the click was directly on the grid container, not bubbled from a card.
    if (editMode && e.target === e.currentTarget) {
      haptic('light')
      setEditMode(false)
    }
  }}
  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '0 14px' }}
>
```

- [ ] **Step 4: Remove the "Reorder" pill** from the `editMode && (<div ...>)` block AND from the always-rendered pill row at the bottom of the grid. Keep `<New Project>` link if present. Find:

```tsx
<div onClick={() => { haptic('light'); setEditMode(prev => !prev); ... }} style={{
  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20,
  border: `1px dashed rgba(196,90,220,${editMode ? '0.4' : '0.2'})`,
  ...
}} className="active:opacity-70 transition-opacity">
  <span style={{ ... }}>⇅</span>
  <span className="font-mono uppercase" style={{ ... }}>{editMode ? 'Done' : 'Reorder'}</span>
</div>
```

Delete that block. The "Done" affordance is now "tap empty space" or the bar Back button (which calls `closeFan` etc — folders won't be open while in wiggle, so back has no other layer to pop and falls back gracefully).

- [ ] **Step 5: Type-check, manual smoke**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
```

Browser: long-press a project → wiggle starts; tap a wiggling card → action sheet; tap empty grid → exit wiggle.

- [ ] **Step 6: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/app/projects/page.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): long-press → wiggle entry; remove Reorder pill"
```

---

## Task 16: `projects/page.tsx` — drag-onto-target detection + magnetic ring

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Track the active drop-target ref** alongside the existing drag refs:

```ts
  const dragTargetIdRef = useRef<string | null>(null)
  const [dragTargetId, setDragTargetIdState] = useState<string | null>(null)
```

(Same as `dragTargetIdx` already exists; we add a parallel `Id` because for folder-create we need the target's identity, not just its slot index.)

- [ ] **Step 2: In `handleTouchMove`**, after computing `cardCx, cardCy`, scan all candidate targets (slates + folders) and pick the closest within snap range:

```ts
const allTargets = document.querySelectorAll<HTMLElement>('[data-project-id], [data-folder-id]')
let closestId: string | null = null
let closestDist = Infinity
allTargets.forEach(el => {
  const id = el.dataset.projectId ?? el.dataset.folderId
  if (!id || id === dragProjectIdRef.current) return
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dist = Math.hypot(cardCx - cx, cardCy - cy)
  if (dist < closestDist) { closestDist = dist; closestId = id }
})
const SNAP_RADIUS = 30
const newTarget = closestDist <= SNAP_RADIUS ? closestId : null
if (newTarget !== dragTargetIdRef.current) {
  dragTargetIdRef.current = newTarget
  setDragTargetIdState(newTarget)
  if (newTarget) haptic('light')
}
```

Keep the existing `lastSlotIdxRef` reorder-detection logic — they coexist (drop-target is for folder ops, slot-index is for top-level reorder).

- [ ] **Step 3: Pass `isDropTarget` into card renders**

For the `FolderCard`: already has the prop — set `isDropTarget={dragTargetIdState === it.folder.id}`.

For the `SlateCard`, since the existing component doesn't have an `isDropTarget` prop, wrap it with a thin overlay rendered inside the card-wrapper div:

```tsx
{dragTargetIdState === p.id && (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    borderRadius: 14,
    boxShadow: '0 0 0 2px rgba(196,90,220,0.7), 0 0 30px rgba(196,90,220,0.5), inset 0 0 18px rgba(196,90,220,0.2)',
    transform: 'scale(1.04)',
    transition: 'all 0.18s ease',
    zIndex: 5,
  }} />
)}
```

- [ ] **Step 4: Type-check + commit**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/app/projects/page.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): magnetic-ring drop target detection during drag"
```

---

## Task 17: `projects/page.tsx` — drop handlers (create folder, add to folder, reorder)

**Files:**
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

- [ ] **Step 1: Update `handleTouchEnd`** to handle three terminal states based on `dragTargetIdRef.current`:

```ts
  const handleTouchEnd = useCallback(() => {
    if (dragTimerRef.current) { clearTimeout(dragTimerRef.current); dragTimerRef.current = null }
    pendingDragRef.current = null

    const projectId = dragProjectIdRef.current
    const targetId = dragTargetIdRef.current
    const targetIdx = dragTargetIdxRef.current

    if (projectId && meId) {
      const targetIsFolder = targetId && allFolders.some(f => f.id === targetId)
      const targetIsProject = targetId && allProjects.some(p => p.id === targetId)

      if (targetId && targetIsFolder) {
        // Drop into existing folder
        haptic('light')
        const folderProjList = folderProjects.get(targetId) ?? []
        placementMutation.mutate({
          userId: meId,
          projectId,
          folderId: targetId,
          sortOrder: folderProjList.length,
        })
      } else if (targetId && targetIsProject) {
        // Drop onto a project → create new folder containing both
        haptic('medium')
        const draggedProject = allProjects.find(p => p.id === projectId)
        const targetProject = allProjects.find(p => p.id === targetId)
        if (draggedProject && targetProject) {
          const draggedItem = homeItems.find(i => i.kind === 'project' && i.id === projectId)
          createFolderMutation.mutate(
            { userId: meId, name: 'Untitled', color: null, sortOrder: draggedItem?.sortOrder ?? 0 },
            {
              onSuccess: (folder) => {
                placementMutation.mutate({ userId: meId, projectId,        folderId: folder.id, sortOrder: 0 })
                placementMutation.mutate({ userId: meId, projectId: targetId, folderId: folder.id, sortOrder: 1 })
              },
            }
          )
        }
      } else if (targetIdx >= 0) {
        // Top-level reorder — persist via placement upsert with folderId: null
        // Compute new sortOrder by midpoint between neighbors at targetIdx.
        const reordered = homeItems.filter(i => i.kind !== 'project' || i.id !== projectId)
        const beforeSO = targetIdx > 0 ? reordered[targetIdx - 1]?.sortOrder ?? 0 : 0
        const afterSO  = reordered[targetIdx]?.sortOrder ?? beforeSO + 1024
        const newSO = Math.floor((beforeSO + afterSO) / 2)
        placementMutation.mutate({ userId: meId, projectId, folderId: null, sortOrder: newSO })
      }
    }

    dragProjectIdRef.current = null
    dragTargetIdRef.current = null
    dragTargetIdxRef.current = -1
    dragStartRef.current = null
    lastSlotIdxRef.current = -1
    setDragProjectId(null)
    setDragTargetIdx(-1)
    setDragTargetIdState(null)
  }, [meId, allProjects, allFolders, folderProjects, homeItems, placementMutation, createFolderMutation])
```

- [ ] **Step 2: Mount the action sheet for folders + the OpenFolderSheet**

Right after the existing `<ProjectActionSheet ...>`:

```tsx
<FolderActionSheet
  folder={actionFolder}
  onClose={() => setActionFolder(null)}
  onRename={(name) => actionFolder && updateFolderMutation.mutate({ id: actionFolder.id, fields: { name } })}
  onColorChange={(color) => actionFolder && updateFolderMutation.mutate({ id: actionFolder.id, fields: { color } })}
  onDelete={() => actionFolder && deleteFolderMutation.mutate(actionFolder.id, { onSuccess: () => setActionFolder(null) })}
/>

<OpenFolderSheet
  open={!!openFolderId}
  folder={allFolders.find(f => f.id === openFolderId) ?? null}
  projects={openFolderId ? (folderProjects.get(openFolderId) ?? []) : []}
  onClose={closeOpenFolder}
/>
```

- [ ] **Step 3: Update the dim-overlay condition** (the `(activePanel || selFabOpen || threadsOpen || chatOpen || resourcesOpen)` line) to also include `openFolderId`:

```tsx
{(activePanel || selFabOpen || threadsOpen || chatOpen || resourcesOpen || openFolderId) && (
  <motion.div ...
    onClick={() => { closeFan(); setActivePanel(null); closeThreads(); closeChat(); closeResources(); closeOpenFolder() }}
  ...)}
```

And the same for the page's `filter`/`pointerEvents` on the body wrapper:

```tsx
filter: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'blur(1.5px)' : 'none',
pointerEvents: (activePanel || threadsOpen || chatOpen || resourcesOpen || openFolderId) ? 'none' : 'auto',
```

- [ ] **Step 4: Type-check + manual smoke**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
```

Browser:
- Long-press a project → wiggle ✓
- Drag a project onto another → folder appears with both inside ✓
- Tap folder outside wiggle → folder zoom-opens ✓
- Bar Back button closes the open folder ✓
- Tap a wiggling folder → folder action sheet opens (rename / color / delete) ✓
- Drag a project onto an existing folder → folder gets new project ✓
- Drag a project to a different top-level slot → persisted reorder ✓

- [ ] **Step 5: Commit**

```bash
git -C /Users/pawn/Code/origin-one-folders add apps/back-to-one/src/app/projects/page.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): drop handlers — create folder / add to folder / reorder"
```

---

## Task 18: Open + close animation polish (zoom from grid origin)

**Files:**
- Modify: `apps/back-to-one/src/components/projects/OpenFolderSheet.tsx`
- Modify: `apps/back-to-one/src/app/projects/page.tsx`

The default OpenFolderSheet animation in Task 13 zooms from center. Polish it to zoom from the folder card's actual grid position so the open is spatially anchored.

- [ ] **Step 1: Pass the source rect** down. In `projects/page.tsx`, when setting `openFolderId`, also stash the folder card element's `getBoundingClientRect()` into a ref and pass to the sheet:

```ts
  const openFolderRectRef = useRef<DOMRect | null>(null)

  // In the FolderCard onClick (non-edit-mode branch):
  onClick={(e) => {
    haptic('light')
    if (editMode) {
      setActionFolder({ id: it.folder.id, name: it.folder.name, color: it.folder.color })
      return
    }
    const el = (e.currentTarget as HTMLElement).closest('[data-folder-id]') as HTMLElement | null
    openFolderRectRef.current = el?.getBoundingClientRect() ?? null
    setOpenFolderId(it.id)
  }}
```

(Note: since `FolderCard`'s onClick fires on the inner card div, we need to thread the click event up. Easier: read from the data-folder-id element directly from the page.)

- [ ] **Step 2: Update `OpenFolderSheet`** to accept an `initialRect?: DOMRect | null` prop and use it to compute the initial transform:

```ts
interface OpenFolderSheetProps {
  open: boolean
  folder: { id: string; name: string; color: string | null } | null
  projects: Project[]
  initialRect?: DOMRect | null
  onClose: () => void
}
```

Inside, replace the `motion.div` initial/animate/exit with a transform anchored on `initialRect`:

```ts
  const initial = initialRect ? {
    opacity: 0,
    scale: initialRect.width / window.innerWidth,
    x: initialRect.left + initialRect.width / 2 - window.innerWidth / 2,
    y: initialRect.top + initialRect.height / 2 - window.innerHeight / 2,
  } : { opacity: 0, scale: 0.92, y: 12 }
```

Use `initial={initial}` and animate to `{ opacity: 1, scale: 1, x: 0, y: 0 }` with `exit={initial}`.

- [ ] **Step 3: Type-check + commit**

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one type-check
git -C /Users/pawn/Code/origin-one-folders add \
  apps/back-to-one/src/components/projects/OpenFolderSheet.tsx \
  apps/back-to-one/src/app/projects/page.tsx
git -C /Users/pawn/Code/origin-one-folders commit -m "feat(folders): zoom open from folder card's grid position"
```

---

## Task 19: Workspace type-check, manual smoke, push, PR, merge

- [ ] **Step 1: Workspace-wide type-check**

```bash
cd /Users/pawn/Code/origin-one-folders && pnpm exec turbo run type-check
```

- [ ] **Step 2: Manual smoke covering every flow**

Start dev:

```bash
pnpm --dir /Users/pawn/Code/origin-one-folders --filter @origin-one/back-to-one dev
```

Walk through the spec's user-experience section. Confirm each:

- Long-press → wiggle
- Tap empty grid → exit wiggle
- Tap wiggling project → ProjectActionSheet
- Tap wiggling folder → FolderActionSheet (rename / color / delete)
- Drag project onto project → "Untitled" folder created with both
- Drag project onto folder → added
- Drag project to empty slot → top-level reorder persisted (refresh — order survives)
- Tap folder outside wiggle → zoom open
- Bar Back button closes open folder
- Dim backdrop closes open folder
- Tap project inside open folder → routes into project
- Folder color change persists across refresh
- Folder rename persists
- Folder delete drops projects to top-level (placement.folderId → NULL)
- Empty folder stays after removing all projects
- iOS PWA: scroll inside open folder works (overscroll-behavior contain on inner scroll)

- [ ] **Step 3: Push and open PR B**

```bash
git -C /Users/pawn/Code/origin-one-folders push -u origin feat/project-folders-ui
gh pr create -R clyde-origin/origin-one \
  --base main \
  --head feat/project-folders-ui \
  --title "feat(projects-root): personal folder system on project selection" \
  --body "Spec: docs/superpowers/specs/2026-04-26-project-selection-folders-design.md
Plan: docs/superpowers/plans/2026-04-26-project-selection-folders.md
Schema PR: <link to PR A>"
```

- [ ] **Step 4: After CI green, merge** (with user OK)

```bash
gh pr merge <PR-number> -R clyde-origin/origin-one --squash --delete-branch
```

- [ ] **Step 5: Wait for Vercel build success** before any cleanup. After success, clean up the worktree (only this PR's worktree — leave the others alone).

---

## Out of plan / future work

These weren't part of this plan; track separately if real productions need them:

- Folder cover image / icon
- Folder nesting
- Multi-folder membership (a project in two folders)
- Bulk-select (multi-select projects → drag set)
- Auto-derive folder color from contained-projects palette
- Producer-only role gate on folder creation (post-Auth, if desired)
