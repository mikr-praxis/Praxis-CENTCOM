-- Google OAuth tokens for user calendar connections
-- Each user can connect one Google account for calendar sync.

create table if not exists google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table google_tokens enable row level security;

create policy "Users manage own tokens" on google_tokens for all
  using (user_id = current_setting('request.jwt.claims')::json->>'sub');

create index if not exists idx_google_tokens_user on google_tokens(user_id);
