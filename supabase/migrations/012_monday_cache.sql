-- Monday.com task cache for offline access and faster loads
-- Synced via webhook or periodic API poll

create table if not exists monday_tasks (
  id text primary key,                  -- Monday item ID
  name text not null,
  board_id text not null,
  board_name text not null,
  group_id text not null,
  group_name text not null,
  status text,
  priority text,
  due_date date,
  timeline_start date,
  timeline_end date,
  assignees jsonb default '[]'::jsonb,  -- [{id, name}]
  column_values jsonb default '{}'::jsonb,
  state text default 'active',          -- active, archived, deleted
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_monday_tasks_board on monday_tasks(board_id);
create index if not exists idx_monday_tasks_due on monday_tasks(due_date) where due_date is not null;
create index if not exists idx_monday_tasks_state on monday_tasks(state);
create index if not exists idx_monday_tasks_synced on monday_tasks(synced_at);

-- Monday webhook events log for debugging
create table if not exists monday_webhook_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  item_id text,
  board_id text,
  payload jsonb,
  processed boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_monday_webhook_log_created on monday_webhook_log(created_at desc);

-- Column mapping configuration per board
create table if not exists monday_column_mappings (
  board_id text primary key,
  board_name text not null,
  status_column_id text,
  date_column_id text,
  priority_column_id text,
  timeline_column_id text,
  custom_mappings jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- RLS policies
alter table monday_tasks enable row level security;
alter table monday_webhook_log enable row level security;
alter table monday_column_mappings enable row level security;

-- Authenticated users can read
create policy "Authenticated users can read monday_tasks"
  on monday_tasks for select to authenticated using (true);

create policy "Authenticated users can read monday_webhook_log"
  on monday_webhook_log for select to authenticated using (true);

create policy "Authenticated users can read monday_column_mappings"
  on monday_column_mappings for select to authenticated using (true);

-- Service role can manage
create policy "Service role manages monday_tasks"
  on monday_tasks for all to service_role using (true) with check (true);

create policy "Service role manages monday_webhook_log"
  on monday_webhook_log for all to service_role using (true) with check (true);

create policy "Service role manages monday_column_mappings"
  on monday_column_mappings for all to service_role using (true) with check (true);
