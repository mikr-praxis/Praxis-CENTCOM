create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  status text check (status in ('todo', 'inprogress', 'review', 'done')) default 'todo',
  assignee text,
  due_date date,
  tag text,
  user_id text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table tasks enable row level security;
create policy "Users see own tasks" on tasks for all using (user_id = auth.jwt()->>'sub');
