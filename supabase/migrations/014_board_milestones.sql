-- Board-level milestones: numbered project milestones linked to Monday.com tasks
-- Each milestone belongs to a board (project) and optionally links to a specific task

create table if not exists board_milestones (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  milestone_number integer not null,
  title text not null default '',
  monday_task_id text,
  task_name text,
  assignee_name text,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_board_milestones_board_id on board_milestones (board_id);
create index if not exists idx_board_milestones_user_id on board_milestones (user_id);

alter table board_milestones enable row level security;

create policy "Users can view their own board milestones"
  on board_milestones for select using (true);

create policy "Users can insert board milestones"
  on board_milestones for insert with check (true);

create policy "Users can update board milestones"
  on board_milestones for update using (true);

create policy "Users can delete board milestones"
  on board_milestones for delete using (true);
