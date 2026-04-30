# Call Sheet — Compose & Render (Arc B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Compose call sheet content tied 1:1 to a ShootDay; render to PDF + public web view.

**Architecture:** New `CallSheet` model (1:1 unique on `shootDayId`). Three-tab page (Compose / Recipients / Tracking) — Arc B implements the page shell + Compose tab. Server-side PDF via Puppeteer-core + @sparticuz/chromium. Public web view at `/c/[token]/view`.

**Tech Stack:** Next.js 14, Prisma, React Query, Puppeteer-core (`@sparticuz/chromium-min` for Vercel).

**Spec:** `docs/superpowers/specs/2026-04-30-daily-schedule-and-call-sheets-design.md`

---

## File Structure

**Created:**
- `packages/db/prisma/migrations/20260430020000_add_call_sheet/migration.sql`
- `apps/back-to-one/src/app/projects/[projectId]/call-sheets/page.tsx` — list
- `apps/back-to-one/src/app/projects/[projectId]/call-sheets/[callSheetId]/page.tsx` — tabs
- `apps/back-to-one/src/components/call-sheets/ComposeTab.tsx`
- `apps/back-to-one/src/components/call-sheets/CallSheetView.tsx` — shared render component (used by Compose preview, web view, PDF)
- `apps/back-to-one/src/components/call-sheets/CreateCallSheetSheet.tsx` — modal to create a CallSheet for a ShootDay
- `apps/back-to-one/src/app/c/[token]/view/page.tsx` — public web view
- `apps/back-to-one/src/app/api/call-sheets/[id]/render-pdf/route.ts` — Puppeteer endpoint
- `apps/back-to-one/src/lib/auth/call-sheet-permissions.ts` — `canEditCallSheet`, `POST_DEPARTMENTS`
- `apps/back-to-one/src/lib/call-sheet/derive-call-sheet-data.ts` — composes the renderable view-model from CallSheet + ShootDay + ScheduleBlocks + Project + Talent + Crew + Location
- `apps/back-to-one/src/lib/call-sheet/derive-call-sheet-data.test.ts`

**Modified:**
- `packages/db/prisma/schema.prisma`
- `apps/back-to-one/src/types/index.ts`
- `apps/back-to-one/src/lib/db/queries.ts`
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts`
- `apps/back-to-one/package.json` — add `puppeteer-core`, `@sparticuz/chromium-min`

---

## Task 1 — Schema migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260430020000_add_call_sheet/migration.sql`

- [ ] **Step 1:** Add to schema:

```prisma
enum CallSheetStatus {
  draft
  sent
}

model CallSheet {
  id              String           @id @default(dbgenerated("gen_random_uuid()"))
  projectId       String
  shootDayId      String           @unique
  status          CallSheetStatus  @default(draft)
  publishedAt     DateTime?

  title           String?
  subtitle        String?
  episodeOrEvent  String?

  generalCallTime  String?
  crewCallTime     String?
  shootingCallTime String?
  lunchTime        String?
  estWrapTime      String?

  weatherTempHigh  Int?
  weatherTempLow   Int?
  weatherCondition String?
  sunriseTime      String?
  sunsetTime       String?

  nearestHospitalName    String?
  nearestHospitalAddress String?
  nearestHospitalPhone   String?

  productionNotes  String?         @db.Text
  parkingNotes     String?         @db.Text

  includeSchedule  Boolean         @default(true)

  replyToEmail     String?
  customFromName   String?
  customFromEmail  String?

  attachmentPaths  String[]        @default([])

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shootDay  ShootDay @relation(fields: [shootDayId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([projectId, status])
}
```

Add reverse relations on Project and ShootDay:

```prisma
model Project {
  // existing fields...
  callSheets CallSheet[]
}

model ShootDay {
  // existing fields...
  callSheet CallSheet?
}
```

- [ ] **Step 2:** Migration SQL:

```sql
CREATE TYPE "CallSheetStatus" AS ENUM ('draft', 'sent');

CREATE TABLE "CallSheet" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId"              TEXT NOT NULL,
  "shootDayId"             UUID NOT NULL,
  "status"                 "CallSheetStatus" NOT NULL DEFAULT 'draft',
  "publishedAt"            TIMESTAMP(3),
  "title"                  TEXT,
  "subtitle"               TEXT,
  "episodeOrEvent"         TEXT,
  "generalCallTime"        TEXT,
  "crewCallTime"           TEXT,
  "shootingCallTime"       TEXT,
  "lunchTime"              TEXT,
  "estWrapTime"            TEXT,
  "weatherTempHigh"        INTEGER,
  "weatherTempLow"         INTEGER,
  "weatherCondition"       TEXT,
  "sunriseTime"            TEXT,
  "sunsetTime"             TEXT,
  "nearestHospitalName"    TEXT,
  "nearestHospitalAddress" TEXT,
  "nearestHospitalPhone"   TEXT,
  "productionNotes"        TEXT,
  "parkingNotes"           TEXT,
  "includeSchedule"        BOOLEAN NOT NULL DEFAULT true,
  "replyToEmail"           TEXT,
  "customFromName"         TEXT,
  "customFromEmail"        TEXT,
  "attachmentPaths"        TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CallSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CallSheet_shootDayId_key" ON "CallSheet"("shootDayId");

ALTER TABLE "CallSheet"
  ADD CONSTRAINT "CallSheet_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallSheet"
  ADD CONSTRAINT "CallSheet_shootDayId_fkey"
  FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CallSheet_projectId_idx" ON "CallSheet"("projectId");
CREATE INDEX "CallSheet_projectId_status_idx" ON "CallSheet"("projectId", "status");

-- Storage bucket: call-sheet-attachments (5MB cap, MIME allowlist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-sheet-attachments',
  'call-sheet-attachments',
  false,
  5242880,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Permissive RLS pre-Auth (tightens on Auth Day in #24 RLS pass)
DROP POLICY IF EXISTS "call_sheet_attachments_anon_all" ON storage.objects;
CREATE POLICY "call_sheet_attachments_anon_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'call-sheet-attachments')
  WITH CHECK (bucket_id = 'call-sheet-attachments');
```

- [ ] **Step 3:** Run `pnpm --filter @origin-one/db db:generate`. Verify build green.

- [ ] **Step 4:** Commit: `feat(call-sheets): CallSheet schema + storage bucket`.

---

## Task 2 — Permissions helper

**Files:**
- Create: `apps/back-to-one/src/lib/auth/call-sheet-permissions.ts`

- [ ] **Step 1:** Implement (full code as in spec §Architecture > Permissions resolution).

- [ ] **Step 2:** Commit: `feat(call-sheets): canEditCallSheet + POST_DEPARTMENTS`.

---

## Task 3 — Types + queries + hooks

**Files:**
- Modify: `apps/back-to-one/src/types/index.ts`
- Modify: `apps/back-to-one/src/lib/db/queries.ts`
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1:** Types:

```ts
export type CallSheetStatus = 'draft' | 'sent'

export interface CallSheet {
  id: string
  projectId: string
  shootDayId: string
  status: CallSheetStatus
  publishedAt: string | null
  title: string | null
  subtitle: string | null
  episodeOrEvent: string | null
  generalCallTime: string | null
  crewCallTime: string | null
  shootingCallTime: string | null
  lunchTime: string | null
  estWrapTime: string | null
  weatherTempHigh: number | null
  weatherTempLow: number | null
  weatherCondition: string | null
  sunriseTime: string | null
  sunsetTime: string | null
  nearestHospitalName: string | null
  nearestHospitalAddress: string | null
  nearestHospitalPhone: string | null
  productionNotes: string | null
  parkingNotes: string | null
  includeSchedule: boolean
  replyToEmail: string | null
  customFromName: string | null
  customFromEmail: string | null
  attachmentPaths: string[]
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2:** Add CRUD queries (`fetchCallSheets`, `fetchCallSheet`, `createCallSheet`, `updateCallSheet`, `deleteCallSheet`, `uploadCallSheetAttachment`, `deleteCallSheetAttachment`).

- [ ] **Step 3:** Add hooks (`useCallSheets`, `useCallSheet`, `useCreateCallSheet`, `useUpdateCallSheet`, `useDeleteCallSheet`, `useUploadCallSheetAttachment`, `useDeleteCallSheetAttachment`).

- [ ] **Step 4:** Build + commit: `feat(call-sheets): CallSheet types + queries + hooks`.

---

## Task 4 — Derive helper

**Files:**
- Create: `apps/back-to-one/src/lib/call-sheet/derive-call-sheet-data.ts`
- Test: `apps/back-to-one/src/lib/call-sheet/derive-call-sheet-data.test.ts`

Builds the `CallSheetViewModel` consumed by the renderer:

```ts
export type CallSheetViewModel = {
  project: { name: string; logoUrl?: string | null }
  callSheet: CallSheet
  shootDay: ShootDay
  primaryLocation: Location | null
  schedule: ScheduleBlock[]
  productionRoles: { name: string; phone: string | null; role: string }[]  // producer, director, 1st AD
  talentRows: { id: string; name: string; role: string | null; callTime: string; hmuTime: string | null }[]
  crewRowsByDept: Record<string, { id: string; name: string; role: string | null; callTime: string }[]>
  clientRows: { id: string; name: string; role: string | null; callTime: string }[]
}
```

- [ ] Step 1: TDD — write tests covering: (a) talent call time derived from earliest schedule block, (b) producer/director/1st AD pulled from ProjectMember by role/department, (c) post-only crew excluded from crew rows.

- [ ] Step 2: Implement.

- [ ] Step 3: Commit: `feat(call-sheets): derive-call-sheet-data + tests`.

---

## Task 5 — `CallSheetView` component

**Files:**
- Create: `apps/back-to-one/src/components/call-sheets/CallSheetView.tsx`

Stateless renderer of `CallSheetViewModel`, matching the GB01 reference layout (header columns: producer/director/1st AD | title + general call | weather + times; LOCATIONS section; CLIENTS / TALENT / CREW tables; ATTACHMENTS).

- [ ] Step 1: Implement using existing design tokens (BRAND_TOKENS.md hex values).

- [ ] Step 2: Commit: `feat(call-sheets): CallSheetView render component`.

---

## Task 6 — Compose tab

**Files:**
- Create: `apps/back-to-one/src/components/call-sheets/ComposeTab.tsx`

Form fields for everything in `CallSheet` (use the schema as the field source of truth). Live preview pane on desktop using `<CallSheetView />`. Attachments uploader (Storage `call-sheet-attachments`).

- [ ] Step 1: Implement.

- [ ] Step 2: Commit: `feat(call-sheets): ComposeTab`.

---

## Task 7 — Tabs page shell + create-call-sheet sheet

**Files:**
- Create: `apps/back-to-one/src/app/projects/[projectId]/call-sheets/page.tsx`
- Create: `apps/back-to-one/src/app/projects/[projectId]/call-sheets/[callSheetId]/page.tsx`
- Create: `apps/back-to-one/src/components/call-sheets/CreateCallSheetSheet.tsx`

- [ ] Step 1: List page — list call sheets, "+ New Call Sheet" via FAB → opens CreateCallSheetSheet (picks a shoot day from dropdown).

- [ ] Step 2: Tabs page — three tabs (Compose / Recipients / Tracking). Recipients + Tracking are stub `<div>` placeholders for now; Compose tab is wired.

- [ ] Step 3: Commit: `feat(call-sheets): list page + tabs shell + create flow`.

---

## Task 8 — Public web view

**Files:**
- Create: `apps/back-to-one/src/app/c/[token]/view/page.tsx`

Server component. Looks up `CallSheetDelivery` by `confirmToken` (Arc C model — but token already lives on a row created at send time; for Arc B preview we'll add a fallback that allows anonymous access with `?preview=<callSheetId>` for testing).

For Arc B **preview only**: support `?preview=<callSheetId>` query param so the view can be rendered before any deliveries exist.

- [ ] Step 1: Implement, render `<CallSheetView />` from server-fetched view model.

- [ ] Step 2: Commit: `feat(call-sheets): public /c/[token]/view page`.

---

## Task 9 — PDF render endpoint

**Files:**
- Create: `apps/back-to-one/src/app/api/call-sheets/[id]/render-pdf/route.ts`
- Modify: `apps/back-to-one/package.json` (add `puppeteer-core`, `@sparticuz/chromium-min`)

- [ ] Step 1: `pnpm add -w --filter @origin-one/back-to-one puppeteer-core @sparticuz/chromium-min`.

- [ ] Step 2: Implement route handler. Uses Puppeteer to navigate to the public web view URL (`?preview=<id>`) and `page.pdf()`. Returns the PDF buffer with `Content-Type: application/pdf`.

```ts
import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`
  const url = `${baseUrl}/c/preview/view?preview=${id}`

  const isProd = process.env.VERCEL === '1'
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: isProd
      ? await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar')
      : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: chromium.headless,
  })
  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true })
    return new NextResponse(pdfBuffer, {
      headers: { 'Content-Type': 'application/pdf' },
    })
  } finally {
    await browser.close()
  }
}
```

- [ ] Step 3: Wire "Generate PDF" button in Compose tab → POSTs to this endpoint, downloads response.

- [ ] Step 4: Commit: `feat(call-sheets): server-side PDF render via Puppeteer`.

---

## Task 10 — Build verify + commit

- [ ] `pnpm -w build` green.
- [ ] `pnpm test` green.
- [ ] Commit any final fixes.

---

## Self-review

- ✅ Spec coverage: schema, view model, Compose tab, web view, PDF.
- ⚠️ Puppeteer on Vercel: confirm @sparticuz/chromium-min versioning at implementation time. Falls back gracefully in dev (uses local Chrome).
- ⚠️ `useViewerCanEditCallSheet` not yet implemented; gate added in Arc C when send buttons appear. Compose tab is editable for any project member in Arc B (gate is added at the send boundary).
