create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text check (status in ('planned', 'in-progress', 'complete')) default 'planned',
  category text check (category in ('core', 'integration', 'infrastructure', 'ai')) default 'core',
  progress int check (progress >= 0 and progress <= 100) default 0,
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  target_date date,
  user_id text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users see own projects" on projects for all using (true);
