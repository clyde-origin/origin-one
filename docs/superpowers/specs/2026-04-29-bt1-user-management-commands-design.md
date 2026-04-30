# Back to One — User Management Slash Commands

Date: 2026-04-29
Status: Approved (awaiting plan)

## Problem

Adding a Supabase auth user for the dogfood team is currently a manual,
multi-step process: create an `auth.users` row in the dashboard, hope the
seed `public."User"` row matches by email, and trust `bindAuthUser` to
glue them on first sign-in. New-team setup is worse — no UI for `Team`
or `Project` creation outside seed scripts.

The friction surfaced when Tyler (`tyler@originpoint.io`) couldn't log in
post-Auth: the dashboard password didn't match what he was given, and
recovery emails hit the Supabase rate limit (`over_email_send_rate_limit`)
before he could reset.

## Goal

Two Claude Code slash commands that let Clyde add people without leaving
the editor, without sending emails, and without manually editing rows
across `auth.users`, `User`, `ProjectMember`, and `TeamMember`.

## Non-goals

- No admin UI inside Back to One (deferred — separate future work).
- No Supabase invite/recovery email path (rate-limit prone; bypass entirely).
- No CLI script (`pnpm add-user`) — slash command only for v1.
- No automatic password rotation or "must change on first login" enforcement.
- No team-management beyond initial creation (rename, archive, etc.).

## Surface

### `/bt1-add-user` — add a person to an existing project

Prompts (one at a time, default-friendly):

1. Email (required)
2. Name (skipped if a `public."User"` row already exists matching this email)
3. Project — list all projects (`id`, `name`, `team.name`); user picks by index or types name
4. Role — one of `producer | director | coordinator | writer | crew`
5. Department — asked only when role = `crew` (free text; e.g. Camera, Art, Sound)
6. Password — defaults to `origin` on empty input

Behavior:

- Look up `public."User"` by email.
  - **Match with non-null `authId`:** abort. Print "<email> is already linked
    to auth user <authId>. Run a password reset instead:" and emit a copy-paste
    SQL one-liner using `crypt('<pw>', gen_salt('bf'))`.
  - **Match with null `authId`** (Flow A — pre-seeded user like Tyler/Kelly):
    create `auth.users`, set `User.authId`, insert `ProjectMember` if not
    already a member of the chosen project, insert `TeamMember` if role is
    producer/director and not already on the team.
  - **No match** (Flow B — net-new person): create `auth.users`, insert
    `User` with `authId`, insert `ProjectMember`, insert `TeamMember` if
    producer/director.
- `email_confirmed_at = now()`, `raw_user_meta_data = {"email_verified": true}`.
- `canEdit = true` for producer/director; `false` otherwise. (Matches the
  heuristic in `apps/back-to-one/src/lib/auth/binding.ts:92`.)
- Prints final summary including login creds.

### `/bt1-new-team` — brand-new team + first project + first producer

Prompts:

1. Team name (required)
2. First project name (required)
3. Project status (default `development`; one of the `ProjectStatus` enum values)
4. Client (optional, free text)
5. Producer email (required)
6. Producer name (required)
7. Password (default `origin`)

Behavior:

- Insert `Team`.
- Insert `Project` with `teamId`, `name`, `status`, optional `client`,
  `color = null`, `is_demo = false`.
- Create `auth.users` for the producer (same pattern as `bt1-add-user`).
- Insert `User` with `authId` set.
- Insert `ProjectMember` (role=producer, canEdit=true).
- Insert `TeamMember` (role=producer).
- Prints summary: team id + name, project id + name, login creds.

## Shared mechanics

### Auth user creation

Both commands create `auth.users` with the same pattern used to fix Tyler:

```sql
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  instance_id, aud, role,
  created_at, updated_at
) values (
  gen_random_uuid(), $email, crypt($password, gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"email_verified":true}'::jsonb,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  now(), now()
)
returning id;
```

This bypasses Supabase's auth admin API and `bindAuthUser` entirely. The
trade-off is documented: we duplicate the bind logic in SQL rather than
relying on the first-sign-in side-effect path. The win is determinism —
the command produces fully-wired rows that are visible in the database
the moment the command finishes.

### Transactional discipline

Each command runs its writes inside a single `begin ... commit` block via
the Supabase MCP `execute_sql` tool. On any error, the entire transaction
rolls back. Partial state is not allowed — either all rows exist after
the command or none do.

### Project resolution

`bt1-add-user` lists projects via:

```sql
select p.id, p.name, p.status, t.name as team_name
from public."Project" p join public."Team" t on t.id = p."teamId"
order by t.name, p.name;
```

User picks by index. Name-based input also accepted; ambiguous names
trigger a re-prompt with the matching subset.

### Guards

- `auth.users` already has the email → abort with reset instructions.
- `User.authId` non-null with email match → abort with reset instructions.
- Project not found → re-list and re-prompt.
- Empty required field → re-prompt.

### Output format

Both commands end with a copy-pasteable summary block:

```
Created tyler@originpoint.io (Tyler Heckerman)
  auth_id:    ee1c469f-b933-4ea7-ac33-1e075b9d0d4b
  user_id:    310013c5-cb43-4f3c-9d5f-f20c5a775eb5
  project:    Simple Skin Promo (producer)
  team:       Origin Point (TeamMember added)
  password:   origin

Share creds with the user. They should change the password after first login.
```

## File layout

```
.claude/commands/
  bt1-add-user.md
  bt1-new-team.md
```

Both committed to git. The `.claude/commands/` directory is already
present in the repo (visible in `git status` at the start of this work).

Each command file is a markdown prompt that:

1. Tells Claude what the command does.
2. Lists the prompts in order with defaults and validation rules.
3. Embeds the SQL templates with `$param` placeholders.
4. Specifies the guard conditions and the success-output format.

## Risks / open questions

- **Schema drift.** If `User`, `Project`, `Team`, `ProjectMember`, or
  `TeamMember` columns change, the SQL templates need updating. Mitigation:
  the command files cite the migration that defines the column set; on
  schema PRs touching these tables, update both commands as part of the same PR.
- **Bypassing `bindAuthUser`.** The production sign-in path still calls it.
  If `bindAuthUser` ever gains side-effects beyond row creation (e.g.
  analytics events, default folder seeding, audit log entries), this
  bypass will skip them. Mitigation: revisit the bypass when `bindAuthUser`
  grows side-effects.
- **Password defaulting to `origin`.** Acceptable for the dogfood phase;
  revisit when the user base extends beyond the founding team.
- **No idempotency for partial re-runs.** If the command fails mid-flight
  the transaction rolls back, but the operator must understand they're
  starting clean on retry. Documented in the command's error path.
