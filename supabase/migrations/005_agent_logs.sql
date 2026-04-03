create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  agent_name text,
  output text,
  approved boolean default false,
  user_id text not null,
  created_at timestamptz default now()
);
alter table agent_logs enable row level security;
create policy "Users see own logs" on agent_logs for all using (user_id = auth.jwt()->>'sub');
