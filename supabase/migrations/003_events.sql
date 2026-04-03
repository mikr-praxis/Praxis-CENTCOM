create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time time,
  duration text,
  event_type text default 'internal',
  attendees int default 1,
  user_id text not null,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "Users see own events" on events for all using (user_id = auth.jwt()->>'sub');
