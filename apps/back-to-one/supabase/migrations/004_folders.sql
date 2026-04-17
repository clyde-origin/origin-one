-- ══════════════════════════════════════════════════════════
-- ORIGIN ONE — FOLDERS + PROJECT ORDERING
-- ══════════════════════════════════════════════════════════

-- Folders table
create table if not exists folders (
  id         text primary key,
  name       text not null,
  color      text not null default '#c45adc',
  logo_url   text,
  "order"    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add folder_id and display_order to projects
alter table projects add column if not exists folder_id text references folders(id) on delete set null;
alter table projects add column if not exists display_order integer not null default 0;

create index if not exists projects_folder_id_idx on projects(folder_id);
create index if not exists folders_order_idx on folders("order");

-- RLS (open, same as rest of app)
alter table folders enable row level security;
create policy "folders_open_select" on folders for select using (true);
create policy "folders_open_insert" on folders for insert with check (true);
create policy "folders_open_update" on folders for update using (true);
create policy "folders_open_delete" on folders for delete using (true);
