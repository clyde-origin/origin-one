# External Production Onboarding — Design

**Date:** 2026-05-04
**Status:** Spec
**Author:** Clyde + Claude (paired)

## Problem

When a new external production (a different production company hiring Origin Point) needs access to Back to One, the producers from that company must be able to:

- See **only** their own production's project(s)
- Edit their project as full producers (Workflow, Shotlist, Crew, Budget, etc.)
- See six demo projects (Origin Point seeds) for orientation

…**without** seeing any of Origin Point's real projects.

Today this requires ~24 manual SQL inserts (`Team`, `User`s, `TeamMember`s, `Project`, `ProjectMember`s, `UserProjectFolder`s, `UserProjectPlacement`s, plus partner-role rows on each demo). Repeating this per onboarding is brittle and error-prone, and will silently leak project visibility if any step is misordered or skipped.

## Goal

A single button in Settings — visible only to admin emails — that runs the full onboarding in one transaction and emails branded magic-link sign-in invites to each new producer.

## Non-goals

- Multi-tenant team management UI for end users (this is admin-only).
- Editing producers/teams after creation (use existing Crew page).
- Deleting/archiving an external production (manual SQL or future feature).

---

## UI

### Placement

Top of `apps/back-to-one/src/components/settings/SettingsSheet.tsx`, before the avatar block. Section is rendered conditionally:

```tsx
const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean)
const isAdmin = !!me?.email && adminEmails.includes(me.email)
```

If `isAdmin`, render a single `cinema-glass` button:

> **+ Onboard external production**

Tapping it opens `OnboardProductionSheet` as a sub-sheet over the SettingsSheet (does not replace).

### Sub-sheet form

Single scrolling form, no pagination:

| Field                       | Type                              | Validation                |
| --------------------------- | --------------------------------- | ------------------------- |
| Production company name     | text input                        | required, 1–80 chars      |
| Starter project name        | text input                        | required, 1–80 chars      |
| Producer rows (1–N)         | repeating `{ name, email }` group | each producer required, valid email |

UX:
- Producer rows render as a vertical list.
- "+ Add producer" button at the bottom of the list adds another row.
- Each row except the last shows a small trash icon to remove it.
- Form starts with one producer row.

Submit button at the bottom: **"Create production"**. While submitting → button shows spinner, all inputs disabled. On error → inline error banner, form values intact. On success → close sub-sheet, toast `"Production created — {N} invite{s} sent"`.

### Visual

- Match existing Cinema Glass class library (`globals.css`).
- No new design tokens. Use `.glass-tile` for the wrapper, existing input styles for fields.

---

## Backend

### Route

`POST /api/admin/external-production`

**Request body** (validated with zod):
```ts
{
  companyName: string,
  projectName: string,
  producers: Array<{ name: string; email: string }>
}
```

### Server-side admin gate

Before any DB writes:

1. Resolve caller via Supabase auth cookies (`createServerClient` + `getUser()`).
2. Reject 401 if no session.
3. Read `process.env.ADMIN_EMAILS` (server-only, **not** `NEXT_PUBLIC_*`).
4. Look up caller's `User.email` via service-role admin client.
5. Reject 403 if caller's email not in allowlist.

The UI gate (`NEXT_PUBLIC_ADMIN_EMAILS`) is **convenience only**; this server gate is the security boundary.

### "Origin team" identification

The Postgres function needs to know which team owns the demo seeds (to attach `DEMO PROJECTS` placements). Resolved via a server-side env var:

```
ORIGIN_TEAM_ID=5dc3f744-2b85-4260-8501-fbf61994ca3a   # Origin Point
```

Hard-coded uuid keeps this predictable: the function never has to guess from caller's TeamMember rows (which can be many). `.env.example` documents this. If absent at runtime, the route returns 500 with `"ORIGIN_TEAM_ID not configured"` — fail-fast rather than create a half-furnished team.

### Conflict handling

The function uses idempotent semantics so re-running with the same producers doesn't double-insert:

- `User` rows: `INSERT … ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id` (no-op update used as a way to capture id whether new or existing).
- `TeamMember` rows: `ON CONFLICT (teamId, userId) DO NOTHING`. (The `@@unique([teamId, userId])` index supports this.)
- `ProjectMember` rows: no unique constraint exists today, so the function pre-checks via `SELECT EXISTS` before insert. (Adding a `@@unique([projectId, userId])` would be cleaner; out of scope for this spec — flag for follow-up.)
- `UserProjectFolder` rows: name+userId is not unique, so a re-run creates a duplicate `DEMO PROJECTS` folder. Acceptable for now (admin can clean up); flag for follow-up.

### Postgres function

New migration: `<timestamp>_onboard_external_production_rpc.sql` defines:

```sql
CREATE OR REPLACE FUNCTION public.onboard_external_production(
  p_caller_user_id text,
  p_company_name text,
  p_project_name text,
  p_producers jsonb,                  -- [{name, email}, ...]
  p_origin_team_id text                -- caller's primary team (for demo seeds)
) RETURNS jsonb                         -- {teamId, projectId, producerIds, folderIds}
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
```

The function does **all 24+ inserts in one transaction**:

1. Insert `Team` (name = `p_company_name`).
2. For each producer in `p_producers`:
   - Upsert `User` by email (insert if not exists; capture id either way).
   - Insert `TeamMember` (teamId = new team, userId, role='producer'). Skip if exists.
3. Insert `Project` (teamId = new team, name = `p_project_name`, status='pre_production').
4. Insert `ProjectMember` (projectId = new project, userId = `p_caller_user_id`, role='producer', canEdit=true).
5. For each producer:
   - Insert `ProjectMember` on new project (role='producer', canEdit=true).
   - Insert `UserProjectFolder` (userId, name='DEMO PROJECTS', sortOrder=0).
   - For each `Project p WHERE p.is_demo = true AND p.teamId = p_origin_team_id`:
     - Insert `UserProjectPlacement` (userId, projectId, folderId, sortOrder ascending).
     - Insert `ProjectMember` (projectId, userId, role='producer', canEdit=true). Skip if exists.

Returns a JSON object with the new IDs.

`SECURITY INVOKER` ensures RLS still applies; the function only adds rows, it doesn't read what the caller couldn't already read. The server route is the privilege gate.

### Magic-link emails

After the rpc returns, the server route iterates the producer list:

```ts
for (const producer of producers) {
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: producer.email,
    options: { redirectTo: `${origin}/auth/callback?redirect=/projects` },
  })
  if (!linkData?.properties?.action_link) continue  // log + skip on error

  await sendEmail({
    to: producer.email,
    subject: `Welcome to ${companyName} on Back to One`,
    html: renderInviteEmail({
      producerName: producer.name,
      productionName: companyName,
      magicLink: linkData.properties.action_link,
      heroImageUrl: `${origin}/images/b21_bg.jpg`,
    }),
  })
}
```

Failures emailing one producer should not roll back the DB transaction — that's already committed. Failed sends get logged; the admin can resend manually from the producer's row in Crew.

### Email template

New file `apps/back-to-one/src/lib/email/templates/external-production-invite.ts`:

- Table-based HTML layout (max email-client compat).
- Inline styles only.
- Uses login background as hero image (`/images/b21_bg.jpg` — JPG only; AVIF/WebP unsupported in many clients).
- Dark background `#04040a` matches Cinema Glass.
- Geist Sans (with system fallback stack) for typography.
- Single primary CTA button: "Sign in to Back to One" → magic link URL.
- Plaintext fallback included.

Hero image is referenced by absolute URL pointing to the deployed app. Email clients fetch on render. If client blocks images, the layout still works because all text/CTA is below the hero, not overlaid on it.

---

## Data flow

```
SettingsSheet [admin section]
  └─ tap "+ Onboard external production"
       │
       ▼
OnboardProductionSheet (sub-sheet)
  └─ submit
       │
       ▼
useOnboardProduction() mutation
  └─ POST /api/admin/external-production
       │
       ▼
route.ts
  ├─ verify auth cookie
  ├─ verify caller email in ADMIN_EMAILS
  ├─ zod-validate body
  ├─ resolve caller's User id + primary team id (server role)
  ├─ supabase.rpc('onboard_external_production', { ... })
  │    └─ Postgres function: 24+ inserts in one transaction
  ├─ for each producer:
  │    ├─ supabase.auth.admin.generateLink({type:'magiclink', ...})
  │    └─ sendEmail({ to, subject, html: branded })
  └─ return { teamId, projectId, producerIds, folderIds }
       │
       ▼
SettingsSheet
  └─ show toast, close sub-sheet
```

---

## Files

**New:**
- `apps/back-to-one/src/components/settings/OnboardProductionSheet.tsx`
- `apps/back-to-one/src/app/api/admin/external-production/route.ts`
- `apps/back-to-one/src/lib/email/templates/external-production-invite.ts`
- `packages/db/prisma/migrations/<timestamp>_onboard_external_production_rpc/migration.sql`

**Modified:**
- `apps/back-to-one/src/components/settings/SettingsSheet.tsx` — add admin section
- `apps/back-to-one/src/lib/db/queries.ts` — `onboardExternalProduction()` rpc wrapper (small)
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — `useOnboardProduction()` mutation
- `apps/back-to-one/.env.example` — add `ADMIN_EMAILS=`, `NEXT_PUBLIC_ADMIN_EMAILS=`, `ORIGIN_TEAM_ID=`
- `apps/back-to-one/CLAUDE.md` — note the admin section under Platform rules

---

## Error handling

| Error                                            | Response                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| Caller not authenticated                         | 401, generic "auth required" message                                      |
| Caller not in `ADMIN_EMAILS`                     | 403, generic "not authorized" — do not reveal allowlist                   |
| zod validation fails                             | 400, field-level error array                                              |
| Email collision on existing User (different team) | rpc inserts new TeamMember on the new team only — no schema collision possible. Existing User row reused; their `authId` is preserved. |
| Postgres rpc throws                              | 500, generic "creation failed", log full error server-side                |
| Magic-link generate fails for producer X         | Log, skip that producer's email. DB rows already committed. Admin can resend from Crew page. |
| Resend send fails for producer X                 | Same as above — log, skip, don't roll back DB.                            |

The DB transaction either fully succeeds or fully rolls back. Email is best-effort post-commit.

---

## Security

- Server route checks **two gates** before any write: (a) authenticated session, (b) email in `ADMIN_EMAILS`.
- `NEXT_PUBLIC_ADMIN_EMAILS` is for UI display only; an attacker who edits client storage cannot bypass the server gate.
- Postgres function is `SECURITY INVOKER` — every insert respects RLS. The route's privilege comes from the auth cookie's session, not the function.
- Service-role client is only used for the `generateLink` step (Supabase admin API requirement). Service role does not touch the rpc call.
- Caller's `User.id` is resolved server-side from their authenticated session — the client cannot inject a different `p_caller_user_id`.

---

## Testing

This is an admin-only one-off flow. Lightweight test coverage:

- **Unit (vitest):** zod schema validation, email template renders without throwing for typical inputs.
- **Integration (manual / one-time):** create one external production end-to-end via the UI in dev/staging; verify producer can sign in via magic link and sees only their project + 6 demos.
- **No automated E2E.** Trade-off: this flow runs at most a few times a month; investing in Playwright is overkill for a Clyde-only admin tool.

---

## Open questions resolved

| Question                       | Resolution                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Wizard scope                   | Full onboarding: Team + producers + project + DEMO folder + demo seed access (option C from brainstorm)                               |
| Admin gate                     | Env-var allowlist: `ADMIN_EMAILS` (server) + `NEXT_PUBLIC_ADMIN_EMAILS` (UI)                                                          |
| Producer count                 | 1-N with "+ Add producer" (option B from brainstorm)                                                                                  |
| Per-producer role on project   | Always `producer`, canEdit=true. Refine on Crew page after.                                                                           |
| Caller membership on new project | Always added as `producer`, canEdit=true. So you see and can monitor every external production you create.                          |
| Magic-link delivery            | Auto-send branded email via existing Resend infra (`@/lib/email/send-email`); no Supabase dashboard template fiddling.                |

## Out of scope (future)

- UI to delete/archive an external production.
- UI to invite additional producers to an existing external team (use existing Crew page invite for now).
- Custom email-from address per production (single global `RESEND_FROM_EMAIL` for now).
- Per-production landing page or signup branding (one global magic-link email template).
- Quota/rate limiting (Clyde-only flow at low volume; not worth it).
- Sentry/observability hooks beyond `console.error` (the rest of the app uses console-only too).
