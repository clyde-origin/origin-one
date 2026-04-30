# BT1 Mentions — Phase 3 (Web Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real iOS / Android / desktop browser notifications via Web Push when a user is mentioned, building on the `Notification` rows + `PushSubscription` table already shipped in Phase 1 (#105).

**Architecture:**
1. Service worker at `public/sw.js` listens for `push` events and shows a system notification, with `notificationclick` deep-linking back to BT1.
2. A user gesture in the InboxSheet (a one-time soft prompt or a settings toggle) triggers `Notification.requestPermission()` and `serviceWorker.pushManager.subscribe()` — the resulting `PushSubscription` is POSTed to a new `/api/push/subscribe` endpoint that writes one row to the `PushSubscription` table.
3. The existing client-side `fanoutMentions` (in `queries.ts`) is unchanged at the database boundary — after it inserts `Notification` rows, it fires a fire-and-forget `POST /api/push/dispatch` with the new notification IDs. The dispatch route reads the rows, looks up the recipient's `PushSubscription` rows, and sends a Web Push request via the `web-push` npm package (server-side; VAPID private key never leaves the server). Stale subscriptions (HTTP 410 Gone) are deleted.
4. The client never holds the VAPID private key. Public key is exposed via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and used in `subscribe()`.

**Locked decisions** (override in review if you want):
- **Library:** `web-push` (server-side); native browser APIs (client). No `next-pwa` or other framework wrappers.
- **Service worker scope:** root (`/sw.js` served from `public/`). Single SW for the whole app — `push` is its only handler in v1.1.
- **Subscription model:** one row per `(user, endpoint)`. The `endpoint` column is already `@unique`, so re-subscribing from the same browser is a no-op.
- **Soft prompt placement:** InboxSheet header, shown once per user (dismiss persisted in `localStorage`). On iOS, prompt copy says "Add to Home Screen first to enable" — no detection in v1.1, the user understands.
- **Settings page:** none in v1.1. The soft prompt is the only entry. Re-enabling later is via clearing the `localStorage` key (a known limitation, fine for v1.1).
- **Failure mode:** push send is fire-and-forget. If `/api/push/dispatch` errors, the in-app notification still appeared via realtime — the user just doesn't get the iPhone banner that round.
- **Deep-link payload:** push notification body carries `{ title, body, url }`. `notificationclick` opens `url` via `clients.openWindow`.

**Tech Stack:** Next.js 14 App Router, TypeScript, `web-push`, native `serviceWorker` and `PushManager` APIs.

**Spec:** `docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md` (Push v1.1 section).
**Foundation:** Phase 1 PR #105 (merged) — `PushSubscription` table, `Notification` table, `fanoutMentions` helper.

---

## Pre-flight: VAPID keys (USER ACTION)

**This step must be completed by the user before Task 4 runs.**

VAPID keys identify your server to push services so subscribers can verify push messages came from BT1 and not an attacker who scraped the public endpoint.

```bash
# Generate one set of keys for the project. Run once, ever.
npx web-push generate-vapid-keys --json
```

Output is:
```json
{
  "publicKey": "BFa…(88 chars base64url)",
  "privateKey": "abc…(43 chars base64url)"
}
```

Add to **all three** environments:

1. **Local `.env.local`** (in `apps/back-to-one/.env.local`):
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BFa…
   VAPID_PRIVATE_KEY=abc…
   VAPID_SUBJECT=mailto:you@yourdomain.com
   ```
2. **Vercel preview env** — Project Settings → Environment Variables → "Preview" scope.
3. **Vercel production env** — same panel, "Production" scope.

`VAPID_SUBJECT` is the contact mailto: that push services use if they need to reach you about deliverability issues. Use a real email you check.

**Confirmation:** When the keys are in all three environments, tell the implementer (or check the Phase 3 PR comments on Vercel preview to confirm the build sees them).

---

## File Structure

**Created:**
- `apps/back-to-one/public/sw.js` — service worker with `push` and `notificationclick` handlers.
- `apps/back-to-one/src/lib/push/client.ts` — client-side: `registerServiceWorker()`, `subscribeToPush()`, `unsubscribeFromPush()`, `getCurrentSubscription()`. Pure browser-API wrappers.
- `apps/back-to-one/src/app/api/push/subscribe/route.ts` — POST writes a `PushSubscription` row, DELETE removes it.
- `apps/back-to-one/src/app/api/push/dispatch/route.ts` — POST sends Web Push for a list of notification IDs.
- `apps/back-to-one/src/lib/push/dispatch.ts` — small utility: `dispatchPush(notificationIds: string[])`. Used by `fanoutMentions` after Notification insert.
- `apps/back-to-one/src/components/notifications/EnablePushPrompt.tsx` — one-time soft prompt rendered inside the InboxSheet header area.

**Modified:**
- `apps/back-to-one/src/lib/db/queries.ts` — `fanoutMentions` calls `dispatchPush(insertedIds)` after inserting Notification rows.
- `apps/back-to-one/src/components/notifications/InboxSheet.tsx` — render `<EnablePushPrompt />` above the section list.
- `apps/back-to-one/package.json` — adds `web-push` dependency.

---

## Task 1 — Add `web-push` dependency

**Files:**
- Modify: `apps/back-to-one/package.json`

- [ ] **Step 1: Install**

```bash
pnpm --filter back-to-one add web-push
pnpm --filter back-to-one add -D @types/web-push
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter back-to-one type-check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/package.json pnpm-lock.yaml
git commit -m "chore(push): add web-push dependency for server-side push delivery"
```

---

## Task 2 — Service worker file

**Files:**
- Create: `apps/back-to-one/public/sw.js`

The service worker is plain JavaScript (not TypeScript) because it runs in a separate worker context where the build pipeline doesn't apply. Keep it minimal: receive a push, show a notification, handle clicks.

- [ ] **Step 1: Write the service worker**

```js
// apps/back-to-one/public/sw.js
//
// BT1 service worker — handles push notifications and click-to-open routing.
// Registered once on first push subscription via lib/push/client.ts. Scope is
// the root of the app so notifications can deep-link to any path.

self.addEventListener('install', (event) => {
  // Activate immediately on install — no waiting for old SW to finish.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of any open BT1 tabs immediately.
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch (e) {
    payload = { title: 'Back to One', body: event.data.text(), url: '/' }
  }
  const { title = 'Back to One', body = '', url = '/' } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
      tag: payload.tag,           // notifications with the same tag replace each other
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If a BT1 tab is already open, focus it and navigate.
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          if ('navigate' in client) return client.navigate(url)
          return
        }
      }
      // Otherwise open a new window.
      return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/back-to-one/public/sw.js
git commit -m "feat(push): add service worker for push delivery and click routing"
```

---

## Task 3 — Client-side push helpers

**Files:**
- Create: `apps/back-to-one/src/lib/push/client.ts`

Pure browser API wrappers. No React, no React Query — those land in the prompt component (Task 6).

- [ ] **Step 1: Write the helpers**

```ts
// apps/back-to-one/src/lib/push/client.ts

const SW_PATH = '/sw.js'
const SW_SCOPE = '/'

/**
 * Returns true if Web Push is supported in this browser context.
 * On iOS Safari, returns true ONLY when the page is running as an
 * installed PWA (display-mode: standalone). In a regular Safari tab
 * on iOS, push is not supported — the user must Add to Home Screen.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  // iOS Safari: only standalone PWAs can subscribe.
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  if (isIOS) {
    const standalone = (window.matchMedia?.('(display-mode: standalone)').matches)
      || (navigator as any).standalone === true
    if (!standalone) return false
  }
  return true
}

/** Returns true if the user has granted Notification permission. */
export function hasNotificationPermission(): boolean {
  if (typeof Notification === 'undefined') return false
  return Notification.permission === 'granted'
}

/** Register the service worker once. Idempotent. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('serviceWorker not supported')
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  if (existing) return existing
  return navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
}

/**
 * Subscribe this browser to push and POST the subscription to the server.
 * Asks for permission if needed; throws if the user denies.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('push not supported in this browser context')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('notification permission denied')

  const reg = await registerServiceWorker()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID public key missing in env')
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }
  await postSubscription(sub)
  return sub
}

/** Remove the local subscription and notify the server. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await sub.unsubscribe()
  await deleteSubscription(sub.endpoint)
}

/** Returns the existing PushSubscription for this browser, or null. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  return (await reg?.pushManager.getSubscription()) ?? null
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    }),
  })
  if (!res.ok) throw new Error(`subscribe failed: ${res.status}`)
}

async function deleteSubscription(endpoint: string): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter back-to-one type-check
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/lib/push/client.ts
git commit -m "feat(push): add client-side helpers for SW registration and push subscription"
```

---

## Task 4 — Subscribe API route

**Files:**
- Create: `apps/back-to-one/src/app/api/push/subscribe/route.ts`

Pattern matches the existing `apps/back-to-one/src/app/api/storyboard/generate/route.ts` (Supabase server client built from cookies, then RLS handles authorization).

- [ ] **Step 1: Write the route**

```ts
// apps/back-to-one/src/app/api/push/subscribe/route.ts
//
// POST   — register a Web Push subscription for the authenticated user.
// DELETE — remove a subscription by endpoint for the authenticated user.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function makeServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    },
  )
}

interface SubscribeBody {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export async function POST(req: Request) {
  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: SubscribeBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  // Look up the User row by authId. The PushSubscription table FK references User.id.
  const { data: appUser, error: userErr } = await supabase
    .from('User').select('id').eq('authId', user.id).single()
  if (userErr || !appUser) return NextResponse.json({ error: 'user row not found' }, { status: 404 })

  // Upsert by endpoint (the unique constraint). Re-subscribing from the same browser is a no-op.
  const { error: upsertErr } = await supabase
    .from('PushSubscription')
    .upsert({
      userId: appUser.id,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: body.userAgent ?? null,
    }, { onConflict: 'endpoint' })

  if (upsertErr) {
    console.error('PushSubscription upsert failed:', upsertErr)
    return NextResponse.json({ error: 'persist failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { endpoint?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  const { error } = await supabase
    .from('PushSubscription').delete().eq('endpoint', body.endpoint)
  if (error) {
    console.error('PushSubscription delete failed:', error)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/app/api/push/subscribe/route.ts
git commit -m "feat(push): add /api/push/subscribe POST and DELETE endpoints"
```

---

## Task 5 — Dispatch API route + client utility

**Files:**
- Create: `apps/back-to-one/src/app/api/push/dispatch/route.ts`
- Create: `apps/back-to-one/src/lib/push/dispatch.ts`

The dispatch route reads notification rows by ID, looks up each recipient's `PushSubscription` rows, and sends a Web Push request via the `web-push` library. Stale subscriptions (HTTP 410) are deleted.

- [ ] **Step 1: Write the dispatch route**

`apps/back-to-one/src/app/api/push/dispatch/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import webpush from 'web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:noreply@example.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

function makeServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    },
  )
}

function deepLinkFor(n: { sourceType: string; sourceId: string; projectId: string }): string {
  switch (n.sourceType) {
    case 'chatMessage':   return `/projects/${n.projectId}/chat?focus=${n.sourceId}`
    case 'threadMessage': return `/projects/${n.projectId}/threads?msg=${n.sourceId}`
    case 'actionItem':    return `/projects/${n.projectId}/action-items?detail=${n.sourceId}`
    case 'milestone':     return `/projects/${n.projectId}/timeline?milestone=${n.sourceId}`
    case 'shootDay':      return `/projects/${n.projectId}/timeline?shootDay=${n.sourceId}`
    default:              return `/projects/${n.projectId}`
  }
}

export async function POST(req: Request) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
  }

  const supabase = makeServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { notificationIds?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const ids = body.notificationIds ?? []
  if (ids.length === 0) return NextResponse.json({ ok: true, dispatched: 0 })

  // Read the notifications + the actor's row to compose the title.
  const { data: notifications, error } = await supabase
    .from('Notification')
    .select('id, userId, projectId, sourceType, sourceId, actorId, excerpt, contextLabel, actor:User!Notification_actorId_fkey(id,name)')
    .in('id', ids)
  if (error) {
    console.error('dispatch: notification fetch failed:', error)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }

  let dispatched = 0
  for (const n of notifications ?? []) {
    const { data: subs } = await supabase
      .from('PushSubscription').select('*').eq('userId', n.userId)
    if (!subs || subs.length === 0) continue

    const actorName = (n as any).actor?.name ?? 'Someone'
    const payload = JSON.stringify({
      title: `${actorName} mentioned you`,
      body: n.excerpt,
      url: deepLinkFor(n),
      tag: n.id,
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        dispatched++
      } catch (err: any) {
        // 410 Gone or 404 — subscription is dead. Remove it.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('PushSubscription').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('webpush sendNotification failed:', err?.statusCode ?? err)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, dispatched })
}
```

- [ ] **Step 2: Write the client utility**

`apps/back-to-one/src/lib/push/dispatch.ts`:

```ts
/**
 * Fire-and-forget POST to /api/push/dispatch. Errors are logged but never
 * thrown — the in-app notification has already been delivered via realtime.
 */
export async function dispatchPush(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return
  try {
    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds }),
    })
  } catch (err) {
    console.warn('dispatchPush failed (non-fatal):', err)
  }
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/app/api/push/dispatch/route.ts apps/back-to-one/src/lib/push/dispatch.ts
git commit -m "feat(push): add /api/push/dispatch and client dispatchPush helper"
```

---

## Task 6 — Wire push dispatch into `fanoutMentions`

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts`

After the existing `Notification` insert, capture the inserted IDs and fire-and-forget the dispatch.

- [ ] **Step 1: Edit `fanoutMentions`**

Locate `fanoutMentions` (around line 3439 in the current file). The function currently ends with:

```ts
const { error } = await db.from('Notification').insert(rows)
if (error) console.error('fanoutMentions failed:', error)
```

Change to:

```ts
const { data: inserted, error } = await db.from('Notification').insert(rows).select('id')
if (error) {
  console.error('fanoutMentions failed:', error)
  return
}
const insertedIds = (inserted ?? []).map((r) => r.id)
if (insertedIds.length > 0) {
  // Fire-and-forget — push delivery is best-effort. In-app realtime already
  // delivered the bell update.
  void dispatchPush(insertedIds)
}
```

Add the import at the top of the file (alongside the other `@/lib/...` imports):

```ts
import { dispatchPush } from '@/lib/push/dispatch'
```

- [ ] **Step 2: Type-check + tests**

```bash
pnpm --filter back-to-one type-check
npx vitest run
```

Expected: clean type-check, 193 tests passing (no behavioral test for push — verified manually in Task 9).

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts
git commit -m "feat(push): wire dispatchPush into fanoutMentions after Notification insert"
```

---

## Task 7 — Soft prompt UI in InboxSheet

**Files:**
- Create: `apps/back-to-one/src/components/notifications/EnablePushPrompt.tsx`
- Modify: `apps/back-to-one/src/components/notifications/InboxSheet.tsx`

A small one-time banner. Hidden when push isn't supported, when the user already subscribed, or when they previously dismissed it.

- [ ] **Step 1: Write the prompt component**

`apps/back-to-one/src/components/notifications/EnablePushPrompt.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { isPushSupported, hasNotificationPermission, getCurrentSubscription, subscribeToPush } from '@/lib/push/client'

const DISMISS_KEY = 'bt1.push.prompt.dismissed'

export function EnablePushPrompt() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isPushSupported()) return
      if (hasNotificationPermission()) {
        // Permission already granted — check whether we have an active subscription.
        const sub = await getCurrentSubscription()
        if (sub) return // already subscribed, nothing to prompt
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return
      if (!cancelled) setVisible(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!visible) return null

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await subscribeToPush()
      setVisible(false)
    } catch (err: any) {
      setError(err?.message ?? 'Could not enable notifications')
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  // iOS Safari (non-PWA) returns false from isPushSupported, so this banner
  // only renders to a context that can actually subscribe. iOS PWA users see
  // the same banner and the iOS system permission sheet on tap.
  return (
    <div style={{
      margin: '8px 16px 12px',
      padding: '12px 14px',
      borderRadius: 12,
      background: 'rgba(100,112,243,0.08)',
      border: '1px solid rgba(100,112,243,0.22)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
        Get notified when you're not in the app?
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
        On iOS, add Back to One to your Home Screen first — system notifications only work for installed PWAs.
      </div>
      {error && (
        <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={enable}
          disabled={busy}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: '#6470f3', color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
        <button
          onClick={dismiss}
          disabled={busy}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'transparent', color: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render it in InboxSheet**

In `apps/back-to-one/src/components/notifications/InboxSheet.tsx`, add the import:
```tsx
import { EnablePushPrompt } from './EnablePushPrompt'
```

And inside `<SheetBody>`, render `<EnablePushPrompt />` ABOVE the `notifications.length === 0` and section blocks. So the structure becomes:

```tsx
<SheetBody>
  <EnablePushPrompt />
  {notifications.length === 0 && (
    <div ...>Nothing new.</div>
  )}
  {unread.length > 0 && (
    <Section title="Unread">...</Section>
  )}
  {earlier.length > 0 && (
    <Section title="Earlier">...</Section>
  )}
</SheetBody>
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter back-to-one type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/components/notifications/EnablePushPrompt.tsx apps/back-to-one/src/components/notifications/InboxSheet.tsx
git commit -m "feat(push): add one-time soft prompt to enable notifications"
```

---

## Task 8 — Manual end-to-end verification

This is a manual test, not automated. Run it on the Vercel preview (HTTPS required for service workers and push) — local dev works only on `localhost` (treated as secure).

- [ ] **Step 1: Verify VAPID env in Vercel preview build**

Open the Phase 3 PR's Vercel preview URL. Open dev tools → Application tab. Confirm:
- `Service Workers` panel: `/sw.js` is registered (will appear after Step 3).
- No console error about `VAPID public key missing in env`.

- [ ] **Step 2: Trigger the prompt**

Sign in. Have someone mention you (or self-mention is filtered, so use a second account). Once you have at least one notification, open the inbox bell — the soft prompt appears.

- [ ] **Step 3: Subscribe**

Tap "Enable". The browser shows its native permission sheet. Grant it. Devtools → Application → Service Workers should now show `/sw.js` as activated. Application → Push panel can simulate a push event (right-click the SW → Push).

- [ ] **Step 4: End-to-end push**

From a different browser session, mention you. Within ~5s, the system notification should appear (notification banner on Mac/Windows, lock-screen banner on iPhone home-screen-installed PWA).

- [ ] **Step 5: Click-to-deep-link**

Tap the notification. The window focuses (or opens) and navigates to the deep-link path (e.g. `/projects/<id>/chat?focus=<msgId>`).

- [ ] **Step 6: Stale subscription cleanup**

In Supabase dashboard, manually delete a row from `PushSubscription` for your user. Mention yourself again. The dispatch endpoint will hit a stale endpoint, get 410 Gone, and clean it up automatically (verify by another mention going through silently — no error chain).

- [ ] **Step 7: iOS PWA path** (if you have an iPhone)

On iPhone Safari, open the preview URL. Tap Share → Add to Home Screen. Open the BT1 home-screen icon. Sign in. Trigger a mention from elsewhere. Confirm the iOS system notification appears on the lock screen and tapping it opens the BT1 PWA at the right deep link.

---

## Task 9 — Push branch and open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/mentions-phase-3-push
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: web push notifications for @mentions (Phase 3)" --body "$(cat <<'EOF'
## Summary

Delivers real iOS / Android / desktop browser system notifications for @mentions, building on the Notification rows + PushSubscription table shipped in Phase 1.

- **Service worker** (`public/sw.js`) — handles `push` events (showNotification) and `notificationclick` (deep-link routing).
- **Client helpers** (`lib/push/client.ts`) — capability detection (iOS PWA vs. Safari tab), permission request, subscription lifecycle.
- **API routes** — `/api/push/subscribe` (POST/DELETE) and `/api/push/dispatch` (POST). Server-side VAPID signing via the `web-push` package; private key never reaches the client.
- **Dispatch wiring** — after `fanoutMentions` inserts Notification rows, `dispatchPush(insertedIds)` is fired and-forgot. Failure of the push hop does not affect in-app realtime delivery.
- **Soft prompt** — a one-time banner inside the InboxSheet (`EnablePushPrompt`) that walks the user through enabling notifications. Dismissal persisted in localStorage. iOS users see "Add to Home Screen first".
- **Stale subscription cleanup** — dispatch handles HTTP 410 Gone by deleting the row.

## Required env

VAPID keys (run `npx web-push generate-vapid-keys --json` once):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client + server)
- `VAPID_PRIVATE_KEY` (server only)
- `VAPID_SUBJECT` (e.g. `mailto:you@yourdomain.com`)

Must be set in BOTH local `.env.local` AND Vercel (preview + production).

Spec: `docs/superpowers/specs/2026-04-28-bt1-mentions-and-notifications-design.md` (Push v1.1)
Plan: `docs/superpowers/plans/2026-04-30-bt1-mentions-phase-3-push.md`

## Test plan

- [x] type-check, vitest
- [ ] manual: subscribe via soft prompt, trigger mention from second session, see system notification within ~5s
- [ ] manual: tap notification → deep-link opens correct surface
- [ ] manual: stale-subscription cleanup (410 path)
- [ ] manual on iPhone: install PWA, subscribe, receive lock-screen notification

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- [x] Service worker registers Web Push — Task 2 + 3
- [x] `web-push` server send — Task 5
- [x] `POST /api/push/subscribe` endpoint — Task 4
- [x] Stale-subscription cleanup (410) — Task 5
- [x] Soft prompt on first mention — Task 7
- [x] iOS via PWA install — capability detection in Task 3 + prompt copy in Task 7
- [x] VAPID keys in env — pre-flight section
- [x] Deep-link payload — service worker (Task 2) + dispatch (Task 5) compute matching URLs from sourceType
- [N/A] Settings toggle — explicitly deferred ("dismiss" is the only path to re-prompt later in v1.1)

**Type consistency:** `subscribeToPush`, `unsubscribeFromPush`, `getCurrentSubscription` are consistent across `client.ts` (Task 3) and `EnablePushPrompt.tsx` (Task 7). `dispatchPush` signature consistent between `dispatch.ts` (Task 5) and the call site in `queries.ts` (Task 6). The dispatch route's `deepLinkFor` is intentionally duplicated from `InboxSheet.tsx` — keeping deep-link logic local to each consumer matches the existing pattern (sw.js can't import from app code).

**Placeholder scan:** No TBDs. The pre-flight VAPID section is an explicit user action — not a placeholder. Manual verification (Task 8) is intentionally manual; automated SW + push tests are out of scope for v1.1.

**Key risk surfaces called out:**
1. VAPID config spread across local/preview/production — easy to miss one and have prod silently fail. Pre-flight section makes this explicit.
2. Service worker scope is `/` — overrides any future SW. Acceptable for v1.1; revisit if BT1 ever needs offline caching too.
3. `fanoutMentions` is currently client-side; `dispatchPush` POSTs back to the server. The actor's session cookies authenticate the dispatch call. If the actor's session is invalid at dispatch time, push silently fails — the recipient still gets the in-app row via realtime.
