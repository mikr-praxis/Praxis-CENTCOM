-- Message logs for tracking Slack messages sent/received via CentCom
create table if not exists message_logs (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  channel_name text,
  message_text text not null,
  slack_ts text,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  workflow_id uuid references workflows(id) on delete set null,
  user_id text not null,
  created_at timestamptz default now()
);

-- RLS
alter table message_logs enable row level security;

create policy "Users see own message logs"
  on message_logs for select
  using (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

create policy "Users insert own message logs"
  on message_logs for insert
  with check (user_id = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Index for fast lookups
create index idx_message_logs_user on message_logs(user_id);
create index idx_message_logs_channel on message_logs(channel_id);
create index idx_message_logs_created on message_logs(created_at desc);
