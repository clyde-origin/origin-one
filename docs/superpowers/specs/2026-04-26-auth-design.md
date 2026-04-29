# Auth — Design Spec

**Date:** 2026-04-26
**Status:** Brainstormed and approved (awaiting implementation plan)
**Owner:** Clyde Bessey
**Builds on:** BUILD_STATUS rows #23–#26, DECISIONS Apr 2026 (Auth — Supabase native, Auth timing — after Phase 1A)

---

## Purpose

Wire Supabase Auth into Back to One so Clyde, Tyler, and Kelly sign in as themselves, invite real crew per-project, and the schema enforces who-sees-what at the database layer (not the UI layer). Lay the data-isolation foundation that will hold up when external testers eventually create their own teams. Partner-tier access is deferred but the schema doesn't paint us into a corner.

## North Star alignment

- **Reduces friction:** producers stop relying on a `localStorage` role toggle and a "first ProjectMember" placeholder; the app knows who's signed in.
- **Protects vision:** RLS at the table layer means the right people see the right thing regardless of UI bugs.
- **Brings the team toward unified workflow:** invite-by-email is how production crews already think.
- **Proven on a real production:** Auth ships when every other surface is honest. The dogfood smoke test is the gate.

## Scope

**In scope:**
- Supabase Auth wiring (`@supabase/ssr`, middleware, login/callback routes).
- `User.authId` column + invite-binding handler.
- Tenant model: `Team` as boundary, `TeamMember` for producer-tier, `ProjectMember` for per-project.
- RLS across every project-scoped and team-scoped table via two SQL helper functions.
- Storage tightening for all currently permissive buckets.
- In-app **crew invite** UI (one sheet, producer-only, project-scoped).
- Viewer-shim cutover (`useMeId`, `viewerIdentity.ts`, CrewPanel `useMemo`).
- Founding-team email rebind (one-time data migration).
- Vercel deploy with Supabase branch for preview testing.

**Out of scope (deferred to post-launch PRs):**
- Partner role and partner UI. Schema gets `'partner'` enum value (cheap), no policies or UI.
- Producer-tier in-app invite (TeamMember + new producer). Stays dashboard-only — rare action.
- Pending-invite list / resend / revoke UI.
- New-team creation UI (for external testers). Stays dashboard-only initially.
- **Demo-cloning on team creation** — schema flag `Project.is_demo` ships now (PR #1) and the 6 existing projects are marked `true`; the cloning mechanism + new-team-creation flow ships later as a cohesive feature when external tester #1 arrives.
- **Multi-role-collapsed UI** ("Sarah · DP, 1stAC" as one row instead of two) — V2. Schema is ready; V1 ships row-per-role (matching existing Clyde-as-director-and-producer seed pattern).
- Cross-team UI affordance (Tyler hired as crew on Sarah's project works at the data layer; no in-app UI for this case).
- Department-level permissions (DP edits Shotlist, Editor edits Workflow) — V3+ if real productions surface specific need. The `canEdit` flag covers most of what departmental rules would.
- Account settings page beyond Crew Profile v2.
- 2FA / SSO / SAML.
- Audit log of invites.
- Bulk invite / CSV import.

**V1 permission model (locked 2026-04-27):**

- **Two permission tiers, derived from existing `Role` enum:**
  - **Producer-tier** = `Role IN ('producer', 'director')` AND/OR has a `TeamMember` row.
  - **Crew-tier** = everyone else with a `ProjectMember` row on the project.
- The 6-value `Role` enum stays as-is — it's job-title display, not permission gating. Permissions are derived via `has_producer_access()` SQL helper.
- **`ProjectMember.canEdit` flag** — producer flips this `true` for trusted crew members who should be able to edit high-trust surfaces (Workflow, Shotlist edits, Milestones, Scenes/Entities/Locations/Props/Wardrobe/Casting, etc.). Defaults `false` for crew, `true` for producer/director rows.
- **Three write tiers per table:**
  - **Producer-only writes** (`has_producer_access`): Project meta, Workflow, Milestone, Deliverable, ProjectMember add/remove, Budget*, Schedule.
  - **High-trust writes** (`has_high_trust_write` = producer-tier OR `canEdit`): Scene, Entity, Location, ShootDay, ShotlistVersion, PropSourced, WardrobeSourced, InventoryItem, Talent, MoodboardTab.
  - **Operational writes** (`is_project_member`): Thread, ChatChannel, ChatMessage, ActionItem, Document, Folder, MoodboardRef, EntityAttachment, own CrewTimecard, own ProjectMember soft fields.
- **Crew never sees:**
  - Other crew's timecards (`CrewTimecard` SELECT = producer-tier OR own row only).
  - Budget at all (`Budget*` SELECT = producer-tier only). UI also hides Budget surfaces from crew.
- **Multi-role per project: data-layer ready, V1 UI exposes via add-role button.** The composite unique constraint `ProjectMember(projectId, userId, role)` already supports it; one ProjectMember row per role. Producer can click "+ Add role" on a crew detail to create a sibling row. The same user appears once per role in the crew list (Flavor 1).

## Tenant model

**Team is the tenant boundary.** Every `Project` belongs to exactly one Team. Two testers' projects can't see each other because they're on different Teams.

Two distinct memberships, deliberately:

- **`TeamMember`** — "you have team-level access." See all team projects, create new projects, invite people. Producers only.
- **`ProjectMember`** — "you're on this specific project." Independent of `TeamMember`. Crew gets this and only this.

| Role | TeamMember? | ProjectMember? | Sees |
|---|---|---|---|
| Producer (Clyde / Tyler / Kelly on Origin Point) | ✅ on Origin Point | ✅ on every project | All 6 projects + ability to create more |
| Crew on one Origin Point project | ❌ | ✅ on that project only | That one project |
| External producer (future tester Sarah) | ✅ on her own team | ✅ on her projects | Only her team's projects |
| Tyler hired as crew on Sarah's project | ❌ on Sarah's team | ✅ on Sarah's project | Sarah's project + Origin Point (via Origin Point membership) |
| Partner (later) | ❌ | scoped read-only on a project | Subset of one project |

**Implication for the seed:** the current seed makes *every* user a `TeamMember` of Origin Point. That's wrong for the post-Auth model. Fictional crew become `ProjectMember`-only. Founding three (Clyde, Tyler, Kelly) keep `TeamMember` rows.

**Implication for invite flow:** when a producer invites someone, the invite specifies a target project. Invitee at crew tier gets a `ProjectMember` row only. Invitee at producer tier (rare, dashboard-driven) also gets a `TeamMember` row.

## Architecture overview

Five pieces, layered on existing patterns rather than rewriting them.

### 1. `@supabase/ssr` integration in `apps/back-to-one`

- New `middleware.ts` at app root refreshes the session cookie on every request via the standard `@supabase/ssr` pattern.
- Server components read session via `createServerClient`.
- Client components / hooks read session via `createBrowserClient`.
- Both helpers live in `apps/back-to-one/src/lib/auth/` (new directory).

### 2. `User.authId` column

- Nullable `UUID` with `UNIQUE` constraint.
- FK to `auth.users(id)` with `ON DELETE SET NULL`.
- No backfill — the founding-team rebind step populates Clyde / Tyler / Kelly; everyone else is filled in on first claimed sign-in.
- The `ON DELETE SET NULL` is deliberate: deleting an `auth.users` row preserves their `User` row, their timecards, their authored threads — they become un-claimable until re-invited.

### 3. RLS via SQL helper functions

Two helpers do all the work:

```sql
CREATE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM "TeamMember" tm
    JOIN "User" u ON u.id = tm."userId"
    WHERE tm."teamId" = p_team_id AND u."authId" = p_user_id
  )
$$;

CREATE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    JOIN "User" u ON u.id = pm."userId"
    WHERE pm."projectId" = p_project_id AND u."authId" = p_user_id
  )
$$;
```

Every project-scoped policy calls one or both, passing `auth.uid()` as `p_user_id`.

### 4. Login + invite-binding handler

- `/login` with email/password and magic-link options.
- `/auth/callback` runs the binding handler (see Invite Flow section).
- Service-role-backed server action handles the bind because at first sign-in there's no `authId` for RLS to gate against.

### 5. Viewer-shim cutover

Single-spot mutations to `useMeId()` and a replacement of `viewerIdentity.ts` — see the Viewer-shim section.

## Role / RLS map

Every table falls into one of five RLS shapes.

### Shape 1 — Team-scoped (producer-tier)
**Tables:** `Team`, `TeamMember`.
- **SELECT:** `is_team_member(id, auth.uid())`.
- **INSERT/UPDATE/DELETE:** producer-role check on `TeamMember` row of the calling user.

### Shape 2 — Project-scoped, dual-gate read
**Tables:** `Project`, `ProjectMember`, `Scene`, `Shot`, `Entity`, `Location`, `Thread`, `ThreadMessage`, `ThreadRead`, `ChatChannel`, `ChatMessage`, `ActionItem`, `Milestone`, `Document`, `Folder`, `Resource`, `MoodboardTab`, `MoodboardRef`, `Talent`, `WorkflowNode`, `WorkflowEdge`, `Deliverable`, `ShootDay`, future `PropSourced` / `WardrobeSourced` / `InventoryItem`.
- **SELECT:** `is_team_member(project.teamId, uid) OR is_project_member(project.id, uid)`. Producers read everything in their team's projects; crew read only the projects they're directly on.
- **INSERT/UPDATE/DELETE:** `is_project_member` plus a producer-role check on the writes that are producer-only (Project meta, Workflow nodes, Milestones, Deliverables, ProjectMember add/remove, Department-tier fields). The "producer-role check" means the calling user has either `is_team_member(project.teamId, uid)` (team-tier write access — only producers have TeamMember rows post-cleanup) OR a `ProjectMember` row on this project with `role IN ('producer', 'director')`. Crew creates ActionItems, ThreadMessages, ChatMessages on projects they're a member of.

### Shape 3 — Self + visible-collaborator read (`User`)
- **SELECT:** own row full read; rows of users who share a `Team` or any `Project` with you, basic-fields-only read (name, avatarUrl, role display). Single SELECT policy: `auth.uid() = authId OR EXISTS (...)`.
- **UPDATE:** own row only, on user-editable fields (name, phone, avatarUrl). `email`, `authId` are locked.
- **INSERT:** none through the app — `User` rows created only by the invite-binding handler running as service-role.
- **DELETE:** none through the app.

### Shape 4 — Per-row authoring (own writes)
**Tables:** `CrewTimecard`, `ProjectMember.notes` / `ProjectMember.skills`.
- **SELECT:** as Shape 2 (project-scoped read).
- **INSERT/UPDATE:** `userId` resolves to the calling user via `User.authId = auth.uid()` AND `is_project_member`. Producer can also INSERT/UPDATE on a crew member's timecard (approve/reopen). Crew cannot edit submitted/approved timecards (already enforced at the application layer; RLS adds belt to suspenders).

### Shape 5 — Auth schema bridge
- `auth.users` is Supabase-managed; we don't write policies there.
- `User ↔ auth.users` linked via `User.authId`.
- The invite-binding handler runs as service-role server-side once per first sign-in, sets `User.authId`. After that, `auth.uid()` lookups all resolve through that column.

## Storage audit baseline (current state)

As of 2026-04-26, audit results:

| Bucket | `public` | Read | Write | Objects | Status |
|---|---|---|---|---|---|
| `moodboard` | true | anon SELECT | anon INSERT/UPDATE | 6 | Open by design until Auth Day. |
| `storyboard` | true | anon SELECT | anon INSERT/UPDATE | 0 | Open by design until Auth Day. |
| `entity-attachments` | true | anon SELECT | anon INSERT/UPDATE/DELETE | 0 | Open by design (matches moodboard pattern). Worst-case: anon DELETE. |
| `avatars` | true | anon (presumed) | anon (presumed) | 0 | Added 2026-04-27 via migration `20260427020000_add_avatars_bucket`. Open by design until Auth Day per its own DECISIONS entry. |
| `project-moodboards` | true | anon (default) | anon (default) | 18 | Orphan — superseded by `moodboard`. Has reference imagery (FCA, FS, IVV, NO, SSP, TW shortcodes). |
| `project-locations` | true | anon (default) | anon (default) | 12 | Orphan — superseded by future `locations`. Has location ref imagery (same project shortcodes). |
| `receipts` | false | authenticated | authenticated | 0 | Already correct shape — template for the others. |

**Action items recorded for the implementation plan:**
1. **Optional, before Auth Day:** tighten `entity-attachments` DELETE to authenticated-only (one-policy migration, closes worst hole, doesn't break documented app flow).
2. **Auth Day storage-policies migration** (PR `auth-005-storage-policies`):
   - `moodboard`, `storyboard`, `entity-attachments`, `avatars`: replace anon CRUD with appropriately-gated CRUD. Bucket-level `public:true` → `false` for project-scoped buckets; `avatars` may stay public-readable for display purposes (decide at PR #5 — display avatars on producer/crew lists, etc., is much easier with public-readable URLs; write/delete still locked to the user themselves).
   - The `avatars` bucket landed 2026-04-27 with permissive RLS, against the original "new buckets ship with auth-check from day one" rule. Audit on Auth Day to bring it into line with the rest of the buckets.
3. **Orphan bucket disposition (separate from Auth, no schedule):**
   - Eyeball the 18 + 12 objects in `project-moodboards` / `project-locations`.
   - Either migrate the imagery into `moodboard` / future `locations`, or confirm-and-drop. Don't drop blind.

## Invite flow

Two flows, both routed through the same server-side binding handler.

### Flow A — Founding team rebind (one-time, three users)

1. **Pre-Auth data migration** (PR `auth-002`) overwrites the seeded `originpoint.com` emails on Clyde / Tyler / Kelly's `User` rows with their real email addresses. Real emails captured at run-time via env vars; not committed in source. Migration validates the target real emails do not already exist in `User` (conflict guard).
2. Producer (Clyde) sends invite from Supabase dashboard → Authentication → Invite User. Real email, magic-link mode (password optional, settable later from account settings).
3. Recipient clicks link, lands on `/auth/callback`, gets authenticated.
4. Binding handler runs server-side on the next authenticated request:
   - Reads `auth.uid()` and `auth.users.email`.
   - Finds the unique `User` row WHERE `email = session.email AND authId IS NULL`.
   - Sets `User.authId = auth.uid()`. Idempotent — re-run is a no-op.
5. Subsequent sign-ins skip the binding step.

### Flow B — New crew invite (post-launch, ongoing)

1. Producer triggers in-app invite (see In-app Invite UI section) OR sends from Supabase dashboard with app metadata: `{ "name": "Sarah Chen", "projectId": "<uuid>", "role": "crew", "department": "Camera" }`.
2. Recipient clicks link, gets authenticated.
3. Binding handler runs:
   - No `User` row matches the email.
   - Reads `app_metadata` from `auth.users.raw_app_meta_data`.
   - Creates new `User` row (name, email, authId) + new `ProjectMember` row (projectId, userId, role, department) atomically.
   - If invitee is producer-tier (`role: 'producer'`): also creates `TeamMember` row.
4. Subsequent sign-ins skip the binding step.

### Binding handler edge cases

| Condition | Result |
|---|---|
| Email matches a `User` row that already has a different `authId` | `/auth/error?code=conflict` — "account conflict, contact a producer" |
| Email doesn't match AND no app metadata | `/auth/error?code=incomplete-invite` — "your invite is incomplete, contact a producer" |
| Multiple `User` rows match (shouldn't happen — defensive) | `/auth/error?code=conflict` |
| Email matches and `authId` already equals `auth.uid()` | No-op, success |

### Handler implementation

- Lives in `apps/back-to-one/src/app/auth/callback/route.ts`.
- Uses Supabase **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`, server-only env var) to write `User.authId` — bypasses RLS, since at first sign-in there's no `authId` yet for RLS to gate against.
- Service-role key never reaches the client.

### `/login` route

- Email + password form (primary).
- "Email me a sign-in link" button (magic link, secondary).
- "Forgot password?" link (Supabase password reset flow).
- No "create account" link. Invite-only is enforced by the handler.

## In-app crew invite UI

**Scope:** producer-only sheet, scoped to a single project, accessible from the Crew page or Project settings.

**Form fields:** name, email, role (defaulted to 'crew'), department.

**Server action:**
1. Verifies caller is a producer on the target project's team (auth check).
2. Calls `supabase.auth.admin.inviteUserByEmail(email, { data: { name, projectId, role, department } })` server-side with the service-role key.
3. Returns success ("invite sent to sarah@…") or specific error (email already invited, email already in use elsewhere, not authorized).

**Errors surfaced as toasts:**
- "Email already has an account — they need to be added as a member, not invited" (future feature: "add existing user to project" — out of scope here).
- "You're not a producer on this project."
- "Invite failed — try again or send from the Supabase dashboard."

## Viewer-shim cutover

Three points of code change, one delete.

1. **`useMeId()`** (`apps/back-to-one/src/lib/hooks/useOriginOne.ts:395`) — body changes from "first ProjectMember row" → reads session via a new `useSupabaseSession()` client hook, then `User.authId === session.user.id` lookup → returns `User.id`. Hook signature unchanged. Every consumer picks up the real id automatically.

2. **`viewerIdentity.ts`** — replaced by `useViewerRole(projectId?)`:
   - With `projectId`: returns the user's `ProjectMember.role` for that project.
   - Without `projectId` (root context): returns `'producer'` if the user has any `TeamMember` row with producer role, else `'crew'`.
   - The `origin_one_user_role` localStorage key is cleared on first authenticated session — no migration of stored values; they were dev-only.

3. **CrewPanel `useMemo` viewer shim** — becomes a one-liner: `const viewer = { id: meId, role: viewerRole }` from the hooks above.

**Deletes on Auth Day:**
- BUILD_STATUS Cleanup #3 ("Role toggle Producer ⇄ Crew on login page") — obsolete; drop from cleanup bundle.
- `VIEWER_ROLE_KEY` localStorage key — cleared on first authenticated session.
- Any "click here to switch role" UI affordance.

## Error states

| State | Trigger | UI |
|---|---|---|
| Unauthed user hits a project route | Middleware detects no session | Redirect to `/login?redirect=<original-path>` |
| Authed user with no `User.authId` binding | Server detects, runs binding handler | Transparent — handler completes mid-request, page renders |
| Authed user, binding handler errored | No email match, no metadata | `/auth/error?code=<code>` page |
| Authed user, no project memberships | App detects empty list | `/projects` shows "no projects yet — ask a producer to add you" |
| Producer invites to a project they're not on | Server action 403 | Toast: "you're not a producer on this project" |
| Producer invites an email already bound elsewhere | Supabase admin API conflict | Toast: "that email already has an account — they need to be added as a member" |
| Session expires mid-session | Middleware refresh fails | Redirect to `/login?redirect=<current-path>` with toast |
| Sign out | Click sign out | Cookie cleared, redirect to `/login` |
| `auth.users` row deleted out-of-band | `User.authId` set NULL via `ON DELETE SET NULL` | User row + authored content preserved; un-claimable until re-invited |

## Routes

- `/login` — sign in.
- `/auth/callback` — OAuth/magic-link exchange + binding handler + redirect.
- `/auth/setup-password` — for users who used magic link initially and want a password.
- `/auth/error?code=<code>` — handler error surface.

`middleware.ts` (root of `apps/back-to-one`):
- Refreshes session via `@supabase/ssr` standard pattern.
- Public routes: `/login`, `/auth/*`. Everything else protected.

## PR sequence

Each is a complete arc: schema PR → seed update if needed → all-three-apps compile (`pnpm -w build`) → merge.

| # | PR | Type | Notes |
|---|---|---|---|
| 1 | `auth-001-add-user-authid` | Schema | `User.authId UUID UNIQUE NULLABLE` FK to `auth.users(id) ON DELETE SET NULL`. Adds `'partner'` to `Role` enum (no behavior change). No backfill. |
| 2 | `auth-002-rebind-founding-emails` | Data | Updates 3 `User.email` rows to real values. SQL committed; values supplied via env at apply time. Conflict guard. |
| 3 | `auth-003-tenant-cleanup` | Data | Drops every `TeamMember` row whose user does NOT have `ProjectMember.role = 'producer'` on at least one project in the team. For Origin Point this leaves exactly three rows: Clyde, Tyler, Kelly (note Clyde's TeamMember stays because he's a producer on every project, regardless of his TeamMember row's enum value). Updates seed for parity. Documents the post-Auth tenant model. |
| 4 | `auth-004-rls-helpers-and-policies` | Schema | Adds `is_team_member` and `is_project_member` SQL functions. Enables RLS on every table from the role/RLS map. Applies all policies in one migration. |
| 5 | `auth-005-storage-policies` | Schema | Tightens `moodboard`, `storyboard`, `entity-attachments`. `bucket.public` → `false`. Adds policies for any buckets shipped between now and Auth Day. |
| 6 | `auth-006-app-wiring` | UI | `@supabase/ssr` integration, `middleware.ts`, `/login`, `/auth/callback`, `/auth/setup-password`, `/auth/error`, viewer-shim swap (`useMeId`, `viewerIdentity` → `useViewerRole`, CrewPanel shim). |
| 6a | `auth-006a-in-app-crew-invite` | UI | Crew invite sheet, server action, producer-only enforcement. |
| 7 | `auth-007-vercel-env-and-smoke-test` | Deploy | `SUPABASE_SERVICE_ROLE_KEY` env var. Supabase Auth settings (site URL, redirects, email templates). Vercel preview against Supabase branch. Smoke test orchestrated. Promote to production only after pass. |

## Testing & rollout

The codebase has no automated test framework. Verification is human, on a Vercel preview against a Supabase branch.

### Pre-merge testing (per PR)

- Schema PRs (#1, #4, #5): `pnpm -w build` across all three apps + `prisma migrate deploy` + verify RLS doesn't break paths that should still work.
- App-wiring PR (#6): Vercel preview, Clyde signs in with real email (Flow A), navigates every surface, signs out and back in.
- In-app invite PR (#6a): Clyde invites a throwaway crew alias, claims it in a private window, confirms scope.

### Auth Day smoke test (orchestrated, before production promote)

| Test | Who | Pass criteria |
|---|---|---|
| Founding rebind — Clyde | Clyde | `useMeId` returns Clyde's `User.id`, all 6 projects visible |
| Founding rebind — Tyler | Tyler | Independent session, all 6 projects visible |
| Founding rebind — Kelly | Kelly | Independent session, all 6 projects visible |
| In-app crew invite | Clyde invites throwaway alias | Invitee's `/projects` list contains exactly 1 project |
| Cross-project denial | Crew alias hits foreign project URL | Empty / RLS denies, no data leak |
| Producer-only surface | Crew alias hits `/projects/[id]/schedule` | Blocked, no producer data rendered |
| Crew write paths | Crew alias logs timecard, posts thread, creates action item | Each write succeeds on their project |
| Producer approve flow | Tyler approves crew alias's timecard | State transition succeeds and visible to crew |
| Cross-team isolation | Clyde creates "Test Tester" team, invites fake email | Fake user sees zero Origin Point projects |
| Session expiry | Force-expire cookie, navigate | Redirected to `/login`, returns to original after re-login |
| Sign out | Click sign out | Cookie cleared, re-auth required |
| `ON DELETE SET NULL` | Delete crew alias from dashboard | `User` row + content preserved; re-invite restores access |

### Rollback stance

Once RLS is enabled across the schema, "rollback" requires a destructive migration. **Don't promote until preview passes.** Fix-forward only after promote. The Vercel preview env runs against a Supabase branch (cloned from production), so smoke tests don't pollute production data.

### Vercel + Supabase config (PR #7)

- New env var: `SUPABASE_SERVICE_ROLE_KEY` (server-only, production env, not shared with preview).
- Supabase Auth settings: site URL, allowed redirect URLs, minimal email template customization (sender "Origin Point", subject "You're invited to {{ project_name }}").
- Preview env uses a Supabase branch.

## Open questions / future work

These are **not** blockers for the Auth PRs but should be tracked.

- **Orphan bucket cleanup** (`project-moodboards`, `project-locations`): eyeball contents, decide migrate-vs-drop. Separate, low-priority.
- **Pending invite list / resend / revoke UI**: post-dogfood, when a real invite hangs in limbo and producers want visibility.
- **Producer-tier in-app invite**: useful when external testers need new producers added by their own team. Stays dashboard for now.
- **Cross-team UI**: when Tyler is hired as crew on Sarah's project, the data layer handles it; UI for project-list ordering / labeling across teams is open.
- **Account settings page**: password change, email change, delete account.
- **Audit log**: who invited whom, who promoted whom.
- **Partner UI**: when a real production wants to give a client / partner read-only access to specific deliverables.

## Anchor

Auth lands when it's right, not when the calendar says. Each PR in the sequence is a complete arc; main stays green. Dogfood runs the day every surface honors the new identity model.

What's in your mind should be what ends up in the world.

---

# Appendix A — Pre-flight investigation findings

Read-only audit conducted 2026-04-26 / 2026-04-27. File:line references valid as of these commits. Findings inform the implementation plan PR breakdown.

## A1. Existing auth scaffolding (good news)

`packages/auth/src/index.ts` already exports:
- `createBrowserAuthClient()` — uses `@supabase/ssr` `createBrowserClient`
- `createServerAuthClient(cookies)` — uses `@supabase/ssr` `createServerClient`
- Type stubs: `AuthUser`, `Session`

`apps/back-to-one/package.json` already has:
- `@supabase/ssr ^0.3.0`
- `@supabase/supabase-js ^2.43.1`

**Implication for PR #6 (`auth-006-app-wiring`):** the dependency layer is in place. PR #6 adds:
- `apps/back-to-one/middleware.ts` (does not exist).
- `apps/back-to-one/src/lib/auth/` — a new directory wrapping the package helpers with app-specific concerns (session lookup, role helpers).
- `/login`, `/auth/callback`, `/auth/setup-password`, `/auth/error` route components.
- `useSupabaseSession()` and `useViewerRole(projectId?)` hooks.

**Note on existing query path:** `apps/back-to-one/src/lib/db/queries.ts` already uses `createBrowserAuthClient` (aliased as `createClient`). Once a session exists, those queries will automatically attach the auth context — no per-call refactor needed. This means RLS gating starts working the moment migrations land, even without UI changes.

## A2. Viewer-shim consumer inventory

Every consumer of `useMeId` / `readStoredViewerRole` / `setStoredViewerRole`:

**`useMeId()` consumers (8 sites, all read-only — body swap is the only code change):**
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts:395` — definition
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts:401` — `useThreads`
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts:454` — `useAllThreads`
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts:921` — additional consumer
- `apps/back-to-one/src/lib/hooks/useOriginOne.ts:929` — additional consumer
- `apps/back-to-one/src/app/projects/[projectId]/resources/page.tsx:126`
- `apps/back-to-one/src/app/projects/[projectId]/threads/page.tsx:439`
- `apps/back-to-one/src/components/attachments/EntityAttachmentGallery.tsx:42`
- `apps/back-to-one/src/components/projects/ResourcesSheet.tsx:234`
- `apps/back-to-one/src/components/threads/useDetailSheetThreads.tsx:44`

**`readStoredViewerRole()` consumers (4 sites, swap to `useViewerRole(projectId)`):**
- `apps/back-to-one/src/app/page.tsx:9,45` — root page
- `apps/back-to-one/src/app/projects/[projectId]/schedule/page.tsx:15,321` — Schedule page (producer-gated)
- `apps/back-to-one/src/components/hub/CrewPanel.tsx:17,1422` — CrewPanel (producer-gated Producer Overview)
- `apps/back-to-one/src/components/hub/HubContent.tsx:15,633` — HubContent (producer-tier surfaces)

**`viewerIdentity.ts`** (5 export sites in this file) → file replaced by a small hook module. The localStorage key `origin_one_user_role` is cleared on first authenticated session.

**Total surface area: ~12 files touched in the cutover.** Manageable.

## A3. RLS table coverage — additions and chain rules

The original spec listed Shape 2 tables but missed several. Complete list with chain rules:

### Tables with direct `projectId` column (Shape 2 standard policy)
`Project`, `ProjectMember`, `Scene`, `Entity`, `Location`, `Thread`, `ChatChannel`, `ChatMessage`, `CrewTimecard`, `ActionItem`, `Milestone`, `Document`, `Folder`, `MoodboardTab`, `MoodboardRef`, `Talent`, `WorkflowNode`, `WorkflowEdge`, `Deliverable`, `ShootDay`, `ShotlistVersion`, `EntityAttachment`, `PropSourced`, `WardrobeSourced`, `InventoryItem`, `Budget` (`projectId @unique`).

### Tables that chain via a sibling table (need EXISTS subquery in policy)
- **`Shot`** → `sceneId` → `Scene.projectId`
  ```
  EXISTS (SELECT 1 FROM "Scene" s WHERE s.id = "Shot"."sceneId" AND (is_team_member(s."projectId"...) OR is_project_member(s."projectId"...)))
  ```
- **`ThreadMessage`** → `threadId` → `Thread.projectId`
- **`ThreadRead`** → `threadId` → `Thread.projectId` (additionally `userId` for ownership)
- **`MilestonePerson`** → `milestoneId` → `Milestone.projectId`
- **`TalentAssignment`** → `talentId` → `Talent.projectId` (or `entityId` → `Entity.projectId`; pick one chain)
- **`BudgetVersion`, `BudgetAccount`, `BudgetLine`, `BudgetVariable`, `BudgetMarkup`, `Expense`** → `budgetId` → `Budget.projectId`
- **`BudgetLineAmount`** → `lineId` → `BudgetLine.budgetId` → `Budget.projectId` (two-hop chain)

### Tables with nullable `projectId` (special case)
- **`Resource`** — has `projectId String?`. Per BUILD_STATUS, nullable supports cross-project resources.
  - Policy: `IF projectId IS NULL THEN is_team_member(<resource owner team>, uid) ELSE Shape 2 standard`. Need to confirm: does a global Resource have a team scope? Currently no `teamId` column. Likely fix: add `teamId` to Resource (cross-project resources are scoped to a team). Defer to its own PR if that's a schema change too big for the Auth bundle.

### Per-user state tables (Shape 4 variant)
- **`UserProjectFolder`** — `userId`-scoped only. Policy: `userId = (SELECT id FROM "User" WHERE authId = auth.uid())`.
- **`UserProjectPlacement`** — same as above; additional check that the placed `projectId` is one the user can see.
- **`User.UserProjectFolder` join**: producer can see other producers' folders? Probably not — these are personal organization. Self-only.

### Out of Auth Day scope (deferred RLS)
- **`auth.users`** — Supabase-managed.
- **All Budget* tables** — currently `projectId` chain is correct, but Budget feature may still be in flight per recent BUILD_STATUS additions. Confirm before applying RLS migration. If Budget is post-Auth, exclude from `auth-004` and add later.

**Action:** PR #4 (`auth-004-rls-helpers-and-policies`) needs to enumerate every model in `schema.prisma` against this list to make sure nothing is missed. Adding RLS to a missed table later is a forgotten-table-leak risk.

## A4. HubContent `ProjectMember.id` vs `User.id` mismatch — confirmed

**Status:** Live latent bug, surfaces post-Auth.

**Locations:**
- `apps/back-to-one/src/components/hub/HubContent.tsx:491` — inside `AIDetailSheet`:
  ```ts
  const assignee = crew.find(c => c.id === item.assignedTo)
  ```
- `apps/back-to-one/src/components/hub/HubContent.tsx:878` — inside hub preview tasks:
  ```ts
  const assigneeMember = item.assignedTo ? allCrew.find(c => c.id === item.assignedTo) : null
  ```

**Schema:**
- `ActionItem.assignedTo` is `String?` FK to `User.id`.
- `crew` / `allCrew` are `ProjectMember` rows from `useAllCrew()` — `c.id` is `ProjectMember.id`.

**Result today:** the `find` returns `undefined`, falling back to no display. Not a crash, just silently wrong.

**Fix (one-liner each):**
```ts
const assignee = crew.find(c => c.userId === item.assignedTo)
const assigneeMember = item.assignedTo ? allCrew.find(c => c.userId === item.assignedTo) : null
```

**Recommendation:** roll this fix into PR #6 (`auth-006-app-wiring`) — it lives in the same file as the viewer-shim swap, and the fix is two lines.

## A5. Server actions / API routes — currently zero

`apps/back-to-one/src` has no `route.ts`, no `actions.ts`, no `'use server'` directives. **All data flow today goes through the browser auth client in `queries.ts`.**

**Implication:** the binding handler at `/auth/callback` will be the **first** server route in the app. PR #6 introduces the route file, the cookies pattern (via `createServerAuthClient(cookies)` from `packages/auth`), and the service-role client for the bind operation.

**Implication for in-app crew invite (PR #6a):** the `auth.admin.inviteUserByEmail()` call must run server-side (service-role key cannot leak to client). PR #6a introduces the second server route (or server action). This is the shape that future "remove crew member" / "transfer ownership" flows will adopt.

## A6. Storage path conventions — RLS readiness check

| Bucket | Path pattern | RLS-extractable scope? |
|---|---|---|
| `moodboard` | `${projectId}/${ts}-${rand}.${ext}` | ✅ projectId — `(storage.foldername(name))[1]` |
| `storyboard` | `${projectId}/${shotId}.${ext}` | ✅ projectId — same pattern |
| `entity-attachments` | `${attachedToType}/${attachedToId}/${rand}.${ext}` | ❌ **no projectId in path** |
| `avatars` | `${userId}/${rand}.${ext}` | ✅ userId — owner-write/owner-delete via `(storage.foldername(name))[1] = (User.id where authId = auth.uid())` |
| `receipts` | (current pattern unknown — bucket empty) | TBD when used |

**Action for `entity-attachments`:** two options for RLS:
- **Option A (recommended):** Change upload path to `${projectId}/${attachedToType}/${attachedToId}/${rand}.${ext}` in `uploadEntityAttachment` (`queries.ts:107`). Bucket has 0 objects today, so no migration pain. RLS extracts projectId from path. Update happens in PR #5 (`auth-005-storage-policies`) alongside the bucket policy change. The `EntityAttachment.storagePath` column persists the new format.
- **Option B (fallback):** Storage RLS uses a join via the EntityAttachment table:
  ```sql
  EXISTS (SELECT 1 FROM "EntityAttachment" ea
          WHERE ea."storagePath" = storage.objects.name
          AND is_project_member(ea."projectId", auth.uid()))
  ```
  Works without code changes but is more expensive per storage check.

**Recommendation: Option A.** Cleaner, faster, and the EntityAttachment row's `storagePath` migrates trivially (it's 0 rows today).

## A7. EntityAttachment.uploadedById nullable — flip post-Auth

`EntityAttachment.uploadedById` is currently `String?` with comment: *"FK to User.id; nullable until Auth ships (DECISIONS Apr 26 2026)."*

**Action:** PR #1 (`auth-001-add-user-authid`) or PR #6 should also change `EntityAttachment.uploadedById` to `String NOT NULL` after backfilling existing rows (which is just 0 today). Application code already passes `uploadedById` from the calling context — once `useMeId()` returns real values, this is always populated.

## A8. Seed-time auth assumptions — no breaking changes needed

The seed (`packages/db/prisma/seed.ts`) creates `User` rows without setting `authId`. Adding `authId` as `nullable UNIQUE` doesn't break the seed. The seed continues to work as-is.

PR #3 (`auth-003-tenant-cleanup`) updates the seed to drop non-producer `TeamMember` rows for parity with the data migration. Single-pass change at the `teamMember.upsert` call site (`seed.ts:404`).

## A9. Cleanup / housekeeping items surfaced

- **`DECISIONS Apr 26 2026: EntityAttachment storage — v1 unsigned public URLs, RLS deferred`** — this DECISION should be updated/superseded by the Auth design when PR #5 lands.
- **`apps/back-to-one/src/lib/db/queries.ts:916` comment** — *"Pre-Auth: meId comes from useMeId()'s placeholder"* — comment can be deleted in PR #6.
- **`apps/back-to-one/CLAUDE.md`** Storage section currently lists `entity-attachments` as not present; update on Auth Day to reflect new RLS shape and projectId-in-path convention.

## A10. Open questions surfaced (not blockers, flag for plan)

1. **Resource cross-project scoping** — does a `Resource` with `projectId IS NULL` belong to a Team? If so, schema needs `teamId` on Resource. If not, what's the access rule? Decide before PR #4.
2. **Budget feature status at Auth Day** — if Budget is still in flight, exclude its tables from `auth-004` policies and add them in a follow-up. If complete, include.
3. **Producer-set password vs magic-link-first for the founding three** — design says magic-link-first, but Clyde may prefer immediate password setting for muscle-memory. Decide at invite time, no spec change needed.
4. **`Role` enum addition for `partner`** — does the Prisma schema expose an upgrade path that doesn't require a follow-up generate? Confirm with `pnpm --filter @origin-one/db exec prisma generate` after PR #1 schema change. Standard practice in this codebase.

