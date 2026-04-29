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
