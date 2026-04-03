create table workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schedule text,
  status text check (status in ('active', 'paused')) default 'active',
  platform text default 'Slack',
  last_run timestamptz,
  run_count int default 0,
  user_id text not null,
  created_at timestamptz default now()
);
alter table workflows enable row level security;
create policy "Users see own workflows" on workflows for all using (user_id = auth.jwt()->>'sub');
