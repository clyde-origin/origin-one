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
