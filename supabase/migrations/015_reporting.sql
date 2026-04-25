-- Reporting module
-- Drive-backed per-client reporting with adjustable KPIs and share tokens.

-- 1. Add Drive folder pointer to clients
alter table clients
  add column if not exists drive_folder_id text;

-- 2. Cached raw files synced from Drive (one row per Drive file per client)
create table if not exists report_raw_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  drive_file_id text not null,
  filename text not null,
  mime_type text,
  modified_time timestamptz,
  last_synced_at timestamptz default now(),
  columns jsonb default '[]',
  rows jsonb default '[]',
  row_count int default 0,
  unique (client_id, drive_file_id)
);

create index if not exists idx_report_raw_files_client
  on report_raw_files(client_id, modified_time desc);

-- 3. KPI definitions (per-client, with optional global defaults via client_id null)
create table if not exists report_kpis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade, -- nullable: null = global default
  key text not null,
  display_name text not null,
  description text,
  formula jsonb not null,
  format text not null default 'count' check (format in ('count','currency','percent','ratio')),
  target numeric,
  viz_type text not null default 'card' check (viz_type in ('card','line','bar','pie','table')),
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_report_kpis_client
  on report_kpis(client_id, display_order);

-- 4. Share tokens for client-facing read-only access
create table if not exists report_share_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  token text unique not null,
  label text,
  created_by text,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_report_share_tokens_token
  on report_share_tokens(token);
create index if not exists idx_report_share_tokens_client
  on report_share_tokens(client_id, revoked_at);

-- 5. RLS — service role only (mirror app_config)
alter table report_raw_files enable row level security;
alter table report_kpis enable row level security;
alter table report_share_tokens enable row level security;
-- No public policies; service role bypasses RLS.
