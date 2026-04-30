# Call Sheet — Tracking (Arc D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Open / confirm / decline tracking, smart delta detection, recipient status table, public confirm landing.

**Architecture:** Arc C migration already added the tracking columns (`openedAt`, `clickedAt`, `confirmedAt`, `declinedAt`, `outdatedAt`, `personalizedSnapshot`). Arc D wires the read paths and the public-facing routes.

**Spec:** `docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md`

---

## File Structure

**Created:**
- `apps/back-to-one/src/lib/call-sheet/detect-outdated.ts` + test
- `apps/back-to-one/src/components/call-sheets/TrackingTab.tsx`
- `apps/back-to-one/src/app/c/[token]/page.tsx` — confirm/decline landing
- `apps/back-to-one/src/app/c/[token]/confirm/route.ts`
- `apps/back-to-one/src/app/c/[token]/pixel.gif/route.ts`

**Modified:**
- `apps/back-to-one/src/lib/db/queries.ts` — `fetchCallSheetDeliveries`, `markDeliveryOpened`, `markDeliveryConfirmed`, `markDeliveryDeclined`
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — `useCallSheetDeliveries` (10s polling), `useResendToRecipients`
- `apps/back-to-one/src/app/c/[token]/view/page.tsx` — set `openedAt` on view
- `apps/back-to-one/src/app/projects/[projectId]/call-sheets/[callSheetId]/page.tsx` — wire TrackingTab
- `apps/back-to-one/src/lib/db/queries.ts` — `updateCallSheet` triggers `runDeltaDetection`

---

## Task 1 — Delta detection helper

**Files:**
- Create: `apps/back-to-one/src/lib/call-sheet/detect-outdated.ts`
- Test: `apps/back-to-one/src/lib/call-sheet/detect-outdated.test.ts`

```ts
export type Snapshot = {
  callTime: string | null
  locationAddress: string | null
  shootDate: string
  scheduleBlockIds: string[]
  lunchTime: string | null
}

export function snapshotsDiffer(a: Snapshot, b: Snapshot): boolean {
  if (a.callTime !== b.callTime) return true
  if (a.locationAddress !== b.locationAddress) return true
  if (a.shootDate !== b.shootDate) return true
  if (a.lunchTime !== b.lunchTime) return true
  if (a.scheduleBlockIds.length !== b.scheduleBlockIds.length) return true
  const sortedA = [...a.scheduleBlockIds].sort()
  const sortedB = [...b.scheduleBlockIds].sort()
  return sortedA.some((id, i) => id !== sortedB[i])
}

// Returns deliveryIds that need flagging
export function findOutdatedDeliveries(input: {
  deliveries: { id: string; personalizedSnapshot: Snapshot | null }[]
  freshSnapshots: Record<string, Snapshot>  // recipientId → fresh snapshot
  recipientIdByDelivery: Record<string, string>
}): string[] {
  return input.deliveries
    .filter(d => {
      const recipientId = input.recipientIdByDelivery[d.id]
      const fresh = input.freshSnapshots[recipientId]
      if (!fresh || !d.personalizedSnapshot) return false
      return snapshotsDiffer(d.personalizedSnapshot, fresh)
    })
    .map(d => d.id)
}
```

- [ ] Step 1: TDD — test all five trigger fields and the order-independence of `scheduleBlockIds`.

- [ ] Step 2: Implement + commit: `feat(call-sheets): delta detection helper`.

---

## Task 2 — Wire delta detection into call sheet update

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts` — `updateCallSheet`

After persisting the update, recompute fresh snapshots for all non-excluded recipients, diff against latest delivery snapshots, and:
- For deliveries that differ: SET `outdatedAt = now()`
- For deliveries that differ AND have non-null `confirmedAt`: also SET `confirmedAt = NULL` (recipient must re-confirm)

- [ ] Step 1: Implement.

- [ ] Step 2: Test manually: edit a CallSheet field that affects a recipient, observe `outdatedAt` set on their latest delivery row.

- [ ] Step 3: Commit: `feat(call-sheets): re-run delta detection on call sheet update`.

---

## Task 3 — Tracking tab

**Files:**
- Create: `apps/back-to-one/src/components/call-sheets/TrackingTab.tsx`

Renders the StudioBinder-style table:

```
┌───┬──────────────┬──────────┬────────────┬────────┬──────────────────┬──────────────┐
│ ☐ │ Avatar Name  │ Call     │ Status     │ Viewed │ Email            │ Phone        │
│   │ Role         │ time     │ badge      │ count  │                  │              │
└───┴──────────────┴──────────┴────────────┴────────┴──────────────────┴──────────────┘
```

Columns:
- Checkbox (multi-select)
- Avatar (existing `<CrewAvatar />`) + name + role (subtitle)
- Call time (formatted)
- Status badge — combines latest email + sms delivery state into one of: `Draft`, `Scheduled`, `Sent`, `Delivered`, `Opened`, `Confirmed`, `Declined`, `Outdated`, `Bounced`, `Failed`
- View count (from email-channel `openedAt` timestamp count — for v1, just 0 or 1)
- Email + Phone columns
- Filter chips above table: All / Confirmed / Outdated / Not yet sent / Declined / Bounced
- Multi-select footer action: "Resend to selected (N)"

`useCallSheetDeliveries(callSheetId)` polls every 10 seconds.

- [ ] Step 1: Status-badge derivation helper:

```ts
export function deriveRecipientStatus(deliveries: CallSheetDelivery[]): {
  badge: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'confirmed' | 'declined' | 'outdated' | 'bounced' | 'failed'
  views: number
} {
  if (deliveries.length === 0) return { badge: 'draft', views: 0 }
  const latest = deliveries.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0]
  if (latest.outdatedAt) return { badge: 'outdated', views: 0 }
  if (latest.declinedAt) return { badge: 'declined', views: 0 }
  if (latest.confirmedAt) return { badge: 'confirmed', views: 0 }
  if (latest.bouncedAt) return { badge: 'bounced', views: 0 }
  if (latest.status === 'failed') return { badge: 'failed', views: 0 }
  if (latest.openedAt) return { badge: 'opened', views: 1 }
  if (latest.deliveredAt) return { badge: 'delivered', views: 0 }
  if (latest.sentAt) return { badge: 'sent', views: 0 }
  if (latest.scheduledFor) return { badge: 'scheduled', views: 0 }
  return { badge: 'draft', views: 0 }
}
```

- [ ] Step 2: Implement table component + commit.

---

## Task 4 — Tracking pixel route

**Files:**
- Create: `apps/back-to-one/src/app/c/[token]/pixel.gif/route.ts`

```ts
export const runtime = 'nodejs'

const TRANSPARENT_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
])

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  // Side effect: mark the matching delivery's openedAt = now() if not already set
  await markDeliveryOpenedByToken(params.token)
  return new Response(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
```

- [ ] Step 1: Implement + commit.

---

## Task 5 — Confirm/decline route

**Files:**
- Create: `apps/back-to-one/src/app/c/[token]/confirm/route.ts`
- Create: `apps/back-to-one/src/app/c/[token]/page.tsx`

```ts
// route.ts — POST
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const formData = await req.formData()
  const action = formData.get('action')
  if (action === 'confirm') {
    await markDeliveryConfirmedByToken(params.token)
  } else if (action === 'decline') {
    await markDeliveryDeclinedByToken(params.token)
  }
  return Response.redirect(new URL(`/c/${params.token}`, req.url), 303)
}
```

```tsx
// page.tsx — landing page
export default async function ConfirmLanding({ params }: { params: { token: string } }) {
  const delivery = await getDeliveryByToken(params.token)
  if (!delivery) return <div>Link expired or invalid.</div>

  const callSheet = await getCallSheetByDelivery(delivery.id)
  const recipient = await getRecipientByDelivery(delivery.id)

  // Mark opened on first land
  if (!delivery.openedAt) {
    await markDeliveryOpenedByToken(params.token)
  }

  const isConfirmed = !!delivery.confirmedAt
  const isDeclined = !!delivery.declinedAt

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04040a] text-white p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-medium mb-2">{callSheet.title ?? 'Call Sheet'}</h1>
        <p className="text-white/60 mb-1">{formatShootDate(callSheet.shootDay.date)}</p>
        <p className="text-white/40 text-sm uppercase tracking-wide mb-2">Your Call Time</p>
        <p className="text-5xl font-light mb-8">{recipient.callTime ?? '—'}</p>

        {!isConfirmed && !isDeclined && (
          <form method="POST" action={`/c/${params.token}/confirm`} className="flex gap-3 justify-center">
            <button name="action" value="confirm" className="bg-emerald-500 text-white rounded-xl px-6 py-3 font-medium">Confirm</button>
            <button name="action" value="decline" className="bg-white/10 text-white rounded-xl px-6 py-3 font-medium">Decline</button>
          </form>
        )}
        {isConfirmed && <p className="text-emerald-400">✓ Confirmed</p>}
        {isDeclined && <p className="text-red-400">Declined</p>}

        <a href={`/c/${params.token}/view`} className="block mt-6 text-white/60 underline">See full call sheet</a>
      </div>
    </div>
  )
}
```

- [ ] Step 1: Implement + commit.

---

## Task 6 — Hooks: deliveries + resend

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

```ts
export function useCallSheetDeliveries(callSheetId: string | null) {
  return useQuery({
    queryKey: ['callSheetDeliveries', callSheetId],
    queryFn: () => fetchCallSheetDeliveriesByCallSheet(callSheetId!),
    enabled: !!callSheetId,
    refetchInterval: 10_000,
  })
}

export function useResendToRecipients(callSheetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { recipientIds: string[]; channels: ('email' | 'sms')[] }) => {
      const res = await fetch(`/api/call-sheets/${callSheetId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Resend failed')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['callSheetDeliveries', callSheetId] }),
  })
}
```

- [ ] Step 1: Implement + commit.

---

## Task 7 — Wire into tabs page

Modify the tabs page to render `<TrackingTab />` in the third tab. Pass `callSheetId`. Multi-select bridge to `useResendToRecipients`.

- [ ] Step 1: Implement + commit.

---

## Task 8 — Hub preview block (producer-gated)

**Files:**
- Create: `apps/back-to-one/src/components/hub/CallSheetPreview.tsx`

Producer-only card showing the next pending call sheet:

```
┌──────────────────────────────────┐
│ Next Call Sheet                  │
│ Tue Apr 22 · Day 1               │
│ ─────                            │
│ 12 / 16 confirmed                │
│ 2 outdated · 0 declined          │
└──────────────────────────────────┘
```

Tap → routes to `/projects/[id]/call-sheets/[id]?tab=tracking`.

Wire into `apps/back-to-one/src/components/hub/HubContent.tsx` between existing producer-only blocks (CrewPreview, BudgetPreview).

- [ ] Step 1: Implement + commit.

---

## Task 9 — Build + test verify

- [ ] `pnpm -w build` green.
- [ ] `pnpm test` green.
- [ ] Manual smoke:
  - With `RESEND_API_KEY` unset, click Send. Check logs: `[email:stub]` lines emitted. Tracking tab shows recipients with `Sent` badge.
  - Click `/c/[token]/view` URL from logs → web view renders. Refresh tracking tab → status flips to `Opened`.
  - Click `/c/[token]` URL → confirm landing renders Confirm/Decline. Tap Confirm → status flips to `Confirmed`.
  - Edit a call time on Compose tab → tracking tab flips that recipient to `Outdated` and clears confirmation.

---

## Self-review

- ✅ Spec coverage: delta detection, tracking pixel, confirm/decline landing, recipient table, hub preview.
- ⚠️ View count: v1 just shows 0/1 (`openedAt` set or not). Multi-view counter is a follow-up that swaps `openedAt` for `views Int` increment.
- ⚠️ Webhooks for Resend/Twilio (delivered/bounced) deferred to a follow-up; Arc D works against `sent` + `opened` + manual confirm/decline only.
