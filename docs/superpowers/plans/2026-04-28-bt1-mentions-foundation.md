# BT1 Mentions + Notifications — Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the schema, shared `MentionInput`/`MentionText` components, the `NotificationBell` + `InboxSheet`, realtime fan-out, and integrate it all into the project chat surface so a user typing `@Sarah` in chat causes Sarah's bell to dot and inbox to update live.

**Architecture:**
- Two new Prisma models (`Notification`, `PushSubscription`) and `mentions String[]` added to five source tables. Single migration ships in PR 1.
- A `<MentionInput />` component (lifted from the existing chat inline picker) standardizes the `@` UX. Pure mention logic (regex tokenizing, excerpt extraction, delta computation) lives in `src/lib/mentions/` and is unit-tested with vitest.
- Bell + Inbox sheet ship alongside the chat-surface integration so the loop is end-to-end on day one. Realtime via Supabase channel on `Notification` inserts.
- Surface rollout (threads, action items, timeline, global ChatSheet) is **out of scope** for this plan — handled by Phase 2.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Supabase (Postgres + RLS + realtime), Prisma, React Query, vitest. Existing patterns: React Query `invalidateQueries`, slide-up Sheets, accent-tinted UI tokens (`TA_DEEP` amber for unread).

**Spec:** `docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md`

---

## File Structure

**Created:**
- `packages/db/prisma/migrations/20260429231353_add_mentions_and_notifications/migration.sql`
- `apps/back-to-one/src/lib/mentions/types.ts` — `MentionRosterEntry` (shared by UI + queries)
- `apps/back-to-one/src/lib/mentions/regex.ts` — `findMentionAtCursor`, `tokenizeMentions` (pure)
- `apps/back-to-one/src/lib/mentions/regex.test.ts`
- `apps/back-to-one/src/lib/mentions/excerpt.ts` — `buildExcerpt` (pure)
- `apps/back-to-one/src/lib/mentions/excerpt.test.ts`
- `apps/back-to-one/src/lib/mentions/delta.ts` — `computeMentionDelta` (pure)
- `apps/back-to-one/src/lib/mentions/delta.test.ts`
- `apps/back-to-one/src/components/ui/MentionInput.tsx` — shared input with picker
- `apps/back-to-one/src/components/ui/MentionText.tsx` — render-only chip highlighter
- `apps/back-to-one/src/components/notifications/NotificationBell.tsx`
- `apps/back-to-one/src/components/notifications/InboxSheet.tsx`

**Modified:**
- `packages/db/prisma/schema.prisma` — add `Notification`, `PushSubscription`; add `mentions String[]` to `ChatMessage`, `ThreadMessage`, `ActionItem`, `Milestone`, `ShootDay`; add reverse relations on `User` and `Project`.
- `apps/back-to-one/src/lib/db/queries.ts` — add notification + roster queries; extend `sendChatMessage` to accept and fan out mentions.
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — add notification hooks + key entries.
- `apps/back-to-one/src/app/projects/[projectId]/chat/page.tsx` — replace inline picker with `<MentionInput />`, render with `<MentionText />`, pass mentions to `useSendChatMessage`.
- `apps/back-to-one/src/app/projects/[projectId]/layout.tsx` — render `<NotificationBell projectId={...} />` overlaid in the project surface (it lives outside `PageHeader` since each subpage owns its own header).

**Out of scope (Phase 2):** thread surface integration, action item surface integration, timeline integration, global ChatSheet integration.

---

## Task 1 — Schema migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260429231353_add_mentions_and_notifications/migration.sql`

Per BT1's DB migration discipline (`origin_one_db_migration_patterns` memory): hand-author SQL + `prisma migrate deploy` is the standard. Prisma shadow DB fails on this codebase's Supabase-specific migrations.

- [ ] **Step 1: Add models and columns to `schema.prisma`**

In `packages/db/prisma/schema.prisma`, insert the two new models and the `mentions` field on five existing models. Place `Notification` and `PushSubscription` after `ChatMessage`. Add reverse relations on `User` and `Project`.

```prisma
model Notification {
  id           String    @id @default(dbgenerated("gen_random_uuid()"))
  userId       String
  projectId    String
  sourceType   String
  sourceId     String
  actorId      String
  excerpt      String
  contextLabel String
  readAt       DateTime?
  createdAt    DateTime  @default(now())

  user    User    @relation("NotificationRecipient", fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actor   User    @relation("NotificationActor", fields: [actorId], references: [id])

  @@index([userId, projectId, readAt, createdAt])
  @@index([userId, readAt, createdAt])
  @@index([sourceType, sourceId])
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

Add to existing models:
- `ChatMessage`: `mentions String[] @default([])`
- `ThreadMessage`: `mentions String[] @default([])`
- `ActionItem`: `mentions String[] @default([])`
- `Milestone`: `mentions String[] @default([])`
- `ShootDay`: `mentions String[] @default([])`

Add to `User` model relations block:
```prisma
  notifications        Notification[]      @relation("NotificationRecipient")
  notificationsAuthored Notification[]     @relation("NotificationActor")
  pushSubscriptions    PushSubscription[]
```

Add to `Project` model relations block:
```prisma
  notifications Notification[]
```

- [ ] **Step 2: Hand-author the SQL migration**

Create `packages/db/prisma/migrations/20260429231353_add_mentions_and_notifications/migration.sql`:

```sql
-- ── Notification ─────────────────────────────────────────────
create table "Notification" (
  id            text primary key default gen_random_uuid()::text,
  "userId"       text not null,
  "projectId"    text not null,
  "sourceType"   text not null,
  "sourceId"     text not null,
  "actorId"      text not null,
  excerpt       text not null,
  "contextLabel" text not null,
  "readAt"       timestamptz,
  "createdAt"    timestamptz not null default now(),
  constraint "Notification_userId_fkey"    foreign key ("userId")    references "User"(id) on delete cascade,
  constraint "Notification_projectId_fkey" foreign key ("projectId") references "Project"(id) on delete cascade,
  constraint "Notification_actorId_fkey"   foreign key ("actorId")   references "User"(id)
);
create index "Notification_user_project_unread_idx" on "Notification" ("userId", "projectId", "readAt", "createdAt" desc);
create index "Notification_user_unread_idx"          on "Notification" ("userId", "readAt", "createdAt" desc);
create index "Notification_source_idx"               on "Notification" ("sourceType", "sourceId");

alter table "Notification" enable row level security;

-- Recipients can read their own notifications.
create policy "Notification_select_own"
  on "Notification" for select
  using ("userId" = (select auth.uid()::text));

-- Server-side mutations (via service role / authenticated context) write rows.
-- For pre-Auth-day permissive posture (matches existing tables), allow insert by authenticated.
create policy "Notification_insert_authenticated"
  on "Notification" for insert
  with check ((select auth.role()) = 'authenticated');

-- Recipient marks own notification read.
create policy "Notification_update_own"
  on "Notification" for update
  using ("userId" = (select auth.uid()::text))
  with check ("userId" = (select auth.uid()::text));

-- ── PushSubscription ────────────────────────────────────────
create table "PushSubscription" (
  id          text primary key default gen_random_uuid()::text,
  "userId"     text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  "userAgent"  text,
  "createdAt"  timestamptz not null default now(),
  constraint "PushSubscription_userId_fkey" foreign key ("userId") references "User"(id) on delete cascade
);
create index "PushSubscription_user_idx" on "PushSubscription" ("userId");

alter table "PushSubscription" enable row level security;

create policy "PushSubscription_select_own"
  on "PushSubscription" for select
  using ("userId" = (select auth.uid()::text));

create policy "PushSubscription_insert_own"
  on "PushSubscription" for insert
  with check ("userId" = (select auth.uid()::text));

create policy "PushSubscription_delete_own"
  on "PushSubscription" for delete
  using ("userId" = (select auth.uid()::text));

-- ── mentions[] columns on five source tables ────────────────
alter table "ChatMessage"   add column mentions text[] not null default '{}';
alter table "ThreadMessage" add column mentions text[] not null default '{}';
alter table "ActionItem"    add column mentions text[] not null default '{}';
alter table "Milestone"     add column mentions text[] not null default '{}';
alter table "ShootDay"      add column mentions text[] not null default '{}';

-- ── Add Notification to realtime publication ────────────────
alter publication supabase_realtime add table "Notification";
```

- [ ] **Step 3: Apply the migration locally**

```bash
pnpm --filter @origin-one/db prisma migrate deploy
pnpm --filter @origin-one/db prisma generate
```

Expected: "1 migration applied" + Prisma client regenerated.

- [ ] **Step 4: Verify all three apps still compile**

```bash
pnpm -w build
```

Expected: all three apps build clean.

- [ ] **Step 5: Commit (feature branch only — never on main)**

Branch: `feat/mentions-schema`

```bash
git checkout -b feat/mentions-schema
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260429231353_add_mentions_and_notifications
git commit -m "feat(schema): add Notification, PushSubscription, mentions[] columns

Adds the schema foundation for cross-surface @mentions and the in-app
notification system. mentions String[] is added to ChatMessage,
ThreadMessage, ActionItem, Milestone, and ShootDay. Notification table
is added to the supabase_realtime publication so clients can subscribe
to inserts.

Spec: docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md"
```

---

## Task 2 — Mention regex + tokenizer (pure logic, TDD)

**Files:**
- Create: `apps/back-to-one/src/lib/mentions/regex.ts`
- Create: `apps/back-to-one/src/lib/mentions/regex.test.ts`

Two pure functions: `findMentionAtCursor(text, cursorPos)` returns the active `@query` substring at the cursor position (or null), and `tokenizeMentions(text)` returns ordered `{ start, end, name }` tokens for rendering.

- [ ] **Step 1: Write the failing tests**

`apps/back-to-one/src/lib/mentions/regex.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findMentionAtCursor, tokenizeMentions } from './regex'

describe('findMentionAtCursor', () => {
  it('returns null when cursor not in a mention', () => {
    expect(findMentionAtCursor('hello world', 5)).toBeNull()
  })
  it('returns empty query for bare @ at end', () => {
    expect(findMentionAtCursor('hello @', 7)).toBe('')
  })
  it('returns partial query', () => {
    expect(findMentionAtCursor('hello @Sa', 9)).toBe('Sa')
  })
  it('handles names with apostrophes and spaces', () => {
    expect(findMentionAtCursor("hi @O'Brien Sm", 14)).toBe("O'Brien Sm")
  })
  it('returns null when @ is preceded by alphanumeric (email-like)', () => {
    expect(findMentionAtCursor('foo@bar', 7)).toBeNull()
  })
  it('only triggers at the active cursor, not earlier @ tokens', () => {
    expect(findMentionAtCursor('@Sarah hello @Bo', 16)).toBe('Bo')
  })
  it('returns null if cursor is inside text after a complete mention', () => {
    expect(findMentionAtCursor('@Sarah hello', 12)).toBeNull()
  })
})

describe('tokenizeMentions', () => {
  it('returns empty for plain text', () => {
    expect(tokenizeMentions('hello world')).toEqual([])
  })
  it('extracts a single mention', () => {
    expect(tokenizeMentions('hi @Sarah!')).toEqual([
      { start: 3, end: 9, name: 'Sarah' },
    ])
  })
  it('extracts multiple mentions in order', () => {
    const tokens = tokenizeMentions('@Sarah and @Tom met')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].name).toBe('Sarah')
    expect(tokens[1].name).toBe('Tom')
  })
  it('handles multi-word names', () => {
    expect(tokenizeMentions("hi @O'Brien Smith done")).toEqual([
      { start: 3, end: 18, name: "O'Brien Smith" },
    ])
  })
  it('does not match emails', () => {
    expect(tokenizeMentions('foo@bar.com hi')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/regex.test.ts
```

Expected: all fail with "module not found".

- [ ] **Step 3: Implement `regex.ts`**

`apps/back-to-one/src/lib/mentions/regex.ts`:

```ts
// A "name" is: leading letter, then letters / apostrophes / hyphens / single
// internal spaces. Trailing whitespace ends the token. Stops conservatively to
// avoid swallowing the next sentence into a mention.
const MENTION_BODY = "[A-Za-z][A-Za-z'\\-]*(?: [A-Za-z][A-Za-z'\\-]*)*"

// At-cursor pattern: must be preceded by start-of-string or whitespace.
// Captures the partial query (possibly empty).
const AT_CURSOR_RE = new RegExp(`(?:^|\\s)@(${MENTION_BODY})?$`)

// Whole-text pattern: same boundary rule, terminated by whitespace, punctuation,
// or end-of-string.
const TOKEN_RE = new RegExp(`(?:^|\\s)@(${MENTION_BODY})`, 'g')

export function findMentionAtCursor(text: string, cursorPos: number): string | null {
  const head = text.slice(0, cursorPos)
  const m = head.match(AT_CURSOR_RE)
  if (!m) return null
  return m[1] ?? ''
}

export interface MentionToken {
  start: number
  end: number
  name: string
}

export function tokenizeMentions(text: string): MentionToken[] {
  const out: MentionToken[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const matchStart = m.index ?? 0
    // Skip the leading whitespace if present.
    const atOffset = m[0].indexOf('@')
    const start = matchStart + atOffset
    const name = m[1]
    out.push({ start, end: start + 1 + name.length, name })
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/regex.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/mentions/regex.ts apps/back-to-one/src/lib/mentions/regex.test.ts
git commit -m "feat(mentions): add regex tokenizer and at-cursor detection"
```

---

## Task 3 — Excerpt builder (pure logic, TDD)

**Files:**
- Create: `apps/back-to-one/src/lib/mentions/excerpt.ts`
- Create: `apps/back-to-one/src/lib/mentions/excerpt.test.ts`

`buildExcerpt(text)` returns the first 140 chars of `text`, truncated at the nearest preceding word boundary, with `…` appended if truncation occurred.

- [ ] **Step 1: Write the failing tests**

`apps/back-to-one/src/lib/mentions/excerpt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildExcerpt } from './excerpt'

describe('buildExcerpt', () => {
  it('returns the text untouched when shorter than 140', () => {
    expect(buildExcerpt('hello world')).toBe('hello world')
  })
  it('returns the text untouched when exactly 140', () => {
    const t = 'a'.repeat(140)
    expect(buildExcerpt(t)).toBe(t)
  })
  it('truncates at the nearest preceding space and adds ellipsis', () => {
    const t = 'word '.repeat(40) // 200 chars, words boundary every 5
    const out = buildExcerpt(t)
    expect(out.length).toBeLessThanOrEqual(141) // 140 chars + ellipsis
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wo…$/) // not mid-word
  })
  it('falls back to a hard cut when no word boundary in window', () => {
    const t = 'a'.repeat(200)
    const out = buildExcerpt(t)
    expect(out.length).toBe(141)
    expect(out.endsWith('…')).toBe(true)
  })
  it('collapses internal whitespace and trims', () => {
    expect(buildExcerpt('  hello\n\nworld  ')).toBe('hello world')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/excerpt.test.ts
```

- [ ] **Step 3: Implement `excerpt.ts`**

```ts
const LIMIT = 140

export function buildExcerpt(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= LIMIT) return cleaned
  // Find the last space at or before LIMIT.
  const lastSpace = cleaned.lastIndexOf(' ', LIMIT)
  const cut = lastSpace > 0 ? lastSpace : LIMIT
  return cleaned.slice(0, cut) + '…'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/excerpt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/mentions/excerpt.ts apps/back-to-one/src/lib/mentions/excerpt.test.ts
git commit -m "feat(mentions): add buildExcerpt utility"
```

---

## Task 4 — Mention delta computation (pure logic, TDD)

**Files:**
- Create: `apps/back-to-one/src/lib/mentions/delta.ts`
- Create: `apps/back-to-one/src/lib/mentions/delta.test.ts`

`computeMentionDelta({ newMentions, alreadyNotified, actorId })` returns the userIds that should receive a fresh notification: in `newMentions`, not in `alreadyNotified`, not equal to `actorId`, deduped.

- [ ] **Step 1: Write the failing tests**

`apps/back-to-one/src/lib/mentions/delta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeMentionDelta } from './delta'

describe('computeMentionDelta', () => {
  it('returns all new mentions when no prior notifications', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1', 'u2'])
  })
  it('skips already-notified users', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u2'],
      alreadyNotified: ['u1'],
      actorId: 'me',
    })).toEqual(['u2'])
  })
  it('skips self-mentions', () => {
    expect(computeMentionDelta({
      newMentions: ['me', 'u1'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1'])
  })
  it('dedupes within newMentions', () => {
    expect(computeMentionDelta({
      newMentions: ['u1', 'u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u1', 'u2'])
  })
  it('preserves first-seen order', () => {
    expect(computeMentionDelta({
      newMentions: ['u3', 'u1', 'u2'],
      alreadyNotified: [],
      actorId: 'me',
    })).toEqual(['u3', 'u1', 'u2'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/delta.test.ts
```

- [ ] **Step 3: Implement `delta.ts`**

```ts
export interface DeltaInput {
  newMentions: string[]
  alreadyNotified: string[]
  actorId: string
}

export function computeMentionDelta(input: DeltaInput): string[] {
  const skip = new Set([...input.alreadyNotified, input.actorId])
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of input.newMentions) {
    if (skip.has(id)) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter back-to-one vitest run src/lib/mentions/delta.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/mentions/delta.ts apps/back-to-one/src/lib/mentions/delta.test.ts
git commit -m "feat(mentions): add computeMentionDelta utility"
```

---

## Task 5 — `<MentionInput />` shared component

**Files:**
- Create: `apps/back-to-one/src/lib/mentions/types.ts`
- Create: `apps/back-to-one/src/components/ui/MentionInput.tsx`

Single-line and multi-line variants. Internally owns the picker dropdown, `@`-detection (via Task 2's `findMentionAtCursor`), and the parallel `(value, mentions)` state synced via `onChange`.

- [ ] **Step 1a: Create the shared `MentionRosterEntry` type**

`apps/back-to-one/src/lib/mentions/types.ts`:

```ts
export interface MentionRosterEntry {
  userId: string
  name: string
  role: string | null
  avatarUrl: string | null
}
```

This single definition is consumed by both the picker UI (Task 5) and the database queries (Task 7). `null` (not `undefined`) keeps it compatible with raw Supabase row shapes.

- [ ] **Step 1b: Implement the component**

```tsx
'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { findMentionAtCursor } from '@/lib/mentions/regex'
import { stableColor, initials } from '@/lib/utils/color' // existing helpers used by chat picker
import type { MentionRosterEntry } from '@/lib/mentions/types'

export interface MentionInputProps {
  value: string
  mentions: string[]
  onChange: (text: string, mentions: string[]) => void
  multiline?: boolean
  roster: MentionRosterEntry[]
  placeholder?: string
  accent?: string
  onSubmit?: () => void
  className?: string
}

const MAX_PICKER_ROWS = 8

export function MentionInput({
  value, mentions, onChange, multiline = false, roster,
  placeholder, accent = '#6470f3', onSubmit, className,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [hoveredIdx, setHoveredIdx] = useState(0)

  const query = findMentionAtCursor(value, cursor)
  const pickerOpen = query !== null

  const filtered = useMemo(() => {
    if (!pickerOpen) return []
    if (query === '') {
      return [...roster]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_PICKER_ROWS)
    }
    const q = query.toLowerCase()
    return roster
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, MAX_PICKER_ROWS)
  }, [pickerOpen, query, roster])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value, mentions)
    setCursor(e.target.selectionStart ?? e.target.value.length)
    setHoveredIdx(0)
  }

  const pick = useCallback((entry: MentionRosterEntry) => {
    const head = value.slice(0, cursor)
    const tail = value.slice(cursor)
    const newHead = head.replace(/@([A-Za-z][A-Za-z'\- ]*)?$/, `@${entry.name} `)
    const newText = newHead + tail
    const newMentions = [...mentions, entry.userId]
    onChange(newText, newMentions)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = newHead.length
      el.setSelectionRange(pos, pos)
      setCursor(pos)
    })
  }, [value, cursor, mentions, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (pickerOpen && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHoveredIdx((i) => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHoveredIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); pick(filtered[hoveredIdx]); return }
      if (e.key === 'Escape')    { e.preventDefault(); setCursor(-1); return }
    }
    if (!multiline && e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCursor(e.currentTarget.selectionStart ?? 0)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    fontFamily: "'Geist', sans-serif", fontSize: 13, color: '#fff',
    resize: multiline ? 'vertical' : 'none',
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} className={className}>
      {pickerOpen && filtered.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, overflow: 'hidden', zIndex: 30,
          }}
        >
          {filtered.map((entry, i) => {
            const c = stableColor(entry.name)
            return (
              <div
                key={entry.userId}
                role="option"
                aria-selected={i === hoveredIdx}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(entry) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', cursor: 'pointer',
                  background: i === hoveredIdx ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: `${c}22`, border: `1px solid ${c}44`, color: c,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                }}>
                  {initials(entry.name)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{entry.name}</span>
                {entry.role && (
                  <span style={{
                    marginLeft: 'auto', fontFamily: "'Geist Mono', monospace",
                    fontSize: 9, color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {entry.role}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          style={{ ...inputStyle, minHeight: 60 }}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </div>
  )
}
```

> Note: `stableColor` and `initials` are existing helpers used by the current chat `MentionPicker`. If they live inline in `chat/page.tsx`, lift them to `apps/back-to-one/src/lib/utils/color.ts` first as a small refactor commit before this task.

- [ ] **Step 2: Verify lift of `stableColor` / `initials`**

If those helpers live only inline in `chat/page.tsx`, extract them into `apps/back-to-one/src/lib/utils/color.ts`:

```ts
export function stableColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const palette = ['#6470f3','#e8a020','#00b894','#f59e0b','#ec4899','#06b6d4','#a855f7','#22c55e']
  return palette[hash % palette.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}
```

If they already live there or in a similar shared location, import from that path instead and skip this step.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter back-to-one type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/lib/mentions/types.ts apps/back-to-one/src/components/ui/MentionInput.tsx apps/back-to-one/src/lib/utils/color.ts
git commit -m "feat(mentions): add MentionInput shared component"
```

---

## Task 6 — `<MentionText />` chip renderer

**Files:**
- Create: `apps/back-to-one/src/components/ui/MentionText.tsx`

Render-only. Highlights `@Name` tokens via Task 2's `tokenizeMentions`. Non-interactive in v1.

- [ ] **Step 1: Implement the component**

```tsx
import { Fragment } from 'react'
import { tokenizeMentions } from '@/lib/mentions/regex'

export interface MentionTextProps {
  text: string
  accent?: string
  className?: string
}

export function MentionText({ text, accent = '#6470f3', className }: MentionTextProps) {
  const tokens = tokenizeMentions(text)
  if (tokens.length === 0) return <span className={className}>{text}</span>

  const out: React.ReactNode[] = []
  let cursor = 0
  tokens.forEach((tok, i) => {
    if (tok.start > cursor) out.push(<Fragment key={`t${i}`}>{text.slice(cursor, tok.start)}</Fragment>)
    out.push(
      <span
        key={`m${i}`}
        style={{
          color: accent,
          background: `${accent}22`,
          padding: '1px 6px',
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        @{tok.name}
      </span>,
    )
    cursor = tok.end
  })
  if (cursor < text.length) out.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>)
  return <span className={className}>{out}</span>
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/components/ui/MentionText.tsx
git commit -m "feat(mentions): add MentionText render-only chip highlighter"
```

---

## Task 7 — Notification + roster queries

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`

Add notification CRUD, roster queries, and extend `sendChatMessage` to accept and fan out mentions.

- [ ] **Step 1: Add notification queries**

Append at the bottom of `apps/back-to-one/src/lib/db/queries.ts`:

```ts
// ── NOTIFICATIONS ─────────────────────────────────────────

export interface NotificationRow {
  id: string
  userId: string
  projectId: string
  sourceType: string
  sourceId: string
  actorId: string
  excerpt: string
  contextLabel: string
  readAt: string | null
  createdAt: string
  actor?: { id: string; name: string; avatarUrl: string | null }
  project?: { id: string; name: string; color: string | null }
}

export async function getNotifications(meId: string, projectId: string | null): Promise<NotificationRow[]> {
  const db = createClient()
  let q = db
    .from('Notification')
    .select('*, actor:User!Notification_actorId_fkey(id,name,avatarUrl), project:Project(id,name,color)')
    .eq('userId', meId)
    .order('createdAt', { ascending: false })
    .limit(100)
  if (projectId) q = q.eq('projectId', projectId)
  const { data, error } = await q
  if (error) { console.error('getNotifications failed:', error); throw error }
  return (data ?? []) as NotificationRow[]
}

export async function getUnreadCount(meId: string, projectId: string | null): Promise<number> {
  const db = createClient()
  let q = db
    .from('Notification')
    .select('id', { count: 'exact', head: true })
    .eq('userId', meId)
    .is('readAt', null)
  if (projectId) q = q.eq('projectId', projectId)
  const { count, error } = await q
  if (error) { console.error('getUnreadCount failed:', error); throw error }
  return count ?? 0
}

export async function markNotificationRead(id: string) {
  const db = createClient()
  const { error } = await db.from('Notification').update({ readAt: new Date().toISOString() }).eq('id', id)
  if (error) { console.error('markNotificationRead failed:', error); throw error }
}

export async function markAllNotificationsRead(meId: string, projectId: string | null) {
  const db = createClient()
  let q = db.from('Notification').update({ readAt: new Date().toISOString() }).eq('userId', meId).is('readAt', null)
  if (projectId) q = q.eq('projectId', projectId)
  const { error } = await q
  if (error) { console.error('markAllNotificationsRead failed:', error); throw error }
}

export function subscribeToNotifications(meId: string, onInsert: (row: NotificationRow) => void) {
  const db = createClient()
  const channelName = `notifications-${meId}-${crypto.randomUUID()}`
  const ch = db.channel(channelName)
  ch.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'Notification', filter: `userId=eq.${meId}` },
    (payload) => onInsert(payload.new as NotificationRow),
  )
  ch.subscribe()
  return () => { db.removeChannel(ch) }
}
```

- [ ] **Step 2: Add mention roster queries**

Append:

```ts
// ── MENTION ROSTER ────────────────────────────────────────

import type { MentionRosterEntry } from '@/lib/mentions/types'
// (re-export for any caller that imports queries directly)
export type { MentionRosterEntry } from '@/lib/mentions/types'

export async function getProjectMentionRoster(projectId: string): Promise<MentionRosterEntry[]> {
  const db = createClient()
  const { data, error } = await db
    .from('ProjectMember')
    .select('role, user:User!ProjectMember_userId_fkey(id,name,avatarUrl)')
    .eq('projectId', projectId)
  if (error) { console.error('getProjectMentionRoster failed:', error); throw error }
  return (data ?? []).map((m: any) => ({
    userId: m.user.id,
    name: m.user.name,
    role: m.role ?? null,
    avatarUrl: m.user.avatarUrl ?? null,
  }))
}

export async function getCrossProjectMentionRoster(meId: string): Promise<MentionRosterEntry[]> {
  const db = createClient()
  const { data: myProjects, error: pErr } = await db
    .from('ProjectMember')
    .select('projectId')
    .eq('userId', meId)
  if (pErr) { console.error('getCrossProjectMentionRoster (myProjects) failed:', pErr); throw pErr }
  const projectIds = (myProjects ?? []).map((p) => p.projectId)
  if (projectIds.length === 0) return []
  const { data, error } = await db
    .from('ProjectMember')
    .select('role, user:User!ProjectMember_userId_fkey(id,name,avatarUrl)')
    .in('projectId', projectIds)
  if (error) { console.error('getCrossProjectMentionRoster failed:', error); throw error }
  const dedup = new Map<string, MentionRosterEntry>()
  for (const m of data ?? []) {
    const u: any = m.user
    if (!u || u.id === meId) continue
    if (!dedup.has(u.id)) dedup.set(u.id, { userId: u.id, name: u.name, role: (m as any).role ?? null, avatarUrl: u.avatarUrl ?? null })
  }
  return Array.from(dedup.values())
}
```

- [ ] **Step 3: Add mention fan-out helper**

Append a single internal helper used by every mention-emitting mutation:

```ts
import { computeMentionDelta } from '@/lib/mentions/delta'
import { buildExcerpt } from '@/lib/mentions/excerpt'

interface FanoutInput {
  sourceType: 'chatMessage' | 'threadMessage' | 'actionItem' | 'milestone' | 'shootDay'
  sourceId: string
  projectId: string
  actorId: string
  newMentions: string[]
  text: string
  contextLabel: string
}

async function fanoutMentions(input: FanoutInput) {
  if (input.newMentions.length === 0) return
  const db = createClient()
  // Look up already-notified userIds for this source row (for edit-time delta).
  const { data: existing } = await db
    .from('Notification')
    .select('userId')
    .eq('sourceType', input.sourceType)
    .eq('sourceId', input.sourceId)
  const alreadyNotified = (existing ?? []).map((r) => r.userId)
  const delta = computeMentionDelta({
    newMentions: input.newMentions,
    alreadyNotified,
    actorId: input.actorId,
  })
  if (delta.length === 0) return
  const excerpt = buildExcerpt(input.text)
  const rows = delta.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    projectId: input.projectId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    actorId: input.actorId,
    excerpt,
    contextLabel: input.contextLabel,
    readAt: null,
  }))
  const { error } = await db.from('Notification').insert(rows)
  if (error) console.error('fanoutMentions failed:', error)
}
```

- [ ] **Step 4: Extend `sendChatMessage` to accept and fan out mentions**

Locate existing `sendChatMessage` (around `queries.ts:3029`) and replace:

```ts
export async function sendChatMessage(input: {
  projectId: string
  channelId?: string | null
  senderId: string
  recipientId?: string | null
  content: string
  mentions?: string[]
  contextLabel?: string
}) {
  const db = createClient()
  const { data, error } = await db
    .from('ChatMessage')
    .insert({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      channelId: input.channelId ?? null,
      senderId: input.senderId,
      recipientId: input.recipientId ?? null,
      content: input.content,
      mentions: input.mentions ?? [],
    })
    .select()
    .single()
  if (error) { console.error('sendChatMessage failed:', error); throw error }
  if (input.mentions && input.mentions.length > 0) {
    await fanoutMentions({
      sourceType: 'chatMessage',
      sourceId: data.id,
      projectId: input.projectId,
      actorId: input.senderId,
      newMentions: input.mentions,
      text: input.content,
      contextLabel: input.contextLabel ?? 'Chat',
    })
  }
  return data
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 6: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts
git commit -m "feat(notifications): add notification queries, roster, and chat fan-out"
```

---

## Task 8 — Notification + roster hooks

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1: Add query keys**

Locate the `keys` object in `useOriginOne.ts` and add:

```ts
notifications: (meId: string, projectId: string | null) => ['notifications', meId, projectId] as const,
unreadCount:   (meId: string, projectId: string | null) => ['notifications', meId, projectId, 'unread'] as const,
mentionRoster: (projectId: string | null) => ['mentionRoster', projectId] as const,
```

- [ ] **Step 2: Add hooks at the bottom of the file**

```ts
import * as db from '@/lib/db/queries' // already imported; just add the new functions if needed

export function useNotifications(projectId: string | null) {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.notifications(meId ?? '', projectId),
    queryFn:  () => db.getNotifications(meId as string, projectId),
    enabled:  !!meId,
  })
}

export function useUnreadCount(projectId: string | null) {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.unreadCount(meId ?? '', projectId),
    queryFn:  () => db.getUnreadCount(meId as string, projectId),
    enabled:  !!meId,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead(projectId: string | null) {
  const qc = useQueryClient()
  const meId = useMeId()
  return useMutation({
    mutationFn: () => db.markAllNotificationsRead(meId as string, projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useNotificationsSubscription() {
  const meId = useMeId()
  const qc = useQueryClient()
  useEffect(() => {
    if (!meId) return
    return db.subscribeToNotifications(meId, () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    })
  }, [meId, qc])
}

export function useMentionRoster(projectId: string | null) {
  const meId = useMeId()
  return useQuery({
    queryKey: keys.mentionRoster(projectId),
    queryFn:  () => projectId
      ? db.getProjectMentionRoster(projectId)
      : db.getCrossProjectMentionRoster(meId as string),
    enabled:  projectId !== null || !!meId,
  })
}
```

- [ ] **Step 3: Extend `useSendChatMessage` to pass mentions**

Locate `useSendChatMessage` (around line 1254) and confirm the mutation already passes the input through; the `mentionList` consumer will pass `mentions` via `input` directly. No code change needed if `mutationFn: db.sendChatMessage` is already a pass-through. If it isn't, update so callers can pass `{ ..., mentions, contextLabel }`.

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "feat(notifications): add hooks for notifications, roster, and realtime"
```

---

## Task 9 — `<NotificationBell />` component

**Files:**
- Create: `apps/back-to-one/src/components/notifications/NotificationBell.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useState } from 'react'
import { useUnreadCount, useNotifications } from '@/lib/hooks/useOriginOne'
import { InboxSheet } from './InboxSheet'

const TA_DEEP = '#D97706' // matches src/lib/thread-tokens.ts

export function NotificationBell({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false)
  const { data: unread = 0 } = useUnreadCount(projectId)
  const { data: all } = useNotifications(projectId)

  // Zero-state suppression: hide bell entirely when this user has no notifications.
  if ((all?.length ?? 0) === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 8, position: 'relative',
        }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: TA_DEEP, border: '2px solid #04040a',
            }}
          />
        )}
      </button>
      <InboxSheet open={open} onClose={() => setOpen(false)} projectId={projectId} />
    </>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.7)' }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter back-to-one type-check
```

(Will fail with InboxSheet not found — that's fine; resolved in Task 10.)

- [ ] **Step 3: Commit after Task 10 passes**

(Combined commit at end of Task 10.)

---

## Task 10 — `<InboxSheet />`

**Files:**
- Create: `apps/back-to-one/src/components/notifications/InboxSheet.tsx`

Slide-up Sheet listing unread + earlier notifications. Each row deep-links via Next router.

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/lib/hooks/useOriginOne'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import type { NotificationRow } from '@/lib/db/queries'

export function InboxSheet({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string | null }) {
  const { data: notifications = [] } = useNotifications(projectId)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead(projectId)
  const router = useRouter()

  const unread = notifications.filter((n) => !n.readAt)
  const earlier = notifications.filter((n) => n.readAt)

  const goTo = (n: NotificationRow) => {
    if (!n.readAt) markRead.mutate(n.id)
    router.push(deepLinkFor(n))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader
        title={projectId ? 'Notifications' : 'All notifications'}
        onClose={onClose}
        action={
          unread.length > 0 ? (
            <button
              onClick={() => markAll.mutate()}
              style={{ background: 'none', border: 'none', color: '#6470f3', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Mark all read
            </button>
          ) : undefined
        }
      />
      <SheetBody>
        {notifications.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Nothing new.
          </div>
        )}
        {unread.length > 0 && (
          <Section title="Unread">
            {unread.map((n) => <Row key={n.id} n={n} unread onClick={() => goTo(n)} showProject={!projectId} />)}
          </Section>
        )}
        {earlier.length > 0 && (
          <Section title="Earlier">
            {earlier.map((n) => <Row key={n.id} n={n} unread={false} onClick={() => goTo(n)} showProject={!projectId} />)}
          </Section>
        )}
      </SheetBody>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.13em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
        padding: '0 16px 8px',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

function Row({ n, unread, onClick, showProject }: { n: NotificationRow; unread: boolean; onClick: () => void; showProject: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: unread ? 'rgba(217,119,6,0.05)' : 'transparent',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
          <span style={{ fontWeight: 700 }}>{n.actor?.name ?? 'Someone'}</span>
          {' mentioned you'}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {showProject && n.project && (
            <span style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4,
            }}>{n.project.name}</span>
          )}
          <span style={{
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4,
          }}>{n.contextLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.4 }}>
          {n.excerpt}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {formatRelative(n.createdAt)}
      </div>
    </div>
  )
}

function deepLinkFor(n: NotificationRow): string {
  switch (n.sourceType) {
    case 'chatMessage':   return `/projects/${n.projectId}/chat?focus=${n.sourceId}`
    case 'threadMessage': return `/projects/${n.projectId}/threads?msg=${n.sourceId}`
    case 'actionItem':    return `/projects/${n.projectId}/action-items?detail=${n.sourceId}`
    case 'milestone':     return `/projects/${n.projectId}/timeline?milestone=${n.sourceId}`
    case 'shootDay':      return `/projects/${n.projectId}/timeline?shootDay=${n.sourceId}`
    default:              return `/projects/${n.projectId}`
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
```

(All three primitives are named exports from `@/components/ui/Sheet`, verified during plan authoring.)

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter back-to-one type-check
```

Expected: clean (NotificationBell now resolves InboxSheet).

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/components/notifications
git commit -m "feat(notifications): add NotificationBell and InboxSheet"
```

---

## Task 11 — Wire bell into project layout

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/layout.tsx`

The bell sits as a fixed top-right overlay so it works regardless of whether a sub-page renders its own `PageHeader` or not.

- [ ] **Step 1: Read current layout**

```bash
cat "apps/back-to-one/src/app/projects/[projectId]/layout.tsx"
```

- [ ] **Step 2: Add the bell + realtime subscription**

Inject the bell as an overlay and call the realtime subscription hook once at the layout level.

```tsx
'use client'

import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useNotificationsSubscription } from '@/lib/hooks/useOriginOne'

// inside the layout component (preserve existing imports and HubContent rendering):
function BellOverlay({ projectId }: { projectId: string }) {
  useNotificationsSubscription()
  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top) + 14px)',
      right: 16,
      zIndex: 25, // below ActionBar (z65) and above page content
    }}>
      <NotificationBell projectId={projectId} />
    </div>
  )
}

// then render <BellOverlay projectId={params.projectId} /> inside the layout's
// existing return alongside HubContent, before the final closing tag.
```

If the existing layout is a server component, extract the bell overlay into a small client wrapper file (e.g. `components/notifications/BellOverlay.tsx`) and import it. Do not convert the entire layout to client.

- [ ] **Step 3: Verify the dev server renders the bell**

```bash
pnpm --filter back-to-one dev
```

Open `http://localhost:3000/projects/<seed-project-id>` and confirm the bell does NOT show (zero-state suppression — no notifications yet).

- [ ] **Step 4: Commit**

```bash
git add "apps/back-to-one/src/app/projects/[projectId]/layout.tsx" apps/back-to-one/src/components/notifications/BellOverlay.tsx
git commit -m "feat(notifications): wire NotificationBell into project layout"
```

---

## Task 12 — Chat surface integration

**Files:**
- Modify: `apps/back-to-one/src/app/projects/[projectId]/chat/page.tsx`

Replace the inline `MentionPicker` and ad-hoc `mentionQuery` logic in `InputBar` with `<MentionInput />`. Render messages with `<MentionText />`. Pass `mentions` and `contextLabel` to `useSendChatMessage`.

- [ ] **Step 1: Replace the inline picker / input**

Delete the local `MentionPicker` function (around lines 170–210) and the inline `mentionQuery` logic in `InputBar` (around lines 219–229). Replace `InputBar` with:

```tsx
import { MentionInput } from '@/components/ui/MentionInput'
import { useMentionRoster } from '@/lib/hooks/useOriginOne'

function InputBar({
  projectId, accent, placeholder, onSend,
}: { projectId: string; accent: string; placeholder: string; onSend: (text: string, mentions: string[]) => void }) {
  const [value, setValue] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const { data: roster = [] } = useMentionRoster(projectId)

  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSend(v, mentions)
    setValue('')
    setMentions([])
  }

  const ready = value.trim().length > 0

  return (
    <div style={{ flexShrink: 0, padding: '10px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22, padding: '8px 14px' }}>
        <MentionInput
          value={value}
          mentions={mentions}
          onChange={(text, m) => { setValue(text); setMentions(m) }}
          roster={roster}
          placeholder={placeholder}
          accent={accent}
          onSubmit={submit}
        />
        <span
          onClick={submit}
          style={{ fontSize: 16, color: ready ? accent : 'rgba(255,255,255,0.25)', flexShrink: 0, cursor: ready ? 'pointer' : 'default', transition: 'color 0.15s' }}>
          ↑
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `MessageList` to render with `MentionText`**

Locate the `MessageList` function (around line 129) and where each message body is rendered, replace `{m.content}` (or whichever prop holds the text) with:

```tsx
import { MentionText } from '@/components/ui/MentionText'

// inside the message bubble:
<MentionText text={m.content} accent={accent} />
```

- [ ] **Step 3: Update callers of `onSend` to pass mentions**

Find both call sites (DM view around line 366, channel view around line 514) and update the send handler to call `useSendChatMessage` with the mentions:

```tsx
const sendMsg = useSendChatMessage(projectId)

// existing onSend caller:
<InputBar
  projectId={projectId}
  accent={accent}
  placeholder={placeholder}
  onSend={(text, mentions) => sendMsg.mutate({
    projectId,
    channelId: channelId ?? null,         // or null for DM
    recipientId: partnerId ?? null,
    senderId: meId as string,
    content: text,
    mentions,
    contextLabel: channelName ? `Chat · ${channelName}` : `Chat · DM`,
  })}
/>
```

(Use the variable name that already exists in scope for the channel name / DM partner.)

- [ ] **Step 4: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 5: Commit**

```bash
git add "apps/back-to-one/src/app/projects/[projectId]/chat/page.tsx"
git commit -m "feat(chat): use shared MentionInput, persist mentions, render MentionText"
```

---

## Task 13 — End-to-end verification

This is a manual test, not a unit test, because mention flow is realtime + multi-user.

- [ ] **Step 1: Apply migration to local Supabase**

If not already done in Task 1:

```bash
pnpm --filter @origin-one/db prisma migrate deploy
pnpm --filter @origin-one/db prisma generate
```

- [ ] **Step 2: Start the dev server**

```bash
pnpm --filter back-to-one dev
```

- [ ] **Step 3: Test as User A (the actor)**

Open `http://localhost:3000/projects/<seed-project-id>/chat`.

1. In the input, type `@`. Picker should appear listing the first 8 project members alphabetically.
2. Type `Sa` — picker filters to "Sa…" matches.
3. Tap a name — input shows `@Sarah `; cursor placed after the trailing space.
4. Add some text and send.
5. The message renders with `@Sarah` highlighted as a chip in the project accent.

- [ ] **Step 4: Test as User B (the recipient — simulate by switching auth in another browser/incognito)**

Open the app as Sarah (or whoever was mentioned). On any project page:

1. Within ~1s of the send, the bell appears top-right with an amber dot.
2. Tap the bell — InboxSheet slides up. One row labeled "User A mentioned you" with `Chat · …` context chip and a `now` timestamp.
3. Tap the row — navigates to `/projects/.../chat?focus=<msgId>` and the bell dot clears.
4. The notification moves to the "Earlier" section on next bell open (or disappears if you used "Mark all read").

- [ ] **Step 5: Test the orphan-source case**

1. As User A, send another mention to Sarah.
2. Delete the resulting `ChatMessage` row directly via Supabase SQL editor.
3. As Sarah, open the inbox. The notification still shows the excerpt + context. Tap it — toast `This message was deleted` appears (this UX is implemented at the destination page; for v1 chat may simply route and show its own empty state — note any gap and capture as a follow-up).

- [ ] **Step 6: Test self-mention is suppressed**

As User A, mention yourself. No notification row should be inserted (verify by SQL: `select * from "Notification" where "userId" = '<userA>' and "actorId" = '<userA>'` returns 0).

- [ ] **Step 7: Sign off**

If all the above pass, the foundation + chat integration is verified. Proceed to PR review and merge.

---

## Task 14 — Open the PR

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feat/mentions-foundation
```

- [ ] **Step 2: Open PR with summary**

```bash
gh pr create --title "feat: mentions + notifications foundation (Phase 1 — chat surface)" --body "$(cat <<'EOF'
## Summary

- Adds Notification + PushSubscription tables and `mentions String[]` to ChatMessage, ThreadMessage, ActionItem, Milestone, ShootDay
- Ships shared `<MentionInput />` and `<MentionText />` components
- Adds NotificationBell + slide-up InboxSheet, scoped per-project on project pages
- Wires realtime fan-out and integrates chat surface end-to-end

Spec: docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md
Plan: docs/superpowers/plans/2026-04-28-bt1-mentions-foundation.md

Phase 2 (threads, action items, timeline, global ChatSheet) is a follow-up plan reusing the same components and fan-out helper.

## Test plan

- [x] vitest unit tests (regex, excerpt, delta) pass
- [x] manual dogfood: A→B mention round-trip with realtime bell + inbox + deep-link
- [x] self-mention suppressed
- [x] zero-state bell suppression
- [ ] reviewed by user before merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL to the user**

---

## Self-Review Notes

Spec coverage:
- [x] Schema (Notification, PushSubscription, mentions[]) — Task 1
- [x] MentionInput — Task 5
- [x] MentionText — Task 6
- [x] Bell + Inbox — Tasks 9, 10, 11
- [x] Realtime — Tasks 7, 8, 11
- [x] Chat surface integration — Task 12
- [x] Self-mention suppression — Task 4 + Task 13
- [x] Edit-time delta (newly mentioned only) — Task 7 (`fanoutMentions` queries existing notifications by source)
- [x] Manual buildExcerpt at fan-out time — Task 7
- [x] Zero-state bell suppression — Task 9
- [x] Orphan source handling — Task 13 (manual verification; v1 acceptable behavior captured)
- [ ] Threads, action items, timeline, global ChatSheet — **Phase 2 plan**, not in this plan
- [ ] Push (v1.1) — **Phase 3 plan**, not in this plan

Placeholder scan: clean. Every step has executable code or an exact command.

Type consistency:
- `MentionRosterEntry` shape consistent between `queries.ts` and `MentionInput.tsx`.
- `NotificationRow` exported from `queries.ts` and consumed by InboxSheet via type import.
- `mentions: string[]` parameter name consistent across `MentionInput`, `useMentionRoster`, `sendChatMessage`, fan-out helper.
- `computeMentionDelta` input shape consistent between Task 4 definition and Task 7 usage.
