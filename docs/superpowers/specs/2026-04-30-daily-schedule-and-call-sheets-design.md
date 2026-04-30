# Daily Schedule + Call Sheets — Design

**Status:** Design
**Date:** 2026-04-30
**App:** `apps/back-to-one`
**Touches packages:** `@origin-one/db` (schema + migrations), `apps/back-to-one` (UI + queries + hooks + cron + email/SMS adapters)

---

## Summary

Adds two cooperating feature areas to back-to-one:

1. **Daily Schedule** — a per-shoot-day strip board (the "GB01 grid"). Multi-track time blocks (Main / Secondary / Tertiary) describe what's being shot, prepped, and lit at every minute of the day.
2. **Call Sheets** — compose, send, schedule, and track call sheets. Tied 1:1 to a `ShootDay`. Optionally embeds the daily schedule. Per-recipient call times (auto-derived from the schedule). Email + SMS distribution with scheduled blasts. Open / confirm / decline tracking with smart delta detection ("who's outdated") and one-click targeted resend.

Designed as **four merge-able PR arcs** that ship in order:

| Arc | Scope | Schema | UI | External |
|---|---|---|---|---|
| **A — Daily Schedule** | strip board editor | `ScheduleBlock`, enums | new shoot-day detail route | none |
| **B — Call Sheet** | compose + render + PDF | `CallSheet`, attachments bucket | `/call-sheets/[id]` Compose tab | Puppeteer |
| **C — Send** | recipients, immediate + scheduled blast | `CallSheetRecipient`, `CallSheetDelivery` | Recipients tab + Send dialog | Resend, Twilio, Vercel Cron |
| **D — Tracking** | opens, confirms, delta detection | extends `CallSheetDelivery` | Tracking tab + public `/c/[token]` landing | tracking pixel |

Each arc lands as its own PR with main green at every stop.

---

## Motivation

Hivemind / Origin Point's current call-sheet workflow runs on StudioBinder. StudioBinder gets the basics right (compose, blast, confirm-tracking) but cannot **schedule a blast in advance**. ADs want to draft the call sheet during the workday and have it auto-send at 9pm — that's the gap.

Beyond closing the StudioBinder gap, owning this feature means:

- **The daily schedule lives next to the script, shotlist, and shoot days** — no copy-pasting from a spreadsheet.
- **Per-recipient call times are derived from the schedule** — change Kathleen's first block from 8:30 to 9:00, the call sheet auto-recalculates her call. Edit-after-publish flags her as "Outdated" so the AD remembers to resend.
- **Confirmation / decline in one place** — no parallel-tracking what came back through email replies vs StudioBinder.

This is a foundational pre-pro feature that must be in place before Tyler and Kelly's first dogfood production.

---

## Scope

### In scope (this design)

**Arc A — Daily Schedule**
- New `ScheduleBlock` model with 1–3 parallel tracks per shoot day.
- Block kinds: `work`, `lunch`, `wrap`, `tail_lights`, `load_in`, `talent_call` (rendered full-width when not `work`).
- FK references: `Talent[]`, `Location` (optional), `ProjectMember[]` (optional crew callouts), `Scene[]` (optional scene tags).
- Editor route: `/projects/[id]/timeline/[shootDayId]` (deep route on existing Timeline page).
- Phone view: card-stack per time block; desktop view: GB01-style grid.
- Add Block via `useFabAction`; delete + reorder; per-track add.

**Arc B — Call Sheet**
- New `CallSheet` model, 1:1 with `ShootDay` (unique constraint).
- Compose form: header (title/subtitle), times (general / crew / shooting / lunch / wrap), weather (high/low/condition), sunrise/sunset, hospital, parking notes, production notes, attachments, includeSchedule toggle.
- Server-side PDF render via headless Chromium (Puppeteer-core + @sparticuz/chromium for Vercel).
- Live web view at `/c/[token]/view` (public, token-gated).
- Auto-fields from existing data: producer/director/1st-AD pulled from `ProjectMember` department flags; locations from project's primary `Location`.
- New storage bucket `call-sheet-attachments` (parking maps, lookbooks).
- Edit-after-publish supported (always editable).

**Arc C — Send**
- New `CallSheetRecipient` and `CallSheetDelivery` models.
- Default recipient pool: every `Talent` + every `ProjectMember` whose department is **not** in `POST_DEPARTMENTS` (Editorial / Color / Sound Post / VFX / Motion Graphics).
- AD can add (any Talent / ProjectMember / free-form) and remove (sets `excluded=true`) any recipient.
- Per-recipient call time: auto-derived from each Talent's earliest schedule block (`startTime - 15 min`); manual override at recipient level.
- Send pipeline: Resend (email) + Twilio (SMS). Both gated behind env vars (`RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). When unset, payloads log to console and the delivery row records `provider='stub'` so the tracking surface still populates.
- Sender identity: `no-reply@<product domain>` with `Reply-To` from `CallSheet.replyToEmail`. Custom-domain-per-project is a follow-up phase.
- SMS body: project name, day, date, recipient's call time, set address, link to web view.
- Scheduled send: each `CallSheetDelivery` carries optional `scheduledFor` (datetime). Vercel Cron polls `/api/cron/dispatch-call-sheets` every minute and sends rows where `scheduledFor <= now() AND sentAt IS NULL`.
- Send dialog: pick channels (email + SMS toggles per recipient), pick "Now" or "Schedule for…" (datetime picker), confirm.

**Arc D — Tracking**
- The Arc-D fields (`openedAt`, `clickedAt`, `confirmedAt`, `declinedAt`, `outdatedAt`, `personalizedSnapshot` JSON) are present in the Arc C migration so the table is built once. Arc D wires the read/write paths.
- `personalizedSnapshot` captures the data the recipient saw at last send: their call time, set location address, shoot date, schedule blocks they appear in, lunch time. Used for delta detection.
- Smart delta detection runs on every CallSheet save: re-derive each recipient's would-be snapshot, diff against `personalizedSnapshot` field-by-field, set `outdatedAt = now()` where they differ. Confirmed recipients whose key data changed have `confirmedAt` cleared back to null (they need to re-confirm). Cosmetic edits (production-notes prose, parking-notes prose, attachments) do not invalidate.
- Tracking tab: full-width recipient table matching the StudioBinder reference (avatar / name+role / call time / status badge / view count / email / phone / checkbox). Status badges: `Draft` → `Scheduled` → `Sent` → `Delivered` → `Opened` → `Confirmed` / `Declined` / `Outdated`. Filter chips: All / Confirmed / Outdated / Not yet sent / Declined / Bounced.
- Multi-select → "Resend selected" action sends a fresh delivery for each picked recipient.
- Public confirm landing: `/c/[token]` shows recipient name, call time, set address, Confirm + Decline buttons. Token is the `CallSheetDelivery.confirmToken` UUID.
- 1×1 transparent tracking pixel served at `/c/[token]/pixel.gif`. Email template embeds it. First load → `openedAt`.
- Click tracking: confirm/decline links go through `/c/[token]/confirm?action=confirm` (sets `clickedAt + confirmedAt`).

### Cross-cutting

- **Hub preview block** (producer-gated): "Next call sheet" card showing shoot day date + confirmation count (e.g. "12 / 16 confirmed for Tue Apr 22"). Tap → `/projects/[id]/call-sheets/[id]` Tracking tab.
- **Permissions:** edit + send restricted to `Owner | Producer | crew with department === 'Production'` (1st AD, PA, Production Coordinator). Read-only for everyone else on the project. Public `/c/[token]` requires no auth, only the token.

### Out of scope (for these four arcs)

- Custom send-domain DKIM verification per project. (Stubbed in schema as `Project.customSenderDomain` but UI deferred.)
- iCal / Google Calendar sync. Possible follow-up.
- Stripboard generation from script. The schedule is hand-authored; auto-stripboarding from the shotlist is not in this design.
- "Request change" recipient action (only Confirm / Decline ship; recipients reply via Reply-To for changes).
- Per-day weather auto-fetch from a forecast API. Manual entry only in Arc B; auto-fetch is a follow-up.
- Sunrise / sunset auto-compute from location lat/long. Manual entry in Arc B; auto-compute is a follow-up.
- iMessage / WhatsApp / Slack. SMS via Twilio only.
- Web Push notifications when someone confirms. Producer can pull-to-refresh the Tracking tab; in-app notification follow-up.
- Versioned / immutable publishes (decision Q3-C: in-place edit + smart delta detection).
- Bulk multi-day scheduling. Each `CallSheet` is for a single `ShootDay`. To send a multi-day blast, the AD sends each day's call sheet individually.

---

## Architecture

### Schema (`packages/db/prisma/schema.prisma`)

```prisma
// ─── Arc A — Daily Schedule ─────────────────────────────────────────

enum ScheduleBlockTrack {
  main
  secondary
  tertiary
}

enum ScheduleBlockKind {
  work          // default — renders inside its track column
  load_in       // full-width row
  talent_call   // full-width row
  lunch         // full-width row
  wrap          // full-width row
  tail_lights   // full-width row
  meal_break    // full-width row
  custom        // full-width row with custom label
}

model ScheduleBlock {
  id           String              @id @default(dbgenerated("gen_random_uuid()"))
  projectId    String
  shootDayId   String
  track        ScheduleBlockTrack  @default(main)
  kind         ScheduleBlockKind   @default(work)

  startTime    String              // 'HH:MM' 24h, scoped to ShootDay.date
  endTime      String?             // 'HH:MM' 24h; nullable for instant rows (e.g. talent_call)
  description  String              @db.Text
  customLabel  String?             // for kind=custom

  locationId   String?
  talentIds    String[]            @default([])
  crewMemberIds String[]           @default([])  // ProjectMember IDs
  sceneIds     String[]            @default([])

  sortOrder    Int                 @default(0)   // tie-breaker within (shootDayId, startTime, track)

  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  project      Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shootDay     ShootDay            @relation(fields: [shootDayId], references: [id], onDelete: Cascade)
  location     Location?           @relation(fields: [locationId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([shootDayId, startTime])
  @@index([shootDayId, track, sortOrder])
}
```

```prisma
// ─── Arc B — Call Sheet ─────────────────────────────────────────────

enum CallSheetStatus {
  draft
  sent
}

model CallSheet {
  id              String           @id @default(dbgenerated("gen_random_uuid()"))
  projectId       String
  shootDayId      String           @unique     // 1:1 with ShootDay
  status          CallSheetStatus  @default(draft)
  publishedAt     DateTime?

  // Header
  title           String?          // "Gibbon Slackboard — One Step"
  subtitle        String?          // "DAY 1 OF 2"
  episodeOrEvent  String?

  // Times (free-text 'h:mm am/pm' to match the GB01 sheet style)
  generalCallTime  String?
  crewCallTime     String?
  shootingCallTime String?
  lunchTime        String?
  estWrapTime      String?

  // Weather (manual; auto-fetch is a follow-up)
  weatherTempHigh  Int?
  weatherTempLow   Int?
  weatherCondition String?         // 'Sunny', 'Cloudy', etc.
  sunriseTime      String?
  sunsetTime       String?

  // Hospital
  nearestHospitalName    String?
  nearestHospitalAddress String?
  nearestHospitalPhone   String?

  // Notes
  productionNotes  String?         @db.Text
  parkingNotes     String?         @db.Text

  // Schedule embed
  includeSchedule  Boolean         @default(true)

  // Sender / reply identity
  replyToEmail     String?         // production@... — defaults to project owner's email if null
  customFromName   String?         // future: bring-your-own-domain
  customFromEmail  String?

  // Attachments — Storage object paths (call-sheet-attachments bucket)
  attachmentPaths  String[]        @default([])

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  project          Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shootDay         ShootDay        @relation(fields: [shootDayId], references: [id], onDelete: Cascade)
  recipients       CallSheetRecipient[]

  @@index([projectId])
  @@index([projectId, status])
}
```

```prisma
// ─── Arc C — Send ───────────────────────────────────────────────────

enum CallSheetRecipientKind {
  talent
  crew
  client
  freeform
}

model CallSheetRecipient {
  id               String                   @id @default(dbgenerated("gen_random_uuid()"))
  callSheetId      String
  kind             CallSheetRecipientKind

  talentId         String?                  // exactly one of talentId / projectMemberId / freeform fields populated
  projectMemberId  String?

  // For freeform recipients (vendor, walk-on, etc.)
  freeformName     String?
  freeformEmail    String?
  freeformPhone    String?
  freeformRole     String?

  callTimeOverride String?                  // 'h:mm am/pm'; null → derive from schedule

  // Channel preferences
  sendEmail        Boolean                  @default(true)
  sendSms          Boolean                  @default(false)

  excluded         Boolean                  @default(false)  // soft-remove

  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  callSheet        CallSheet                @relation(fields: [callSheetId], references: [id], onDelete: Cascade)
  talent           Talent?                  @relation(fields: [talentId], references: [id], onDelete: SetNull)
  projectMember    ProjectMember?           @relation("CallSheetRecipientCrew", fields: [projectMemberId], references: [id], onDelete: SetNull)
  deliveries       CallSheetDelivery[]

  @@index([callSheetId])
  @@index([callSheetId, excluded])
}

enum CallSheetDeliveryChannel {
  email
  sms
}

enum CallSheetDeliveryProvider {
  resend
  twilio
  stub          // env-var-less local fallback (logs to console)
}

enum CallSheetDeliveryStatus {
  queued        // scheduled, not yet sent
  sent          // handed to provider
  delivered     // provider acknowledged
  opened        // recipient opened email (Arc D)
  bounced       // provider rejected
  failed        // provider errored
}

model CallSheetDelivery {
  id              String                   @id @default(dbgenerated("gen_random_uuid()"))
  recipientId     String
  channel         CallSheetDeliveryChannel
  provider        CallSheetDeliveryProvider
  status          CallSheetDeliveryStatus  @default(queued)

  scheduledFor    DateTime?                // null → send immediately
  sentAt          DateTime?
  deliveredAt     DateTime?
  bouncedAt       DateTime?
  failedReason    String?

  // Provider IDs
  externalId      String?                  // Resend message id / Twilio sid

  // Confirmation token (also used for tracking pixel + web view)
  confirmToken    String                   @unique @default(dbgenerated("gen_random_uuid()"))

  // Arc D fields — included up front so the migration is one shot
  openedAt        DateTime?
  clickedAt       DateTime?
  confirmedAt     DateTime?
  declinedAt      DateTime?
  outdatedAt      DateTime?

  // Snapshot of personalized data at send time (delta detection input)
  personalizedSnapshot Json?

  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  recipient       CallSheetRecipient       @relation(fields: [recipientId], references: [id], onDelete: Cascade)

  @@index([recipientId])
  @@index([scheduledFor, sentAt])          // cron polling index
  @@index([confirmToken])
}
```

```prisma
// ─── Arc B — storage bucket ────────────────────────────────────────
// Created via Prisma migration (matches storage discipline).
// Permissive (anon) RLS pre-Auth; tightens on Auth Day in the #24 RLS pass.
// Bucket: call-sheet-attachments (5MB limit, MIME allowlist: pdf, png, jpg, webp)
```

### Add `callSheetRecipients` relation back to `ProjectMember`

```prisma
model ProjectMember {
  // ... existing fields ...
  callSheetRecipients CallSheetRecipient[]  @relation("CallSheetRecipientCrew")
  // Note: ScheduleBlock.crewMemberIds is a String[] (no FK constraint) —
  // matches the existing ShootDay.mentions pattern for soft references.
}
```

### Add `callSheet` relation to `ShootDay`

```prisma
model ShootDay {
  // ... existing fields ...
  callSheet      CallSheet?
  scheduleBlocks ScheduleBlock[]
}
```

### Migrations

| File | Bundles |
|---|---|
| `20260430_010000_add_schedule_block.sql` | `ScheduleBlock` table + enums + indexes |
| `20260430_020000_add_call_sheet.sql` | `CallSheet` table + enum + storage bucket `call-sheet-attachments` (with bucket-level RLS permissive) |
| `20260430_030000_add_call_sheet_distribution.sql` | `CallSheetRecipient` + `CallSheetDelivery` + enums |

Migrations are hand-authored SQL (consistent with the existing pattern — see `origin_one_db_migration_patterns.md`).

### Routes

| Route | Purpose | Auth |
|---|---|---|
| `/projects/[id]/timeline/[shootDayId]` | Schedule editor (Arc A) | project member |
| `/projects/[id]/call-sheets` | List of call sheets in this project | project member |
| `/projects/[id]/call-sheets/[callSheetId]` | Compose / Recipients / Tracking tabs | edit gated to Owner/Producer/Production crew |
| `/api/cron/dispatch-call-sheets` | Vercel Cron worker (1 / minute) | cron secret |
| `/api/call-sheets/[id]/render-pdf` | Render PDF via Puppeteer | edit-permission users |
| `/api/call-sheet-deliveries/[id]/track-open` | Tracking pixel | none |
| `/c/[token]` | Public confirm/decline landing | none (token-gated) |
| `/c/[token]/view` | Public web-view of the call sheet | none (token-gated) |
| `/c/[token]/pixel.gif` | 1×1 tracking pixel | none |
| `/c/[token]/confirm?action=confirm\|decline` | Confirm/decline action | none |

### Permissions resolution

Add a helper to `apps/back-to-one/src/lib/auth/`:

```ts
export const PRODUCTION_DEPARTMENTS = ['Production'] as const
export const POST_DEPARTMENTS = ['Editorial', 'Color', 'Sound Post', 'VFX', 'Motion Graphics'] as const

export function canEditCallSheet(viewer: ViewerRole, member: { department?: string | null } | null): boolean {
  if (viewer === 'owner' || viewer === 'producer') return true
  const dept = member?.department?.trim()
  if (dept && PRODUCTION_DEPARTMENTS.some(d => d.toLowerCase() === dept.toLowerCase())) return true
  return false
}

export function isPostOnlyDepartment(department: string | null | undefined): boolean {
  if (!department) return false
  return POST_DEPARTMENTS.some(d => d.toLowerCase() === department.trim().toLowerCase())
}
```

Usage: in the Compose / Recipients / Tracking pages, gate the edit + send buttons. The `useViewerRole(projectId)` hook is the producer gate (post-Auth shipped) — extend with a `useViewerCanEditCallSheet(projectId)` companion that resolves the viewer's `ProjectMember.department`. The constants live in this file so the upcoming Department-enum-conversion arc can swap to enum membership in one place.

### React Query hook surface (`useOriginOne.ts`)

New hooks (matching the existing `invalidateQueries` pattern, no optimistic updates):

```ts
useScheduleBlocks(shootDayId)             // GET
useCreateScheduleBlock(projectId)         // POST
useUpdateScheduleBlock(projectId)         // PATCH
useDeleteScheduleBlock(projectId)         // DELETE
useReorderScheduleBlocks(projectId)       // bulk PATCH

useCallSheets(projectId)                  // list
useCallSheet(callSheetId)                 // single
useCreateCallSheet(projectId)             // creates the row tied to a ShootDay
useUpdateCallSheet(projectId)             // any field
useDeleteCallSheet(projectId)
useUploadCallSheetAttachment(callSheetId)
useDeleteCallSheetAttachment(callSheetId)

useCallSheetRecipients(callSheetId)
useUpdateCallSheetRecipient(callSheetId)  // per-row toggle / override
useAddCallSheetRecipient(callSheetId)     // freeform or talent/crew add
useRemoveCallSheetRecipient(callSheetId)  // soft (sets excluded=true)
useReseedCallSheetRecipients(callSheetId) // refresh from project members + schedule

useScheduleCallSheetSend(callSheetId)     // POST {scheduledFor?}
useCancelScheduledSend(callSheetId)
useResendToRecipients(callSheetId)        // POST {recipientIds, channels}

useCallSheetDeliveries(callSheetId)       // for the Tracking tab; polls every 10s
```

### Send pipeline architecture

```
[AD clicks Send / Schedule]
  ↓
schedule_call_sheet_send(callSheetId, scheduledFor?)
  ↓
For each non-excluded recipient:
  1. compute personalized snapshot {callTime, locationAddress, shootDate, scheduleBlocksTheyAppearIn, lunchTime}
  2. INSERT CallSheetDelivery rows (one per active channel — email, sms)
     — provider: resend|twilio|stub (based on env)
     — scheduledFor = arg or null
     — status = queued
     — personalizedSnapshot = computed
  ↓
[Vercel Cron: GET /api/cron/dispatch-call-sheets every minute]
  ↓
SELECT deliveries WHERE scheduledFor <= now() AND sentAt IS NULL AND status = 'queued'
  ↓
For each:
  - email path → render template (react-email) + pixel link + confirm link → resend.send() OR console.log() if stub
  - sms path → format body + link → twilio.messages.create() OR console.log() if stub
  - update sentAt, externalId, status='sent'
  ↓
[Resend webhook → /api/webhooks/resend] sets deliveredAt / bouncedAt by externalId
[Twilio webhook → /api/webhooks/twilio] sets deliveredAt / failedReason by externalId
[Tracking pixel hit → /c/[token]/pixel.gif] sets openedAt (first hit only)
[Confirm/decline link → /c/[token]/confirm] sets confirmedAt / declinedAt
```

### Email template

`apps/back-to-one/src/lib/email/CallSheetEmail.tsx` — React Email component matching the Origin Point reference (logo, project title, date, big call time, confirm button, production notes, location, parking, pixel).

### SMS template

```
{Project Title} — Day {N}
{Date}
Your call: {personalCallTime}
Location: {setAddress}
Confirm: {webViewUrl}
```

### PDF render

`apps/back-to-one/src/app/api/call-sheets/[id]/render-pdf/route.ts` — Puppeteer-core + @sparticuz/chromium (Vercel-compatible). Renders the live `/c/[token]/view` HTML page server-side and returns a PDF buffer. The Compose tab shows a "Generate PDF" button + uses the result as an attachment when sending.

### Public web-view + confirm landing

`/c/[token]/view` — server-rendered, looks up the recipient via `confirmToken`, renders a public page using the same components as the Compose preview (no auth required). Records `openedAt` if not already set.

`/c/[token]` — interactive confirm/decline page. Confirm button POSTs to `/c/[token]/confirm?action=confirm`; sets `confirmedAt = now()`. Decline equivalent. Renders confirmation state on subsequent loads.

### Cron config

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/dispatch-call-sheets", "schedule": "* * * * *" }
  ]
}
```

Cron route gates on `Authorization: Bearer <CRON_SECRET>` (Vercel sets this automatically for cron requests). Per-minute cron requires Vercel Pro+; Hobby falls back to hourly (acceptable for v1 — drop schedule to `*/5 * * * *` if needed).

### Env vars

| Name | Required for |
|---|---|
| `RESEND_API_KEY` | live email send |
| `RESEND_FROM_EMAIL` | live email send (e.g. `no-reply@back-to-one.app`) |
| `TWILIO_ACCOUNT_SID` | live SMS send |
| `TWILIO_AUTH_TOKEN` | live SMS send |
| `TWILIO_FROM_NUMBER` | live SMS send |
| `CRON_SECRET` | Vercel-managed; production-only |
| `NEXT_PUBLIC_APP_URL` | building tracking + confirm links |

Without `RESEND_API_KEY` or `TWILIO_*`, the relevant channel falls back to `provider='stub'` and writes the payload to console + the delivery row. Tracking pixel + confirm flow still work for stub deliveries (the AD can preview the entire pipeline locally without external accounts).

### Hub preview block (producer-gated)

`apps/back-to-one/src/components/hub/CallSheetPreview.tsx` — shows the next pending call sheet (closest future shoot day with status=`sent`) with confirmation count and quick-link to Tracking tab.

---

## Implementation order

Each arc lands as one PR with main green at every stop, per origin-one's "complete arc" rule.

| PR | Title | Touches |
|---|---|---|
| 1 | `feat(schedule): daily strip board` | schema PR + UI PR — scoped to Arc A |
| 2 | `feat(call-sheets): compose + render` | schema PR + UI PR — scoped to Arc B |
| 3 | `feat(call-sheets): send + recipients` | schema PR + UI PR — scoped to Arc C |
| 4 | `feat(call-sheets): tracking + delta detection` | schema PR + UI PR — scoped to Arc D |

Each commit on the working branch corresponds to a future PR boundary; splitting is a `git cherry-pick` exercise, not a rewrite.

---

## Decisions log

(For traceability — these are the user-confirmed forks during brainstorming.)

| # | Question | Decision |
|---|---|---|
| Q1 | Schedule data model | **B — Hybrid reference-aware**: Talent + Location are FKs; Description stays free text; optional Scene[] tags |
| Q2 | Single-track vs multi-track | **B — Multi-track from day one**: blocks have `track` enum (main/secondary/tertiary), special kinds render full-width |
| Q3 | Edit-after-publish behavior | **C — In-place edit + smart delta detection**: per-recipient `outdatedAt` + auto-clear `confirmedAt` when key fields change |
| Q4 | Per-recipient call time source | **A — Auto-derive from schedule** with manual override |
| Q5 | Recipient actions | **B — Confirm or Decline** (no third "request change") |
| Q6 | Default recipient pool | **Custom — everyone in project EXCEPT post-only** |
| Q7 | "Post" tagging mechanism | **B — Department-name-based exclusion** via `POST_DEPARTMENTS` constant |
| Q8 | Email "from" address | **C — Generic default with bring-your-own-domain upgrade later** |
| Q9 | SMS body | **A — Essentials inline + link to web view** |
| Q10 | Edit/send permissions | **B — Producer/Owner + crew with department === Production** |
| Q11 | Tracking surface placement | **A — Tab inside Call Sheet detail (Compose / Recipients / Tracking)** |

---

## Open questions / follow-ups (post-merge)

- **Custom send domain UI** — DKIM verify flow, per-project domain config. Schema fields stubbed; UI deferred.
- **Weather + sunrise/sunset auto-fetch** — manual entry in v1.
- **Web Push** when someone confirms — leverage existing `PushSubscription` infra.
- **Group recipients** — `@dept-camera`, `@all-grip` shortcuts. Today: AD picks individuals.
- **Multi-day blast** — sending one call sheet covers one day. Multi-day = AD repeats.
- **Stripboard from shotlist** — auto-generate schedule blocks from shotlist scenes + shoot order. Today: hand-authored.
- **iCal / Google Calendar export** — recipients can add their personal call to their calendar.
- **Reply-from-email tracking** — show reply-to inbox replies inline in the Tracking tab.

---

## Test strategy

- **Schema migrations** — apply against shadow DB equivalent (origin-one uses hand-authored SQL + `prisma migrate deploy`; verify each migration applies clean from zero).
- **Arc A** — unit test: `deriveTalentCallTimes(scheduleBlocks, talentIds)` returns earliest `startTime - 15min` per talent. Component test: editor creates / edits / deletes blocks across tracks.
- **Arc B** — unit test: PDF renders without error for a fully-populated CallSheet. E2E (manual): open Compose tab, fill, click Generate PDF, verify download.
- **Arc C** — unit test: `seedRecipients(projectId, callSheetId)` excludes post-only crew, includes all talent on the day. Integration test: `POST /api/cron/dispatch-call-sheets` with stub provider writes `sentAt` and logs payload. Manual E2E: schedule a stub send, verify cron fires and rows update.
- **Arc D** — unit test: `detectOutdatedRecipients(callSheet)` flags recipients whose key fields changed against `personalizedSnapshot`. Integration: hit `/c/[token]/pixel.gif` → `openedAt` set; hit `/c/[token]/confirm?action=confirm` → `confirmedAt` set, public page renders confirmation state. Manual E2E: edit Kathleen's call time post-send, verify her row flips to Outdated and confirmation clears.

---

## North-Star check

**Does this reduce friction?** ✓ AD writes the schedule once; call sheet auto-derives call times. Edit-after-send doesn't require remembering who needs an update — the app flags Outdated rows.

**Does this protect vision?** ✓ Schedule + call sheet live next to script + shotlist. The same talent / location / scene FKs the rest of the app uses. No copy-paste from spreadsheets, no parallel system to keep in sync.

**Does this bring the team closer to a unified workflow?** ✓ One shared confirm-tracking surface. Producer + AD see the same recipient list and same confirmation state.

**Is it proven on a real production before it ships?** Tyler + Kelly's first dogfood production is the bar.
