-- Task milestones: CENTCOM-defined steps/milestones linked to Monday.com tasks
-- These are managed in Praxis, not pulled from Monday subitems

create table if not exists task_milestones (
  id uuid primary key default gen_random_uuid(),
  monday_task_id text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  sort_order integer not null default 0,
  due_date date,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups by Monday task ID
create index if not exists idx_task_milestones_monday_task_id on task_milestones (monday_task_id);

-- Index for user-scoped queries
create index if not exists idx_task_milestones_user_id on task_milestones (user_id);

-- RLS policies
alter table task_milestones enable row level security;

create policy "Users can view their own milestones"
  on task_milestones for select using (auth.uid()::text = user_id);

create policy "Users can insert their own milestones"
  on task_milestones for insert with check (auth.uid()::text = user_id);

create policy "Users can update their own milestones"
  on task_milestones for update using (auth.uid()::text = user_id);

create policy "Users can delete their own milestones"
  on task_milestones for delete using (auth.uid()::text = user_id);
