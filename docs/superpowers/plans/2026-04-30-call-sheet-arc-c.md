# Call Sheet — Send (Arc C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build the recipient list, send + scheduled-send pipeline (Resend / Twilio / stub), and Recipients tab.

**Architecture:** Two new models (`CallSheetRecipient`, `CallSheetDelivery`) — Arc D fields included up front so the migration is one shot. Provider adapters env-gated; missing env → `provider='stub'` console-log path. Vercel Cron polls every minute.

**Tech Stack:** Next.js 14, Prisma, Resend SDK, Twilio SDK, react-email, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md`

---

## File Structure

**Created:**
- `packages/db/prisma/migrations/20260430030000_add_call_sheet_distribution/migration.sql`
- `apps/back-to-one/src/lib/call-sheet/seed-recipients.ts` + test
- `apps/back-to-one/src/lib/call-sheet/personalize.ts` + test — builds per-recipient data (call time, snapshot)
- `apps/back-to-one/src/lib/email/send-email.ts` — Resend adapter (stub fallback)
- `apps/back-to-one/src/lib/email/CallSheetEmail.tsx` — react-email template
- `apps/back-to-one/src/lib/sms/send-sms.ts` — Twilio adapter (stub fallback)
- `apps/back-to-one/src/lib/call-sheet/dispatch-deliveries.ts` — cron-shared dispatch logic
- `apps/back-to-one/src/components/call-sheets/RecipientsTab.tsx`
- `apps/back-to-one/src/components/call-sheets/SendDialog.tsx`
- `apps/back-to-one/src/app/api/cron/dispatch-call-sheets/route.ts`
- `apps/back-to-one/src/app/api/call-sheets/[id]/send/route.ts`

**Modified:**
- `packages/db/prisma/schema.prisma`
- `apps/back-to-one/src/types/index.ts`
- `apps/back-to-one/src/lib/db/queries.ts`
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts`
- `apps/back-to-one/src/app/projects/[projectId]/call-sheets/[callSheetId]/page.tsx` (wire RecipientsTab + SendDialog)
- `apps/back-to-one/package.json` — add `resend`, `twilio`, `react-email`, `@react-email/components`
- `vercel.json` — cron entry

---

## Task 1 — Schema migration (recipients + deliveries)

Includes Arc D fields (`openedAt`, `clickedAt`, `confirmedAt`, `declinedAt`, `outdatedAt`, `personalizedSnapshot`) so the migration is one shot.

- [ ] **Step 1:** Schema additions per spec § Architecture > Schema (Arc C section).

- [ ] **Step 2:** Migration SQL:

```sql
CREATE TYPE "CallSheetRecipientKind" AS ENUM ('talent', 'crew', 'client', 'freeform');
CREATE TYPE "CallSheetDeliveryChannel" AS ENUM ('email', 'sms');
CREATE TYPE "CallSheetDeliveryProvider" AS ENUM ('resend', 'twilio', 'stub');
CREATE TYPE "CallSheetDeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'opened', 'bounced', 'failed');

CREATE TABLE "CallSheetRecipient" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "callSheetId"      UUID NOT NULL,
  "kind"             "CallSheetRecipientKind" NOT NULL,
  "talentId"         TEXT,
  "projectMemberId"  TEXT,
  "freeformName"     TEXT,
  "freeformEmail"    TEXT,
  "freeformPhone"    TEXT,
  "freeformRole"     TEXT,
  "callTimeOverride" TEXT,
  "sendEmail"        BOOLEAN NOT NULL DEFAULT true,
  "sendSms"          BOOLEAN NOT NULL DEFAULT false,
  "excluded"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheetRecipient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_callSheetId_fkey"
  FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE CASCADE;

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_talentId_fkey"
  FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE SET NULL;

ALTER TABLE "CallSheetRecipient"
  ADD CONSTRAINT "CallSheetRecipient_projectMemberId_fkey"
  FOREIGN KEY ("projectMemberId") REFERENCES "ProjectMember"("id") ON DELETE SET NULL;

CREATE INDEX "CallSheetRecipient_callSheetId_idx" ON "CallSheetRecipient"("callSheetId");
CREATE INDEX "CallSheetRecipient_callSheetId_excluded_idx" ON "CallSheetRecipient"("callSheetId", "excluded");

CREATE TABLE "CallSheetDelivery" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipientId"        UUID NOT NULL,
  "channel"            "CallSheetDeliveryChannel" NOT NULL,
  "provider"           "CallSheetDeliveryProvider" NOT NULL,
  "status"             "CallSheetDeliveryStatus" NOT NULL DEFAULT 'queued',
  "scheduledFor"       TIMESTAMP(3),
  "sentAt"             TIMESTAMP(3),
  "deliveredAt"        TIMESTAMP(3),
  "bouncedAt"          TIMESTAMP(3),
  "failedReason"       TEXT,
  "externalId"         TEXT,
  "confirmToken"       UUID NOT NULL DEFAULT gen_random_uuid(),
  "openedAt"           TIMESTAMP(3),
  "clickedAt"          TIMESTAMP(3),
  "confirmedAt"        TIMESTAMP(3),
  "declinedAt"         TIMESTAMP(3),
  "outdatedAt"         TIMESTAMP(3),
  "personalizedSnapshot" JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheetDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallSheetDelivery_confirmToken_key" ON "CallSheetDelivery"("confirmToken");

ALTER TABLE "CallSheetDelivery"
  ADD CONSTRAINT "CallSheetDelivery_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "CallSheetRecipient"("id") ON DELETE CASCADE;

CREATE INDEX "CallSheetDelivery_recipientId_idx" ON "CallSheetDelivery"("recipientId");
CREATE INDEX "CallSheetDelivery_scheduledFor_sentAt_idx" ON "CallSheetDelivery"("scheduledFor", "sentAt");
CREATE INDEX "CallSheetDelivery_confirmToken_idx" ON "CallSheetDelivery"("confirmToken");
```

- [ ] **Step 3:** `pnpm --filter @origin-one/db db:generate`.

- [ ] **Step 4:** Commit: `feat(call-sheets): recipient + delivery schema`.

---

## Task 2 — Recipient seeding helper

**Files:**
- Create: `apps/back-to-one/src/lib/call-sheet/seed-recipients.ts` + test

Pure function that builds the default recipient list from project members + talent + clients minus post-only departments.

```ts
import { isPostOnlyDepartment } from '@/lib/auth/call-sheet-permissions'

export function buildDefaultRecipients(input: {
  callSheetId: string
  talent: { id: string; email: string | null; phone: string | null }[]
  members: { id: string; department: string | null; email: string | null; phone: string | null }[]
  clientMemberIds?: string[]
}) {
  const talentRecipients = input.talent.map(t => ({
    callSheetId: input.callSheetId,
    kind: 'talent' as const,
    talentId: t.id,
    sendEmail: !!t.email,
    sendSms: !!t.phone,
    excluded: false,
  }))
  const crewRecipients = input.members
    .filter(m => !isPostOnlyDepartment(m.department))
    .map(m => ({
      callSheetId: input.callSheetId,
      kind: input.clientMemberIds?.includes(m.id) ? 'client' as const : 'crew' as const,
      projectMemberId: m.id,
      sendEmail: !!m.email,
      sendSms: !!m.phone,
      excluded: false,
    }))
  return [...talentRecipients, ...crewRecipients]
}
```

- [ ] Step 1: TDD — test post-only exclusion, talent inclusion, sendSms gated on phone presence.

- [ ] Step 2: Implement + commit: `feat(call-sheets): buildDefaultRecipients helper`.

---

## Task 3 — Personalize helper

**Files:**
- Create: `apps/back-to-one/src/lib/call-sheet/personalize.ts` + test

For each recipient, computes:
- `callTime`: from override or `deriveCallTimes` (talent) / `crewCallTime` (crew/client)
- `snapshot`: `{ callTime, locationAddress, shootDate, scheduleBlockIds, lunchTime }` — JSON used for delta detection

- [ ] Step 1: TDD — call time derivation precedence (override > derived > general crew call); snapshot includes only schedule blocks where the recipient appears.

- [ ] Step 2: Implement + commit.

---

## Task 4 — Resend + Twilio adapters (env-gated, stub fallback)

**Files:**
- Create: `apps/back-to-one/src/lib/email/send-email.ts`
- Create: `apps/back-to-one/src/lib/sms/send-sms.ts`

```ts
// send-email.ts
import { Resend } from 'resend'
import { render } from '@react-email/render'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM_EMAIL || 'no-reply@back-to-one.app'

export async function sendEmail(args: {
  to: string
  replyTo?: string
  subject: string
  reactBody: React.ReactElement
  attachments?: { filename: string; content: Buffer | string }[]
}) {
  const html = await render(args.reactBody)
  const text = await render(args.reactBody, { plainText: true })
  if (!RESEND_API_KEY) {
    console.log('[email:stub]', { to: args.to, subject: args.subject, replyTo: args.replyTo, htmlPreview: html.slice(0, 200) })
    return { provider: 'stub' as const, externalId: null, ok: true }
  }
  const resend = new Resend(RESEND_API_KEY)
  const result = await resend.emails.send({
    from: FROM,
    to: args.to,
    replyTo: args.replyTo,
    subject: args.subject,
    html,
    text,
    attachments: args.attachments,
  })
  if (result.error) {
    return { provider: 'resend' as const, externalId: null, ok: false, error: result.error.message }
  }
  return { provider: 'resend' as const, externalId: result.data?.id ?? null, ok: true }
}
```

```ts
// send-sms.ts
import twilio from 'twilio'

const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const FROM = process.env.TWILIO_FROM_NUMBER

export async function sendSms(args: { to: string; body: string }) {
  if (!SID || !TOKEN || !FROM) {
    console.log('[sms:stub]', { to: args.to, body: args.body.slice(0, 200) })
    return { provider: 'stub' as const, externalId: null, ok: true }
  }
  const client = twilio(SID, TOKEN)
  try {
    const msg = await client.messages.create({ from: FROM, to: args.to, body: args.body })
    return { provider: 'twilio' as const, externalId: msg.sid, ok: true }
  } catch (err: any) {
    return { provider: 'twilio' as const, externalId: null, ok: false, error: err.message }
  }
}
```

- [ ] Step 1: `pnpm add --filter @origin-one/back-to-one resend twilio @react-email/render @react-email/components`.

- [ ] Step 2: Implement + commit.

---

## Task 5 — Email template

**Files:**
- Create: `apps/back-to-one/src/lib/email/CallSheetEmail.tsx`

react-email component matching the Origin Point reference: header, big call time, confirm/decline buttons, production notes, location, parking, embedded tracking pixel (`<img src="{appUrl}/c/{token}/pixel.gif" width="1" height="1">`), CTA link to web view.

- [ ] Step 1: Implement using `@react-email/components` (`Html`, `Body`, `Container`, `Section`, `Text`, `Img`, `Button`).

- [ ] Step 2: Commit.

---

## Task 6 — Dispatch logic + cron route + send route

**Files:**
- Create: `apps/back-to-one/src/lib/call-sheet/dispatch-deliveries.ts`
- Create: `apps/back-to-one/src/app/api/cron/dispatch-call-sheets/route.ts`
- Create: `apps/back-to-one/src/app/api/call-sheets/[id]/send/route.ts`
- Create: `vercel.json` (or modify if exists)

```ts
// dispatch-deliveries.ts
export async function dispatchPendingDeliveries(now = new Date()): Promise<{ sent: number }> {
  // 1. SELECT deliveries WHERE (scheduledFor <= now OR scheduledFor IS NULL) AND sentAt IS NULL AND status = 'queued'
  // 2. For each: load recipient, call sheet, project, snapshot; build content; call send-email or send-sms
  // 3. UPDATE delivery: sentAt, externalId, status='sent', provider
  // Return count.
}
```

```ts
// /api/cron/dispatch-call-sheets/route.ts
export const runtime = 'nodejs'
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 })
  }
  const result = await dispatchPendingDeliveries()
  return Response.json({ ok: true, ...result })
}
```

```ts
// /api/call-sheets/[id]/send/route.ts
// POST { scheduledFor?: string, recipientIds?: string[], channels?: ('email'|'sms')[] }
// Creates CallSheetDelivery rows. If scheduledFor null, immediately calls dispatchPendingDeliveries.
```

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/dispatch-call-sheets", "schedule": "* * * * *" }
  ]
}
```

- [ ] Step 1: Implement.

- [ ] Step 2: Commit: `feat(call-sheets): dispatch + cron + send routes`.

---

## Task 7 — Recipients tab + Send dialog

**Files:**
- Create: `apps/back-to-one/src/components/call-sheets/RecipientsTab.tsx`
- Create: `apps/back-to-one/src/components/call-sheets/SendDialog.tsx`
- Modify: `apps/back-to-one/src/app/projects/[projectId]/call-sheets/[callSheetId]/page.tsx`

**Recipients tab:**
- Lists `CallSheetRecipient` rows with: avatar/name+role, channels (email/sms toggles), call time (override input), exclude toggle.
- "Reseed from project" button → calls `/api/call-sheets/[id]/reseed`.
- "+ Add Recipient" → freeform / pick talent / pick crew.

**Send dialog:**
- Triggered by Compose tab "Send" button (gated on `canEditCallSheet`).
- Picks: channels (email + SMS toggles applied globally), schedule (Now vs datetime picker).
- Confirm → POST `/api/call-sheets/[id]/send`.

- [ ] Step 1: Implement + wire into tabs page.

- [ ] Step 2: Commit: `feat(call-sheets): RecipientsTab + SendDialog`.

---

## Task 8 — Hooks

Add to `useOriginOne.ts`: `useCallSheetRecipients`, `useUpdateCallSheetRecipient`, `useAddCallSheetRecipient`, `useRemoveCallSheetRecipient`, `useReseedCallSheetRecipients`, `useScheduleCallSheetSend`, `useCancelScheduledSend`.

- [ ] Step 1: Implement.

- [ ] Step 2: Build green + commit.

---

## Task 9 — Auto-create recipients on CallSheet create

Modify `useCreateCallSheet` (or the underlying query function) to call `buildDefaultRecipients` and bulk-insert recipient rows on creation.

- [ ] Step 1: Implement.

- [ ] Step 2: Commit.

---

## Task 10 — Build + test verify

- [ ] `pnpm -w build` green.
- [ ] `pnpm test` green.

---

## Self-review

- ✅ Spec coverage: schema, seed, dispatch, recipients/send UI.
- ⚠️ Cron security: only Vercel cron requests carry the bearer token in production. Local dev: invoke via `curl` with `CRON_SECRET` set.
- ⚠️ Idempotency: `dispatchPendingDeliveries` should set `status='sent'` BEFORE calling provider to avoid double-sends if cron overlaps. Implementation uses `UPDATE ... WHERE status='queued' RETURNING` to claim rows atomically.
