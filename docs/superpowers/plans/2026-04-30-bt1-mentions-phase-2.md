# BT1 Mentions — Phase 2 (Surface Rollout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `<MentionInput />` and `<MentionText />` into BT1's remaining mention-emitting surfaces — threads, action items, milestone notes, shoot-day notes — and make notifications visible on the top-level `/projects` route via a global-scope bell.

**Architecture:** Each surface follows the chat-integration pattern proven in Phase 1 (PR #105): replace plain inputs with `<MentionInput />`, render saved text with `<MentionText />`, extend each create/update mutation to accept `mentions: string[]` and call `fanoutMentions` server-side. No new schema. No new shared components. The cross-project mention roster (`useMentionRoster(null)`) was scoped for a global ChatSheet input, but the global ChatSheet is a conversation-list sheet (no input) — that hook entry stays in place for the bell's `/projects`-scope notification list but has no picker consumer in v1.

**Tech Stack:** Same as Phase 1 — Next.js 14, TypeScript, Supabase, React Query. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md`
**Foundation PR:** #105 — must be merged or rebased onto before this plan can be executed.

---

## File Structure

**Modified:**
- `apps/back-to-one/src/lib/db/queries.ts` — extend 7 mutations (`postMessage`, `createActionItem`, `updateActionItem`, `createMilestone`, `updateMilestone`, `createShootDay`, `updateShootDay`) to accept and fan out `mentions`.
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — extend `usePostMessage`, `useCreateActionItem`, `useUpdateActionItem`, `useCreateMilestone`, `useUpdateMilestone`, `useCreateShootDay`, `useUpdateShootDay` mutation signatures so callers can pass `mentions`.
- `apps/back-to-one/src/app/projects/[projectId]/threads/page.tsx` — reply input → `<MentionInput />`; thread message bodies → `<MentionText />`.
- `apps/back-to-one/src/app/projects/[projectId]/action-items/page.tsx` — `description` textarea → `<MentionInput multiline />`; description preview → `<MentionText />`.
- `apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx` — milestone `notes` and shoot-day `notes` textareas → `<MentionInput multiline />`; renders → `<MentionText />`.
- `apps/back-to-one/src/app/projects/layout.tsx` — mount `<NotificationBell projectId={null} />` and `useNotificationsSubscription()` so cross-project notifications appear on `/projects` and `/projects/threads`.

**Out of scope:** the global `ChatSheet` (no input). Web Push (Phase 3).

---

## Task 1 — Extend mutations to accept and fan out mentions

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`

The existing private `fanoutMentions` helper from Phase 1 (in the same file) takes `{ sourceType, sourceId, projectId, actorId, newMentions, text, contextLabel }` and writes one `Notification` row per newly-mentioned user. Each of the 7 mutations below gets an optional `mentions: string[]` and `contextLabel: string` and calls `fanoutMentions` after the source row is written.

Edit-vs-create semantics: `update*` mutations use the same `fanoutMentions` call — `computeMentionDelta` (already wired into `fanoutMentions`) compares against existing `Notification` rows for `(sourceType, sourceId)` and only fires for newly-added mentions.

- [ ] **Step 1: Extend `postMessage` (threads)**

Locate `export async function postMessage(threadId, createdBy, content)` (around line 948). Replace with:

```ts
export async function postMessage(input: {
  threadId: string
  createdBy: string
  content: string
  projectId: string
  mentions?: string[]
  contextLabel?: string
}) {
  const db = createClient()
  const { data, error } = await db
    .from('ThreadMessage')
    .insert({
      id: crypto.randomUUID(),
      threadId: input.threadId,
      createdBy: input.createdBy,
      content: input.content,
      mentions: input.mentions ?? [],
    })
    .select()
    .single()
  if (error) throw error
  if (input.mentions && input.mentions.length > 0) {
    await fanoutMentions({
      sourceType: 'threadMessage',
      sourceId: data.id,
      projectId: input.projectId,
      actorId: input.createdBy,
      newMentions: input.mentions,
      text: input.content,
      contextLabel: input.contextLabel ?? 'Thread',
    })
  }
  return data
}
```

The signature changed from positional args to a single object. Update `usePostMessage` (next task) accordingly.

- [ ] **Step 2: Extend `createActionItem` and `updateActionItem`**

Locate `createActionItem` (around line 600) and `updateActionItem` (around line 588). Add optional `mentions: string[]` and `contextLabel: string` to each input. After the row is written, fan out:

For `createActionItem`:
```ts
if (input.mentions && input.mentions.length > 0) {
  await fanoutMentions({
    sourceType: 'actionItem',
    sourceId: data.id,
    projectId: input.projectId,
    actorId: input.actorId,    // see note below
    newMentions: input.mentions,
    text: input.description ?? '',
    contextLabel: input.contextLabel ?? `Action Item · ${input.title}`,
  })
}
```

`createActionItem` does not currently take an `actorId`. Add `actorId: string` to its input type and require it. The hook will pass `meId`. The action item `description` field is what holds the mention text (per the spec).

For `updateActionItem`, also add `actorId: string` to the input. After the update, fan out only if `description` was in the update:
```ts
if (fields.description !== undefined && fields.mentions && fields.mentions.length > 0) {
  await fanoutMentions({
    sourceType: 'actionItem',
    sourceId: id,
    projectId: data.projectId,    // returned from select
    actorId: input.actorId,
    newMentions: fields.mentions,
    text: fields.description ?? '',
    contextLabel: input.contextLabel ?? `Action Item · ${data.title}`,
  })
}
```

Note: `updateActionItem` currently does `.update(fields)` — keep that. Add `mentions` to the allowed fields if the function signature filters fields explicitly (read it carefully). Make sure the select returns `projectId` and `title` so the fan-out call has them.

- [ ] **Step 3: Extend `createMilestone` and `updateMilestone`**

Same pattern. Locate `createMilestone` (around line 661) and `updateMilestone` (around line 637). Mention text is `notes`. `sourceType` is `'milestone'`. `contextLabel` default: `Milestone · ${input.title}`.

- [ ] **Step 4: Extend `createShootDay` and `updateShootDay`**

Same pattern. Locate `createShootDay` (around line 1630) and `updateShootDay` (around line 1656). Mention text is `notes`. `sourceType` is `'shootDay'`. `contextLabel` default: `Shoot Day · ${formatted-date}` — format with `new Date(input.date).toLocaleDateString()`.

- [ ] **Step 5: Type-check**

```bash
pnpm --filter back-to-one type-check
```

Expected: clean. If breaks at hook callsites, that's fine — Task 2 fixes them. If breaks elsewhere (e.g. another caller of `postMessage`), grep for callers and update them all to use the new object signature in Task 2.

- [ ] **Step 6: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts
git commit -m "feat(notifications): extend thread/action-item/milestone/shoot-day mutations with mention fan-out"
```

---

## Task 2 — Update hook signatures

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

Each of the 7 affected hooks already wraps the underlying query function via `mutationFn: db.<fn>`. Because the mutation functions now take a single object input (or already did and just got new optional fields), the hooks usually pass through unchanged — but `usePostMessage` changed from positional args to an object, so callers must pass an object.

- [ ] **Step 1: Verify each hook**

For each of: `usePostMessage`, `useCreateActionItem`, `useUpdateActionItem`, `useCreateMilestone`, `useUpdateMilestone`, `useCreateShootDay`, `useUpdateShootDay`:

- Confirm `mutationFn: db.<fn>` is still valid (i.e., the mutation accepts the object signature).
- If the hook wraps the mutation with extra coercion (e.g. spreading args), update the wrapper to pass through the new fields.

Example: `usePostMessage` likely currently looks like:
```ts
export function usePostMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, createdBy, content }: { threadId: string; createdBy: string; content: string }) =>
      db.postMessage(threadId, createdBy, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.threads(projectId, /* meId */ null) }),
  })
}
```

Change to:
```ts
export function usePostMessage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.postMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  })
}
```

(If `keys.threads` requires `meId`, broaden the invalidation to the umbrella key as shown.)

- [ ] **Step 2: Type-check after Task 1 + 2**

```bash
pnpm --filter back-to-one type-check
```

Expected: clean. If any UI page is now broken (e.g., it was passing positional args to `postMessage.mutate`), note them — Tasks 3-6 fix them.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "feat(notifications): update mutation hooks to pass through mentions"
```

---

## Task 3 — Threads surface integration

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/threads/page.tsx`

Reply input → `<MentionInput />`; thread message bodies → `<MentionText />`.

- [ ] **Step 1: Add imports**

At the top of the file:
```ts
import { MentionInput } from '@/components/ui/MentionInput'
import { MentionText } from '@/components/ui/MentionText'
import { useMentionRoster } from '@/lib/hooks/useOriginOne'
```

- [ ] **Step 2: Replace the reply input**

Find the `<input value={reply} ...>` block (around line 403). Replace with:

```tsx
<MentionInput
  value={reply}
  mentions={replyMentions}
  onChange={(text, m) => { setReply(text); setReplyMentions(m) }}
  roster={roster}
  placeholder="Reply…"
  accent={accent}
  onSubmit={handleSend}
/>
```

Add the second piece of state at the top of the component (where `setReply` is declared):
```ts
const [replyMentions, setReplyMentions] = useState<string[]>([])
const { data: roster = [] } = useMentionRoster(projectId)
```

(Use the existing `accent` variable if present; otherwise import a project-color helper or pass `'#6470f3'`.)

- [ ] **Step 3: Update `handleSend` to use the new object signature**

Find `handleSend` and the line:
```ts
postMessage.mutate({ threadId: thread.id, createdBy: meId, content: reply.trim() })
```

Replace with:
```ts
postMessage.mutate({
  threadId: thread.id,
  createdBy: meId,
  content: reply.trim(),
  projectId,
  mentions: replyMentions,
  contextLabel: `Threads · ${thread.subject ?? thread.attachedToType}`,
})
setReply('')
setReplyMentions([])
```

(Confirm the field name on Thread is `subject` or `attachedToLabel` — read the surrounding code or the Thread type.)

- [ ] **Step 4: Render thread messages with `<MentionText />`**

Find where each thread message body renders (search for `m.content` or `message.content` inside the thread message map). Replace the plain text render with:

```tsx
<MentionText text={m.content ?? ''} accent={accent} />
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 6: Commit**

```bash
git add "apps/back-to-one/src/app/projects/[projectId]/threads/page.tsx"
git commit -m "feat(threads): use MentionInput, persist mentions, render MentionText"
```

---

## Task 4 — Action items surface integration

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/action-items/page.tsx`

`description` textarea → `<MentionInput multiline />`. Description preview in cards → `<MentionText />`. Both create-sheet and detail-sheet need updating.

- [ ] **Step 1: Add imports**

```ts
import { MentionInput } from '@/components/ui/MentionInput'
import { MentionText } from '@/components/ui/MentionText'
import { useMentionRoster, useMeId } from '@/lib/hooks/useOriginOne'
```

- [ ] **Step 2: Replace the `description` textarea (detail sheet)**

Locate the textarea (around line 216):
```tsx
<textarea
  value={notes}
  onChange={e => setNotes(e.target.value)}
  ...
/>
```

Replace with:
```tsx
<MentionInput
  value={notes}
  mentions={notesMentions}
  onChange={(text, m) => { setNotes(text); setNotesMentions(m) }}
  roster={roster}
  placeholder="Add notes…"
  multiline
  accent={accent}
/>
```

Add state at the top of the detail-sheet component (where `setNotes` is declared):
```ts
const [notesMentions, setNotesMentions] = useState<string[]>(item?.mentions ?? [])
const { data: roster = [] } = useMentionRoster(projectId)
const meId = useMeId()
```

- [ ] **Step 3: Update the description save call**

Find the line:
```ts
updateItem.mutate({ id: item.id, fields: { description: notes || undefined } })
```

Replace with:
```ts
updateItem.mutate({
  id: item.id,
  actorId: meId as string,
  fields: { description: notes || undefined, mentions: notesMentions },
  contextLabel: `Action Item · ${item.title}`,
})
```

- [ ] **Step 4: Render description preview with `<MentionText />`**

Find where `item.description` (or `item.notes`) renders in the action-item card (likely in a list view). Wrap with:
```tsx
{item.description && <MentionText text={item.description} accent={accent} />}
```

- [ ] **Step 5: Same treatment in the create sheet**

Find the create-sheet's `description` textarea and `createItem.mutate(...)` call. Apply the same replacement: `<MentionInput multiline />`, parallel `mentions` state, pass `mentions` and `actorId: meId` to `createItem.mutate`.

- [ ] **Step 6: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 7: Commit**

```bash
git add "apps/back-to-one/src/app/projects/[projectId]/action-items/page.tsx"
git commit -m "feat(action-items): use MentionInput on description, render MentionText"
```

---

## Task 5 — Timeline (milestones + shoot days) integration

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx`

Two textareas to convert in this file: milestone notes (around line 280) and shoot-day notes (around line 945). Both follow the same pattern as action items.

- [ ] **Step 1: Add imports** (same as Task 4 Step 1).

- [ ] **Step 2: Convert milestone notes textarea**

Find the `<textarea value={notes} ...>` block in `MSDetailSheet` (around line 280). Replace with `<MentionInput multiline />` (same shape as Task 4 Step 2). Add `notesMentions` state and `roster` query.

Update the `saveNotes` / `updateMs.mutate` call to include `mentions: notesMentions` in `fields`, plus `actorId: meId` and `contextLabel: \`Milestone · \${milestone.title}\`` at the top level.

- [ ] **Step 3: Convert shoot-day notes textarea**

Find the second `<textarea>` (around line 945) in the shoot-day editor. Same pattern. The mutation is `updateShootDay` (or `createShootDay` for new days). `contextLabel: \`Shoot Day · \${new Date(day.date).toLocaleDateString()}\``.

- [ ] **Step 4: Render notes with `<MentionText />`**

Find where milestone `notes` and shoot-day `notes` display (preview rows, list cards). Wrap with `<MentionText text={notes} accent={accent} />`.

- [ ] **Step 5: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 6: Commit**

```bash
git add "apps/back-to-one/src/app/projects/[projectId]/timeline/page.tsx"
git commit -m "feat(timeline): use MentionInput on milestone and shoot-day notes"
```

---

## Task 6 — Bell on `/projects` for cross-project notifications

**Files:**
- Modify: `apps/back-to-one/src/app/projects/layout.tsx`

The Phase 1 `BellOverlay` was wired into `[projectId]/layout.tsx` only. Adding it here so a user on `/projects` (or `/projects/threads`) sees notifications across every project.

- [ ] **Step 1: Add a BellOverlay to `/projects/layout.tsx`**

Read the existing file. Add at the top:
```tsx
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useNotificationsSubscription } from '@/lib/hooks/useOriginOne'

function GlobalBellOverlay() {
  useNotificationsSubscription()
  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top, 0px) + 14px)',
      right: 16,
      zIndex: 25,
    }}>
      <NotificationBell projectId={null} />
    </div>
  )
}
```

In the layout's JSX, render `<GlobalBellOverlay />` only on root routes (where the existing `isRootRoute` check controls `ActionBarRoot`). When inside a project subroute, the project layout's bell takes over — showing the global one too would double-render.

```tsx
{isRootRoute && <GlobalBellOverlay />}
```

(Confirm by re-reading the existing file: it already has the `isRootRoute` boolean.)

- [ ] **Step 2: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/app/projects/layout.tsx
git commit -m "feat(notifications): mount global NotificationBell on /projects root routes"
```

---

## Task 7 — End-to-end manual verification

- [ ] **Step 1: Apply the schema migration if not already**

```bash
pnpm --filter @origin-one/db exec prisma migrate deploy
pnpm --filter @origin-one/db exec prisma generate
```

(Already applied to the dev DB during Phase 1 if you've been dogfooding.)

- [ ] **Step 2: Start dev server**

```bash
pnpm --filter back-to-one dev
```

- [ ] **Step 3: Test each surface as User A → User B**

For each: open a project, take the action below, then verify in User B's session that the bell dots within ~1s and the inbox row deep-links correctly.

1. **Threads:** Open any thread, type a reply with `@SomeOne`, send. Inbox row → opens threads page with `?msg=<msgId>`.
2. **Action items:** Open or create an action item, edit the description with `@SomeOne`, save. Inbox row → opens action-items with `?detail=<aid>`.
3. **Milestone notes:** Open a milestone, edit notes with `@SomeOne`, blur (saves). Inbox row → opens timeline with `?milestone=<mid>`.
4. **Shoot-day notes:** Open a shoot day, edit notes with `@SomeOne`, save. Inbox row → opens timeline with `?shootDay=<sid>`.

- [ ] **Step 4: Test the global bell on `/projects`**

User B navigates to `/projects` (their projects list). Trigger a mention from any other project the user is on. Confirm the bell appears top-right (zero-state suppression should clear once any notification exists), and the inbox row labels the source project chip.

- [ ] **Step 5: Test edit-time delta**

Edit an existing action item that already mentions Sarah, adding `@Tom`. Tom gets a notification; Sarah does not (her notification was from the original write).

---

## Task 8 — Push branch and open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/mentions-phase-2
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: mentions across threads, action items, timeline (Phase 2)" --body "$(cat <<'EOF'
## Summary

Wires the shared <MentionInput /> and <MentionText /> components (shipped in #105) into BT1's remaining mention-emitting surfaces — threads, action items, milestone notes, shoot-day notes — and adds a global NotificationBell on /projects so cross-project notifications are visible.

- Threads: reply input, message rendering, fan-out via postMessage
- Action items: description input + render, fan-out via createActionItem/updateActionItem
- Timeline: milestone notes and shoot-day notes input + render, fan-out via the corresponding create/update mutations
- /projects layout: global bell overlay (projectId=null) on root routes

The cross-project mention roster (useMentionRoster(null)) was scoped during Phase 1 for a global ChatSheet input, but the global ChatSheet is a conversation-list sheet — the hook entry stays in place because the bell's "all projects" inbox query relies on it. No separate cross-project picker UI is added in this PR.

Spec: docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md
Plan: docs/superpowers/plans/2026-04-30-bt1-mentions-phase-2.md
Foundation: #105 (must be merged or this rebases onto)

## Test plan

- [x] vitest, type-check
- [ ] manual: mention round-trip on each of the four surfaces, deep-link works
- [ ] global bell visible on /projects with multi-project mention
- [ ] edit-time delta: editing a note to add a new mention only notifies the new user

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return PR URL**

---

## Self-Review Notes

**Spec coverage** (all from the foundation spec at `docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md`):
- [x] Threads — Tasks 1, 2, 3
- [x] Action items — Tasks 1, 2, 4
- [x] Milestone notes — Tasks 1, 2, 5
- [x] Shoot-day notes — Tasks 1, 2, 5
- [x] Bell scope on `/projects` (your 3a-locked decision) — Task 6
- [N/A] Global ChatSheet input — explicitly out of scope (no UI surface; documented above)
- [Phase 3] Web Push — separate plan

**Type consistency:** All surface integrations use the same `MentionInput` / `MentionText` shape proven in Phase 1's chat integration. `mentions: string[]` and `contextLabel: string` are consistent across all 7 mutation extensions.

**Placeholder scan:** All steps include exact code where the implementation matters; line-number references are approximate (the file has been edited recently — implementer should re-grep to find the exact location).
