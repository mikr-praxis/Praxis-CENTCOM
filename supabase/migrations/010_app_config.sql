-- App-wide configuration store
-- Values saved here override process.env equivalents at runtime.
-- This lets admins configure modules from the UI without redeploying.

create table if not exists app_config (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,              -- stored as text; sensitive values are never sent to the client
  updated_by text,                  -- clerk user_id of last editor
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: only authenticated users with service role can read/write
-- (the server client uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS,
--  so this table is effectively admin-only via server actions)
alter table app_config enable row level security;

-- No public policies — only service_role can access
-- This means the anon key and user JWTs cannot read or write this table.
