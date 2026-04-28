# Auth Day Runbook

The orchestrated cutover that flips Back to One from pre-Auth (open access) to authenticated + RLS-gated. Each step is a checkbox; do them in order, top to bottom.

> ⚠️  **Trap to avoid: do not sign in before the rebind runs.**
>
> The app on main now has a working /login page. If anyone (including a producer) signs in with their real email *before* the rebind script (Step 3.1) updates the seeded `User.email` columns to real values, the magic-link flow still creates an `auth.users` row — but the binding handler can't match it to a `User` row and returns `incomplete-invite`. That `auth.users` row sticks around as a "ghost." The next sign-in attempt (post-rebind) fails with `conflict` because the User's `authId` candidate is already taken by the ghost.
>
> If this happens: delete the ghost row from `auth.users` in Supabase Studio, then sign in again. Cheap to recover from, but easier to avoid.
>
> **Bottom line:** Step 3.1 (rebind) is the gate. Don't tap /login until it's done.

**Prerequisites — every PR in this list must be merged to main before starting:**

| PR | Status | Notes |
|---|---|---|
| #78 auth-000-add-resource-teamid | merged + applied | |
| #79 auth-001-add-user-authid | merged + applied | |
| #80 auth-003-tenant-cleanup | merged + applied | |
| #81 auth-004-rls-helpers-and-policies | DRAFT — **merge today, do not apply yet** | |
| #82 auth-005-storage-policies | DRAFT — **merge today, do not apply yet** | |
| #83 auth-005b-storage-signed-urls | DRAFT — **merge today** | |
| #84 auth-006-app-wiring | merged | code-only |
| #85 auth-006a-in-app-crew-invite-and-add-role | merged | code-only |

**Window plan:** Auth Day takes ~90 minutes. Most of it is dashboard config; the destructive step (RLS apply) is one command and runs in seconds. Schedule the window when no producer needs the live PWA — RLS apply causes the unauthed app to show empty state until sign-ins land.

---

## Phase 1 — Pre-cutover (do these any time before Auth Day)

### 1.1 Collect real email addresses

Have these in hand before starting Phase 3:

- [ ] **Clyde:** real email (e.g., `clydebessey@gmail.com`)
- [ ] **Tyler:** real email (Tyler provides)
- [ ] **Kelly:** real email (Kelly provides)

Don't commit these to git or paste them in chats. Set as shell exports right before Step 3.1.

### 1.2 Verify Vercel access

Producer issuing the cutover needs Vercel project admin to set env vars and promote deployments.

- [ ] Confirm access to `clyde-origin/origin-one` Vercel project at the role required to edit Environment Variables.

### 1.3 Verify Supabase access

- [ ] Confirm Supabase Studio access to the Orbit project (`sgnjlzcffaptwzxtbefp`) at the role required to:
  - Edit Authentication → URL Configuration
  - Edit Authentication → Email Templates
  - Send invitations (Authentication → Users → Invite)
  - Take a database backup (Database → Backups)

### 1.4 Pick the throwaway smoke-test alias

Recommended: `clyde+auth-test1@gmail.com` (Gmail aliases route to the producer's real inbox; bump the suffix for retest rounds).

- [ ] Throwaway alias chosen and confirmed accessible.

---

## Phase 2 — Pre-flight (within ~30 minutes of cutover)

### 2.1 Take a Supabase production snapshot

Required before applying RLS. RLS once on cannot be cleanly toggled off without a destructive migration. The snapshot is the parachute.

- [ ] Supabase Studio → Database → Backups → "Take backup" → wait for completion. Confirm the backup is listed and timestamped within the last few minutes.

### 2.2 Verify all PRs merged to main

```bash
git fetch origin main
git log --oneline origin/main | head -10
```

- [ ] Most recent commits include auth-001, auth-003, auth-004, auth-005, auth-005b, auth-006, auth-006a.

### 2.3 Verify pending migrations on production

```bash
pnpm --filter @origin-one/db exec prisma migrate status
```

Expected: two pending migrations:
- `<ts>_rls_helpers_and_policies` (PR #4)
- `<ts>_storage_policies` (PR #5)

(PR #5b is code-only, no migration. PR #6 / #6a are code-only.)

- [ ] Both pending migrations confirmed.

---

## Phase 3 — Cutover

### 3.1 Apply founding-team email rebind

Sets up the binding handler match. Run BEFORE issuing invites.

```bash
export CLYDE_REAL_EMAIL="<clyde's real email>"
export TYLER_REAL_EMAIL="<tyler's real email>"
export KELLY_REAL_EMAIL="<kelly's real email>"

psql "$DATABASE_URL_PRODUCTION" \
  -v clyde_email="$CLYDE_REAL_EMAIL" \
  -v tyler_email="$TYLER_REAL_EMAIL" \
  -v kelly_email="$KELLY_REAL_EMAIL" \
  -f scripts/auth-day/01-rebind-founding-emails.sql
```

- [ ] Script completes without exceptions.

Verify via SQL:

```sql
SELECT name, email FROM "User"
WHERE name IN ('Clyde Bessey','Tyler Heckerman','Kelly Pratt')
ORDER BY name;
```

- [ ] Returns 3 rows, each with the real email (not `*@originpoint.com`).

### 3.2 Apply RLS + storage policy migrations

```bash
pnpm --filter @origin-one/db exec prisma migrate deploy
```

Expected: applies both pending migrations (RLS + storage policies). After this, unauthed queries return zero rows.

- [ ] `Applying migration ...` messages for both migrations.
- [ ] Final line: `All migrations have been successfully applied.`

Verify via SQL:

```sql
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: ~70 policies

SELECT id, public FROM storage.buckets ORDER BY id;
-- Expected: moodboard / storyboard / entity-attachments → public:false
--           avatars → public:true
```

- [ ] Counts and flags match.

### 3.3 Configure Vercel env vars

Vercel dashboard → Project → Settings → Environment Variables.

**Production scope:**

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` = `<production service-role key from Supabase project Settings → API>`. **Do not enable for Preview.**

**Preview scope:**

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` = `<a Supabase branch's service-role key, separate from production>`.

Verify other env vars exist (already set during prior deploys):
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — production: production Supabase; preview: Supabase branch
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same scopes
- [ ] `DATABASE_URL`, `DIRECT_URL` — production points to production Supabase; preview to branch

### 3.4 Configure Supabase Auth dashboard

Supabase Studio → Authentication → URL Configuration.

- [ ] **Site URL:** `https://<production-domain>`
- [ ] **Redirect URLs (allow list):**
  - `https://<production-domain>/auth/callback`
  - `https://<production-domain>/auth/setup-password`
  - `https://*-<vercel-team>.vercel.app/auth/callback` (Vercel preview deployments)
  - `http://localhost:3000/auth/callback` (local dev)

Authentication → Email Templates → Invite user:
- [ ] **From name:** `Origin Point`
- [ ] **Subject:** `You're invited to {{ .SiteName }}`
- [ ] Body uses `{{ .ConfirmationURL }}`. Defer rich design.

Authentication → Email Templates → Magic Link:
- [ ] **From name:** `Origin Point`
- [ ] **Subject:** `Sign in to Origin Point`
- [ ] Body uses `{{ .ConfirmationURL }}`.

### 3.5 Trigger a Vercel deploy

Either push a no-op commit to main or trigger a manual redeploy from the Vercel dashboard. The new build picks up the env vars.

- [ ] Build completes; new deployment promoted to production.

### 3.6 Issue founding invites

Supabase Studio → Authentication → Users → Invite user. For each:

- [ ] **Clyde** — real email; magic-link mode (default); user metadata blank (Flow A — bind by email)
- [ ] **Tyler** — same
- [ ] **Kelly** — same

---

## Phase 4 — Smoke test on production

Each producer claims their invite, then runs through the matrix below.

### 4.1 Founding rebind verification

| Test | Pass criteria |
|---|---|
| Clyde clicks magic link → lands on `/projects` | All 6 demo projects visible |
| Tyler clicks magic link → lands on `/projects` | All 6 demo projects visible (independent session) |
| Kelly clicks magic link → lands on `/projects` | All 6 demo projects visible (independent session) |

- [ ] All three pass.

### 4.2 In-app invite

- [ ] Clyde signs in, opens any project's CrewPanel, clicks "+ Invite", enters throwaway alias as `crew` role
- [ ] Throwaway alias's inbox receives invite email
- [ ] Click invite link → claim it in a private window → sign in
- [ ] Throwaway alias sees only the invited project on `/projects`
- [ ] Throwaway alias can log a timecard, post a thread, create an action item

### 4.3 Cross-project denial (RLS)

- [ ] Throwaway alias navigates directly to a different project URL → empty / redirected (RLS denies, no data leak)
- [ ] Throwaway alias hits `/projects/<id>/budget` directly → redirected to project home (Budget is producer-tier only)
- [ ] Throwaway alias hits `/projects/<id>/timeline` and tries the Days tab → blocked

### 4.4 Producer flow back

- [ ] Tyler signs in, navigates to the project the throwaway alias was invited to
- [ ] Tyler sees throwaway alias in the crew list
- [ ] Tyler approves throwaway alias's timecard
- [ ] Throwaway alias on next load sees the approved status

### 4.5 Add role

- [ ] Clyde opens any crew member's detail in CrewPanel, clicks "+ Add role", picks a different role
- [ ] Crew member now appears twice in the crew list (once per role)

### 4.6 Cross-team isolation (forward-looking)

- [ ] Clyde creates a "Test Tester" team via Supabase dashboard, invites a fake email to it
- [ ] Fake user signs in → empty `/projects` list (no Origin Point visibility)
- [ ] Clyde signs in → still sees only Origin Point projects (no Test Tester visibility)

### 4.7 Session lifecycle

- [ ] Force-expire cookie (browser DevTools), navigate → redirected to `/login?redirect=<path>`
- [ ] Re-sign-in → returned to original URL
- [ ] Click sign out (`/projects` page) → cookie cleared, redirected to `/login`

### 4.8 ON DELETE SET NULL behavior

- [ ] In Supabase Studio, delete the throwaway alias's `auth.users` row
- [ ] Their `User` row remains in the public schema, FK `authId` is NULL
- [ ] Their authored content (timecards, threads, action items) is intact and attributable
- [ ] Re-invite the same email → binding handler restores `authId` → they're back in

---

## Phase 5 — Promote / cleanup

### 5.1 Update DECISIONS.md

- [ ] Mark "Auth — Supabase native" decision as **shipped** with date.
- [ ] Mark "Auth timing — after Phase 1A complete" as **complete**.
- [ ] Add a new entry: "Storage URL signing — signed URLs for project-scoped buckets at render time" (records the PR #5b signing pattern).

### 5.2 Update BUILD_STATUS.md

- [ ] Move Auth section (rows #23–#26) to "Done" with PR numbers.
- [ ] Drop Cleanup #3 ("Role toggle Producer ⇄ Crew on login page") — obsolete.
- [ ] Note `viewerIdentity.ts` deletion.

### 5.3 Note follow-ups

| Item | Notes |
|---|---|
| `auth-005c` — EntityAttachmentGallery signed-URL refactor | ~10 backgroundImage sites — small dedicated PR after Auth Day. |
| Demo cloning on team creation | `Project.is_demo` flag is in place. Cloning mechanism + new-team-creation flow ships when external tester #1 is onboarded. |
| Pending invites list / resend / revoke UI | Producer-side admin convenience. Post-dogfood. |
| Producer-tier in-app invite | Currently dashboard-only. Add when external producers self-serve. |
| Multi-role-collapsed UI (Flavor 2) | Currently each role appears as its own row. Defer until producers find duplicate listings annoying. |
| Account settings page | Password change, profile edit beyond Crew Profile v2. |
| 2FA / SSO / SAML | Not on roadmap. Add when a tester requires it. |

### 5.4 Dogfood

- [ ] Tyler + Kelly run a real production day end-to-end through Back to One under their real auth.
- [ ] Surface any friction; fix forward.

---

## Rollback stance

Once RLS is enabled across the schema, "rollback" requires a destructive migration. **Do not promote the RLS-enabled deploy to production until this runbook's smoke test passes on a Supabase branch.**

If a P0 issue surfaces post-promote: fix forward. The Supabase backup from Step 2.1 is the last-resort restore — only invoke if data corruption surfaces, not for behavior bugs.

---

## Anchor

What's in your mind should be what ends up in the world. Auth lands when it's right, not when the calendar says.
