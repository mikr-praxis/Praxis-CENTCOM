-- GitHub OAuth tokens for per-user GitHub account connections
-- Each user can connect one GitHub account for repo access.

create table if not exists github_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  github_username text not null,
  github_id bigint not null,
  access_token text not null,
  token_scope text not null default '',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table github_tokens enable row level security;

create policy "Users manage own GitHub tokens" on github_tokens for all
  using (user_id = current_setting('request.jwt.claims')::json->>'sub');

create index if not exists idx_github_tokens_user on github_tokens(user_id);
create index if not exists idx_github_tokens_gh_id on github_tokens(github_id);
