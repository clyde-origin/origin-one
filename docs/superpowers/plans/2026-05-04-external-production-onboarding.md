# External Production Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings-section, admin-gated "Onboard external production" wizard that creates Team + N producers + starter project + DEMO PROJECTS folder + auto-sends branded magic-link invites — all in one transaction.

**Architecture:** New POST API route runs server-side admin allowlist check, then calls a single Postgres function that performs ~24+ inserts atomically. After commit, route iterates producers and sends branded HTML emails via existing Resend wrapper. UI is a sub-sheet over SettingsSheet, gated client-side on `NEXT_PUBLIC_ADMIN_EMAILS`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Auth admin API), Prisma migrations, React Query mutations, Resend, vitest, zod.

**Spec:** `docs/superpowers/specs/2026-05-04-external-production-onboarding-design.md`

---

## File map

**New:**
- `packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/migration.sql`
- `apps/back-to-one/src/lib/email/templates/external-production-invite.ts`
- `apps/back-to-one/src/lib/email/templates/external-production-invite.test.ts`
- `apps/back-to-one/src/lib/admin/onboard-validation.ts`
- `apps/back-to-one/src/lib/admin/onboard-validation.test.ts`
- `apps/back-to-one/src/app/api/admin/external-production/route.ts`
- `apps/back-to-one/src/components/settings/OnboardProductionSheet.tsx`

**Modified:**
- `apps/back-to-one/src/lib/db/queries.ts` — add `onboardExternalProduction()` rpc wrapper
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts` — add `useOnboardProduction()` mutation
- `apps/back-to-one/src/components/settings/SettingsSheet.tsx` — admin-gated entry point
- `apps/back-to-one/.env.example` — three new env vars

---

### Task 1: Postgres function migration

**Files:**
- Create: `packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/migration.sql`

- [ ] **Step 1: Create the migration directory and SQL file**

```bash
mkdir -p packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc
```

Write `packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/migration.sql`:

```sql
-- Onboard a brand-new external production in one transaction.
-- Replaces ~24+ manual INSERT statements with a single rpc call.
-- SECURITY INVOKER so RLS still applies; the API route is the privilege gate.

CREATE OR REPLACE FUNCTION public.onboard_external_production(
  p_caller_user_id text,
  p_company_name text,
  p_project_name text,
  p_producers jsonb,        -- array of {name: text, email: text}
  p_origin_team_id text     -- team that owns the demo seeds
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  now_ts        timestamptz := now();
  new_team_id   text;
  new_project_id text;
  producer      jsonb;
  producer_id   text;
  producer_ids  text[] := ARRAY[]::text[];
  folder_id     text;
  folder_ids    text[] := ARRAY[]::text[];
  seed          record;
  placement_ord int;
BEGIN
  -- 1. Team
  INSERT INTO "Team" (id, name)
  VALUES (gen_random_uuid(), p_company_name)
  RETURNING id INTO new_team_id;

  -- 2. Project (under new team)
  INSERT INTO "Project" (id, "teamId", name, status)
  VALUES (gen_random_uuid(), new_team_id, p_project_name, 'pre_production'::"ProjectStatus")
  RETURNING id INTO new_project_id;

  -- 3. Caller as producer on the new project
  INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
  VALUES (gen_random_uuid(), new_project_id, p_caller_user_id, 'producer'::"Role", true);

  -- 4. Each producer
  FOR producer IN SELECT * FROM jsonb_array_elements(p_producers) LOOP
    -- 4a. Upsert User by email; capture id either way
    INSERT INTO "User" (id, email, name)
    VALUES (gen_random_uuid(), (producer->>'email'), (producer->>'name'))
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO producer_id;
    producer_ids := array_append(producer_ids, producer_id);

    -- 4b. TeamMember on new team (idempotent)
    INSERT INTO "TeamMember" (id, "teamId", "userId", role)
    VALUES (gen_random_uuid(), new_team_id, producer_id, 'producer'::"Role")
    ON CONFLICT ("teamId", "userId") DO NOTHING;

    -- 4c. ProjectMember on new project
    IF NOT EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = new_project_id AND "userId" = producer_id
    ) THEN
      INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
      VALUES (gen_random_uuid(), new_project_id, producer_id, 'producer'::"Role", true);
    END IF;

    -- 4d. UserProjectFolder for demos
    INSERT INTO "UserProjectFolder" (id, "userId", name, "sortOrder")
    VALUES (gen_random_uuid(), producer_id, 'DEMO PROJECTS', 0)
    RETURNING id INTO folder_id;
    folder_ids := array_append(folder_ids, folder_id);

    -- 4e. UserProjectPlacement + ProjectMember per demo seed
    placement_ord := 0;
    FOR seed IN
      SELECT id FROM "Project"
      WHERE is_demo = true AND "teamId" = p_origin_team_id
      ORDER BY name
    LOOP
      INSERT INTO "UserProjectPlacement" (id, "userId", "projectId", "folderId", "sortOrder")
      VALUES (gen_random_uuid(), producer_id, seed.id, folder_id, placement_ord);

      IF NOT EXISTS (
        SELECT 1 FROM "ProjectMember"
        WHERE "projectId" = seed.id AND "userId" = producer_id
      ) THEN
        INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "canEdit")
        VALUES (gen_random_uuid(), seed.id, producer_id, 'producer'::"Role", true);
      END IF;

      placement_ord := placement_ord + 1024;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'teamId', new_team_id,
    'projectId', new_project_id,
    'producerIds', to_jsonb(producer_ids),
    'folderIds', to_jsonb(folder_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_external_production(text, text, text, jsonb, text)
  TO authenticated, anon;
```

- [ ] **Step 2: Verify migration syntax via psql parse-only check (optional, manual)**

If you have a local Postgres or shadow DB:

```bash
psql -d <local-db> -v ON_ERROR_STOP=1 -f packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/migration.sql
```

If you don't, skip — Prisma will validate on `migrate deploy`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/
git commit -m "$(cat <<'EOF'
feat(db): onboard_external_production rpc

Single-transaction Postgres function for the upcoming admin onboarding
wizard. Creates Team + N producers + starter project + DEMO PROJECTS
folder + per-producer placements/memberships on demo seeds. SECURITY
INVOKER; the API route gates privilege.
EOF
)"
```

---

### Task 2: Email template (pure function, TDD)

**Files:**
- Create: `apps/back-to-one/src/lib/email/templates/external-production-invite.ts`
- Test: `apps/back-to-one/src/lib/email/templates/external-production-invite.test.ts`

- [ ] **Step 1: Write the failing test**

Write `apps/back-to-one/src/lib/email/templates/external-production-invite.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderInviteEmail } from './external-production-invite'

describe('renderInviteEmail', () => {
  const baseArgs = {
    producerName: 'Chris Loanzon',
    productionName: 'THNK Elephant',
    magicLink: 'https://app.example.com/auth/callback?token=xyz',
    heroImageUrl: 'https://app.example.com/images/b21_bg.jpg',
  }

  it('includes the magic link as the primary CTA href', () => {
    const { html } = renderInviteEmail(baseArgs)
    expect(html).toContain(`href="${baseArgs.magicLink}"`)
  })

  it('addresses the producer by name', () => {
    const { html, text } = renderInviteEmail(baseArgs)
    expect(html).toContain('Chris Loanzon')
    expect(text).toContain('Chris Loanzon')
  })

  it('mentions the production name in the subject and body', () => {
    const result = renderInviteEmail(baseArgs)
    expect(result.subject).toContain('THNK Elephant')
    expect(result.html).toContain('THNK Elephant')
  })

  it('uses the hero image absolute URL', () => {
    const { html } = renderInviteEmail(baseArgs)
    expect(html).toContain(`src="${baseArgs.heroImageUrl}"`)
  })

  it('returns a plaintext fallback', () => {
    const { text } = renderInviteEmail(baseArgs)
    expect(text).toContain('Chris Loanzon')
    expect(text).toContain('THNK Elephant')
    expect(text).toContain(baseArgs.magicLink)
  })

  it('html-escapes name and production fields', () => {
    const args = { ...baseArgs, producerName: 'O\'Brien <hi>', productionName: 'A&B' }
    const { html } = renderInviteEmail(args)
    expect(html).toContain('O&#39;Brien &lt;hi&gt;')
    expect(html).toContain('A&amp;B')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/email/templates/external-production-invite.test.ts`

Expected: FAIL — `Cannot find module './external-production-invite'`.

- [ ] **Step 3: Write the template**

Write `apps/back-to-one/src/lib/email/templates/external-production-invite.ts`:

```ts
export type InviteEmailArgs = {
  producerName: string
  productionName: string
  magicLink: string
  heroImageUrl: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderInviteEmail(args: InviteEmailArgs): RenderedEmail {
  const name = escapeHtml(args.producerName)
  const prod = escapeHtml(args.productionName)
  const link = args.magicLink            // already a URL, never escape
  const hero = args.heroImageUrl

  const subject = `Welcome to ${args.productionName} on Back to One`

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#04040a;color:#e8e8ea;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Geist,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#04040a;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#0a0a14;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="position:relative;padding:0;">
                <img src="${hero}" width="560" height="240" alt="" style="display:block;width:100%;height:240px;object-fit:cover;border-top-left-radius:20px;border-top-right-radius:20px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#e8e8ea;line-height:1.25;">Welcome, ${name}</h1>
                <p style="margin:0;font-size:16px;line-height:1.55;color:#bdbdc6;">You've been added as a producer on <strong style="color:#e8e8ea;">${prod}</strong> in Back to One — Origin Point's production operating system.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <a href="${link}" style="display:inline-block;background:#6470f3;color:#04040a;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:14px;">Sign in to Back to One</a>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#7c7c8a;">This link signs you in directly — no password needed. It expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:</p>
                <p style="margin:8px 0 0;font-size:12px;word-break:break-all;color:#5d5d6a;"><a href="${link}" style="color:#5d5d6a;text-decoration:underline;">${link}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid rgba(255,255,255,0.05);">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#5d5d6a;">If you weren't expecting this invite, you can safely ignore the email — nothing happens until you click the link.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `Welcome, ${args.producerName}

You've been added as a producer on ${args.productionName} in Back to One.

Sign in here (link expires in 24h):
${args.magicLink}

If you weren't expecting this, ignore this email.`

  return { subject, html, text }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/email/templates/external-production-invite.test.ts`

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/email/templates/external-production-invite.ts apps/back-to-one/src/lib/email/templates/external-production-invite.test.ts
git commit -m "feat(email): branded external-production invite template"
```

---

### Task 3: Onboard request validator (zod, TDD)

**Files:**
- Create: `apps/back-to-one/src/lib/admin/onboard-validation.ts`
- Test: `apps/back-to-one/src/lib/admin/onboard-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Write `apps/back-to-one/src/lib/admin/onboard-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { onboardRequestSchema } from './onboard-validation'

describe('onboardRequestSchema', () => {
  const valid = {
    companyName: 'THNK Elephant',
    projectName: 'Office Pool',
    producers: [
      { name: 'Chris Loanzon', email: 'a.chrisdelas@gmail.com' },
      { name: 'Eileen Soong', email: 'eileen.s.soong@gmail.com' },
    ],
  }

  it('accepts a valid payload', () => {
    expect(onboardRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty company name', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, companyName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects company name over 80 chars', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, companyName: 'A'.repeat(81) })
    expect(r.success).toBe(false)
  })

  it('rejects empty project name', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, projectName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects when producers array is empty', () => {
    const r = onboardRequestSchema.safeParse({ ...valid, producers: [] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email in producer row', () => {
    const r = onboardRequestSchema.safeParse({
      ...valid,
      producers: [{ name: 'Chris', email: 'not-an-email' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty producer name', () => {
    const r = onboardRequestSchema.safeParse({
      ...valid,
      producers: [{ name: '', email: 'ok@example.com' }],
    })
    expect(r.success).toBe(false)
  })

  it('trims whitespace on names and emails', () => {
    const r = onboardRequestSchema.parse({
      companyName: '  THNK Elephant  ',
      projectName: '  Office Pool  ',
      producers: [{ name: '  Chris  ', email: '  a@b.com  ' }],
    })
    expect(r.companyName).toBe('THNK Elephant')
    expect(r.projectName).toBe('Office Pool')
    expect(r.producers[0]).toEqual({ name: 'Chris', email: 'a@b.com' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/admin/onboard-validation.test.ts`

Expected: FAIL — `Cannot find module './onboard-validation'`.

- [ ] **Step 3: Write the validator**

Write `apps/back-to-one/src/lib/admin/onboard-validation.ts`:

```ts
import { z } from 'zod'

const trimmedString = (max: number) =>
  z.string().transform(s => s.trim()).pipe(z.string().min(1).max(max))

const trimmedEmail = z.string().transform(s => s.trim()).pipe(z.string().email().min(1).max(254))

export const producerSchema = z.object({
  name: trimmedString(80),
  email: trimmedEmail,
})

export const onboardRequestSchema = z.object({
  companyName: trimmedString(80),
  projectName: trimmedString(80),
  producers: z.array(producerSchema).min(1).max(20),
})

export type OnboardRequest = z.infer<typeof onboardRequestSchema>
export type Producer = z.infer<typeof producerSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/admin/onboard-validation.test.ts`

Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/admin/onboard-validation.ts apps/back-to-one/src/lib/admin/onboard-validation.test.ts
git commit -m "feat(admin): zod validator for onboard request"
```

---

### Task 4: queries.ts wrapper for the rpc

**Files:**
- Modify: `apps/back-to-one/src/lib/db/queries.ts` (add new function near other rpc wrappers)

- [ ] **Step 1: Locate the existing `bulkReorderHomeGrid` function (uses rpc); add new wrapper below it**

Find `bulkReorderHomeGrid` in `apps/back-to-one/src/lib/db/queries.ts`. Add this function immediately after it:

```ts
export type OnboardExternalProductionInput = {
  callerUserId: string
  companyName: string
  projectName: string
  producers: { name: string; email: string }[]
  originTeamId: string
}

export type OnboardExternalProductionResult = {
  teamId: string
  projectId: string
  producerIds: string[]
  folderIds: string[]
}

export async function onboardExternalProduction(
  input: OnboardExternalProductionInput
): Promise<OnboardExternalProductionResult> {
  const db = createClient()
  const { data, error } = await db.rpc('onboard_external_production', {
    p_caller_user_id: input.callerUserId,
    p_company_name: input.companyName,
    p_project_name: input.projectName,
    p_producers: input.producers,
    p_origin_team_id: input.originTeamId,
  })
  if (error) {
    console.error('onboardExternalProduction failed:', error)
    throw error
  }
  return data as OnboardExternalProductionResult
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/back-to-one && pnpm type-check`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/lib/db/queries.ts
git commit -m "feat(db): onboardExternalProduction rpc wrapper"
```

---

### Task 5: API route — auth + admin gate (TDD via extracted helper)

**Files:**
- Modify: `apps/back-to-one/src/lib/admin/onboard-validation.ts` (add helper)
- Modify: `apps/back-to-one/src/lib/admin/onboard-validation.test.ts` (add tests)

The route itself integrates Supabase + filesystem env, hard to unit-test cleanly. Extract a pure helper for the only piece worth testing (the email allowlist check).

- [ ] **Step 1: Add failing test for `isAdminEmail`**

Append to `apps/back-to-one/src/lib/admin/onboard-validation.test.ts`:

```ts
import { isAdminEmail } from './onboard-validation'

describe('isAdminEmail', () => {
  it('returns true for an exact match in the allowlist', () => {
    expect(isAdminEmail('clyde@originpoint.io', 'clyde@originpoint.io')).toBe(true)
  })

  it('returns true when allowlist has multiple entries', () => {
    expect(isAdminEmail('tyler@originpoint.io', 'clyde@originpoint.io,tyler@originpoint.io')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAdminEmail('Clyde@Originpoint.IO', 'clyde@originpoint.io')).toBe(true)
  })

  it('handles whitespace around entries', () => {
    expect(isAdminEmail('clyde@originpoint.io', ' clyde@originpoint.io , tyler@originpoint.io ')).toBe(true)
  })

  it('returns false when email not in allowlist', () => {
    expect(isAdminEmail('intruder@example.com', 'clyde@originpoint.io')).toBe(false)
  })

  it('returns false when allowlist is empty or undefined', () => {
    expect(isAdminEmail('clyde@originpoint.io', '')).toBe(false)
    expect(isAdminEmail('clyde@originpoint.io', undefined)).toBe(false)
  })

  it('returns false when email is empty', () => {
    expect(isAdminEmail('', 'clyde@originpoint.io')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/admin/onboard-validation.test.ts`

Expected: FAIL — `isAdminEmail is not exported`.

- [ ] **Step 3: Implement `isAdminEmail` in `onboard-validation.ts`**

Append to `apps/back-to-one/src/lib/admin/onboard-validation.ts`:

```ts
export function isAdminEmail(email: string | null | undefined, allowlistEnv: string | undefined): boolean {
  if (!email) return false
  if (!allowlistEnv) return false
  const target = email.trim().toLowerCase()
  if (!target) return false
  const allowed = allowlistEnv
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(target)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @origin-one/back-to-one exec vitest run src/lib/admin/onboard-validation.test.ts`

Expected: PASS — 15 tests total now.

- [ ] **Step 5: Commit**

```bash
git add apps/back-to-one/src/lib/admin/onboard-validation.ts apps/back-to-one/src/lib/admin/onboard-validation.test.ts
git commit -m "feat(admin): isAdminEmail allowlist helper"
```

---

### Task 6: API route handler

**Files:**
- Create: `apps/back-to-one/src/app/api/admin/external-production/route.ts`

- [ ] **Step 1: Write the route**

Write `apps/back-to-one/src/app/api/admin/external-production/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { onboardRequestSchema, isAdminEmail } from '@/lib/admin/onboard-validation'
import { renderInviteEmail } from '@/lib/email/templates/external-production-invite'
import { sendEmail } from '@/lib/email/send-email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // 1. Parse body + zod-validate
  const body = await request.json().catch(() => null)
  const parsed = onboardRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { companyName, projectName, producers } = parsed.data

  // 2. Resolve caller via Supabase auth cookies
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set(name, value, options) },
        remove(name: string, options: CookieOptions) { cookieStore.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }

  // 3. Admin allowlist gate (UI is convenience; THIS is security)
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    return NextResponse.json({ error: 'not authorized' }, { status: 403 })
  }

  // 4. Required env: ORIGIN_TEAM_ID (which team owns the demo seeds)
  const originTeamId = process.env.ORIGIN_TEAM_ID
  if (!originTeamId) {
    console.error('ORIGIN_TEAM_ID not configured')
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  // 5. Resolve caller's User.id (rpc needs it for the caller-as-producer row)
  const { data: callerUser, error: callerErr } = await supabase
    .from('User').select('id').eq('authId', user.id).single()
  if (callerErr || !callerUser) {
    console.error('caller User row lookup failed', callerErr)
    return NextResponse.json({ error: 'caller user not found' }, { status: 500 })
  }

  // 6. Run the rpc — DB transaction commits or rolls back as a unit
  const { data: rpcData, error: rpcErr } = await supabase.rpc('onboard_external_production', {
    p_caller_user_id: callerUser.id,
    p_company_name: companyName,
    p_project_name: projectName,
    p_producers: producers,
    p_origin_team_id: originTeamId,
  })
  if (rpcErr) {
    console.error('onboard rpc failed', rpcErr)
    return NextResponse.json({ error: 'creation failed' }, { status: 500 })
  }

  // 7. Send branded magic-link emails (best-effort, post-commit)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const origin = request.nextUrl.origin
  const emailResults: Array<{ email: string; ok: boolean; reason?: string }> = []

  for (const producer of producers) {
    try {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: producer.email,
        options: { redirectTo: `${origin}/auth/callback?redirect=/projects` },
      })
      if (linkErr || !linkData?.properties?.action_link) {
        emailResults.push({ email: producer.email, ok: false, reason: linkErr?.message ?? 'no link' })
        continue
      }
      const rendered = renderInviteEmail({
        producerName: producer.name,
        productionName: companyName,
        magicLink: linkData.properties.action_link,
        heroImageUrl: `${origin}/images/b21_bg.jpg`,
      })
      const sendResult = await sendEmail({
        to: producer.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      emailResults.push({
        email: producer.email,
        ok: sendResult.ok,
        reason: sendResult.ok ? undefined : sendResult.error,
      })
    } catch (err) {
      emailResults.push({
        email: producer.email,
        ok: false,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    ...rpcData,
    emails: emailResults,
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/back-to-one && pnpm type-check`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/app/api/admin/external-production/route.ts
git commit -m "feat(api): admin/external-production POST route"
```

---

### Task 7: React Query mutation hook

**Files:**
- Modify: `apps/back-to-one/src/lib/hooks/useOriginOne.ts`

- [ ] **Step 1: Add the mutation hook**

Find the bottom of `apps/back-to-one/src/lib/hooks/useOriginOne.ts` (where other mutations live). Add:

```ts
export type OnboardProductionInput = {
  companyName: string
  projectName: string
  producers: { name: string; email: string }[]
}

export type OnboardProductionResult = {
  teamId: string
  projectId: string
  producerIds: string[]
  folderIds: string[]
  emails: Array<{ email: string; ok: boolean; reason?: string }>
}

export function useOnboardProduction() {
  const queryClient = useQueryClient()
  return useMutation<OnboardProductionResult, Error, OnboardProductionInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/admin/external-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `request failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      // New project + memberships landed; force a fresh project list.
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/back-to-one && pnpm type-check`

Expected: clean. (`useQueryClient` and `useMutation` are already imported in this file.)

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/lib/hooks/useOriginOne.ts
git commit -m "feat(hooks): useOnboardProduction mutation"
```

---

### Task 8: OnboardProductionSheet UI

**Files:**
- Create: `apps/back-to-one/src/components/settings/OnboardProductionSheet.tsx`

- [ ] **Step 1: Write the sub-sheet**

Write `apps/back-to-one/src/components/settings/OnboardProductionSheet.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetHeader, SheetBody } from '@/components/ui/Sheet'
import { useOnboardProduction } from '@/lib/hooks/useOriginOne'
import { haptic } from '@/lib/utils/haptics'

type ProducerRow = { name: string; email: string }

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#e8e8ea',
  padding: '12px 14px',
  fontSize: 15,
  outline: 'none',
}

const labelBase: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#7c7c8a',
  marginBottom: 6,
}

export function OnboardProductionSheet({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const onboard = useOnboardProduction()
  const [companyName, setCompanyName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [producers, setProducers] = useState<ProducerRow[]>([{ name: '', email: '' }])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function updateProducer(idx: number, patch: Partial<ProducerRow>) {
    setProducers(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function addProducer() {
    haptic('light')
    setProducers(prev => [...prev, { name: '', email: '' }])
  }
  function removeProducer(idx: number) {
    haptic('light')
    setProducers(prev => prev.filter((_, i) => i !== idx))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    haptic('medium')
    try {
      const result = await onboard.mutateAsync({ companyName, projectName, producers })
      const sentCount = result.emails.filter(e => e.ok).length
      const failedCount = result.emails.length - sentCount
      setSuccess(
        failedCount === 0
          ? `Production created. ${sentCount} invite${sentCount === 1 ? '' : 's'} sent.`
          : `Production created. ${sentCount} invite${sentCount === 1 ? '' : 's'} sent, ${failedCount} failed (resend manually from Crew page).`
      )
      // Reset form so a second onboarding starts clean.
      setCompanyName('')
      setProjectName('')
      setProducers([{ name: '', email: '' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'creation failed')
    }
  }

  const submitDisabled =
    onboard.isPending ||
    !companyName.trim() ||
    !projectName.trim() ||
    producers.length === 0 ||
    producers.some(p => !p.name.trim() || !p.email.trim())

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader title="Onboard external production" onClose={onClose} />
      <SheetBody>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelBase} htmlFor="company">Production company</label>
            <input
              id="company"
              type="text"
              autoFocus
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. THNK Elephant"
              maxLength={80}
              style={inputBase}
            />
          </div>

          <div>
            <label style={labelBase} htmlFor="project">Starter project</label>
            <input
              id="project"
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Office Pool"
              maxLength={80}
              style={inputBase}
            />
          </div>

          <div>
            <span style={labelBase}>Producers</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {producers.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8 }}>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateProducer(i, { name: e.target.value })}
                    placeholder="Name"
                    maxLength={80}
                    style={inputBase}
                  />
                  <input
                    type="email"
                    value={p.email}
                    onChange={e => updateProducer(i, { email: e.target.value })}
                    placeholder="email@example.com"
                    style={inputBase}
                  />
                  <button
                    type="button"
                    onClick={() => removeProducer(i)}
                    disabled={producers.length <= 1}
                    aria-label="Remove producer"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: producers.length <= 1 ? '#3a3a4a' : '#7c7c8a',
                      cursor: producers.length <= 1 ? 'default' : 'pointer',
                      fontSize: 18,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addProducer}
              style={{
                marginTop: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#bdbdc6',
                padding: '10px 14px',
                fontSize: 14,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              + Add producer
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#ffa8a8' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(80,180,120,0.08)', border: '1px solid rgba(80,180,120,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#9be0b8' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            style={{
              background: submitDisabled ? 'rgba(100,112,243,0.4)' : '#6470f3',
              color: '#04040a',
              border: 'none',
              borderRadius: 14,
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitDisabled ? 'default' : 'pointer',
            }}
          >
            {onboard.isPending ? 'Creating…' : 'Create production'}
          </button>
        </form>
      </SheetBody>
    </Sheet>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/back-to-one && pnpm type-check`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/back-to-one/src/components/settings/OnboardProductionSheet.tsx
git commit -m "feat(settings): OnboardProductionSheet form sub-sheet"
```

---

### Task 9: SettingsSheet integration

**Files:**
- Modify: `apps/back-to-one/src/components/settings/SettingsSheet.tsx`

- [ ] **Step 1: Add the admin-gated section**

In `apps/back-to-one/src/components/settings/SettingsSheet.tsx`, add the `OnboardProductionSheet` import and a new admin section.

Add this import near the existing imports:

```ts
import { OnboardProductionSheet } from './OnboardProductionSheet'
```

Inside the `SettingsSheet` component body, near the other `useState` calls, add:

```ts
const [onboardOpen, setOnboardOpen] = useState(false)

const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const isAdmin = !!me?.email && adminEmails.includes(me.email.toLowerCase())
```

Inside the returned JSX, in `<SheetBody>`, add this BEFORE the existing avatar block:

```tsx
{isAdmin && (
  <div style={{ paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <button
      onClick={() => { haptic('light'); setOnboardOpen(true) }}
      style={{
        width: '100%',
        background: 'rgba(100,112,243,0.1)',
        border: '1px solid rgba(100,112,243,0.3)',
        borderRadius: 14,
        color: '#a8b0ff',
        padding: '14px 18px',
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
      Onboard external production
    </button>
  </div>
)}
```

And, after the closing `</Sheet>` of the main SettingsSheet (or as a sibling at the end of the returned fragment — adjust the return to a Fragment if needed):

```tsx
<OnboardProductionSheet open={onboardOpen} onClose={() => setOnboardOpen(false)} />
```

If the current return is a single `<Sheet>` JSX element (no fragment), wrap both in `<>...</>`.

- [ ] **Step 2: Type-check**

Run: `cd apps/back-to-one && pnpm type-check`

Expected: clean.

- [ ] **Step 3: Build smoke test**

Run: `cd apps/back-to-one && pnpm build`

Expected: clean (all routes compile).

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/src/components/settings/SettingsSheet.tsx
git commit -m "feat(settings): admin-gated entry point for production onboarding"
```

---

### Task 10: Env example + CLAUDE.md note

**Files:**
- Modify: `apps/back-to-one/.env.example` (or root `.env.example` — wherever the app's env reference lives)
- Modify: `apps/back-to-one/CLAUDE.md`

- [ ] **Step 1: Identify the right .env.example**

```bash
ls apps/back-to-one/.env.example 2>/dev/null && echo "use apps-level" || ls .env.example 2>/dev/null && echo "use root"
```

Use whichever exists. If neither exists, create `apps/back-to-one/.env.example`.

- [ ] **Step 2: Append the new env vars**

Add these lines (preserving existing content):

```
# ── External-production onboarding (admin-only) ───────────────────────────────
# Server-side allowlist of emails permitted to onboard new external productions.
# Comma-separated. Verified server-side in /api/admin/external-production.
ADMIN_EMAILS=

# Same allowlist exposed to the client for UI gating only. NOT a security boundary.
NEXT_PUBLIC_ADMIN_EMAILS=

# UUID of the Team that owns the demo seed projects. New external productions
# get a "DEMO PROJECTS" folder pointing at every is_demo=true project under this team.
ORIGIN_TEAM_ID=
```

- [ ] **Step 3: Append a note to apps/back-to-one/CLAUDE.md**

Find a sensible section (e.g., near "Platform rules" or after "Imports from"). Append:

```markdown
## Admin tools

`/api/admin/external-production` — POST endpoint, gated by `ADMIN_EMAILS`
allowlist (server) + `NEXT_PUBLIC_ADMIN_EMAILS` (UI gate, not security).
Triggered from a button at the top of `SettingsSheet`. Creates Team + N
producers + starter project + DEMO PROJECTS folder + auto-sends branded
magic-link emails. Requires `ORIGIN_TEAM_ID` env (UUID of the Team whose
`is_demo=true` projects become the demo seeds).
Spec: `docs/superpowers/specs/2026-05-04-external-production-onboarding-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add apps/back-to-one/.env.example apps/back-to-one/CLAUDE.md
git commit -m "docs: env vars + admin-tools note for production onboarding"
```

---

### Task 11: Apply the migration to Supabase

**Files:** none (deploys the Task 1 migration)

- [ ] **Step 1: Apply the migration to the back-to-one database**

Either:

```bash
pnpm --filter @origin-one/db prisma migrate deploy
```

…OR via Supabase MCP / dashboard, applying the SQL from `packages/db/prisma/migrations/20260504170000_onboard_external_production_rpc/migration.sql`.

- [ ] **Step 2: Smoke-test the function**

Run a no-op call to verify the function exists and is invokable:

```sql
SELECT public.onboard_external_production(
  '00000000-0000-0000-0000-000000000000',
  'Test Co',
  'Test Project',
  '[]'::jsonb,
  '00000000-0000-0000-0000-000000000000'
);
```

Expected: completes without error. (It will create a Team and Project rows; if you want to keep the DB clean, run inside `BEGIN ... ROLLBACK`.)

If you'd rather not pollute the DB at all, instead just verify the function exists:

```sql
SELECT proname, pronargs FROM pg_proc WHERE proname = 'onboard_external_production';
```

Expected: 1 row, 5 args.

- [ ] **Step 3: Set the env vars in your local .env (and Vercel for prod)**

Add to `apps/back-to-one/.env.local`:
```
ADMIN_EMAILS=clyde@originpoint.io
NEXT_PUBLIC_ADMIN_EMAILS=clyde@originpoint.io
ORIGIN_TEAM_ID=5dc3f744-2b85-4260-8501-fbf61994ca3a
```

(Add the same three to Vercel environment variables before merging to production.)

- [ ] **Step 4: Manual end-to-end smoke**

1. Run `pnpm --filter @origin-one/back-to-one dev`.
2. Sign in as Clyde.
3. Open Settings (gear icon). Verify "+ Onboard external production" button appears.
4. Click it. Form opens.
5. Fill in: Company "Test Production X", Project "Pilot", one producer "Test User" / your-personal-email@example.com.
6. Submit. Verify success toast and your test email receives a branded invite.
7. Click the magic link in the email. Confirm landing on `/projects` and seeing only the "Pilot" project + DEMO PROJECTS folder with 6 demos.
8. Sign back in as Clyde. Confirm Pilot also appears in Clyde's project list.
9. Optional cleanup: SQL `DELETE` the test team + cascading rows.

- [ ] **Step 5: No new commit unless step 3's `.env.local` was tracked (it shouldn't be)**

---

## Self-review summary

- ✅ Spec section "UI placement" → Task 9
- ✅ Spec section "Sub-sheet form" → Task 8
- ✅ Spec section "Server-side admin gate" → Tasks 5, 6
- ✅ Spec section "Postgres function" → Task 1
- ✅ Spec section "Magic-link emails" → Task 6 (route step 7)
- ✅ Spec section "Email template" → Task 2
- ✅ Spec section "Origin team identification" → env var documented in Task 10, used in Task 6
- ✅ Spec section "Conflict handling" → Task 1 SQL uses ON CONFLICT / IF NOT EXISTS
- ✅ Spec section "Files" matches Task file paths
- ✅ Spec section "Error handling" → Task 6 covers all enumerated cases
- ✅ Spec section "Security" → Task 5 admin-gate helper, Task 6 route uses it
- ✅ Spec section "Testing" → unit tests in Tasks 2, 3, 5; manual E2E in Task 11

---

## Out-of-scope reminders (for future iterations)

- Add `@@unique([projectId, userId])` on `ProjectMember` so the rpc can use ON CONFLICT instead of EXISTS pre-check. (Schema PR.)
- Dedup `UserProjectFolder` by `(userId, name)` so re-running for the same producers doesn't double-create the demos folder. (Schema PR.)
- UI to delete/archive an external production. (Future feature.)
- UI to invite additional producers later (use existing `/projects/[id]/crew/invite` for now).
