# BT1 User Management Commands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two Claude Code slash commands — `/bt1-add-user` and `/bt1-new-team` — that add Supabase auth users + wire up the `public."User"`, `ProjectMember`, and `TeamMember` rows in one transaction, bypassing email-based onboarding entirely.

**Architecture:** Each command is a single markdown file under `.claude/commands/` containing the prompt sequence, SQL templates, and guards. Both bypass `bindAuthUser` (`apps/back-to-one/src/lib/auth/binding.ts`) and write all rows up front via Supabase MCP `execute_sql` inside a single transaction. Validation is integration-style: synthetic test users get inserted and then torn down against the live Supabase project (`sgnjlzcffaptwzxtbefp`).

**Tech Stack:** Supabase Postgres (`pgcrypto` already loaded — provides `crypt()` and `gen_salt()`), Claude Code slash command runtime, Supabase MCP server.

**Spec:** `docs/superpowers/specs/2026-04-29-bt1-user-management-commands-design.md`

---

## File Structure

```
.claude/commands/
  bt1-add-user.md      ← Task 1
  bt1-new-team.md      ← Task 4
docs/superpowers/plans/
  2026-04-29-bt1-user-management-commands.md   ← this file
```

The `.claude/commands/` directory already exists (untracked at start of this work). Both command files get committed to git so future sessions and subagents pick them up automatically.

---

## Reference Constants

Used across multiple tasks. Embed verbatim where referenced.

**Project ID for tests:** Pick any real seed project. Use this query to find one:

```sql
select id, name from public."Project" where is_demo = true order by name limit 1;
```

**Test email pattern:** `bt1-plan-test-<flow>@example.invalid` — `.invalid` TLD is reserved by RFC 2606 so it can never collide with real users.

**Auth-users insert template:** Used by both commands, identical SQL.

```sql
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  instance_id, aud, role,
  created_at, updated_at
) values (
  gen_random_uuid(), $1, crypt($2, gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"email_verified":true}'::jsonb,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  now(), now()
)
returning id;
```

**Schema invariants confirmed:**
- `User.email` UNIQUE.
- `User.authId` UNIQUE (nullable).
- `ProjectMember` UNIQUE `(projectId, userId, role)` — a person can hold multiple roles on a project.
- `TeamMember` UNIQUE `(teamId, userId)`.
- `Role` enum values: `director, producer, coordinator, writer, crew`.
- `ProjectStatus` enum values: `development, pre_production, production, post_production, archived`.

---

## Task 1: Build `/bt1-add-user` command file

**Files:**
- Create: `.claude/commands/bt1-add-user.md`

- [ ] **Step 1: Write the command file**

Create `.claude/commands/bt1-add-user.md` with this exact content:

````markdown
---
description: Add a Supabase auth login + wire up User/ProjectMember/TeamMember rows for a person on an existing project. No emails sent.
---

# /bt1-add-user

You are creating a Supabase auth login for a person and wiring them into the
public application tables in one transaction. The person is being added to an
**existing** project — for brand-new teams use `/bt1-new-team` instead.

Reference: `apps/back-to-one/src/lib/auth/binding.ts` defines the same logic
that runs at first sign-in. This command does the equivalent up front so the
user is fully wired in the database the moment the command finishes.

Use the Supabase MCP `execute_sql` tool for every database step. The Supabase
project ID for this repo is `sgnjlzcffaptwzxtbefp`. Confirm against
`apps/back-to-one/.env.local` `NEXT_PUBLIC_SUPABASE_URL` if unsure.

## Step 1 — Email

Ask the user: **"Email address?"**

Validate: must contain `@` and a `.`. Re-prompt on failure.

## Step 2 — Lookup existing state

Run:

```sql
select
  u.id          as user_id,
  u."authId"    as user_auth_id,
  u.name        as user_name,
  au.id         as auth_id
from public."User" u
full outer join auth.users au on au.email = u.email
where coalesce(u.email, au.email) = $email;
```

Branch on result:

- **`auth_id` is not null OR `user_auth_id` is not null** → ABORT. Print:

  ```
  <email> already has an auth login.
  Run a password reset instead:

  update auth.users
  set encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf')),
      updated_at = now()
  where email = '<email>';
  ```

  Stop. Do not proceed.

- **`user_id` not null, `user_auth_id` null** → **Flow A** (pre-seeded). Use
  `user_name` as the name. Skip Step 3.

- **No row at all** → **Flow B** (net-new). Continue to Step 3.

## Step 3 — Name (Flow B only)

Ask: **"Full name?"**

Validate: non-empty trimmed string. Re-prompt on empty.

## Step 4 — Project

Run:

```sql
select p.id, p.name, p.status, t.name as team_name
from public."Project" p
join public."Team" t on t.id = p."teamId"
order by t.name, p.name;
```

Print as a numbered list:

```
1. <team_name> / <project.name>  [<status>]
2. ...
```

Ask: **"Which project? (number or name)"**

Resolve to a single `projectId`. If user types a name and it matches multiple
projects, re-prompt with the matching subset only. Capture both `projectId`
and `teamId` (look up the team via the join above).

## Step 5 — Role

Ask: **"Role? [producer | director | coordinator | writer | crew]"**

Default if the user types nothing: `crew`.
Validate: must be one of the five values. Re-prompt on mismatch.

Compute:
- `canEdit` = `true` if role ∈ `{producer, director}`, else `false`.
- `addTeamMember` = `true` if role ∈ `{producer, director}`, else `false`.

## Step 6 — Department (crew only)

Only if role = `crew`. Ask: **"Department? (e.g. Camera, Art, Sound, Wardrobe)"**

Free text, non-empty. Store in `department`. For non-crew roles, set
`department = NULL`.

## Step 7 — Password

Ask: **"Password? [origin]"**

Default if empty: `origin`.

## Step 8 — Execute (single transaction)

### Flow A — existing User row, no authId

```sql
begin;

with new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(), $email, crypt($password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
linked as (
  update public."User"
  set "authId" = (select id from new_auth),
      "updatedAt" = now()
  where email = $email
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  values
    ($projectId, (select id from linked), $role::"Role", $department, $canEdit)
  on conflict ("projectId", "userId", role) do nothing
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select $teamId, (select id from linked), $role::"Role"
where $addTeamMember
on conflict ("teamId", "userId") do nothing;

commit;
```

### Flow B — net-new, no User row

```sql
begin;

with new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(), $email, crypt($password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
new_user as (
  insert into public."User" (id, email, name, "authId", "createdAt", "updatedAt")
  values (gen_random_uuid(), $email, $name, (select id from new_auth), now(), now())
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  values
    ($projectId, (select id from new_user), $role::"Role", $department, $canEdit)
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select $teamId, (select id from new_user), $role::"Role"
where $addTeamMember;

commit;
```

If the SQL returns an error, the transaction has already rolled back. Print the
error message and stop.

## Step 9 — Print summary

After the transaction commits, run:

```sql
select
  u.id      as user_id,
  u.email,
  u.name,
  u."authId" as auth_id,
  pm.role   as project_role,
  pm.department,
  pm."canEdit",
  p.name    as project_name,
  t.name    as team_name,
  exists(
    select 1 from public."TeamMember" tm
    where tm."userId" = u.id and tm."teamId" = p."teamId"
  ) as on_team
from public."User" u
join public."ProjectMember" pm on pm."userId" = u.id
join public."Project" p on p.id = pm."projectId"
join public."Team" t on t.id = p."teamId"
where u.email = $email and pm."projectId" = $projectId;
```

Print to the user:

```
Created <email> (<name>)
  user_id:    <user_id>
  auth_id:    <auth_id>
  project:    <project_name> (<project_role>)
  team:       <team_name>  [TeamMember: yes|no]
  canEdit:    <canEdit>
  password:   <password>

Share creds with the user. They should change the password after first login
via Supabase Auth UI or by you running the password-reset SQL block.
```
````

- [ ] **Step 2: Verify the file is well-formed Markdown**

Run: `head -3 .claude/commands/bt1-add-user.md`

Expected output: front-matter `---` line, `description:` line, closing `---` line.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/bt1-add-user.md
git commit -m "$(cat <<'EOF'
feat(claude): /bt1-add-user slash command

Adds a Supabase auth login + wires User/ProjectMember/TeamMember rows in
one transaction, bypassing the bindAuthUser first-sign-in path. No emails
sent. Two flows: pre-seeded User row (Flow A) or net-new (Flow B).

Spec: docs/superpowers/specs/2026-04-29-bt1-user-management-commands-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Validate `/bt1-add-user` Flow A end-to-end

This task validates the SQL inside the command works against the live database.
We insert a synthetic User row, run the Flow A SQL the command would run, verify
all rows exist as expected, then tear everything down. No commits.

**Files:** None — pure database validation against project `sgnjlzcffaptwzxtbefp`.

- [ ] **Step 1: Pick a target project for the test**

Run via Supabase MCP `execute_sql`:

```sql
select p.id as project_id, p."teamId" as team_id, p.name, t.name as team_name
from public."Project" p join public."Team" t on t.id = p."teamId"
where p.is_demo = true
order by p.name
limit 1;
```

Capture `project_id` and `team_id` from the result. Note them as `$TEST_PROJECT_ID`
and `$TEST_TEAM_ID` for the rest of this task.

- [ ] **Step 2: Insert the synthetic pre-seeded User row (Flow A precondition)**

```sql
insert into public."User" (id, email, name, "createdAt", "updatedAt")
values (
  gen_random_uuid(),
  'bt1-plan-test-flowa@example.invalid',
  'BT1 Test Flow A',
  now(),
  now()
)
returning id;
```

Capture the returned `id` as `$TEST_USER_ID_A`. Email/`authId`/etc. are all NULL.

- [ ] **Step 3: Run the Flow A transaction (mirror what the command does)**

Substitute parameters: `$email = 'bt1-plan-test-flowa@example.invalid'`,
`$password = 'origin'`, `$projectId = $TEST_PROJECT_ID`, `$teamId = $TEST_TEAM_ID`,
`$role = 'producer'`, `$department = NULL`, `$canEdit = true`,
`$addTeamMember = true`.

```sql
begin;

with new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    'bt1-plan-test-flowa@example.invalid',
    crypt('origin', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
linked as (
  update public."User"
  set "authId" = (select id from new_auth), "updatedAt" = now()
  where email = 'bt1-plan-test-flowa@example.invalid'
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  select $TEST_PROJECT_ID, id, 'producer'::"Role", NULL, true from linked
  on conflict ("projectId", "userId", role) do nothing
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select $TEST_TEAM_ID, id, 'producer'::"Role" from linked
on conflict ("teamId", "userId") do nothing;

commit;
```

Replace `$TEST_PROJECT_ID` and `$TEST_TEAM_ID` literals before running.

Expected: `COMMIT` succeeds, no errors.

- [ ] **Step 4: Verify rows**

```sql
select
  u.id, u.email, u.name, u."authId" is not null as has_auth_id,
  au.encrypted_password = crypt('origin', au.encrypted_password) as pw_matches,
  au.email_confirmed_at is not null as email_confirmed,
  exists(select 1 from public."ProjectMember" pm
         where pm."userId" = u.id and pm.role = 'producer') as has_pm,
  exists(select 1 from public."TeamMember" tm
         where tm."userId" = u.id and tm.role = 'producer') as has_tm
from public."User" u
left join auth.users au on au.id = u."authId"
where u.email = 'bt1-plan-test-flowa@example.invalid';
```

Expected (single row): `has_auth_id = true`, `pw_matches = true`,
`email_confirmed = true`, `has_pm = true`, `has_tm = true`.

If any boolean is false, the command's SQL is broken — go back to Task 1 and fix
before proceeding.

- [ ] **Step 5: Tear down**

```sql
delete from public."TeamMember"
  where "userId" in (select id from public."User" where email = 'bt1-plan-test-flowa@example.invalid');
delete from public."ProjectMember"
  where "userId" in (select id from public."User" where email = 'bt1-plan-test-flowa@example.invalid');
delete from auth.users where email = 'bt1-plan-test-flowa@example.invalid';
delete from public."User" where email = 'bt1-plan-test-flowa@example.invalid';
```

Verify cleanup:

```sql
select
  (select count(*) from public."User" where email = 'bt1-plan-test-flowa@example.invalid') as user_rows,
  (select count(*) from auth.users where email = 'bt1-plan-test-flowa@example.invalid') as auth_rows;
```

Expected: both counts = 0.

- [ ] **Step 6: No commit**

This task validates behavior; nothing on disk changed. Skip the git step.

---

## Task 3: Validate `/bt1-add-user` Flow B end-to-end

Same shape as Task 2 but for the net-new path (no pre-existing User row).

**Files:** None — database validation only.

- [ ] **Step 1: Use the project/team IDs from Task 2**

Re-run the project lookup from Task 2 Step 1 if you don't still have them.
Capture as `$TEST_PROJECT_ID` and `$TEST_TEAM_ID`.

- [ ] **Step 2: Confirm no User row exists for the test email**

```sql
select count(*) from public."User" where email = 'bt1-plan-test-flowb@example.invalid';
```

Expected: `0`. If non-zero, delete the row before proceeding.

- [ ] **Step 3: Run the Flow B transaction**

Parameters: `$email = 'bt1-plan-test-flowb@example.invalid'`, `$name = 'BT1 Test Flow B'`,
`$password = 'origin'`, `$projectId = $TEST_PROJECT_ID`, `$teamId = $TEST_TEAM_ID`,
`$role = 'crew'`, `$department = 'Camera'`, `$canEdit = false`, `$addTeamMember = false`.

```sql
begin;

with new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    'bt1-plan-test-flowb@example.invalid',
    crypt('origin', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
new_user as (
  insert into public."User" (id, email, name, "authId", "createdAt", "updatedAt")
  values (
    gen_random_uuid(),
    'bt1-plan-test-flowb@example.invalid',
    'BT1 Test Flow B',
    (select id from new_auth),
    now(), now()
  )
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  select $TEST_PROJECT_ID, id, 'crew'::"Role", 'Camera', false from new_user
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select $TEST_TEAM_ID, id, 'crew'::"Role" from new_user
where false;  -- crew never gets TeamMember

commit;
```

Substitute the literal `$TEST_PROJECT_ID` / `$TEST_TEAM_ID` before running.

Expected: `COMMIT` succeeds.

- [ ] **Step 4: Verify rows**

```sql
select
  u.id, u.email, u.name, u."authId" is not null as has_auth_id,
  au.encrypted_password = crypt('origin', au.encrypted_password) as pw_matches,
  pm.role as pm_role, pm.department as pm_department, pm."canEdit",
  exists(select 1 from public."TeamMember" tm where tm."userId" = u.id) as has_tm
from public."User" u
left join auth.users au on au.id = u."authId"
left join public."ProjectMember" pm on pm."userId" = u.id
where u.email = 'bt1-plan-test-flowb@example.invalid';
```

Expected: `has_auth_id = true`, `pw_matches = true`, `pm_role = 'crew'`,
`pm_department = 'Camera'`, `canEdit = false`, `has_tm = false`.

- [ ] **Step 5: Tear down**

```sql
delete from public."ProjectMember"
  where "userId" in (select id from public."User" where email = 'bt1-plan-test-flowb@example.invalid');
delete from auth.users where email = 'bt1-plan-test-flowb@example.invalid';
delete from public."User" where email = 'bt1-plan-test-flowb@example.invalid';
```

Verify counts both zero with the same query as Task 2 Step 5 (substitute the
flowb email).

- [ ] **Step 6: No commit**

---

## Task 4: Build `/bt1-new-team` command file

**Files:**
- Create: `.claude/commands/bt1-new-team.md`

- [ ] **Step 1: Write the command file**

Create `.claude/commands/bt1-new-team.md` with this exact content:

````markdown
---
description: Create a brand-new Team + first Project + first producer login in one transaction. Use /bt1-add-user to add people to existing projects.
---

# /bt1-new-team

You are creating a brand-new Team, its first Project, and the first producer's
auth login — all wired together in one transaction. For adding additional
people to an existing project, use `/bt1-add-user`.

Use the Supabase MCP `execute_sql` tool. Project ID:
`sgnjlzcffaptwzxtbefp` (confirm via `apps/back-to-one/.env.local` if unsure).

Ask one question at a time. Use defaults when the user replies empty.

## Step 1 — Team name

Ask: **"Team name?"**
Validate: non-empty trimmed.

## Step 2 — First project name

Ask: **"First project name?"**
Validate: non-empty trimmed.

## Step 3 — Project status

Ask: **"Project status? [development | pre_production | production | post_production | archived]"**
Default: `development`. Re-prompt if not in the enum.

## Step 4 — Client (optional)

Ask: **"Client name? (optional, hit enter to skip)"**
Empty input is fine — store as NULL.

## Step 5 — Producer email

Ask: **"Producer email?"**

Validate format. Then check for existing auth login:

```sql
select
  (select count(*) from public."User" where email = $email and "authId" is not null) as already_linked,
  (select count(*) from auth.users where email = $email) as auth_rows;
```

If either count > 0 → ABORT with the same password-reset block as
`/bt1-add-user` Step 2. Stop.

## Step 6 — Producer name

Ask: **"Producer full name?"**
Validate: non-empty.

## Step 7 — Password

Ask: **"Password? [origin]"**
Default: `origin`.

## Step 8 — Execute (single transaction)

```sql
begin;

with new_team as (
  insert into public."Team" (id, name, "createdAt", "updatedAt")
  values (gen_random_uuid(), $teamName, now(), now())
  returning id
),
new_project as (
  insert into public."Project"
    (id, "teamId", name, status, client, color, is_demo, "createdAt", "updatedAt")
  values
    (gen_random_uuid(), (select id from new_team), $projectName,
     $status::"ProjectStatus", $client, NULL, false, now(), now())
  returning id
),
new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(), $email, crypt($password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
new_user as (
  insert into public."User" (id, email, name, "authId", "createdAt", "updatedAt")
  values (gen_random_uuid(), $email, $name, (select id from new_auth), now(), now())
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  values
    ((select id from new_project), (select id from new_user),
     'producer'::"Role", NULL, true)
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select (select id from new_team), (select id from new_user), 'producer'::"Role";

commit;
```

If any error, the transaction rolls back. Print the error and stop.

## Step 9 — Print summary

```sql
select
  t.id as team_id, t.name as team_name,
  p.id as project_id, p.name as project_name, p.status,
  u.id as user_id, u.email, u.name, u."authId" as auth_id
from public."Team" t
join public."Project" p on p."teamId" = t.id
join public."ProjectMember" pm on pm."projectId" = p.id and pm.role = 'producer'
join public."User" u on u.id = pm."userId"
where u.email = $email
order by t."createdAt" desc
limit 1;
```

Print:

```
Team created:    <team_name>  (<team_id>)
Project created: <project_name>  [<status>]  (<project_id>)
Producer login:  <email> / <password>
  user_id: <user_id>
  auth_id: <auth_id>

Share creds with the producer. They should change the password after first
login.
```
````

- [ ] **Step 2: Verify the file is well-formed**

Run: `head -3 .claude/commands/bt1-new-team.md`

Expected: front-matter delimiter, `description:` line, closing delimiter.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/bt1-new-team.md
git commit -m "$(cat <<'EOF'
feat(claude): /bt1-new-team slash command

Creates a brand-new Team + first Project + first producer auth login in
one transaction. Companion to /bt1-add-user, which adds people to existing
projects.

Spec: docs/superpowers/specs/2026-04-29-bt1-user-management-commands-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Validate `/bt1-new-team` end-to-end

**Files:** None — database validation only.

- [ ] **Step 1: Confirm no test team exists**

```sql
select count(*) from public."Team" where name = 'BT1 Plan Test Team';
select count(*) from public."User" where email = 'bt1-plan-test-team@example.invalid';
```

Expected: both 0. If either is nonzero, run the teardown from Step 4 first.

- [ ] **Step 2: Run the new-team transaction**

Parameters: `$teamName = 'BT1 Plan Test Team'`, `$projectName = 'BT1 Plan Test Project'`,
`$status = 'development'`, `$client = NULL`,
`$email = 'bt1-plan-test-team@example.invalid'`, `$name = 'BT1 Plan Test Producer'`,
`$password = 'origin'`.

```sql
begin;

with new_team as (
  insert into public."Team" (id, name, "createdAt", "updatedAt")
  values (gen_random_uuid(), 'BT1 Plan Test Team', now(), now())
  returning id
),
new_project as (
  insert into public."Project"
    (id, "teamId", name, status, client, color, is_demo, "createdAt", "updatedAt")
  values
    (gen_random_uuid(), (select id from new_team), 'BT1 Plan Test Project',
     'development'::"ProjectStatus", NULL, NULL, false, now(), now())
  returning id
),
new_auth as (
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    instance_id, aud, role,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    'bt1-plan-test-team@example.invalid',
    crypt('origin', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    now(), now()
  )
  returning id
),
new_user as (
  insert into public."User" (id, email, name, "authId", "createdAt", "updatedAt")
  values (
    gen_random_uuid(),
    'bt1-plan-test-team@example.invalid',
    'BT1 Plan Test Producer',
    (select id from new_auth),
    now(), now()
  )
  returning id
),
pm as (
  insert into public."ProjectMember"
    ("projectId", "userId", role, department, "canEdit")
  values
    ((select id from new_project), (select id from new_user),
     'producer'::"Role", NULL, true)
  returning id
)
insert into public."TeamMember" ("teamId", "userId", role)
select (select id from new_team), (select id from new_user), 'producer'::"Role";

commit;
```

Expected: `COMMIT` succeeds.

- [ ] **Step 3: Verify the full graph**

```sql
select
  t.id as team_id, t.name as team_name,
  p.id as project_id, p.name as project_name, p.status,
  u.id as user_id, u.email, u.name, u."authId" is not null as has_auth,
  au.encrypted_password = crypt('origin', au.encrypted_password) as pw_matches,
  au.email_confirmed_at is not null as confirmed,
  pm.role as pm_role, pm."canEdit" as pm_can_edit,
  tm.role as tm_role
from public."Team" t
join public."Project" p on p."teamId" = t.id
join public."ProjectMember" pm on pm."projectId" = p.id
join public."User" u on u.id = pm."userId"
join public."TeamMember" tm on tm."userId" = u.id and tm."teamId" = t.id
left join auth.users au on au.id = u."authId"
where t.name = 'BT1 Plan Test Team';
```

Expected: exactly one row with `has_auth = true`, `pw_matches = true`,
`confirmed = true`, `pm_role = 'producer'`, `pm_can_edit = true`,
`tm_role = 'producer'`, status `'development'`.

If any field is wrong, fix the command file before tearing down.

- [ ] **Step 4: Tear down**

```sql
delete from public."TeamMember"
  where "userId" in (select id from public."User" where email = 'bt1-plan-test-team@example.invalid');
delete from public."ProjectMember"
  where "userId" in (select id from public."User" where email = 'bt1-plan-test-team@example.invalid');
delete from auth.users where email = 'bt1-plan-test-team@example.invalid';
delete from public."User" where email = 'bt1-plan-test-team@example.invalid';
delete from public."Project" where name = 'BT1 Plan Test Project';
delete from public."Team" where name = 'BT1 Plan Test Team';
```

Verify cleanup:

```sql
select
  (select count(*) from public."Team" where name = 'BT1 Plan Test Team') as teams,
  (select count(*) from public."Project" where name = 'BT1 Plan Test Project') as projects,
  (select count(*) from public."User" where email = 'bt1-plan-test-team@example.invalid') as users,
  (select count(*) from auth.users where email = 'bt1-plan-test-team@example.invalid') as auth_users;
```

Expected: all four counts = 0.

- [ ] **Step 5: No commit**

---

## Task 6: Final handoff

**Files:** None.

- [ ] **Step 1: Confirm both command files are committed**

```bash
git log --oneline -3 .claude/commands/
```

Expected: two commits (one for `bt1-add-user.md`, one for `bt1-new-team.md`),
plus possibly the spec commit if listed.

- [ ] **Step 2: Confirm working tree is clean (no leftover validation rows in git)**

```bash
git status -sb
```

Expected: clean working tree (or only untracked files unrelated to this work).

- [ ] **Step 3: Print user-facing summary**

Tell Clyde:

```
Done. Two new slash commands live on main:

  /bt1-add-user   — add a person to an existing project (Flow A or B)
  /bt1-new-team   — new Team + first Project + first producer login

Both default the password to `origin`. Neither sends email. Run them in this
repo and Claude will prompt you through the steps.

Note: command files are picked up the next time you start a Claude Code
session in this repo. Restart Claude Code (or open a new session) to see the
commands appear.
```

---

## Self-review notes

Spec coverage check (vs `docs/superpowers/specs/2026-04-29-bt1-user-management-commands-design.md`):

- "Two slash commands in `.claude/commands/`" → Tasks 1 + 4.
- "`/bt1-add-user` prompts (1–7) and Flow A/B branching" → Task 1 command file.
- "`/bt1-new-team` prompts and single-transaction insert chain" → Task 4 command file.
- "Auth user creation pattern (the Tyler-fix SQL)" → Reference Constants block + both command files.
- "Single `begin … commit` per command, rollback on failure" → embedded in both commands.
- "Project resolution by index or name with re-prompt on ambiguity" → Task 1 Step 4.
- "Guards: existing auth user → abort with reset block" → Task 1 Step 2 / Task 4 Step 5.
- "Output format with copy-pasteable summary" → Task 1 Step 9 / Task 4 Step 9.
- "File layout under `.claude/commands/`" → Tasks 1 + 4.
- "Schema-drift risk" → mitigated by integration validation in Tasks 2, 3, 5; if columns change, validation will fail loudly.

No placeholders, all SQL is concrete, all expected outputs are explicit, and
Role/ProjectStatus enum values match the schema as confirmed in the
Reference Constants block.
