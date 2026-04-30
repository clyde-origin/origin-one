-- ── Notification ─────────────────────────────────────────────
create table "Notification" (
  id            text primary key default gen_random_uuid()::text,
  "userId"       text not null,
  "projectId"    text not null,
  "sourceType"   text not null,
  "sourceId"     text not null,
  "actorId"      text not null,
  excerpt       text not null,
  "contextLabel" text not null,
  "readAt"       timestamptz,
  "createdAt"    timestamptz not null default now(),
  constraint "Notification_userId_fkey"    foreign key ("userId")    references "User"(id) on delete cascade,
  constraint "Notification_projectId_fkey" foreign key ("projectId") references "Project"(id) on delete cascade,
  constraint "Notification_actorId_fkey"   foreign key ("actorId")   references "User"(id)
);
create index "Notification_user_project_unread_idx" on "Notification" ("userId", "projectId", "readAt", "createdAt" desc);
create index "Notification_user_unread_idx"          on "Notification" ("userId", "readAt", "createdAt" desc);
create index "Notification_source_idx"               on "Notification" ("sourceType", "sourceId");

alter table "Notification" enable row level security;

create policy "Notification_select_own"
  on "Notification" for select
  using ("userId" = (select auth.uid()::text));

-- TODO(Auth-day): tighten this insert policy as part of the #24 RLS pass.
-- Currently any authenticated user can insert a Notification with arbitrary
-- userId/actorId. Auth-day target: with check (
--   "actorId"  = (select auth.uid()::text)
--   AND "userId" <> (select auth.uid()::text)
--   AND public.is_project_member("projectId", (select auth.uid()))
-- )
create policy "Notification_insert_authenticated"
  on "Notification" for insert
  with check ((select auth.role()) = 'authenticated');

create policy "Notification_update_own"
  on "Notification" for update
  using ("userId" = (select auth.uid()::text))
  with check ("userId" = (select auth.uid()::text));

-- ── PushSubscription ────────────────────────────────────────
create table "PushSubscription" (
  id          text primary key default gen_random_uuid()::text,
  "userId"     text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  "userAgent"  text,
  "createdAt"  timestamptz not null default now(),
  constraint "PushSubscription_userId_fkey" foreign key ("userId") references "User"(id) on delete cascade
);
create index "PushSubscription_user_idx" on "PushSubscription" ("userId");

alter table "PushSubscription" enable row level security;

create policy "PushSubscription_select_own"
  on "PushSubscription" for select
  using ("userId" = (select auth.uid()::text));

create policy "PushSubscription_insert_own"
  on "PushSubscription" for insert
  with check ("userId" = (select auth.uid()::text));

create policy "PushSubscription_delete_own"
  on "PushSubscription" for delete
  using ("userId" = (select auth.uid()::text));

-- ── mentions[] columns on five source tables ────────────────
alter table "ChatMessage"   add column mentions text[] not null default '{}';
alter table "ThreadMessage" add column mentions text[] not null default '{}';
alter table "ActionItem"    add column mentions text[] not null default '{}';
alter table "Milestone"     add column mentions text[] not null default '{}';
alter table "ShootDay"      add column mentions text[] not null default '{}';

-- ── Add Notification to realtime publication ────────────────
alter publication supabase_realtime add table "Notification";
