-- ══════════════════════════════════════════════════════════
-- ORIGIN ONE — INITIAL SCHEMA v2
-- Updated to match full planning spec
-- Run this, then run 002_seed_data.sql
-- ══════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── PROJECTS ───────────────────────────────────────────────

create table projects (
  id               text primary key,
  name             text not null,
  type             text not null default 'Commercial',
  client           text not null default '',
  company          text not null default 'Origin Point',
  phase            text not null default 'prod'
                   check (phase in ('pre','prod','post')),
  status           text not null default 'In Production',
  logline          text not null default '',
  runtime_target   text,
  aspect_ratio     text,
  capture_format   text,
  start_date       date,
  shoot_date       date,
  shoot_date_end   date,
  delivery_date    date,
  scene_count      integer not null default 0,
  shot_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── CREW ───────────────────────────────────────────────────

create table crew_members (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  first       text not null,
  last        text not null,
  role        text not null,
  dept        text not null,
  color1      text not null default '#1a1040',
  color2      text not null default '#0e1640',
  online      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index crew_members_project_id_idx on crew_members(project_id);

-- ── ACTION ITEMS ───────────────────────────────────────────

create table action_items (
  id           text primary key,
  project_id   text not null references projects(id) on delete cascade,
  name         text not null,
  dept         text not null default 'Production',
  assignee_id  text references crew_members(id) on delete set null,
  due_date     date,
  notes        text not null default '',
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index action_items_project_id_idx on action_items(project_id);

-- ── MILESTONES ─────────────────────────────────────────────

create table milestones (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  name        text not null,
  phase       text not null check (phase in ('pre','prod','post')),
  dept        text not null default 'Production',
  date        date not null,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
create table milestone_people (
  milestone_id  text not null references milestones(id) on delete cascade,
  crew_id       text not null references crew_members(id) on delete cascade,
  primary key (milestone_id, crew_id)
);
create index milestones_project_id_idx on milestones(project_id);

-- ── SCENEMAKER ─────────────────────────────────────────────

create table sm_versions (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  label       text not null default 'v1',
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table sm_scenes (
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  version_id  text not null references sm_versions(id) on delete cascade,
  num         integer not null,
  heading     text not null,
  action      jsonb not null default '[]',
  dialogue    jsonb not null default '[]',
  action2     jsonb not null default '[]',
  dialogue2   jsonb not null default '[]',
  action3     jsonb not null default '[]',
  dialogue3   jsonb not null default '[]',
  action4     jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

create table sm_shots (
  id           text primary key,
  project_id   text not null references projects(id) on delete cascade,
  version_id   text not null references sm_versions(id) on delete cascade,
  scene_id     text not null references sm_scenes(id) on delete cascade,
  story_order  integer not null,
  shoot_order  integer not null,
  desc         text not null default '',
  framing      text not null default '',
  movement     text not null default '',
  lens         text not null default '',
  dir_notes    text not null default '',
  prod_notes   text not null default '',
  elements     jsonb not null default '[]',
  images       jsonb not null default '[]',
  status       text not null default 'planned'
               check (status in ('planned','captured','approved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index sm_shots_scene_id_idx   on sm_shots(scene_id);
create index sm_shots_version_id_idx on sm_shots(version_id);

-- ── MOODBOARD ──────────────────────────────────────────────

create table moodboard_refs (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references projects(id) on delete cascade,
  cat         text not null check (cat in ('tone','visual','product','music')),
  title       text not null,
  note        text not null default '',
  image_url   text,
  gradient    text not null default '',
  created_at  timestamptz not null default now()
);
create index moodboard_refs_project_id_idx on moodboard_refs(project_id);

-- ── LOCATIONS ──────────────────────────────────────────────

create table location_groups (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references projects(id) on delete cascade,
  script_location  text not null,
  type             text not null default 'Practical',
  created_at       timestamptz not null default now()
);
create table location_options (
  id                text primary key default gen_random_uuid()::text,
  location_group_id text not null references location_groups(id) on delete cascade,
  name              text not null,
  status            text not null default 'Scouted'
                    check (status in ('Scouted','Option','Selected','Confirmed')),
  gradient          text not null default '',
  note              text not null default '',
  created_at        timestamptz not null default now()
);
create index location_groups_project_id_idx on location_groups(project_id);

-- ── CASTING ────────────────────────────────────────────────

create table cast_roles (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references projects(id) on delete cascade,
  name        text not null,
  desc        text not null default '',
  status      text not null default 'Uncast'
              check (status in ('Uncast','Hold','Confirmed')),
  scenes      jsonb not null default '[]',
  talent      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index cast_roles_project_id_idx on cast_roles(project_id);

-- ── ART ────────────────────────────────────────────────────

create table art_items (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references projects(id) on delete cascade,
  name        text not null,
  cat         text not null check (cat in ('props','hmu','wardrobe')),
  status      text not null default 'In Progress'
              check (status in ('In Progress','Ready','Approved','Needs Review')),
  note        text not null default '',
  gradient    text not null default '',
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index art_items_project_id_idx on art_items(project_id);

-- ── THREADS ────────────────────────────────────────────────

create table threads (
  id             text primary key default gen_random_uuid()::text,
  project_id     text not null references projects(id) on delete cascade,
  context_type   text not null default 'general',
  context_label  text not null default '',
  context_ref    text not null default '',
  subject        text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table thread_messages (
  id          text primary key default gen_random_uuid()::text,
  thread_id   text not null references threads(id) on delete cascade,
  author_id   text references crew_members(id) on delete set null,
  tagged      jsonb not null default '[]',
  text        text not null,
  created_at  timestamptz not null default now()
);
create index threads_project_id_idx         on threads(project_id);
create index thread_messages_thread_id_idx  on thread_messages(thread_id);

-- ── RESOURCES ──────────────────────────────────────────────

create table resources (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references projects(id) on delete cascade,
  cat         text not null,
  type        text not null,
  title       text not null,
  meta        text not null default '',
  url         text not null default '#',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index resources_project_id_idx on resources(project_id);

-- ── WORKFLOW NODES ─────────────────────────────────────────

create table workflow_nodes (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references projects(id) on delete cascade,
  label       text not null,
  type        text not null,
  phase       text not null,
  note        text not null default '',
  "order"     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workflow_nodes_project_id_idx on workflow_nodes(project_id);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────────

create or replace function handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_updated_at before update on projects
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on action_items
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on sm_shots
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on cast_roles
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on art_items
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on threads
  for each row execute procedure handle_updated_at();
create trigger set_updated_at before update on workflow_nodes
  for each row execute procedure handle_updated_at();

-- ── RLS — open for now, tighten at auth phase ──────────────

alter table projects        enable row level security;
alter table crew_members    enable row level security;
alter table action_items    enable row level security;
alter table milestones      enable row level security;
alter table sm_versions     enable row level security;
alter table sm_scenes       enable row level security;
alter table sm_shots        enable row level security;
alter table moodboard_refs  enable row level security;
alter table location_groups enable row level security;
alter table location_options enable row level security;
alter table cast_roles      enable row level security;
alter table art_items       enable row level security;
alter table threads         enable row level security;
alter table thread_messages enable row level security;
alter table resources       enable row level security;
alter table workflow_nodes  enable row level security;

create policy "open" on projects        for all using (true) with check (true);
create policy "open" on crew_members    for all using (true) with check (true);
create policy "open" on action_items    for all using (true) with check (true);
create policy "open" on milestones      for all using (true) with check (true);
create policy "open" on sm_versions     for all using (true) with check (true);
create policy "open" on sm_scenes       for all using (true) with check (true);
create policy "open" on sm_shots        for all using (true) with check (true);
create policy "open" on moodboard_refs  for all using (true) with check (true);
create policy "open" on location_groups for all using (true) with check (true);
create policy "open" on location_options for all using (true) with check (true);
create policy "open" on cast_roles      for all using (true) with check (true);
create policy "open" on art_items       for all using (true) with check (true);
create policy "open" on threads         for all using (true) with check (true);
create policy "open" on thread_messages for all using (true) with check (true);
create policy "open" on resources       for all using (true) with check (true);
create policy "open" on workflow_nodes  for all using (true) with check (true);
