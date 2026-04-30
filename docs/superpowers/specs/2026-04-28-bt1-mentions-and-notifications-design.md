# BT1 — @Mentions and Notifications

**Status:** Design
**Date:** 2026-04-28
**App:** `apps/back-to-one`
**Touches packages:** `@origin-one/db` (schema + migration), `apps/back-to-one` (UI + queries + hooks)

---

## Summary

Add cross-surface `@mention` support and an in-app notification system to BT1. Typing `@` in any text surface opens a tap-to-pick roster of mentionable users. Saving the text fans out one notification per mentioned user; notifications surface as a bell icon in `PageHeader` with an unread amber dot, opening a slide-up Inbox sheet that deep-links to the source.

A second, additive PR adds Web Push so iOS users with BT1 installed to the home screen receive real iPhone notifications, plus Android and desktop push.

## Motivation

BT1 already partially started this work: the project chat input has a `MentionPicker` that opens on `@` and inserts a name token, but the mention is plaintext only — nothing persists, nothing notifies. Threads, action items, and timeline notes have no `@` support at all. The schema's legacy `thread_messages.tagged jsonb` column was dropped when threads were modeled in Prisma.

A producer juggling six productions needs to direct attention without DM-spamming. `@Sarah look at this scout note` should reach Sarah without anyone leaving the surface they're in.

## Scope

### In scope (v1)

- Shared `<MentionInput />` component (single-line and multi-line variants) used by chat, threads, action items, milestone notes, shoot-day notes, and the global cross-project ChatSheet.
- `<MentionText />` renderer that displays saved text with `@Name` chips.
- New `Notification` table; new `mentions String[]` column on five source tables.
- Bell icon in `PageHeader` with unread dot, scoped per page (project page → that project; `/projects` → all projects).
- Slide-up Inbox sheet listing unread + earlier notifications with deep-links.
- Inline amber unread dots on action item rows, timeline rows, and chat channel rows when mentions are unread (extends the existing thread dot pattern).
- Realtime updates via Supabase realtime channel on `Notification` inserts.
- `PushSubscription` table shipped in the same migration so v1.1 is UI-only.

### In scope (v1.1, additive PR after v1 ships)

- Web Push delivery: service worker, `web-push` server send, `POST /api/push/subscribe` endpoint, soft prompt on first mention.

### Out of scope

- Notifications for events other than mentions (assignments, replies, status changes). The schema is generic enough to support these later without changes.
- Email digests.
- Per-user notification preferences UI (mute project, do-not-disturb, frequency). Acceptable to add later — `Notification` rows are still written; only delivery is gated.
- Mention groups (`@dept-camera`, `@all`). Future work.
- Editing-history audit trail of mention changes.

## Architecture

### Schema (`packages/db/prisma/schema.prisma`)

Two new models:

```prisma
model Notification {
  id           String    @id @default(dbgenerated("gen_random_uuid()"))
  userId       String    // recipient
  projectId    String    // scopes the per-project bell
  sourceType   String    // 'chatMessage' | 'threadMessage' | 'actionItem' | 'milestone' | 'shootDay'
  sourceId     String    // FK target (loose; sourceType disambiguates)
  actorId      String    // who mentioned the recipient
  excerpt      String    // first 140 chars of the source text body, truncated at the nearest word boundary
  contextLabel String    // "Threads · Score Direction", "Action Item · Locations scout"
  readAt       DateTime?
  createdAt    DateTime  @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actor   User    @relation("NotificationActor", fields: [actorId], references: [id])

  @@index([userId, projectId, readAt, createdAt])  // per-project bell
  @@index([userId, readAt, createdAt])              // global bell on /projects
  @@index([sourceType, sourceId])                   // delta-fanout lookup
}

model PushSubscription {
  id        String   @id @default(dbgenerated("gen_random_uuid()"))
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

Add `mentions String[] @default([])` column to:

- `ChatMessage`
- `ThreadMessage`
- `ActionItem` (mentions in `description`)
- `Milestone` (mentions in `notes`)
- `ShootDay` (mentions in `notes`)

The text body keeps human-readable `@Name` tokens. The `mentions` array is the source of truth for **who is currently tagged** in the text — used at write time to compute the notification fan-out delta. The renderer does not consult it (see `<MentionText />` below). Two same-named users both render as `@Sarah` (acceptable v1 visual ambiguity); the correct `userId` is in `mentions` and gets the notification.

### Why a denormalized array, not a separate `Mention` table

A polymorphic `Mention` join table would be ~90% redundant with `Notification`, which is already polymorphic (`sourceType + sourceId + userId`). Every mention produces exactly one Notification row per recipient. Keeping the array on the source row keeps edit-delta computation cheap (compare new array to existing `Notification` rows for `(sourceType, sourceId)` in one indexed query) and avoids re-deriving mentions by re-parsing the text against the current roster — which is fragile across same-name ambiguity and roster changes. `Notification` separately answers "show me everywhere I've been mentioned."

### Write path

Every mutation that writes a row whose text supports mentions accepts an optional `mentions: string[]`. Inside the mutation:

1. Insert/update the source row with `mentions` set.
2. Compute the delta: `mentions - existing Notification rows for (sourceType, sourceId, userId)`.
3. For each new userId in the delta, insert a `Notification` row with `actorId = me`, computed `excerpt` (first ~140 chars of the text body), and `contextLabel` (the surface + a human label for the parent).
4. Skip self-mentions (`actorId === recipientId`).

Removing a mention does **not** retract the historical notification — it was legitimately delivered.

Updates kept simple: `mentions` and the text body are written together by the same mutation; we never derive one from the other on the server.

### RLS

- `Notification`: `select` policy `userId = auth.uid()`. `insert` policy permissive (server-side mutations only).
- `PushSubscription`: `select` and `insert` `userId = auth.uid()`.
- `mentions` column inherits the existing RLS of its host table.

### Realtime

`Notification` is added to the Supabase realtime publication. Client subscribes to inserts where `userId = me`; on insert, React Query invalidates `notifications(projectId)` and `notificationsGlobal(meId)` keys.

## Components

### `<MentionInput />` (`apps/back-to-one/src/components/ui/MentionInput.tsx`)

```tsx
interface MentionInputProps {
  value: string
  mentions: string[]                                   // userIds
  onChange: (text: string, mentions: string[]) => void // both update together
  multiline?: boolean                                  // textarea vs input
  roster: { userId: string; name: string; role?: string; avatarUrl?: string }[]
  placeholder?: string
  accent?: string                                      // for chip color
  onSubmit?: () => void                                // single-line Enter (chat)
}
```

Internally lifts the existing `MentionPicker` from `chat/page.tsx:172`. Picker:

- Opens on `@` at a word boundary (regex from current chat).
- Filters live by name as the user types after `@`.
- Empty filter → first 8 roster members alphabetical by name (deterministic, no activity tracking required for v1).
- Mobile: tap to pick. Desktop: arrow keys + Enter.
- Pick inserts `@Name ` and pushes the userId into `mentions`.
- Dropdown row: avatar + name + role chip (already exists in chat picker).
- Esc dismisses the picker without picking.
- Manually typed `@Name` (no picker pick) does **not** record a mention. The picker is the contract.

### `<MentionText />` (`apps/back-to-one/src/components/ui/MentionText.tsx`)

Render-only. Takes `text` and renders a small accent-colored pill in place of every `@Name` token matched by the picker regex. Chips are **non-interactive in v1** — purely visual markers. The `mentions` array is not consulted at render time; it exists solely for fan-out at write time. This keeps the renderer trivial (one regex pass, no per-message lookups) and avoids the same-name disambiguation problem at display. Used in chat bubbles, thread messages, action item cards, and timeline note bodies.

### Bell + Inbox

- **`<NotificationBell projectId={string | null} />`** — placed in `PageHeader.right`. Reads `useUnreadCount(projectId)` for the dot. Hides itself entirely when the user has zero notifications ever (zero-state suppression).
- **`<InboxSheet open onClose />`** — slide-up sheet (BT1's standard). Sectioned `Unread` / `Earlier`. Header has "Mark all read" action. Each row composed of avatar + actor + context chip + relative time, plus a project chip on the global view.

### Deep-link routes

| `sourceType` | Route |
|---|---|
| `chatMessage` (channel) | `/projects/[id]/chat?focus=msgId` |
| `chatMessage` (DM in project) | `/projects/[id]/chat?dm=partnerId&focus=msgId` |
| `chatMessage` (cross-project DM) | `/projects` with global ChatSheet open on `partnerId`, `focus=msgId` |
| `threadMessage` | `/projects/[id]/threads?thread=tid&msg=mid` |
| `actionItem` | `/projects/[id]/action-items?detail=aid` |
| `milestone` | `/projects/[id]/timeline?milestone=mid` |
| `shootDay` | `/projects/[id]/timeline?shootDay=sid` |

Each surface page reads the relevant query param and opens its detail sheet on mount. Marking the notification read happens on the click in the inbox, not on the destination view.

### Hooks (`apps/back-to-one/src/lib/hooks/useOriginOne.ts`)

```ts
useNotifications(projectId: string | null)              // list (sectioned)
useUnreadCount(projectId: string | null)                // bell dot
useMarkNotificationRead()                               // mutation
useMarkAllNotificationsRead(projectId: string | null)   // mutation
useNotificationsSubscription(meId: string | null)       // realtime → invalidations
useMentionRoster(projectId: string | null)              // project members or cross-project union
```

### Queries (`apps/back-to-one/src/lib/db/queries.ts`)

```ts
getNotifications(meId, projectId | null)
getUnreadCount(meId, projectId | null)
markNotificationRead(id)
markAllNotificationsRead(meId, projectId | null)
subscribeToNotifications(meId, onInsert)

// Mention roster
getProjectMentionRoster(projectId)                      // ProjectMember + User
getCrossProjectMentionRoster(meId)                      // union across viewer's projects, deduped

// Mutation extensions: existing send/post/create/update functions accept optional mentions: string[]
// and perform the delta-fanout server-side.
```

## Surfaces wired in v1

In this order, each as its own PR (BT1 "complete arc" discipline — no batched UI passes):

1. **Project chat** — replace inline picker with `MentionInput`. Roster: project members. Renderer: `MentionText` in chat bubbles.
2. **Threads — new message + reply** — `MentionInput` (multiline). Renderer: `MentionText` in messages.
3. **Action items — `description`** — in create sheet and detail sheet. `MentionInput` (multiline). Renderer in action item card body where description preview shows.
4. **Timeline — milestone `notes`** — in `MSDetailSheet`. `MentionInput` (multiline). Renderer in `TimelinePreview`.
5. **Timeline — shoot day `notes`** — in shoot day editor. `MentionInput` (multiline). Renderer where notes display.
6. **Global ChatSheet** (`/projects` cross-project) — `MentionInput` (single-line). Roster: cross-project union. Renderer in ChatSheet bubbles.

Bell + Inbox + realtime ship in PR 1 alongside the chat surface so the loop is complete from day one. Subsequent PRs extend coverage.

## Mention scoping (locked)

| Surface | Mention picker shows |
|---|---|
| Project chat | `ProjectMember` of that project |
| Project threads | `ProjectMember` of that project |
| Action items | `ProjectMember` of that project |
| Timeline (milestones, shoot days) | `ProjectMember` of that project |
| Global ChatSheet | Union of `ProjectMember` across every project the viewer is on, deduped by `userId` |

Mention authority is the **surface**, not the recipient. From inside Project A you cannot mention Tom if Tom is only on Project B — you'd have to use a surface that includes Tom (global ChatSheet, or Project B).

## Bell scope (locked)

- On `/projects/[id]/*` → notifications for **that project only**.
- On `/projects` → notifications across **all projects** the viewer has membership in (each row labeled with its source project).

## Push (v1.1)

Additive PR after v1 ships. UI-only — schema (`PushSubscription`) is in v1.

- Service worker registers Web Push on first mention received in v1, or via a settings toggle in the inbox sheet.
- `POST /api/push/subscribe` writes a `PushSubscription` row.
- Server-side `web-push` send on `Notification` insert: payload `{ title: "Sarah mentioned you", body: excerpt, url: deepLink }`.
- VAPID keys in env (`VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`).
- iOS: real iPhone notifications for users who installed BT1 to home screen (iOS 16.4+). Soft prompt to install can come in a later PR.
- Android Chrome: works in browser, no install required.
- Desktop: works on permission grant.

## Failure modes and edge cases

- **Self-mention:** filtered out at fan-out time. No notification.
- **Duplicate mention in same edit:** `mentions` array is deduped before fan-out; only one notification per recipient per source row.
- **Editing to add a mention later:** delta vs. existing `Notification` rows for `(sourceType, sourceId)`; only newly-mentioned userIds get notifications.
- **Editing to remove a mention:** historical notification is not deleted.
- **Source row deleted:** `Notification` has no FK to source (polymorphic). On project delete the notification cascades. On source-row delete (e.g. message deleted, action item removed) the notification is orphaned: the excerpt and contextLabel still display in the inbox, but tapping it shows a single-line toast `This message was deleted` and marks the notification read. v1 acceptable; we can add a polymorphic cascade trigger later if it surfaces as an issue.
- **Mention of a non-member (e.g. user removed from project after mention):** notification still fires; the destination view RLS handles whether they can still see the surface.
- **Realtime drop:** React Query refetch on tab focus catches up.
- **Two same-named users:** picker shows them as separate rows (with role chip to disambiguate); render is `@Sarah` for both. Notification routing uses `userId` and is correct.
- **Bell on a page where `projectId` is unknown (e.g. settings):** falls back to global scope.

## Migration plan

Single Prisma migration (PR 1 of v1):

1. Create `Notification` and `PushSubscription` tables with indexes.
2. Add `mentions String[] @default([])` to all five source tables.
3. RLS policies for `Notification` (`select userId = auth.uid()`) and `PushSubscription` (`select/insert userId = auth.uid()`).
4. Add `Notification` to Supabase realtime publication.
5. No data backfill — existing rows have empty `mentions[]` and no historical notifications.

Schema change ships as a dedicated PR (BT1 schema discipline). All three apps must compile after the schema PR before the chat-integration PR opens.

## Testing

- **Unit:** `MentionInput` picker open/close/filter/insert; mention array sync with text edits including backspace deleting a `@Name` token (token deletion does **not** auto-remove the userId from `mentions` in v1 — acceptable; the `mentions` array can carry stale entries that the renderer ignores when no token is present).
- **Integration:** sending a chat message with one mention writes one `Notification`; editing an action item to add a second mention writes one new `Notification`, not two.
- **E2E (manual on dev):** mention yourself → no notification. Mention Sarah → bell dot appears in her session within ~1s via realtime. Tap bell → inbox open. Tap row → deep-link to source with the right scroll position.

## Rollout

Each PR a complete arc per BT1 discipline. Schema PR first; main stays green at every stop.

1. Schema PR (`Notification`, `PushSubscription`, `mentions[]` on five tables, RLS, realtime publication).
2. Chat integration PR — `MentionInput`, `MentionText`, bell, inbox, realtime hooks; chat send wired to fan-out.
3. Threads PR — wire `MentionInput`/`MentionText` into thread message create + render.
4. Action items PR — wire into create + detail sheet.
5. Timeline milestones PR.
6. Timeline shoot days PR.
7. Global ChatSheet PR.
8. Push (v1.1) PR — service worker, `web-push`, subscribe endpoint, soft prompt.

Order is followed strictly; no batching.

## Open questions for review

None — all scoping decisions are locked in this design. If you want to revisit any locked item, call it out in review.
